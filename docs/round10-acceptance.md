# Round 10 completion gate — November 19–20, 2026

The word **Done** must not be used for Round 10 before all required gates pass.

## Implemented and source controlled
- [x] Verified restored web release (run 44609208502).
- [x] Provider ID and timestamp validation for browser Coinbase and Binance trade streams; duplicate/replay guards.
- [x] Private Postgres market event journal, lease/checkpoint tables, alert-outbox and staged execution-intent audit tables.
- [x] Dedicated NOLOGIN market ingestion role with no access to execution intent or audit tables.
- [x] Independent Coinbase BTC-USD worker implementation, conservative reconnect backfill, bounded queues and health route.
- [x] Server-side price alert evaluation and outbox staging in the market-event transaction (delivery not activated).
- [x] Reconciliation planning that does not permit blind resubmission after ambiguous broker timeouts.
- [x] Deterministic worker, market feed and state-machine unit/fault-injection tests in GitHub Actions.
- [x] Browser regression fixture updated to supply native Binance identifiers; latest cross-browser result pending.
- [x] Worker container build and tests added as CI deployment gate; verify its first run result before marking complete.

## Must still be verified or implemented
- [ ] Provision a least-privilege LOGIN credential through a secure secret manager and deploy worker to always-on compute; prove it runs with the NOLOGIN delegated role.
- [ ] Prove live Coinbase REST/WS overlap, trade-ID continuity and long-outage replay against exchange truth; increase recovery reach beyond the last 100 trades.
- [ ] Add independent observability, on-call escalation, automatic crash recovery, disk/network outage testing and resource/throughput benchmarks.
- [ ] Configure an authenticated account-scoped API for creating server alert rules without exposing private schema or authority to the browser.
- [ ] Configure actual notification transport/delivery receipts, retries, deduplication and dead-letter handling; test offline-device alerts.
- [ ] Add authorized broker adapter(s), live order reconciliation after ambiguous failures, lease-fenced account writers, enforceable risk policy and kill switch. Do not enable real-money submission before authorization and sandbox tests.
- [ ] Prove outbox, journal, ledger and backup consistency across device disconnects, duplicate events, crashes, permission failures and retry storms.
- [ ] Pass current GitHub Actions on the exact published main SHA and verify live Pages/version identity.

Until then, Candlelight remains a research/paper-trading frontend with a **not-yet-deployed** server infrastructure. New database objects are real, but there is no claim of 24/7 live ingestion, alerts or brokerage.
