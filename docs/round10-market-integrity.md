# Round 10 — Market-event integrity (increment 1)

## What this implements

- The latest restored deployment on main passed its GitHub Actions build, TypeScript, paper tests and cross-browser smoke tests (run 44609208502).
- Provider-native trade IDs from Coinbase ticker and Binance raw trade streams are retained, and repeated identified prints are suppressed **within each subscription** before updating candles, positions or trade tape.
- Coinbase tickers lacking a valid native trade ID, positive trade size or exchange timestamp are classified as ticker data rather than verified prints. Binance records without analogous native evidence are also classified as ticker data.
- Source-reported timestamps and monotonically scoped sequences are tracked for diagnostics. Only explicit contiguous streams can generate missing-sequence counts, because generic monotonic IDs can skip values.
- The data health panel reports detected duplicates, invalid events, source-reported lag, print freshness, and sequence order.
- Unit tests exercise repeat prints, missing/late sequences, stale feeds, incomplete/invalid metadata, bounded guard memory and suspicious future source timestamps.

## Remaining limitations and next gates

- Existing UI and browser subscriptions are **not** durable. This does not implement server-side alerts, broker execution, or exactly-once delivery.
- Only Coinbase and Binance trade streams currently supply native identifiers to the replay guard. Other supported feeds must be audited provider by provider; missing IDs are not presumed unique.
- Subscription-local replay protection cannot prevent duplicates across tabs, processes, separate sockets or restarts. A durable backend must reconcile provider events using venue-specific keys, sequencing rules and persisted checkpoints.
- The browser clock can be incorrect; 'reported lag' is a diagnostic estimate, not a certified latency measurement.
- Gaps cannot be recovered by extrapolation. A provider-specific snapshot/replay mechanism, independently verified against source records, is required before declaring lossless historical capture.
- New live orders remain disabled. The risk and ledger services require authenticated account permissions, broker-native idempotency where available, reconciliation and kill-switch tests before live deployment.
- On November 19, 2026, the private event-journal migration `20261119235617_candlelight_round10_private_market_journal` was applied to the established project and `app_candlelight` schema. Three new tables exist: `market_ingest_sessions`, `market_event_journal`, and `market_ingest_checkpoints`. RLS is enabled and forced; policies are restricted to the NOLOGIN `app_candlelight_executor` role. There is no direct access for `anon`, `authenticated`, or `service_role`. The event journal is append-only to this app role.
- The applied SQL is preserved in `supabase/migrations/20261119235617_candlelight_round10_private_market_journal.sql`. Do not reapply it to this existing database; only use migration management for fresh environments. Do not reset production data.
- The next milestone is the authenticated continuously running ingest worker and provider-by-provider reconnect/replay verification. This migration alone does not connect any live data.
