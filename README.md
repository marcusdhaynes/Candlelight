# Candlelight

Trading workspace imported from the current TVClone project in Google AI Studio.

**Live app:** https://marcusdhaynes.github.io/Candlelight/

GitHub is the source of truth. The `Deploy Candlelight` workflow type-checks and builds every push to `main`, then deploys the verified artifact to GitHub Pages. No Google AI Studio publishing is used.

## Current scope

Charts, drawing tools, indicators, alerts, journal examples, paper positions, and browser-based conditional order simulation. Public WebSockets stream directly to the browser. Kraken futures history uses a read-only Vercel function at https://candlelight-market-api.vercel.app/api/history because Kraken blocks direct cross-origin browser history requests. Its source lives in services/market-proxy; it has no broker keys or order endpoints. The function is deployed separately from the Pages workflow. Market coverage, interval aggregation, and candle accuracy remain under validation. Some account, journal, alert, news, and watchlist values are demonstration or snapshot data. No broker account or real-money execution is connected. Bots and alerts cannot run reliably while this browser page is closed.

Fabricated history, fallback heartbeat ticks, generated depth, and seeded tape entries have been removed from the active market-data path. Missing feeds do not generate fake candles. Derivatives history never silently falls back to spot history. The preview does not provide equities/forex data through the old AI Studio-only proxy.

## Development

Use Node.js 22 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm run dev
pnpm run lint
GITHUB_PAGES=true pnpm run build
```

Public market feeds require no API key. Never put broker or AI credentials in this frontend, repository, build variables, or browser storage. Future broker connections need an authenticated backend, risk validation, durable order reconciliation, and a secret store.

## Architecture

See [the architecture assessment](docs/architecture.md). Recommended direction: TypeScript/Vite web client with Canvas charts; Rust/Tokio streaming, execution and risk services; Postgres ledger; broker capability adapters; sandboxed automation; PWA followed by benchmarked native packaging. These are design recommendations, not implemented features or measured performance guarantees.

Charts use [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts). Preserve its license, NOTICE, and creator attribution.
