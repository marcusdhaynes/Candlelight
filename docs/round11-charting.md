# Candlelight — Round 11: chart rendering integrity (increment 1)

This increment fixes verified shortcomings in the chart pipeline without rewriting the interface or fabricating market data.

- **Historically correct reconciliation:** validate OHLCV fields including timestamp and nonnegative volume; sort source history, de-duplicate exact times (the last source record wins), and discard malformed bars rather than repairing prices. An asynchronously delivered history response cannot erase newer live bars.
- **Incremental chart updates are safe:** the chart compares every earlier candle against its last rendered snapshot, rather than only sampling first/middle/penultimate bars. A revision anywhere in history triggers a full series rebuild instead of a misleading last-candle update. The hot path updates only the cached tail after verifying the prefix.
- **Indicators stay correct:** since the current chart engine does not incrementally update calculated studies, it deliberately rebuilds their series when the source candle changes. Volume-only charts retain the faster last-candle update. This prioritizes correctness over peak FPS until incremental indicator series are implemented and tested.
- **Exact DEX identity:** chain ID and pair address are included in chart series identity and effect dependencies, so same-symbol pools cannot share a stale series.
- **Regression tests:** malformed/corrupt bars, unsorted historical responses, duplicate timestamps, late corrections, volume corrections, ongoing live updates, all calculated indicators, and DEX pool changes.

Round 11 remains open: benchmark large chart histories and 16-pane layouts, introduce incremental indicator recomputation, add multi-pane synchronization regression tests, enhance snapshots and accessibility, and verify final production deployment. No superiority or performance claim is made without measurement.

## Hover and navigation integrity (increment 2)

- The crosshair legend now uses recorded historical volume rather than a renderer-supplied placeholder (the price-series event does not carry volume).
- Line/area hover shows the corresponding original OHLCV record rather than manufacturing an equal-open-high-low-close candle from its scalar plot point.
- Same-market historical revisions and calculated-indicator redraws preserve the chart's visible time range where supported; symbol/timeframe changes still reset appropriately.
- Exact historical bar lookup is a binary search with missing-time handling and unit assertions.
