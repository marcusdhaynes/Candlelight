import type { Asset } from '../types';

type ProviderResponse = { source: string; assets: Asset[]; error?: string };
const QUOTES = ['USDT', 'USD', 'USDC', 'BTC', 'ETH', 'EUR', 'GBP', 'JPY', 'FDUSD', 'TRY'];
const mk = (symbol: string, base: string, quote: string, source: string, marketType: 'spot' | 'swap' | 'futures'): Asset => ({
  symbol, name: `${base} / ${quote}${marketType === 'swap' ? ' Perpetual' : marketType === 'futures' ? ' Futures' : ''}`,
  exchange: source, source, category: 'crypto', marketType,
  isCex: true, isDefi: false, price: 0, change24h: 0, changePercent24h: 0,
  high24h: 0, low24h: 0, volume24h: '—',
  digits: 6, currency: quote, quoteStatus: 'unavailable',
  subCategory: marketType === 'spot' ? 'spot cryptocurrency' : marketType === 'swap' ? 'perpetual swap' : 'dated futures',
});
async function json(url: string): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
const active = (status: unknown) => status === 'TRADING' || status === 'online' || status === 'Trading' || status === 'trading' || status === 'Live';
async function binance(source: 'Binance' | 'Binance.US'): Promise<Asset[]> {
  const url = source === 'Binance' ? 'https://data-api.binance.vision/api/v3/exchangeInfo' : 'https://api.binance.us/api/v3/exchangeInfo';
  const data = await json(url);
  return (data.symbols || []).filter((s: any) => active(s.status) && s.isSpotTradingAllowed !== false).map((s: any) =>
    mk(s.symbol, s.baseAsset, s.quoteAsset, source, 'spot'));
}
async function coinbase(): Promise<Asset[]> {
  const data = await json('https://api.exchange.coinbase.com/products');
  return (Array.isArray(data) ? data : []).filter((p: any) => p.status === 'online' && !p.trading_disabled).map((p: any) =>
    mk(p.id, p.base_currency, p.quote_currency, 'Coinbase', 'spot'));
}
async function okx(): Promise<Asset[]> {
  const reqs = await Promise.allSettled(['SPOT', 'SWAP', 'FUTURES'].map(instType =>
    json(`https://www.okx.com/api/v5/public/instruments?instType=${instType}`)));
  const out: Asset[] = [];
  reqs.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const type = (['spot', 'swap', 'futures'] as const)[i];
    for (const p of result.value.data || []) {
      if (p.state !== 'live') continue;
      out.push(mk(p.instId, p.baseCcy || p.ctValCcy || p.instId.split('-')[0], p.quoteCcy || p.settleCcy || p.instId.split('-')[1] || 'USD', 'OKX', type));
    }
  });
  if (!out.length) throw new Error('Instruments blocked or unavailable');
  return out;
}
async function bybit(): Promise<Asset[]> {
  const requests = await Promise.allSettled(['spot', 'linear'].map(category =>
    json(`https://api.bybit.com/v5/market/instruments-info?category=${category}&limit=1000`)));
  const out: Asset[] = [];
  requests.forEach((result, i) => {
    if (result.status !== 'fulfilled' || result.value.retCode !== 0) return;
    for (const p of result.value.result?.list || []) {
      if (p.status && p.status !== 'Trading') continue;
      out.push(mk(p.symbol, p.baseCoin, p.quoteCoin, 'Bybit', i === 0 ? 'spot' : 'swap'));
    }
  });
  if (!out.length) throw new Error('Instruments blocked or unavailable');
  return out;
}
async function hyperliquidInfo(type: string): Promise<any> {
  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }), signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error('Hyperliquid HTTP ' + response.status);
  return response.json();
}
async function hyperliquid(): Promise<Asset[]> {
  const [perps, spots] = await Promise.allSettled([
    hyperliquidInfo('metaAndAssetCtxs'), hyperliquidInfo('spotMetaAndAssetCtxs')]);
  const out: Asset[] = [], source = 'Hyperliquid (Hyperliquid)';
  if (perps.status === 'fulfilled' && Array.isArray(perps.value)) {
    const [meta, ctxs] = perps.value;
    (meta.universe || []).forEach((p: any, i: number) => {
      const ctx = ctxs?.[i], price = Number(ctx?.markPx || ctx?.midPx);
      if (!p.name) return;
      const a = mk(p.name + '-USD.P', p.name, 'USD', source, 'swap');
      a.feedSymbol = p.name; a.isCex = false; a.isDefi = true;
      if (Number.isFinite(price) && price > 0) {
        a.price = price; a.quoteStatus = 'live'; a.quoteUpdatedAt = Date.now();
        a.volume24h = String(ctx?.dayNtlVlm || '—');
      }
      out.push(a);
    });
  }
  if (spots.status === 'fulfilled' && Array.isArray(spots.value)) {
    const [meta, ctxs] = spots.value;
    (meta.universe || []).forEach((p: any, i: number) => {
      const ctx = ctxs?.[i], price = Number(ctx?.midPx || ctx?.markPx);
      if (!p.name) return;
      const [base, quote = 'USDC'] = p.name.split('/');
      const a = mk(p.name, base, quote, source, 'spot');
      a.feedSymbol = p.name === 'PURR/USDC' ? p.name : '@' + i;
      a.isCex = false; a.isDefi = true;
      if (Number.isFinite(price) && price > 0) {
        a.price = price; a.quoteStatus = 'live'; a.quoteUpdatedAt = Date.now();
        a.volume24h = String(ctx?.dayNtlVlm || '—');
      }
      out.push(a);
    });
  }
  if (!out.length) throw new Error('Hyperliquid API unavailable');
  return out;
}
const providers: Array<[string, () => Promise<Asset[]>]> = [
  ['Binance', () => binance('Binance')],
  ['Binance.US', () => binance('Binance.US')],
  ['Coinbase', coinbase],
  ['OKX', okx],
  ['Bybit', bybit],
  ['Hyperliquid (Hyperliquid)', hyperliquid],
];
let cache: { at: number; results: ProviderResponse[] } | null = null;
/** Fetch only real public instrument metadata; no invented listings or prices. */
export async function discoverPublicMarkets(): Promise<ProviderResponse[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.results;
  const results = await Promise.all(providers.map(async ([source, loader]): Promise<ProviderResponse> => {
    try {
      const assets = await loader();
      const seen = new Set<string>();
      return { source, assets: assets.filter(a => {
        const k = `${a.marketType}:${a.symbol}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }) };
    } catch (e) { return { source, assets: [], error: e instanceof Error ? e.message : 'Unavailable' }; }
  }));
  cache = { at: Date.now(), results };
  return results;
}
