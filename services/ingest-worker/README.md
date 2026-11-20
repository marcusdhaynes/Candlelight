# Candlelight Market Ingestion Worker

An experimental **standalone server-side worker**, not yet deployed. It must run on persistent compute, not GitHub Pages or short-lived serverless invocations.

- Stores Coinbase Exchange BTC-USD trade prints in the private app_candlelight Postgres journal.
- Uses database lease ownership, native trade-ID uniqueness and checkpoint validation.
- On reconnect, accepts history only when recent Coinbase trades contain the last durable ID and a contiguous sequence. Missing history causes a safe halt/retry, not fabricated candles.
- No broker authentication, live order submission, webhook delivery or user alert delivery.

Deployment requires a **dedicated low-privilege PostgreSQL LOGIN** capable of SET ROLE app_candlelight_executor. Do not use postgres, service_role or the database owner. Set CANDLELIGHT_DATABASE_URL as a server-side secret with TLS verification. This is not a frontend variable. Worker will refuse to start without it. Use CANDLELIGHT_MARKET_ID=BTCUSD|Coinbase|spot and CANDLELIGHT_COINBASE_PRODUCT=BTC-USD.

The database migration was already applied. It is tracked in supabase/migrations and must not be executed twice on the existing project. Run tests with node --test services/ingest-worker/protocol.test.mjs.

Production gaps: hosted worker deployment, authenticated backend login, source-backed archive recovery beyond Coinbase's recent-trades window, security/fault tests against live provider data, independently monitored uptime and server-side alert notification delivery.
