// GitHub Pages has no application server. Only use public, browser-accessible feeds.
// No API keys, third-party CORS proxies, or synthetic responses belong here.
export async function marketFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!input.startsWith('/api/')) return globalThis.fetch(input, init);
  const url = new URL(input, 'https://candlelight.invalid');
  let upstream: string;
  let parse: (data: any) => any[];
  if (url.pathname === '/api/kraken/futures-chart') {
    const symbol = url.searchParams.get('symbol') || '';
    const resolution = url.searchParams.get('resolution') || '1h';
    upstream = `https://futures.kraken.com/api/charts/v1/trade/${encodeURIComponent(symbol)}/${encodeURIComponent(resolution)}`;
    parse = data => (data.candles || []).map((c: any) => ({
      time: Math.floor(Number(c.time) / 1000), open: Number(c.open), high: Number(c.high),
      low: Number(c.low), close: Number(c.close), volume: Number(c.volume) || 0,
    }));
  } else if (url.pathname === '/api/kraken/ohlc') {
    upstream = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(url.searchParams.get('pair') || '')}&interval=${encodeURIComponent(url.searchParams.get('interval') || '60')}`;
    parse = data => {
      const key = Object.keys(data.result || {}).find(k => k !== 'last');
      return key ? data.result[key].map((c: any) => ({
        time: Number(c[0]), open: Number(c[1]), high: Number(c[2]), low: Number(c[3]),
        close: Number(c[4]), volume: Number(c[6]) || 0,
      })) : [];
    };
  } else {
    // Equities/forex need a separately authenticated, licensed data service.
    return Response.json({ success: false, candles: [], reason: 'Feed unavailable in this preview' }, { status: 503 });
  }
  const response = await globalThis.fetch(upstream, { ...init, signal: init?.signal || AbortSignal.timeout(8000) });
  if (!response.ok) return Response.json({ success: false, candles: [] }, { status: 502 });
  const candles = parse(await response.json()).filter(c =>
    [c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) &&
    c.open > 0 && c.close > 0 && c.low > 0 && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close)
  );
  const ordered = [...new Map(candles.map(c => [c.time, c])).values()].sort((a,b) => a.time - b.time);
  return Response.json({ success: ordered.length > 0, candles: ordered });
}
