
-- Split ingestion permissions from future broker-command permissions.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_candlelight_market_ingestor') THEN
   CREATE ROLE app_candlelight_market_ingestor NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA app_candlelight TO app_candlelight_market_ingestor;
GRANT SELECT,INSERT,UPDATE ON app_candlelight.market_ingest_sessions
 TO app_candlelight_market_ingestor;
GRANT SELECT,INSERT,UPDATE ON app_candlelight.market_ingest_checkpoints
 TO app_candlelight_market_ingestor;
GRANT SELECT,INSERT ON app_candlelight.market_event_journal
 TO app_candlelight_market_ingestor;
GRANT SELECT,UPDATE ON app_candlelight.market_alert_rules
 TO app_candlelight_market_ingestor;
GRANT SELECT,INSERT ON app_candlelight.market_alert_outbox
 TO app_candlelight_market_ingestor;

CREATE POLICY market_ingestor_sessions_read ON app_candlelight.market_ingest_sessions
 FOR SELECT TO app_candlelight_market_ingestor USING(true);
CREATE POLICY market_ingestor_sessions_insert ON app_candlelight.market_ingest_sessions
 FOR INSERT TO app_candlelight_market_ingestor WITH CHECK(true);
CREATE POLICY market_ingestor_sessions_update ON app_candlelight.market_ingest_sessions
 FOR UPDATE TO app_candlelight_market_ingestor USING(true) WITH CHECK(true);

CREATE POLICY market_ingestor_checkpoints_read ON app_candlelight.market_ingest_checkpoints
 FOR SELECT TO app_candlelight_market_ingestor USING(true);
CREATE POLICY market_ingestor_checkpoints_insert ON app_candlelight.market_ingest_checkpoints
 FOR INSERT TO app_candlelight_market_ingestor WITH CHECK(true);
CREATE POLICY market_ingestor_checkpoints_update ON app_candlelight.market_ingest_checkpoints
 FOR UPDATE TO app_candlelight_market_ingestor USING(true) WITH CHECK(true);

CREATE POLICY market_ingestor_journal_read ON app_candlelight.market_event_journal
 FOR SELECT TO app_candlelight_market_ingestor USING(true);
CREATE POLICY market_ingestor_journal_append ON app_candlelight.market_event_journal
 FOR INSERT TO app_candlelight_market_ingestor WITH CHECK(true);

CREATE POLICY market_ingestor_alert_rules_read ON app_candlelight.market_alert_rules
 FOR SELECT TO app_candlelight_market_ingestor USING(true);
CREATE POLICY market_ingestor_alert_rules_update ON app_candlelight.market_alert_rules
 FOR UPDATE TO app_candlelight_market_ingestor USING(true) WITH CHECK(true);
CREATE POLICY market_ingestor_outbox_read ON app_candlelight.market_alert_outbox
 FOR SELECT TO app_candlelight_market_ingestor USING(true);
CREATE POLICY market_ingestor_outbox_insert ON app_candlelight.market_alert_outbox
 FOR INSERT TO app_candlelight_market_ingestor WITH CHECK(true);
