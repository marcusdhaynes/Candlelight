
-- Candlelight Round 10: private server-side alert event and execution-intent foundations.
-- Never expose through Data API or grant public roles.
CREATE TABLE app_candlelight.market_alert_rules(
  rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(length(provider) BETWEEN 1 AND 100),
  market_id text NOT NULL CHECK(length(market_id) BETWEEN 1 AND 256),
  stream_scope text NOT NULL CHECK(length(stream_scope) BETWEEN 1 AND 128),
  condition text NOT NULL CHECK(condition IN ('crosses_above','crosses_below','greater_than','less_than')),
  threshold numeric(38,16) NOT NULL CHECK(threshold > 0),
  status text NOT NULL DEFAULT 'paused' CHECK(status IN ('active','paused','deleted')),
  max_triggers integer NOT NULL DEFAULT 1 CHECK(max_triggers BETWEEN 1 AND 100000),
  trigger_count integer NOT NULL DEFAULT 0 CHECK(trigger_count >= 0),
  last_price numeric(38,16) CHECK(last_price IS NULL OR last_price > 0),
  last_event_id uuid REFERENCES app_candlelight.market_event_journal(event_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(trigger_count <= max_triggers)
);
CREATE INDEX candlelight_market_alert_active_idx
 ON app_candlelight.market_alert_rules(provider,market_id,stream_scope)
 WHERE status='active';

CREATE TABLE app_candlelight.market_alert_outbox(
  outbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES app_candlelight.market_alert_rules(rule_id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_event_id uuid NOT NULL REFERENCES app_candlelight.market_event_journal(event_id) ON DELETE RESTRICT,
  triggered_price numeric(38,16) NOT NULL CHECK(triggered_price > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','processing','delivered','failed','dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered_at timestamptz,
  UNIQUE(rule_id,market_event_id)
);
CREATE INDEX candlelight_market_alert_outbox_pending_idx
 ON app_candlelight.market_alert_outbox(status,next_attempt_at) WHERE status IN ('pending','failed');

CREATE TABLE app_candlelight.execution_intents(
  intent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_key text NOT NULL CHECK(length(account_key) BETWEEN 1 AND 200),
  client_command_id text NOT NULL CHECK(length(client_command_id) BETWEEN 1 AND 200),
  market_id text NOT NULL CHECK(length(market_id) BETWEEN 1 AND 256),
  order_action text NOT NULL CHECK(order_action IN ('buy','sell','cancel','replace')),
  quantity numeric(38,16) CHECK(quantity IS NULL OR quantity > 0),
  limit_price numeric(38,16) CHECK(limit_price IS NULL OR limit_price > 0),
  state text NOT NULL DEFAULT 'staged' CHECK(state IN
    ('staged','risk_rejected','ready','dispatching','uncertain','acknowledged','partially_filled','filled','cancelled','failed')),
  broker_order_id text,
  risk_policy_snapshot jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(owner_id,account_key,client_command_id),
  CHECK(order_action IN ('cancel','replace') OR quantity IS NOT NULL),
  CHECK(risk_policy_snapshot IS NULL OR (jsonb_typeof(risk_policy_snapshot)='object'
    AND octet_length(risk_policy_snapshot::text)<=16384))
);
CREATE INDEX candlelight_execution_intents_reconcile_idx
 ON app_candlelight.execution_intents(state,updated_at)
 WHERE state IN ('dispatching','uncertain','acknowledged','partially_filled');

CREATE TABLE app_candlelight.execution_audit_events(
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES app_candlelight.execution_intents(intent_id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(length(event_type) BETWEEN 1 AND 80),
  broker_event_id text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(
    jsonb_typeof(event_payload)='object' AND octet_length(event_payload::text)<=32768),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(intent_id,broker_event_id)
);
CREATE INDEX candlelight_execution_events_by_intent_idx
 ON app_candlelight.execution_audit_events(intent_id,observed_at);

ALTER TABLE app_candlelight.market_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_alert_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_alert_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_alert_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.execution_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.execution_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.execution_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.execution_audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON app_candlelight.market_alert_rules,
  app_candlelight.market_alert_outbox,app_candlelight.execution_intents,
  app_candlelight.execution_audit_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON app_candlelight.market_alert_rules TO app_candlelight_executor;
GRANT SELECT,INSERT,UPDATE ON app_candlelight.market_alert_outbox TO app_candlelight_executor;
GRANT SELECT,INSERT,UPDATE ON app_candlelight.execution_intents TO app_candlelight_executor;
GRANT SELECT,INSERT ON app_candlelight.execution_audit_events TO app_candlelight_executor;

CREATE POLICY candlelight_alert_rules_select ON app_candlelight.market_alert_rules
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_alert_rules_insert ON app_candlelight.market_alert_rules
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);
CREATE POLICY candlelight_alert_rules_update ON app_candlelight.market_alert_rules
 FOR UPDATE TO app_candlelight_executor USING (true) WITH CHECK (true);
CREATE POLICY candlelight_alert_outbox_select ON app_candlelight.market_alert_outbox
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_alert_outbox_insert ON app_candlelight.market_alert_outbox
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);
CREATE POLICY candlelight_alert_outbox_update ON app_candlelight.market_alert_outbox
 FOR UPDATE TO app_candlelight_executor USING (true) WITH CHECK (true);

CREATE POLICY candlelight_execution_intents_select ON app_candlelight.execution_intents
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_execution_intents_insert ON app_candlelight.execution_intents
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);
CREATE POLICY candlelight_execution_intents_update ON app_candlelight.execution_intents
 FOR UPDATE TO app_candlelight_executor USING (true) WITH CHECK (true);
CREATE POLICY candlelight_execution_audit_select ON app_candlelight.execution_audit_events
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_execution_audit_insert ON app_candlelight.execution_audit_events
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);
