import { marketFetch as fetch } from './marketApi';
import { Asset, OHLCV, Timeframe, OrderBookItem, TradeItem } from '../types';
import { fetchPublicQuote, fetchPublicHistory, subscribePublicFeed } from './publicMarketFeeds';

// Map timeframe string to seconds
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1s': 1,
  '5s': 5,
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '45m': 2700,
  '1h': 3600,
  '2h': 7200,
  '3h': 10800,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
  '3M': 7776000,
  '12M': 31536000,
};

// Map timeframe to Coinbase granularity (in seconds)
export const COINBASE_GRANULARITY: Record<Timeframe, number> = {
  '1s': 60,
  '5s': 60,
  '15s': 60,
  '30s': 60,
  '1m': 60,
  '3m': 300,
  '5m': 300,
  '15m': 900,
  '30m': 900,
  '45m': 900,
  '1h': 3600,
  '2h': 3600,
  '3h': 3600,
  '4h': 21600,
  '1D': 86400,
  '1W': 86400,
  '1M': 86400,
  '3M': 86400,
  '12M': 86400,
};

// Map timeframe to Binance interval string
export const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1s': '1s',
  '5s': '1s',
  '15s': '1s',
  '30s': '1s',
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '45m': '15m',
  '1h': '1h',
  '2h': '2h',
  '3h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M',
  '3M': '1M',
  '12M': '1M',
};

// Map timeframe to Kraken interval (in minutes)
export const KRAKEN_INTERVAL: Record<Timeframe, number> = {
  '1s': 1,
  '5s': 1,
  '15s': 1,
  '30s': 1,
  '1m': 1,
  '3m': 5,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '45m': 60,
  '1h': 60,
  '2h': 120,
  '3h': 180,
  '4h': 240,
  '1D': 1440,
  '1W': 10080,
  '1M': 21600,
  '3M': 21600,
  '12M': 21600,
};

// Map timeframe to Kraken Futures resolution
export const KRAKEN_FUTURES_RESOLUTION: Record<Timeframe, string> = {
  '1s': '1m',
  '5s': '1m',
  '15s': '1m',
  '30s': '1m',
  '1m': '1m',
  '3m': '5m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '45m': '30m',
  '1h': '1h',
  '2h': '1h',
  '3h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1w',
  '3M': '1w',
  '12M': '1w',
};

/**
 * Returns clean Kraken Futures perpetual symbol (e.g. PF_ARBUSD, PI_XBTUSD, PF_ETHUSD)
 */
export function getKrakenFuturesSymbol(symbol: string): string | null {
  const clean = symbol.trim().toUpperCase();
  if (clean.startsWith('PF_') || clean.startsWith('PI_')) return clean;
  if (clean.endsWith('.P')) {
    const base = clean.replace('.P', '');
    if (base === 'BTCUSD' || base === 'XBTUSD') return 'PI_XBTUSD';
    if (base === 'ETHUSD') return 'PF_ETHUSD';
    return `PF_${base}`;
  }
  if (clean === 'ARBUSD' || clean === 'ARB') return 'PF_ARBUSD';
  return null;
}

/**
 * Maps symbol to Coinbase product ID (e.g. BTC-USD, ETH-USD, ARB-USD)
 */
export function getCoinbasePair(symbol: string): string | null {
  const clean = symbol.toUpperCase().replace('.P', '').trim();
  if (clean === 'BTCUSD' || clean === 'BTCUSDT') return 'BTC-USD';
  if (clean === 'ETHUSD' || clean === 'ETHUSDT') return 'ETH-USD';
  if (clean === 'SOLUSD' || clean === 'SOLUSDT') return 'SOL-USD';
  if (clean === 'ARBUSD') return 'ARB-USD';
  if (clean === 'DOGEUSD' || clean === 'DOGEUSDT') return 'DOGE-USD';
  if (clean === 'XRPUSD' || clean === 'XRPUSDT') return 'XRP-USD';
  if (clean === 'ADAUSD' || clean === 'ADAUSDT') return 'ADA-USD';
  if (clean === 'AVAXUSD' || clean === 'AVAXUSDT') return 'AVAX-USD';
  if (clean === 'LINKUSD' || clean === 'LINKUSDT') return 'LINK-USD';
  if (clean === 'SUIUSD') return 'SUI-USD';
  if (clean === 'NEARUSD') return 'NEAR-USD';

  // If already formatted like BTC-USD
  if (clean.includes('-USD')) return clean;

  return null;
}

