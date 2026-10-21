import { marketFetch as fetch } from './marketApi';
import { Asset, OHLCV, Timeframe, OrderBookItem, TradeItem } from '../types';

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
  // 1. Try Kraken Futures & Spot if Kraken / Perpetual / ARB asset
  const isKraken =
    asset.symbol.startsWith('PF_') ||
    asset.symbol.startsWith('PI_') ||
    asset.symbol.endsWith('.P') ||
    asset.exchange.toLowerCase().includes('kraken') ||
    asset.marketType === 'swap' ||
    asset.marketType === 'futures' ||
    asset.symbol.includes('ARB');

  if (isKraken) {
    try {
      const perpSym = getKrakenFuturesSymbol(asset.symbol);
      if (perpSym || asset.marketType === 'swap' || asset.marketType === 'futures') {
        const targetSym = perpSym || (asset.symbol.includes('ARB') ? 'PF_ARBUSD' : asset.symbol);
        const res = await fetch('https://futures.kraken.com/derivatives/api/v3/tickers');
        if (res.ok) {
          const data = await res.json();
          const tickers = data.tickers || [];
          const found = tickers.find((t: any) => t.symbol === targetSym || t.symbol === asset.symbol);
          if (found) {
            const lastPrice = Number(found.last) || Number(found.markPrice) || 0;
            const changePct = Number(found.change24h) || 0;
            const changeVal = Number(((lastPrice * changePct) / 100).toFixed(asset.digits));
            const vol = Number(found.vol24h) || 0;
            let volStr = `${(vol / 1e6).toFixed(1)}M`;
            if (vol >= 1e9) volStr = `${(vol / 1e9).toFixed(1)}B`;
            else if (vol < 1e6) volStr = `${(vol / 1e3).toFixed(1)}K`;

            return {
              price: Number(lastPrice.toFixed(asset.digits)),
              change24h: changeVal,
              changePercent24h: Number(changePct.toFixed(2)),
              high24h: Number(found.high24h) || lastPrice,
              low24h: Number(found.low24h) || lastPrice,
              volume24h: volStr,
            };
          }
        }
      } else {
        const cleanSym = asset.symbol.toUpperCase().replace('.P', '').trim();
        const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${cleanSym}`);
        if (res.ok) {
          const json = await res.json();
          const result = json.result;
          if (result) {
            const keys = Object.keys(result);
            const t = keys.length > 0 ? result[keys[0]] : null;
            if (t && t.c) {
              const lastPrice = parseFloat(t.c[0]);
              const openPrice = parseFloat(t.o);
              const change = lastPrice - openPrice;
              const changePct = openPrice > 0 ? (change / openPrice) * 100 : 0;
              const highPrice = parseFloat(t.h[1]);
              const lowPrice = parseFloat(t.l[1]);
              const vol = parseFloat(t.v[1]);
              let volStr = `${(vol / 1e3).toFixed(1)}K`;
              if (vol >= 1e6) volStr = `${(vol / 1e6).toFixed(1)}M`;

              return {
                price: Number(lastPrice.toFixed(asset.digits)),
                change24h: Number(change.toFixed(asset.digits)),
                changePercent24h: Number(changePct.toFixed(2)),
                high24h: highPrice,
                low24h: lowPrice,
                volume24h: volStr,
              };
            }
          }
        }
      }
    } catch {
      // Continue to Coinbase
    }
  }

  const cbPair = getCoinbasePair(asset.symbol);

  // 2. Try Coinbase 24hr Stats
  if (cbPair) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const [statsRes, tickerRes] = await Promise.all([
        fetch(`https://api.exchange.coinbase.com/products/${cbPair}/stats`, { signal: controller.signal }),
        fetch(`https://api.exchange.coinbase.com/products/${cbPair}/ticker`, { signal: controller.signal }),
      ]);
      clearTimeout(timeout);

      if (statsRes.ok && tickerRes.ok) {
        const stats = await statsRes.json();
        const ticker = await tickerRes.json();
        const lastPrice = parseFloat(ticker.price);
        const openPrice = parseFloat(stats.open);
        const highPrice = parseFloat(stats.high);
        const lowPrice = parseFloat(stats.low);
        const volume = parseFloat(stats.volume);

        const change = lastPrice - openPrice;
        const changePct = openPrice > 0 ? (change / openPrice) * 100 : 0;

        let volStr = `${(volume / 1000).toFixed(1)}K`;
        if (volume >= 1e6) {
          volStr = `${(volume / 1e6).toFixed(1)}M`;
        }

        return {
          price: Number(lastPrice.toFixed(asset.digits)),
          change24h: Number(change.toFixed(asset.digits)),
          changePercent24h: Number(changePct.toFixed(2)),
          high24h: highPrice,
          low24h: lowPrice,
          volume24h: volStr,
        };
      }
    } catch {
      // Continue to Binance.US
    }
  }

  // 3. Try Binance.US 24hr ticker
  const binancePair = getBinancePair(asset.symbol);
  if (binancePair) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`https://api.binance.us/api/v3/ticker/24hr?symbol=${binancePair}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const lastPrice = parseFloat(data.lastPrice);
        const priceChange = parseFloat(data.priceChange);
        const priceChangePercent = parseFloat(data.priceChangePercent);
        const highPrice = parseFloat(data.highPrice);
        const lowPrice = parseFloat(data.lowPrice);
        const quoteVolume = parseFloat(data.quoteVolume);

        let volStr = `${(quoteVolume / 1e6).toFixed(1)}M`;
        if (quoteVolume >= 1e9) {
          volStr = `${(quoteVolume / 1e9).toFixed(1)}B`;
        }

        return {
          price: Number(lastPrice.toFixed(asset.digits)),
          change24h: Number(priceChange.toFixed(asset.digits)),
          changePercent24h: Number(priceChangePercent.toFixed(2)),
          high24h: highPrice,
          low24h: lowPrice,
          volume24h: volStr,
        };
      }
    } catch {
      // Continue to server proxy
    }
  }

  // 4. Try Local Server Market API for Stocks, Forex, Indices, Commodities
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(asset.symbol)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.price != null) {
        return {
          price: Number(data.price.toFixed(asset.digits)),
          change24h: data.change24h,
          changePercent24h: data.changePercent24h,
          high24h: data.high24h,
          low24h: data.low24h,
        };
      }
    }
  } catch {
    // Continue
  }

  return null;
}

/**
 * Fetch real historical OHLCV klines from Kraken Futures / Kraken Spot / Coinbase / Binance / Server Proxy
 */
export async function fetchHistoricalData(asset: Asset, timeframe: Timeframe): Promise<OHLCV[]> {
  // 1. Prioritize Kraken Futures for Perpetuals & ARB
  const isKrakenFutures =
    asset.symbol.startsWith('PF_') ||
    asset.symbol.startsWith('PI_') ||
    asset.symbol.endsWith('.P') ||
    asset.marketType === 'swap' ||
    asset.marketType === 'futures' ||
    (asset.exchange && asset.exchange.toLowerCase().includes('futures')) ||
    asset.symbol === 'ARBUSD'; // By default for ARB, user explicitly requested the perpetuals chart!

  if (isKrakenFutures) {
    try {
      const perpSym = getKrakenFuturesSymbol(asset.symbol) || (asset.symbol.includes('ARB') ? 'PF_ARBUSD' : asset.symbol);
      const resolution = KRAKEN_FUTURES_RESOLUTION[timeframe] || '1h';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(
        `/api/kraken/futures-chart?symbol=${encodeURIComponent(perpSym)}&resolution=${encodeURIComponent(resolution)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.candles) && data.candles.length > 5) {
          return data.candles;
        }
      }
    } catch (error) {
      console.warn('Kraken historical feed unavailable', error);
      // History unavailable
    }
  }

  if (isKrakenFutures) return []; // Never substitute a spot chart for a derivative.

  // 2. Prioritize Kraken Spot for Kraken pairings
  const isKrakenSpot =
    asset.exchange.toLowerCase().includes('kraken') ||
    asset.source?.toLowerCase().includes('kraken') ||
    asset.symbol.includes('ARB');

  if (isKrakenSpot) {
    try {
      const cleanSym = asset.symbol.toUpperCase().replace('.P', '').trim();
      const interval = KRAKEN_INTERVAL[timeframe] || 60;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(
        `/api/kraken/ohlc?pair=${encodeURIComponent(cleanSym)}&interval=${encodeURIComponent(interval)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.candles) && data.candles.length > 5) {
          return data.candles;
        }
      }
    } catch {
      // Fallback
    }
  }

  // 3. Try Coinbase Pro Candles for Crypto
  const cbPair = getCoinbasePair(asset.symbol);
  if (cbPair) {
    try {
      const granularity = COINBASE_GRANULARITY[timeframe] || 3600;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(
        `https://api.exchange.coinbase.com/products/${cbPair}/candles?granularity=${granularity}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          const candles: OHLCV[] = raw
            .slice()
            .reverse()
            .map((k: any) => ({
              time: k[0],
              open: Number(k[3]),
              high: Number(k[2]),
              low: Number(k[1]),
              close: Number(k[4]),
              volume: Math.round(Number(k[5])),
            }));
          if (candles.length > 5) {
            return candles;
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  // 4. Try Binance.US for non-ARB cryptos
  const binancePair = getBinancePair(asset.symbol);
  if (binancePair) {
    try {
      const interval = BINANCE_INTERVAL[timeframe] || '1h';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res1 = await fetch(
        `https://api.binance.us/api/v3/klines?symbol=${binancePair}&interval=${interval}&limit=1000`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res1.ok) {
        const raw1 = await res1.json();
        if (Array.isArray(raw1) && raw1.length > 0) {
          const parsed = raw1.map((k: any) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: Math.round(parseFloat(k[5])),
          }));

          if (parsed.length > 10) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  // 5. Try Local Server Market API (for Stocks, Forex, Indices, Commodities, and Crypto)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `/api/market/chart?symbol=${encodeURIComponent(asset.symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.candles) && data.candles.length > 0) {
        return data.candles;
      }
    }
  } catch {
    // Fallback to synthetic
  }

  // 6. Realistic fallback candles based on exact current asset price (deep 1200 candles)
  return []; // Never fabricate market history when the provider is unavailable.
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
export function subscribeRealMarketData(
  asset: Asset,
  timeframe: Timeframe,
  callbacks: LiveMarketCallbacks
): () => void {
  let isUnsubscribed = false;
  let ws: WebSocket | null = null;
  let pollInterval: NodeJS.Timeout | null = null;
  let tickInterval: NodeJS.Timeout | null = null;

  const cbPair = getCoinbasePair(asset.symbol);
  const binancePair = getBinancePair(asset.symbol);

  // Helper to construct current candle tick
  const stepSeconds = TIMEFRAME_SECONDS[timeframe] || 60;
  let activeCandle: OHLCV = {
    time: Math.floor(Date.now() / 1000 / stepSeconds) * stepSeconds,
    open: asset.price,
    high: asset.price,
    low: asset.price,
    close: asset.price,
    volume: 1,
  };

  let receivedFirstPrice = false;
  let pendingPrice: number = asset.price;
  let pendingCandleDirty = false;
  let pendingPriceDirty = false;
  let lastOrderBookDispatch = 0;
  let lastTradeDispatch = 0;
  let latestTrade: TradeItem | null = null;
  let batchInterval: any = null;

  const flushUpdates = () => {
    if (isUnsubscribed) return;

    if (pendingCandleDirty) {
      callbacks.onCandleTick(activeCandle, false);
      pendingCandleDirty = false;
    }

    if (pendingPriceDirty) {
      callbacks.onPriceUpdate(pendingPrice);
      pendingPriceDirty = false;
    }

    const now = Date.now();
    if (latestTrade && now - lastTradeDispatch > 120) {
      if (latestTrade.size > 0) callbacks.onTrade(latestTrade);
      latestTrade = null;
      lastTradeDispatch = now;
    }


  };

  // High-performance smooth batch flush at ~30 FPS (33ms)
  batchInterval = setInterval(flushUpdates, 33);

  const updateWithLivePrice = (price: number, size: number = 0.5, side: 'buy' | 'sell' = 'buy') => {
    if (isUnsubscribed || isNaN(price) || price <= 0) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const candleBucket = Math.floor(nowSec / stepSeconds) * stepSeconds;

    if (!receivedFirstPrice) {
      receivedFirstPrice = true;
      activeCandle = { time: candleBucket, open: price, high: price, low: price, close: price, volume: 0 };
    }
    if (candleBucket > activeCandle.time) {
      // Flush previous candle closed immediately
      callbacks.onCandleTick(activeCandle, true);
      callbacks.onPriceUpdate(price);
      activeCandle = {
        time: candleBucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: Math.round(size),
      };
      pendingCandleDirty = true;
      pendingPriceDirty = true;
    } else {
      activeCandle.high = Math.max(activeCandle.high, price);
      activeCandle.low = Math.min(activeCandle.low, price);
      activeCandle.close = price;
      activeCandle.volume += Math.round(size);
      pendingCandleDirty = true;
      pendingPriceDirty = true;
    }

    pendingPrice = price;
    latestTrade = {
      id: Math.random().toString(36).substring(2, 9),
      price,
      size: Number(size.toFixed(4)),
      time: Date.now(),
      side,
    };
  };

  // Case 1: Connect to Kraken Futures WebSocket for Perpetuals / ARB
  const krakenFutSym = getKrakenFuturesSymbol(asset.symbol);
  if (krakenFutSym || asset.symbol.includes('ARB') || asset.marketType === 'swap') {
    const targetSym = krakenFutSym || (asset.symbol.includes('ARB') ? 'PF_ARBUSD' : asset.symbol);
    try {
      const connectStart = Date.now();
      ws = new WebSocket('wss://futures.kraken.com/ws/v1');

      ws.onopen = () => {
        if (isUnsubscribed) return;
        const latency = Date.now() - connectStart;
        callbacks.onStatusChange({
          connected: true,
          provider: `Kraken Futures Live Feed (${targetSym})`,
          latencyMs: Math.max(16, latency),
        });

        ws?.send(
          JSON.stringify({
            event: 'subscribe',
            feed: 'ticker',
            product_ids: [targetSym],
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnsubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.feed === 'ticker' && data.last != null) {
            const price = parseFloat(data.last);
            const size = 0; // Ticker volume is cumulative, not the size of this update.
            updateWithLivePrice(price, size, 'buy');
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        // Fallback
      };

      ws.onclose = () => {
        if (!isUnsubscribed) {
          callbacks.onStatusChange({
            connected: false,
            provider: 'Reconnecting Kraken Futures Stream...',
            latencyMs: 0,
          });
        }
      };
    } catch {
      // WS failed
    }
  } else if (cbPair) {
    // Case 2: Connect to Coinbase Pro WebSocket (for BTC, ETH, SOL, DOGE, XRP, etc.)
    try {
      const connectStart = Date.now();
      ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      ws.onopen = () => {
        if (isUnsubscribed) return;
        const latency = Date.now() - connectStart;
        callbacks.onStatusChange({
          connected: true,
          provider: `Coinbase Pro Live Feed (${cbPair})`,
          latencyMs: Math.max(16, latency),
        });

        // Subscribe to real-time ticker
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: [cbPair],
            channels: ['ticker'],
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnsubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ticker' && data.price) {
            const price = parseFloat(data.price);
            const size = parseFloat(data.last_size || '0.2');
            const side = data.side === 'buy' ? 'buy' : 'sell';
            updateWithLivePrice(price, size, side);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        // Fallback to ticker polling
      };

      ws.onclose = () => {
        if (!isUnsubscribed) {
          callbacks.onStatusChange({
            connected: false,
            provider: 'Reconnecting Market Stream...',
            latencyMs: 0,
          });
        }
      };
    } catch {
      // WS failed
    }
  } else if (binancePair) {
    // Case 2: Connect to Binance.US WebSocket
    try {
      const connectStart = Date.now();
      const wsUrl = `wss://stream.binance.us:9443/stream?streams=${binancePair.toLowerCase()}@kline_1m/${binancePair.toLowerCase()}@trade`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isUnsubscribed) return;
        const latency = Date.now() - connectStart;
        callbacks.onStatusChange({
          connected: true,
          provider: `Binance Live WebSocket (${binancePair})`,
          latencyMs: Math.max(16, latency),
        });
      };

      ws.onmessage = (event) => {
        if (isUnsubscribed) return;
        try {
          const payload = JSON.parse(event.data);
          const stream = payload.stream;
          const data = payload.data;
          if (!data) return;

          if (stream.includes('@trade')) {
            const tradePrice = parseFloat(data.p);
            const tradeSize = parseFloat(data.q);
            updateWithLivePrice(tradePrice, tradeSize, data.m ? 'sell' : 'buy');
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // WS failed
    }
  } else {
    // Case 3: Stocks, forex, commodities: no streaming connection established.
    callbacks.onStatusChange({
      connected: false,
      provider: `Quote polling (${asset.exchange}); availability unverified`,
      latencyMs: 0,
    });
  }

  // Periodic poll for latest quotes (especially for stocks/forex/commodities and fallback)
  const pollQuote = async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(asset.symbol)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.price != null) {
          updateWithLivePrice(data.price, 1, 'buy');
        }
      }
    } catch {
      // ignore
    }
  };

  if (!cbPair && !binancePair) {
    pollInterval = setInterval(pollQuote, 2500);
  }



  return () => {
    isUnsubscribed = true;
    if (batchInterval) clearInterval(batchInterval);
    if (pollInterval) clearInterval(pollInterval);
    if (tickInterval) clearInterval(tickInterval);
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
      ws = null;
    }
  };
}
