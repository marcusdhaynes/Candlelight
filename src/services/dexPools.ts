import type { Asset } from '../types';

/** DEX Screener indexes actual pools. These are snapshot quotes, not exchange WebSocket ticks. */
const mappedDex = (dex: string, chain: string, labels: string[]): string => {
  const c: Record<string, string> = { ethereum: 'Ethereum', bsc: 'BNB chain', base: 'Base',
    arbitrum: 'Arbitrum', avalanche: 'Avalanche', polygon: 'Polygon',
    solana: 'Solana', optimism: 'Optimism', unichain: 'Unichain', sui: 'Sui',
    pulsechain: 'Pulsechain', ton: 'TON', tron: 'TRON', cronos: 'Cronos' };
  const name: Record<string,string> = { uniswap: 'Uniswap', pancakeswap: 'PancakeSwap',
    raydium: 'Raydium', orca: 'Orca', meteora: 'Meteora', aerodrome: 'Aerodrome',
    sushiswap: 'SushiSwap', quickswap: 'QuickSwap', camelot: 'Camelot', curve: 'Curve',
    jupiter: 'Jupiter', velodrome: 'Velodrome', balancer: 'Balancer', traderjoe: 'Trader Joe' };
  const version = labels.find(l => /^v[234]$/i.test(l)) || '';
  const root = name[dex.toLowerCase()] || dex;
  return `${root}${version ? ' ' + version : ''} (${c[chain.toLowerCase()] || chain})`;
};
export const dexSnapshotAsset = (pool: any): Asset | null => {
  const base = pool.baseToken?.symbol, quote = pool.quoteToken?.symbol;
  const pairAddress = String(pool.pairAddress || ''), chainId = String(pool.chainId || '');
  const price = Number(pool.priceUsd), liquidity = Number(pool.liquidity?.usd);
  if (!base || !quote || !pairAddress || !chainId || !Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(liquidity) || liquidity <= 0) return null;
  const source = mappedDex(String(pool.dexId || 'DEX'), chainId, pool.labels || []);
  const changePercent = Number(pool.priceChange?.h24) || 0;
  const previous = price / (1 + changePercent / 100);
  return {
    symbol: `${base}/${quote}@${pairAddress.slice(0, 7)}`, name: `${base} / ${quote} · ${chainId}`,
    source, exchange: source, category: 'crypto', marketType: 'spot', isDefi: true, isCex: false,
    pairAddress, chainId, iconType: base.toLowerCase(), currency: 'USD',
    price, changePercent24h: changePercent, change24h: Number.isFinite(previous) ? price - previous : 0,
    high24h: 0, low24h: 0, volume24h: String(pool.volume?.h24 ?? '—'),
    digits: price < 0.001 ? 9 : price < 1 ? 6 : 4,
    quoteStatus: 'delayed', quoteUpdatedAt: Date.now(),
    subCategory: 'DEX pool · indexed snapshot', description: `Pool ${pairAddress} on ${chainId}; public aggregator snapshot, not direct exchange tick.`,
  };
};
export async function searchDexPools(query: string): Promise<Asset[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(query.trim()), {
    signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('DEX index HTTP ' + res.status);
  const data = await res.json();
  const seen = new Set<string>();
  return (data.pairs || []).map(dexSnapshotAsset).filter((a: Asset | null): a is Asset => {
    if (!a || !a.pairAddress) return false;
    const k = a.chainId + ':' + a.pairAddress;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 100);
}
