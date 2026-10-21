# Candlelight architecture assessment

Date: October 21, 2026
Status: design recommendation based on the retrieved current AI Studio TVClone source. Candlelight has been imported into GitHub; GitHub Pages is the publishing target. Features below are proposed unless explicitly described in README as current.

## Recommended direction

Preserve and audit the original application before selecting migration work. Ship a responsive TypeScript web client with Vite, a Canvas financial chart renderer, and independently deployed Rust/Tokio services for streaming market data, order management, and automation. Keep tick updates outside the UI framework's reactive component tree. Add a PWA first and evaluate Tauri 2 desktop/mobile shells after device benchmarks. Retain React if already used by Candlelight; a framework rewrite is not justified without measurements.

No language or engine is universally fastest, smallest, and most secure. End-to-end speed depends on data subscriptions, broker/exchange proximity, networking, correctness, and workload. Published library size claims vary by version and compression; measure the shipped bundle.

## Technology assessment

| Layer / option | Assessment and decision |
| --- | --- |
| TypeScript + React + Vite | Strong default if present in existing source. Mature tooling; isolate chart updates and virtualize tables. TypeScript types do not validate untrusted network input. |
| Svelte or Solid | Candidates for a new UI with fine-grained updates; compare on identical scenarios. Switching frameworks alone does not speed broker execution. |
| Lightweight Charts + Canvas | Initial chart candidate with streaming updates. Does not supply market data or built-in indicators. Drawing tools, studies, replay, layouts, and accessibility need application work. Preserve license/attribution. |
| Custom WebGL/WebGPU renderer | Benchmark for dense heatmaps/order books and multi-chart layouts. Greater maintenance and device compatibility burden; retain a Canvas fallback. |
| Rust + Tokio | Recommended core for bounded streaming pipelines, risk validation, order state, and shared calculation libraries. Memory safety and control over allocations; correctness still requires design and tests. |
| Rust compiled to WebAssembly | Use for measured CPU-heavy indicator/replay workloads in workers. Crossing the JS/Wasm boundary has cost; avoid one call per tick. |
| Go | Credible simpler service alternative. Benchmark tail latency and garbage collection under the actual feed burst workload. |
| C++ | Credible specialized native feed/venue integration option; manual memory safety and engineering cost make it a poor default. |
| C#/.NET or JVM | Mature integration ecosystems; valid if broker SDKs require them. Profile runtime, startup, memory, and tail latency. |
| Node.js/Bun | Good control-plane/API tooling and fast iteration. Do not put CPU-heavy calculations on the event loop. Runtime branding does not establish lower trading latency. |
| Python | Research, data science, offline analytics and optional SDK adapters. Keep outside the primary execution path unless benchmark and operational requirements support it. |
| Tauri 2 | Candidate for shared desktop/mobile app, with narrow capability permissions. Verify webview behavior, signing, updates, and mobile restrictions. |
| Electron | Mature desktop integration; larger runtime footprint conflicts with the lightweight priority unless required integrations justify it. |
| Flutter / React Native / native Swift and Kotlin | Evaluate only if mobile charts, gestures, accessibility or native integrations fail webview requirements. More platform-specific work. |

## Service boundaries and data flow

Licensed feed -> adapter -> normalized sequenced events -> candle/indicator engine -> bounded subscriber streams -> client worker -> chart.

User/bot/condition -> authenticated command -> risk checks -> durable order intent -> broker adapter -> broker acknowledgement/fills -> reconciliation -> ledger/journal -> client.

Start with a modular service and Postgres rather than a large microservice fleet. Use fixed-point integers or decimal types for money and quantity, exchange-defined ticks/lots, explicit rounding, UTC timestamps, and a canonical instrument registry including venue and contract identity. Add ClickHouse/Parquet for historical tick analytics when measured volume justifies them. Treat caches as disposable; the order ledger must be durable.

Use WebSockets for browser streaming and normal HTTPS for control/history. Begin with compact validated messages; add binary encodings only when profiling demonstrates a benefit. Track source event time, ingress time, sequence numbers, corrections, duplicates, gaps, stale feeds and reconnects. Bound queues. Display coalescing may skip visual frames; execution and recording must preserve relevant events. Recover gaps using snapshots/replay where supported, and visibly mark unrecoverable gaps.

Deploy static frontend assets on a CDN with a stable HTTPS address and automatic updates from the repository. Run always-on feed, broker session and bot services on persistent compute near the selected providers. A static preview alone cannot provide reliable unattended trading.

## Broker compatibility and execution

Maintain a capability matrix per broker, account type, asset class and region: authentication, sync/import, streaming, order submission, cancellation/replacement, fractional quantities, shorting, sessions, TP, SL, trailing stops, OCO/brackets, and rate limits. Support every accessible broker progressively; universal execution cannot be promised because some brokers have no suitable API or restrict access. Offer statement imports/read-only sync where execution is unavailable.

