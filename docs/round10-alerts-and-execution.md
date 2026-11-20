## Server-side alerts and intent audit (increment 2)

Migration 20261120002411_candlelight_round10_private_alerts_execution_audit was applied in Supabase and is retained in GitHub:
- market_alert_rules: private owner-bound rules with threshold and trigger counters; default paused.
- market_alert_outbox: exactly one pending notification event per rule and source trade, within the same transaction as accepted journal entries. **No transport/delivery is configured yet.**
- execution_intents: uniquely identified staged commands, initially non-executing.
- execution_audit_events: append-only command history; **no connected brokers and no dispatch endpoint**.

The worker evaluates authenticated, pre-provisioned active price rules only against verified *new stream* prints. Recovery/backfilled trades do not fire old alerts. Database numeric comparisons prevent floating-point threshold rounding. Ingestion, checkpoint advancement, and alert outbox creation commit or roll back together.

No UI or public API currently creates server rules or delivers outbox events. Production authentication and delivery integrations are still required.
