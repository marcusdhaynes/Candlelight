import type { Asset, OHLCV, Timeframe, TradeItem } from '../types';
import { marketFetch } from './marketApi';

export type PublicCallbacks = {
  onPriceUpdate: (price: number, change?: number, changePct?: number) => void;
  onCandleTick: (candle: OHLCV, isClosed: boolean) => void;
  onOrderBook: (book: { bids: any[]; asks: any[] }) => void;
  onTrade: (trade: TradeItem) => void;
  onStatusChange: (status: { connected: boolean; provider: string; latencyMs: number }) => void;
};
const sourceOf = (a: Asset) => (a.source || a.exchange).trim().toLowerCase();
const marketOf = (a: Asset) => a.symbol.toUpperCase();
const isKrakenDerivative = (a: Asset) =>
  sourceOf(a).startsWith('kraken') && (a.marketType === 'swap' || a.marketType === 'futures');
const supported = (a: Asset) =>
  ['kraken', 'kraken futures', 'coinbase', 'binance', 'binance.us', 'okx', 'bybit'].includes(sourceOf(a));
const futureSymbol = (s: string) => {
  if (s.startsWith('PF_') || s.startsWith('PI_') || s.startsWith('FF_')) return s;
  const b = s.replace(/\.P$/, '');
  return b === 'BTCUSD' || b === 'XBTUSD' ? 'PI_XBTUSD' : b.startsWith('FF_') ? b : 'PF_' + b;
};
const coinbaseSymbol = (s: string) => s.includes('-') ? s :
  s.endsWith('USDT') ? s.slice(0, -4) + '-USDT' : s.endsWith('USD') ? s.slice(0, -3) + '-USD' : '';
const delaySeconds: Record<string, number> = { '1s': 1, '5s': 5, '15s': 15, '30s': 30,
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '45m': 2700,
  '1h': 3600, '2h': 7200, '3h': 10800, '4h': 14400, '1D': 86400, '1W': 604800,
  '1M': 2592000, '3M': 7776000, '12M': 31536000 };
const binanceBar: Record<string, string> = { '1s': '1s', '1m': '1m', '3m': '3m', '5m': '5m',
  '15m': '15m', '30m': '30m', '45m': '15m', '1h': '1h', '2h': '2h', '3h': '1h',
  '4h': '4h', '1D': '1d', '1W': '1w', '1M': '1M' };
const coinbaseBar: Record<string, number> = { '1m': 60, '3m': 300, '5m': 300,
  '15m': 900, '30m': 900, '1h': 3600, '2h': 3600, '4h': 21600,
  '1D': 86400, '1W': 86400 };
const okxBar: Record<string, string> = { '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m',
  '30m': '30m', '1h': '1H', '2h': '2H', '4h': '4H', '1D': '1D', '1W': '1W', '1M': '1M' };
const bybitBar: Record<string, string> = { '1m': '1', '3m': '3', '5m': '5', '15m': '15',
  '30m': '30', '1h': '60', '2h': '120', '4h': '240', '1D': 'D', '1W': 'W', '1M': 'M' };
const krakenBar: Record<string, number> = { '1m': 1, '3m': 5, '5m': 5, '15m': 15,
  '30m': 30, '1h': 60, '2h': 120, '4h': 240, '1D': 1440, '1W': 10080 };
const krakenFuturesBar: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m',
  '30m': '30m', '1h': '1h', '4h': '4h', '1D': '1d', '1W': '1w' };