Prefer broker-native protective orders. App-emulated stops must be labeled and require an always-on service, feed-health checks and explicit failure behavior. A stop is a trigger, not a guaranteed fill price. Do not silently emulate unsupported order combinations. Alpaca, for example, documents limitations on combining trailing stops with bracket/OCO orders.

Use idempotent command IDs, an explicit order lifecycle, partial-fill handling, durable intent/outbox, and reconciliation against broker truth. After an ambiguous timeout, query by client order ID before resubmitting. Network failure cannot be solved by claiming exactly-once broker execution. Prevent concurrent writers for the same trading account through leases/fencing and tested failover. Keep independent position, order, notional, loss, frequency and stale-data limits plus an emergency kill switch.

## Automation, paper trading, and journaling

A visual condition language should compile into a versioned deterministic rule representation. Use the same rule/indicator libraries for replay, paper and live modes while keeping their account IDs, endpoints, credentials, permissions and ledgers separate. Paper fills must include spread, latency, fees, partial fills and configurable slippage; historical results do not establish live fill quality.

For user-supplied bots, evaluate Wasmtime with memory/CPU/time limits and explicit host capabilities. No direct broker credentials, arbitrary filesystem, or unrestricted network. All order intents pass through the risk service. Consider separate processes/containers for stronger isolation and crash containment. AI assistance can propose or explain rules; it should not bypass the execution controls.

Build the journal from broker events and reconciled fills, with explicit fee/currency accounting, trade grouping, tags, notes and replay. Expose data provenance and corrections. Journal edits must not mutate the execution ledger.

## Security baseline

Keep broker secrets out of browser bundles, URLs, repositories and logs. Use broker OAuth where supported, otherwise a server-side encrypted secret store with scoped access and rotation. Separate development, paper and production credentials. Require strong authentication, session protection, tenant isolation, authorization on each command and subscription, webhook signature verification and replay protection. Prefer withdrawal-disabled trading access where supported.

Use a restrictive CSP, dependency lockfiles/scanning, reviewed releases, signed desktop builds/updates, narrowly scoped Tauri capabilities, encrypted transport/storage, redacted observability and an append-only execution audit trail. Never cache authenticated trading responses or credentials in a service worker. Security review must cover account linking, authorization, cross-tenant data, secret leakage, bot isolation and recovery.

## Measurable performance goals

These are proposed acceptance targets, not measured results or guarantees:

- On declared reference hardware, maintain a p95 chart frame time below 16.7 ms during the agreed chart workload.
- Set and enforce a compressed initial JavaScript budget after the existing app audit; lazy-load journal analytics, drawing tools and research features.
- Target p99 internal pre-trade validation below 5 ms on warm designated service hardware under the documented load. Measure durable storage separately and as part of total acceptance time.
- Report p50/p95/p99 feed age, ingest-to-client time, browser receive-to-render time, command-to-send time, broker acknowledgement time, and fill time independently.
- Stress test burst rates, tenfold expected load, bounded memory, slow clients, feed gaps, disconnects, duplicate/out-of-order events, partial fills, cancel/replace races and ambiguous acknowledgements.

Do not claim to outperform TradingView or TradeZella without reproducible comparisons on the same hardware, data and tasks. A lower local render time does not establish faster exchange execution.

## Delivery sequence

1. Retrieve original Candlelight source; identify dependencies, data provenance, secret exposure, licenses and current features.
2. Build and verify it; create the requested Candlelight GitHub repository; configure a stable hosted preview and repository-driven deployments. Clearly label simulated/delayed/live data.
3. Establish performance traces and budgets before optimizing or changing frameworks.
4. Add one real feed plus replay and a realistic paper engine; prove recovery and data integrity.
5. Add journal reconciliation and one broker adapter in paper mode, then validate live capability without placing unrequested trades.
6. Expand brokers, native protective orders and condition automation with fault-injection and security validation.
7. Add sandboxed bots and native packaging based on demonstrated need.

## Primary references

- Lightweight Charts: https://github.com/tradingview/lightweight-charts
- TradingView chart library capabilities and missing data/indicators: https://www.tradingview.com/charting-library-docs/latest/getting_started/product-comparison/
- Rust/Tokio runtime: https://tokio.rs/
- Tauri capabilities: https://tauri.app/security/capabilities/
- Wasmtime security: https://docs.wasmtime.dev/security.html
- Alpaca order behavior and limitations: https://docs.alpaca.markets/us/docs/orders-at-alpaca
- Alpaca streaming data and subscription access: https://docs.alpaca.markets/us/docs/streaming-market-data
- Alpaca feed coverage: https://docs.alpaca.markets/us/docs/market-data-faq
