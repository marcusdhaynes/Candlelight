export type AssetCategory =
  | 'crypto'
  | 'stocks'
  | 'funds'
  | 'futures'
  | 'forex'
  | 'indices'
  | 'bonds'
  | 'economy'
  | 'options'
  | 'commodities';

export interface Asset {
  symbol: string;
  name: string;
  exchange: string;
  category: AssetCategory;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  marketCap?: string;
  digits: number;
  currency: string;
  peRatio?: number;
  week52High?: number;
  week52Low?: number;
  description?: string;
  // TradingView Symbol Search enhancements
  marketType?: 'spot' | 'swap' | 'index' | 'futures' | 'stock' | 'fund' | 'forex' | 'bond' | 'economy' | 'option';
  source?: string;
  isDefi?: boolean;
  isCex?: boolean;
  iconType?: string;
  subCategory?: string;
  /** Provenance of the displayed quote; bundled example values are not live quotes. */
  quoteStatus?: 'live' | 'delayed' | 'unavailable';
  quoteUpdatedAt?: number;
  /** Specific DEX pool locator; never infer this from a shared ticker. */
  pairAddress?: string;
  chainId?: string;
  feedSymbol?: string; // Provider-native market identifier (e.g., Hyperliquid coin)
}

export type Timeframe =
  | '1s'
  | '5s'
  | '15s'
  | '30s'
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '45m'
  | '1h'
  | '2h'
  | '3h'
  | '4h'
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '12M';

export type ChartType =
  | 'candlestick'
  | 'bar'
  | 'hollow'
  | 'heikin-ashi'
  | 'line'
  | 'area'
  | 'baseline'
  | 'column'
  | 'step-line'
  | 'high-low';

export interface OHLCV {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DrawingPoint {
  time: number;
  price: number;
}

export type DrawingToolType = 
  | 'cursor' 
  | 'crosshair' 
  // Lines
  | 'trendline' 
  | 'ray' 
  | 'info_line' 
  | 'extended_line' 
  | 'trend_angle' 
  | 'horizontal' 
  | 'horizontal_ray' 
  | 'vertical' 
  | 'crossline' 
  | 'bendline'
  // Channels
  | 'parallel_channel' 
  | 'regression_trend' 
  | 'flat_top_bottom' 
  | 'disjoint_channel' 
  // Pitchforks
  | 'pitchfork' 
  | 'schiff_pitchfork' 
  | 'modified_schiff_pitchfork' 
  | 'inside_pitchfork' 
  // Other tools
  | 'fibonacci' 
  | 'rectangle' 
  | 'text' 
  | 'measure';

export interface Drawing {
  id: string;
  type: DrawingToolType;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  label?: string;
  text?: string;
  controlPoint?: DrawingPoint; // For bendline Bézier control point
  channelOffset?: number; // Price offset for channel parallel lines
  channelPoint?: DrawingPoint; // 3rd point for parallel channel / pitchforks
}

export interface IndicatorSettings {
  // Overlays
  sma20: { enabled: boolean; period: number; color: string };
  sma50: { enabled: boolean; period: number; color: string };
  sma200: { enabled: boolean; period: number; color: string };
  ema9: { enabled: boolean; period: number; color: string };
  ema21: { enabled: boolean; period: number; color: string };
  bollingerBands: { enabled: boolean; period: number; stdDev: number; upperColor: string; middleColor: string; lowerColor: string; fillColor: string };
  vwap: { enabled: boolean; color: string };
  supertrend: { enabled: boolean; period: number; multiplier: number; upColor: string; downColor: string };
  volume: { enabled: boolean; upColor: string; downColor: string };

  // Sub-panes
  rsi: { enabled: boolean; period: number; overbought: number; oversold: number; color: string };
  macd: { enabled: boolean; fastPeriod: number; slowPeriod: number; signalPeriod: number; macdColor: string; signalColor: string; histUpColor: string; histDownColor: string };
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  isCustom?: boolean;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'cross_above' | 'cross_below';
  createdAt: number;
  triggered: boolean;
  paused?: boolean;
  notes?: string;
}

export interface AlertLogEntry {
  id: string;
  symbol: string;
  price: number;
  message: string;
  at: number;
}

export interface OrderBookItem {
  price: number;
  size: number;
  total: number;
}

export interface TradeItem {
  id: string;
  price: number;
  size: number;
  time: number;
  side: 'buy' | 'sell';
}

export interface MarketNews {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  symbol?: string;
  url: string;
}

export interface PaperTargetLevel {
  id:string;price:number;quantity:number;
}
export interface PaperPosition {
  id: string;
  symbol: string;
  exchange: string;
  side: 'Long' | 'Short';
  qty: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  leverage?: number;
  category?: AssetCategory;
  marketType?: Asset['marketType'];
  openedAt?: number;
  lastMarkedAt?: number;
  tp?: number;
  sl?: number;
  tpLevels?:PaperTargetLevel[];
  trailingPercent?:number;
  trailingAnchor?:number;
}

export interface PaperAccount {
  name: string;
  balance: number;
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  accountMargin: number;
  availableFunds: number;
  ordersMargin: number;
  marginBuffer: number;
}

export interface DetailedAlert {
  id: string;
  title: string;
  message: string;
  symbol: string;
  timeframe: string;
  status: 'Active' | 'Activating' | 'Triggered' | 'Paused';
  dateStr: string;
  type: 'trendline' | 'price' | 'indicator';
}

// ----------------------------------------------------
// Trade Journal (TradeZella & TraderSync) Types
// ----------------------------------------------------

export type JournalStatus = 'WIN' | 'LOSS' | 'OPEN' | 'BE';
export type JournalSide = 'LONG' | 'SHORT';

export interface JournalExecution {
  id: string;
  time: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  fee?: number;
}

export interface JournalTrade {
  id: string;
  symbol: string;
  side: JournalSide;
  status: JournalStatus;
  openDate: string; // e.g. "2025-04-22 09:34:12"
  closeDate?: string; // e.g. "2025-04-22 10:15:44"
  entryPrice: number;
  exitPrice?: number;
  size: number;
  cost: number;
  netReturn: number; // in $
  netReturnPercent: number; // in %
  setups: string[]; // e.g. ['BREAKOUT', 'REVERSAL', 'RSI CROSSED', 'BU-OB', 'GAP UP', 'BOUNCE']
  mistakes: string[]; // e.g. ["didn't set up stop loss", 'fomo', 'Greed', 'Market crash', 'News', 'Early exit']
  efficiency: number; // 0 to 100%
  note?: string;
  stopLoss?: number;
  takeProfit?: number;
  plannedRR?: number;
  realizedRR?: number;
  mfe?: number; // Maximum Favorable Excursion
  mae?: number; // Maximum Adverse Excursion
  emotion?: 'Confident' | 'Disciplined' | 'FOMO' | 'Greed' | 'Hesitant' | 'Revenge';
  screenshotUrl?: string;
  executions?: JournalExecution[];
  portfolio?: string; // e.g. 'Main Account', 'Crypto Prop', 'Scalp Desk'
}

export interface WaveScoreData {
  overall: number; // e.g. 78
  entry: number; // 0-100
  risk: number; // 0-100
  exit: number; // 0-100
  stability: number; // 0-100
  tempo: number; // 0-100
}

export type JournalTab = 
  | 'overview' 
  | 'calendar' 
  | 'trades' 
  | 'evaluator' 
  | 'ai-assistant';

export * from './types/conditionalOrders';