/**
 * Maps internal symbol to Binance.US pair
 */
export function getBinancePair(symbol: string): string | null {
  const clean = symbol.toUpperCase().replace('.P', '').trim();
  // Do not use Binance.US for ARB (Binance.US has zero liquidity on ARB, Kraken has deep active perps & spot)
  if (clean.includes('ARB')) return null;
  if (clean === 'BTCUSD') return 'BTCUSDT';
  if (clean === 'ETHUSD') return 'ETHUSDT';
  if (clean === 'SOLUSD') return 'SOLUSDT';
  if (clean === 'BNBUSD') return 'BNBUSDT';
  if (clean === 'XRPUSD') return 'XRPUSDT';
  if (clean === 'DOGEUSD') return 'DOGEUSDT';
  if (clean === 'ADAUSD') return 'ADAUSDT';
  if (clean === 'AVAXUSD') return 'AVAXUSDT';

  if (clean.endsWith('USDT') || clean.endsWith('USD')) {
    const base = clean.replace('USDT', '').replace('USD', '');
    return `${base}USDT`;
  }
  return null;
}

/**
 * Fetch real 24hr ticker data from Coinbase / Binance.US / Server Proxy
 */
export async function fetchRealTicker24h(asset: Asset): Promise<Partial<Asset> | null> {
  return fetchPublicQuote(asset);
}
/**
 * Fetch real historical OHLCV klines from Kraken Futures / Kraken Spot / Coinbase / Binance / Server Proxy
 */
export async function fetchHistoricalData(asset: Asset, timeframe: Timeframe): Promise<OHLCV[]> {
  return fetchPublicHistory(asset, timeframe);
}
/**
 * Generate synthetic realistic OHLCV candles
 */
export function generateSyntheticCandles(
  basePrice: number,
  timeframe: Timeframe,
  count: number = 250
): OHLCV[] {
  const stepSeconds = TIMEFRAME_SECONDS[timeframe] || 3600;
  const nowSec = Math.floor(Date.now() / 1000);
  const currentCandleStart = Math.floor(nowSec / stepSeconds) * stepSeconds;
  const startSec = currentCandleStart - count * stepSeconds;

  const candles: OHLCV[] = [];
  let currentPrice = basePrice * 0.94;

  const volatility =
    timeframe === '1s' || timeframe === '5s' || timeframe === '15s'
      ? 0.0008
      : timeframe === '1m' || timeframe === '5m'
      ? 0.0018
      : timeframe === '15m' || timeframe === '1h'
      ? 0.0045
      : 0.012;

  for (let i = 0; i < count; i++) {
    const time = startSec + i * stepSeconds;
    const trendCycle = Math.sin(i / 18) * 0.004 + Math.cos(i / 35) * 0.006;
    const randomShock = (Math.random() - 0.49) * 2 * volatility;
    const priceChangeRatio = trendCycle + randomShock;

    const open = currentPrice;
    const close = Math.max(open * 0.7, open * (1 + priceChangeRatio));
    const range = Math.abs(close - open);
    const high = Math.max(open, close) + Math.random() * range * 1.4 + open * volatility * 0.3;
    const low = Math.min(open, close) - Math.random() * range * 1.4 - open * volatility * 0.3;
    const volume = Math.round(
      (basePrice * 80 + Math.random() * basePrice * 250) * (1 + Math.abs(priceChangeRatio) * 8)
    );

    candles.push({
      time,
      open: Number(open.toFixed(basePrice < 10 ? 4 : 2)),
      high: Number(high.toFixed(basePrice < 10 ? 4 : 2)),
      low: Number(Math.max(low, open * 0.6).toFixed(basePrice < 10 ? 4 : 2)),
      close: Number(close.toFixed(basePrice < 10 ? 4 : 2)),
      volume,
    });

    currentPrice = close;
  }

  // Adjust last candle close towards target current basePrice for seamless continuity
  const diff = basePrice - candles[candles.length - 1].close;
  const slope = diff / count;
  for (let i = 0; i < candles.length; i++) {
    const adjustment = slope * i;
    candles[i].open = Number((candles[i].open + adjustment).toFixed(basePrice < 10 ? 4 : 2));
    candles[i].high = Number((candles[i].high + adjustment).toFixed(basePrice < 10 ? 4 : 2));
    candles[i].low = Number((candles[i].low + adjustment).toFixed(basePrice < 10 ? 4 : 2));
    candles[i].close = Number((candles[i].close + adjustment).toFixed(basePrice < 10 ? 4 : 2));
  }

  return candles;
}

