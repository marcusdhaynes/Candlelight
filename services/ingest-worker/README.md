# Candlelight Market Ingestion Worker

An experimental **standalone server-side worker**, not yet deployed. It must run on persistent compute, not GitHub Pages or short-lived serverless invocations.

- Stores Coinbase Exchange BTC-USD trade prints in the private app_candlelight Postgres journal.
- Uses database lease ownership, native trade-ID uniqueness and checkpoint validation.
- On reconnect, consumes Coinbase's matches and heartbeat channels; heartbeats expose the last trade ID and allow missing messages to be detected. Batched ticker updates are never treated as a complete trade tape. The worker backfills using CB-AFTER REST cursor pages, up to 12,000 trades, and accepts recovery only when the durable checkpoint appears with every intervening trade ID present. Otherwise it stops processing and retries rather than fabricating data. Source verification under sustained live market conditions remains required.
- No broker authentication, live order submission, webhook delivery or user alert delivery.

Deployment requires a **dedicated low-privilege PostgreSQL LOGIN** capable of SET ROLE app_candlelight_market_ingestor. Do not use postgres, service_role or the database owner. Set CANDLELIGHT_DATABASE_URL as a server-side secret with TLS verification. This is not a frontend variable. Worker will refuse to start without it. Use CANDLELIGHT_MARKET_ID=BTCUSD|Coinbase|spot and CANDLELIGHT_COINBASE_PRODUCT=BTC-USD.

The database migration was already applied. It is tracked in supabase/migrations and must not be executed twice on the existing project. Run tests with node --test services/ingest-worker/protocol.test.mjs.

Production gaps: hosted worker deployment, authenticated backend login, source-backed archive recovery beyond Coinbase's recent-trades window, security/fault tests against live provider data, independently monitored uptime and server-side alert notification delivery.
