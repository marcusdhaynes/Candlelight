
-- Candlelight Round 10: private, append-only provider-event journal.
-- No browser roles or generic service_role access; a vetted backend gateway must assume
-- the app-specific NOLOGIN role after separate authorization and deployment.
CREATE TABLE app_candlelight.market_ingest_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 100),
  market_id text NOT NULL CHECK (length(market_id) BETWEEN 1 AND 256),
  stream_scope text NOT NULL CHECK (length(stream_scope) BETWEEN 1 AND 128),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ended_at timestamptz,
  state text NOT NULL DEFAULT 'running'
    CHECK (state IN ('running','recovering','stopped','failed')),
  stop_reason text,
  CONSTRAINT market_ingest_sessions_scope_uniq
    UNIQUE (session_id, provider, market_id, stream_scope),
  CONSTRAINT market_ingest_sessions_time_order
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE app_candlelight.market_event_journal (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 100),
  market_id text NOT NULL CHECK (length(market_id) BETWEEN 1 AND 256),
  stream_scope text NOT NULL CHECK (length(stream_scope) BETWEEN 1 AND 128),
  kind text NOT NULL CHECK (kind IN ('trade','ticker','snapshot','book')),
  native_event_id text CHECK (native_event_id IS NULL OR length(native_event_id) BETWEEN 1 AND 200),
  native_sequence numeric(38,0) CHECK (native_sequence IS NULL OR native_sequence >= 0),
  sequence_mode text CHECK (sequence_mode IS NULL OR sequence_mode IN ('contiguous','monotonic')),
  provider_reported_at timestamptz,
  source_received_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  price numeric(38,16) CHECK (price IS NULL OR price > 0),
  quantity numeric(38,16) CHECK (quantity IS NULL OR quantity >= 0),
  side text CHECK (side IS NULL OR side IN ('buy','sell')),
  integrity_state text NOT NULL CHECK (integrity_state IN ('accepted','unverified','out_of_order','gap')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 32768),
  CONSTRAINT market_event_journal_ingest_session_fk
    FOREIGN KEY (session_id,provider,market_id,stream_scope)
    REFERENCES app_candlelight.market_ingest_sessions(session_id,provider,market_id,stream_scope),
  CONSTRAINT market_event_journal_trades_need_price_and_size
    CHECK (kind <> 'trade' OR (price IS NOT NULL AND quantity > 0))
);
CREATE UNIQUE INDEX market_event_journal_native_uniq
 ON app_candlelight.market_event_journal(provider,market_id,stream_scope,kind,native_event_id)
 WHERE native_event_id IS NOT NULL;
CREATE INDEX market_event_journal_market_time_idx
 ON app_candlelight.market_event_journal(provider,market_id,source_received_at DESC);
CREATE INDEX market_event_journal_ingest_time_idx
 ON app_candlelight.market_event_journal(ingested_at DESC);

CREATE TABLE app_candlelight.market_ingest_checkpoints (
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 100),
  market_id text NOT NULL CHECK (length(market_id) BETWEEN 1 AND 256),
  stream_scope text NOT NULL CHECK (length(stream_scope) BETWEEN 1 AND 128),
  last_native_event_id text,
  last_sequence numeric(38,0) CHECK (last_sequence IS NULL OR last_sequence >= 0),
  last_provider_at timestamptz,
  last_received_at timestamptz,
  gap_count bigint NOT NULL DEFAULT 0 CHECK (gap_count >= 0),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider,market_id,stream_scope),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);

ALTER TABLE app_candlelight.market_ingest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_ingest_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_event_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_event_journal FORCE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_ingest_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_candlelight.market_ingest_checkpoints FORCE ROW LEVEL SECURITY;

-- Existing NOLOGIN role is only a future server-side backend identity, not a client role.
REVOKE ALL ON app_candlelight.market_ingest_sessions,
  app_candlelight.market_event_journal,
  app_candlelight.market_ingest_checkpoints
 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app_candlelight TO app_candlelight_executor;
GRANT SELECT, INSERT, UPDATE ON app_candlelight.market_ingest_sessions
  TO app_candlelight_executor;
GRANT SELECT, INSERT ON app_candlelight.market_event_journal
  TO app_candlelight_executor;
GRANT SELECT, INSERT, UPDATE ON app_candlelight.market_ingest_checkpoints
  TO app_candlelight_executor;

CREATE POLICY candlelight_ingest_sessions_read ON app_candlelight.market_ingest_sessions
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_ingest_sessions_insert ON app_candlelight.market_ingest_sessions
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);
CREATE POLICY candlelight_ingest_sessions_update ON app_candlelight.market_ingest_sessions
 FOR UPDATE TO app_candlelight_executor USING (true) WITH CHECK (true);

CREATE POLICY candlelight_market_journal_read ON app_candlelight.market_event_journal
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_market_journal_insert ON app_candlelight.market_event_journal
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);

CREATE POLICY candlelight_ingest_checkpoints_read ON app_candlelight.market_ingest_checkpoints
 FOR SELECT TO app_candlelight_executor USING (true);
CREATE POLICY candlelight_ingest_checkpoints_insert ON app_candlelight.market_ingest_checkpoints
 FOR INSERT TO app_candlelight_executor WITH CHECK (true);
CREATE POLICY candlelight_ingest_checkpoints_update ON app_candlelight.market_ingest_checkpoints
 FOR UPDATE TO app_candlelight_executor USING (true) WITH CHECK (true);
