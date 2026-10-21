const intervals = new Set(['1m','5m','15m','30m','1h','4h','12h','1d','1w']);
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin === 'https://marcusdhaynes.github.io' || origin === 'http://127.0.0.1:4174') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const {symbol, resolution = '1m'} = req.query;
  if (typeof symbol !== 'string' || !/^(PF|PI|FI)_[A-Z0-9]{2,32}$/.test(symbol) || !intervals.has(resolution)) {
    return res.status(400).json({error:'Invalid instrument or interval'});
  }
  try {
    const upstream = await fetch(`https://futures.kraken.com/api/charts/v1/trade/${encodeURIComponent(symbol)}/${encodeURIComponent(resolution)}`, {signal:AbortSignal.timeout(8000)});
    if (!upstream.ok) return res.status(502).json({error:'History provider unavailable'});
    const data = await upstream.json();
    if (!Array.isArray(data.candles)) return res.status(502).json({error:'Invalid provider response'});
    res.setHeader('Cache-Control','public, max-age=5, s-maxage=15, stale-while-revalidate=15');
    return res.status(200).json({candles:data.candles.slice(-2000),source:'Kraken Futures',retrievedAt:new Date().toISOString()});
  } catch {
    return res.status(502).json({error:'History provider unavailable'});
  }
}