const api = async (url: string) => {
  const r = await marketFetch(url, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};
const formatVolume = (n: number) => !Number.isFinite(n) ? '—' :
  n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(2)+'M' :
  n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toFixed(2);
const toQuote = (a: Asset, price: number, open: number, high: number, low: number, vol: number): Partial<Asset> | null => {
  if (![price, open].every(Number.isFinite) || price <= 0 || open <= 0) return null;
  const digits = Math.min(Math.max(0, a.digits), 10);
  return { price: Number(price.toFixed(digits)), change24h: Number((price - open).toFixed(digits)),
    changePercent24h: Number(((price/open - 1)*100).toFixed(2)),
    high24h: Number.isFinite(high) && high > 0 ? high : price,
    low24h: Number.isFinite(low) && low > 0 ? low : price, volume24h: formatVolume(vol),
    quoteStatus: 'live', quoteUpdatedAt: Date.now() };
};
let krakenFuturesCache: { at: number; tickers: any[] } | null = null;
let krakenFuturesRequest: Promise<any[]> | null = null;
async function getKrakenFuturesTickers(): Promise<any[]> {
  if (krakenFuturesCache && Date.now() - krakenFuturesCache.at < 5000) return krakenFuturesCache.tickers;
  if (krakenFuturesRequest) return krakenFuturesRequest;
  krakenFuturesRequest = api('https://futures.kraken.com/derivatives/api/v3/tickers')
    .then(r => { const tickers = r.tickers || []; krakenFuturesCache = { at: Date.now(), tickers }; return tickers; })
    .finally(() => { krakenFuturesRequest = null; });
  return krakenFuturesRequest;
}
/** Exact-market public quote lookup, with no cross-exchange substitutions. */
export async function fetchPublicQuote(a: Asset): Promise<Partial<Asset> | null> {
  const source = sourceOf(a), s = marketOf(a);
  try {
    if (source.startsWith('kraken')) {
      if (isKrakenDerivative(a)) {
        const row = (await getKrakenFuturesTickers()).find((t: any) => t.symbol?.toUpperCase() === futureSymbol(s));
        if (!row) return null;
        const price = Number(row.last) || Number(row.markPrice), pct = Number(row.change24h) || 0;
        return toQuote(a, price, price / (1 + pct/100), Number(row.high24h), Number(row.low24h), Number(row.vol24h));
      }
      const t = Object.values((await api('https://api.kraken.com/0/public/Ticker?pair=' + encodeURIComponent(s))).result || {})[0] as any;
      return t?.c ? toQuote(a, Number(t.c[0]), Number(t.o), Number(t.h?.[1]), Number(t.l?.[1]), Number(t.v?.[1])) : null;
    }
    if (source === 'coinbase') {
      const id = coinbaseSymbol(s);
      if (!id) return null;
      const [stats, tick] = await Promise.all([
        api('https://api.exchange.coinbase.com/products/' + encodeURIComponent(id) + '/stats'),
        api('https://api.exchange.coinbase.com/products/' + encodeURIComponent(id) + '/ticker'),
      ]);
      return toQuote(a, Number(tick.price), Number(stats.open), Number(stats.high), Number(stats.low), Number(stats.volume));
    }
    if (source === 'binance' || source === 'binance.us') {
      const host = source === 'binance' ? 'https://data-api.binance.vision' : 'https://api.binance.us';
      const t = await api(host + '/api/v3/ticker/24hr?symbol=' + encodeURIComponent(s));
      return toQuote(a, Number(t.lastPrice), Number(t.openPrice), Number(t.highPrice), Number(t.lowPrice), Number(t.quoteVolume));
    }
    if (source === 'okx') {
      const t = (await api('https://www.okx.com/api/v5/market/ticker?instId=' + encodeURIComponent(s))).data?.[0];
      return t ? toQuote(a, Number(t.last), Number(t.open24h), Number(t.high24h), Number(t.low24h), Number(t.volCcy24h)) : null;
    }
    if (source === 'bybit') {
      const category = a.marketType === 'spot' ? 'spot' : 'linear';
      const t = (await api('https://api.bybit.com/v5/market/tickers?category=' + category + '&symbol=' + encodeURIComponent(s))).result?.list?.[0];
      if (!t) return null;
      const p = Number(t.lastPrice), pct = Number(t.price24hPcnt);
      return toQuote(a, p, p/(1+pct), Number(t.highPrice24h), Number(t.lowPrice24h), Number(t.turnover24h));
    }
  } catch (e) { console.debug('Unavailable public quote', a.source, a.symbol, e); }
  return null;
}
const cleanCandles = (candles: OHLCV[]) =>
  [...new Map(candles.filter(c => [c.time,c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)
    && c.time > 0 && c.low > 0 && c.open > 0 && c.close > 0
    && c.high >= Math.max(c.open,c.close) && c.low <= Math.min(c.open,c.close))
    .map(c => [c.time, c])).values()].sort((a,b)=>a.time-b.time);
/** Market-specific historical candles. Never synthesize a derivative from a spot chart. */
export async function fetchPublicHistory(a: Asset, timeframe: Timeframe): Promise<OHLCV[]> {
  const source = sourceOf(a), s = marketOf(a);
  try {
    if (source.startsWith('kraken')) {
      if (isKrakenDerivative(a)) {
        const data = await api('/api/kraken/futures-chart?symbol=' + encodeURIComponent(futureSymbol(s)) +
          '&resolution=' + (krakenFuturesBar[timeframe] || '1h'));
        return cleanCandles((data.candles || []).map((c: any) => ({
          time: Number(c.time), open: Number(c.open), high: Number(c.high),
          low: Number(c.low), close: Number(c.close), volume: Number(c.volume) || 0 })));
      }
      const data = await api('/api/kraken/ohlc?pair=' + encodeURIComponent(s) + '&interval=' + (krakenBar[timeframe] || 60));
      return cleanCandles(data.candles || []);
    }
    if (source === 'coinbase') {
      const id = coinbaseSymbol(s); if (!id) return [];
      const raw = await api('https://api.exchange.coinbase.com/products/' + encodeURIComponent(id) +
        '/candles?granularity=' + (coinbaseBar[timeframe] || 3600));
      return cleanCandles((Array.isArray(raw) ? raw : []).map((k: any) => ({
        time: Number(k[0]), open: Number(k[3]), high: Number(k[2]), low: Number(k[1]),
        close: Number(k[4]), volume: Number(k[5]) || 0 })));
    }
    if (source === 'binance' || source === 'binance.us') {
      const host = source === 'binance' ? 'https://data-api.binance.vision' : 'https://api.binance.us';
      const raw = await api(host + '/api/v3/klines?symbol=' + encodeURIComponent(s) +
        '&interval=' + (binanceBar[timeframe] || '1h') + '&limit=1000');
      return cleanCandles((Array.isArray(raw) ? raw : []).map((k: any) => ({
        time: Math.floor(Number(k[0])/1000), open: Number(k[1]), high: Number(k[2]),
        low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) || 0 })));
    }
    if (source === 'okx') {
      const data = await api('https://www.okx.com/api/v5/market/candles?instId=' +
        encodeURIComponent(s) + '&bar=' + (okxBar[timeframe] || '1H') + '&limit=300');
      return cleanCandles((data.data || []).map((k: any) => ({
        time: Math.floor(Number(k[0])/1000), open: Number(k[1]), high: Number(k[2]),
        low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) || 0 })));
    }
    if (source === 'bybit') {
      const category = a.marketType === 'spot' ? 'spot' : 'linear';
      const data = await api('https://api.bybit.com/v5/market/kline?category=' + category +
        '&symbol=' + encodeURIComponent(s) + '&interval=' + (bybitBar[timeframe] || '60') + '&limit=1000');
      return cleanCandles((data.result?.list || []).map((k: any) => ({
        time: Math.floor(Number(k[0])/1000), open: Number(k[1]), high: Number(k[2]),
        low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) || 0 })));
    }
  } catch (e) { console.debug('Unavailable public history', a.source, a.symbol, e); }
  return [];
}
/** Direct public WebSockets, backed by REST polling if browser/network blocks WS. */
export function subscribePublicFeed(a: Asset, timeframe: Timeframe, cb: PublicCallbacks): () => void {
  const source = sourceOf(a), symbol = marketOf(a), step = delaySeconds[timeframe] || 60;
  if (!supported(a)) {
    cb.onStatusChange({ connected: false, provider: a.exchange + ': no verified free browser feed', latencyMs: 0 });
    return () => {};
  }
  let stopped = false, ws: WebSocket | null = null, reconnect: ReturnType<typeof setTimeout> | null = null;
  let lastTick = 0, lastBroadcast = 0, lastOpen = Date.now(), retry = 0;
  let candle: OHLCV | null = null;
  let pending: { price: number; size: number; side: 'buy'|'sell' } | null = null;
  const status = (connected: boolean, via: string) => {
    if (stopped) return;
    cb.onStatusChange({ connected, provider: `${a.source || a.exchange} · ${via}`, latencyMs: connected ? Math.max(1, Date.now() - lastOpen) : 0 });
  };
  const tick = (price: number, size = 0, side: 'buy'|'sell' = 'buy', live = true) => {
    if (stopped || !Number.isFinite(price) || price <= 0) return;
    lastTick = Date.now();
    const bucket = Math.floor(lastTick/1000/step)*step;
    if (!candle || bucket > candle.time) {
      if (candle) cb.onCandleTick({ ...candle }, true);
      candle = { time: bucket, open: price, high: price, low: price, close: price, volume: Math.max(size,0) };
    } else {
      candle.high = Math.max(candle.high,price); candle.low = Math.min(candle.low,price);
      candle.close = price; candle.volume += Math.max(size,0);
    }
    pending = {price,size,side};
    if (live && Date.now() - lastBroadcast > 250) {
      status(true,'live WebSocket');
      lastBroadcast = Date.now();
    }
  };
  const flush = setInterval(() => {
    if (!pending || !candle || stopped) return;
    const t = pending; pending = null;
    cb.onPriceUpdate(t.price);
    cb.onCandleTick({ ...candle }, false);
    if (t.size > 0) cb.onTrade({ id: String(Date.now()), price: t.price, size: t.size, side: t.side, time: Date.now() });
  }, 100);
  const open = () => {
    if (stopped) return;
    lastOpen = Date.now();
    let url = '';
    if (source.startsWith('kraken') && isKrakenDerivative(a)) url = 'wss://futures.kraken.com/ws/v1';
    else if (source.startsWith('kraken')) url = 'wss://ws.kraken.com/v2';
    else if (source === 'coinbase') url = 'wss://ws-feed.exchange.coinbase.com';
    else if (source === 'binance') url = 'wss://data-stream.binance.vision/ws/' + symbol.toLowerCase() + '@trade';
    else if (source === 'binance.us') url = 'wss://stream.binance.us:9443/ws/' + symbol.toLowerCase() + '@trade';
    else if (source === 'okx') url = 'wss://ws.okx.com:8443/ws/v5/public';
    else if (source === 'bybit') url = 'wss://stream.bybit.com/v5/public/' + (a.marketType === 'spot' ? 'spot' : 'linear');
    if (!url) return;
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        if (stopped) return;
        retry = 0;
        if (source.startsWith('kraken') && isKrakenDerivative(a)) ws?.send(JSON.stringify({
          event: 'subscribe', feed: 'ticker', product_ids: [futureSymbol(symbol)] }));
        else if (source.startsWith('kraken')) {
          // Kraken WS v2 uses canonical BASE/QUOTE names.
          const m = symbol.match(/^(.+?)(USDT|USD|EUR|BTC|ETH)$/);
          if (m) ws?.send(JSON.stringify({ method: 'subscribe', params: {
            channel: 'ticker', symbol: [m[1].replace(/^XXBT$/, 'BTC').replace(/^XBT$/, 'BTC') + '/' + m[2]] }}));
        } else if (source === 'coinbase') ws?.send(JSON.stringify({
          type: 'subscribe', product_ids: [coinbaseSymbol(symbol)], channels: ['ticker'] }));
        else if (source === 'okx') ws?.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instId: symbol }] }));
        else if (source === 'bybit') ws?.send(JSON.stringify({ op: 'subscribe', args: ['tickers.' + symbol] }));
      };
      ws.onmessage = e => {
        if (stopped) return;
        try {
          const raw = JSON.parse(e.data), d = raw.data;
          if (source.startsWith('kraken') && isKrakenDerivative(a)) {
            if (raw.feed === 'ticker' && raw.product_id === futureSymbol(symbol))
              tick(Number(raw.last),0,'buy');
          } else if (source.startsWith('kraken')) {
            if (raw.channel === 'ticker' && Array.isArray(d) && d[0]?.last)
              tick(Number(d[0].last),0,'buy');
          } else if (source === 'coinbase') {
            if (raw.type === 'ticker' && raw.product_id === coinbaseSymbol(symbol))
              tick(Number(raw.price),Number(raw.last_size)||0,raw.side==='sell'?'sell':'buy');
          } else if (source === 'binance' || source === 'binance.us') {
            if (raw.e === 'trade') tick(Number(raw.p),Number(raw.q)||0,raw.m?'sell':'buy');
          } else if (source === 'okx') {
            if (raw.arg?.channel === 'tickers' && Array.isArray(d) && d[0]?.instId === symbol)
              tick(Number(d[0].last),0,'buy');
          } else if (source === 'bybit') {
            if (raw.topic === 'tickers.'+symbol) tick(Number(d?.lastPrice),0,'buy');
          }
        } catch { /* Ignore other channel messages. */ }
      };
      ws.onerror = () => { if (!stopped) status(false,'WebSocket unavailable · checking REST'); };
      ws.onclose = () => {
        if (stopped) return;
        status(false,'WebSocket disconnected · REST fallback');
        reconnect = setTimeout(open, Math.min(30000,2000 * 2 ** Math.min(retry++,4)));
      };
    } catch { status(false,'WebSocket blocked · checking REST'); }
  };
  open();
  const poll = async () => {
    if (stopped || Date.now() - lastTick < 12000) return;
    const q = await fetchPublicQuote(a);
    if (!stopped && q && typeof q.price === 'number') {
      tick(q.price,0,'buy',false);
      status(true,'public REST polling (not streaming)');
    } else if (!stopped && Date.now() - lastTick >= 12000) {
      status(false,'quote unavailable');
    }
  };
  void poll();
  const pollTimer = setInterval(() => { void poll(); }, 10000);
  return () => {
    stopped = true;
    clearInterval(flush); clearInterval(pollTimer);
    if (reconnect) clearTimeout(reconnect);
    if (ws) { ws.onclose = null; ws.close(); }
  };
}
