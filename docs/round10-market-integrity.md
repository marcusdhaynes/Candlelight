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
- The next milestone is the authenticated persistent ingestion service with bounded durable journal and provider-by-provider recovery tests, using the dedicated app_candlelight schema under the repository's established Supabase routing policy.