/**
 * Generate Order Book Depth ladder
 */
export function generateOrderBook(midPrice: number, spreadPercent: number = 0.0004): {
  bids: OrderBookItem[];
  asks: OrderBookItem[];
} {
  const asks: OrderBookItem[] = [];
  const bids: OrderBookItem[] = [];

  let cumAskTotal = 0;
  let cumBidTotal = 0;

  const count = 12;
  const step = midPrice * (spreadPercent + 0.0001);

  for (let i = 1; i <= count; i++) {
    const price = midPrice + i * step + (Math.random() - 0.5) * step * 0.2;
    const size = Math.round((Math.random() * 2.5 + 0.2) * 100) / 100;
    cumAskTotal += size;
    asks.push({
      price: Number(price.toFixed(midPrice < 10 ? 4 : 2)),
      size,
      total: Number(cumAskTotal.toFixed(2)),
    });
  }

  for (let i = 1; i <= count; i++) {
    const price = midPrice - i * step - (Math.random() - 0.5) * step * 0.2;
    const size = Math.round((Math.random() * 2.5 + 0.2) * 100) / 100;
    cumBidTotal += size;
    bids.push({
      price: Number(price.toFixed(midPrice < 10 ? 4 : 2)),
      size,
      total: Number(cumBidTotal.toFixed(2)),
    });
  }

  return { asks, bids };
}

/**
 * Generate live trade item
 */
export function generateLiveTrade(currentPrice: number): TradeItem {
  const side: 'buy' | 'sell' = Math.random() > 0.48 ? 'buy' : 'sell';
  const priceOffset = (Math.random() - 0.5) * currentPrice * 0.0004;
  const price = Number((currentPrice + priceOffset).toFixed(currentPrice < 10 ? 4 : 2));
  const size = Math.round((Math.random() * 1.8 + 0.05) * 100) / 100;

  return {
    id: Math.random().toString(36).substring(2, 9),
    price,
    size,
    time: Date.now(),
    side,
  };
}

export interface LiveMarketCallbacks {
  onPriceUpdate: (price: number, change24h?: number, changePercent24h?: number) => void;
  onCandleTick: (candle: OHLCV, isClosed: boolean) => void;
  onOrderBook: (book: { bids: OrderBookItem[]; asks: OrderBookItem[] }) => void;
  onTrade: (trade: TradeItem) => void;
  onStatusChange: (status: { connected: boolean; provider: string; latencyMs: number }) => void;
}

/**
 * Live Real-Time Market Stream Manager:
 * - Direct Coinbase WebSocket for crypto
 * - Direct Binance.US WebSocket for Binance pairs
 * - Server Polling & micro-interpolation for Stocks (AAPL, TSLA, NVDA), Forex, Indices & Gold
 */
export function subscribeRealMarketData(asset: Asset, timeframe: Timeframe, callbacks: LiveMarketCallbacks): () => void {
  return subscribePublicFeed(asset, timeframe, callbacks);
}
