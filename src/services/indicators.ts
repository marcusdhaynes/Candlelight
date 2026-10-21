import { OHLCV } from '../types';

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(data: OHLCV[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  result.push({ time: data[period - 1].time, value: sum / period });

  for (let i = period; i < data.length; i++) {
    sum += data[i].close - data[i - period].close;
    result.push({ time: data[i].time, value: sum / period });
  }

  return result;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: OHLCV[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  const k = 2 / (period + 1);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEMA = sum / period;
  result.push({ time: data[period - 1].time, value: prevEMA });

  for (let i = period; i < data.length; i++) {
    const currentClose = data[i].close;
    const currentEMA = (currentClose - prevEMA) * k + prevEMA;
    result.push({ time: data[i].time, value: currentEMA });
    prevEMA = currentEMA;
  }

  return result;
}

/**
 * Calculates Bollinger Bands (Upper, Middle, Lower)
 */
export function calculateBollingerBands(
  data: OHLCV[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerPoint[] {
  const result: BollingerPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const middle = sum / period;

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j].close - middle, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    result.push({
      time: data[i].time,
      middle,
      upper: middle + stdDevMultiplier * stdDev,
      lower: middle - stdDevMultiplier * stdDev,
    });
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI - Wilder's Smoothing)
 */
export function calculateRSI(data: OHLCV[], period: number = 14): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = 100 - 100 / (1 + firstRS);
  result.push({ time: data[period].time, value: firstRSI });

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    result.push({ time: data[i].time, value: rsi });
  }

  return result;
}

/**
 * Calculates Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  data: OHLCV[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdPoint[] {
  const result: MacdPoint[] = [];
  if (data.length < slowPeriod + signalPeriod) return result;

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  // Align slow and fast EMA by timestamp
  const fastMap = new Map<number, number>();
  fastEMA.forEach((p) => fastMap.set(p.time, p.value));

  const macdLinePoints: { time: number; value: number }[] = [];
  slowEMA.forEach((slowPoint) => {
    const fastVal = fastMap.get(slowPoint.time);
    if (fastVal !== undefined) {
      macdLinePoints.push({
        time: slowPoint.time,
        value: fastVal - slowPoint.value,
      });
    }
  });

  if (macdLinePoints.length < signalPeriod) return result;

  // Calculate Signal line (EMA of MACD line)
  const k = 2 / (signalPeriod + 1);
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLinePoints[i].value;
  }
  let prevSignal = sum / signalPeriod;

  result.push({
    time: macdLinePoints[signalPeriod - 1].time,
    macd: macdLinePoints[signalPeriod - 1].value,
    signal: prevSignal,
    histogram: macdLinePoints[signalPeriod - 1].value - prevSignal,
  });

  for (let i = signalPeriod; i < macdLinePoints.length; i++) {
    const currentMacd = macdLinePoints[i].value;
    const currentSignal = (currentMacd - prevSignal) * k + prevSignal;
    result.push({
      time: macdLinePoints[i].time,
      macd: currentMacd,
      signal: currentSignal,
      histogram: currentMacd - currentSignal,
    });
    prevSignal = currentSignal;
  }

  return result;
}

/**
 * Calculates Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(data: OHLCV[]): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  let cumTypicalPriceVol = 0;
  let cumVol = 0;

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const vol = data[i].volume;
    cumTypicalPriceVol += typicalPrice * vol;
    cumVol += vol;

    const vwap = cumVol > 0 ? cumTypicalPriceVol / cumVol : data[i].close;
    result.push({ time: data[i].time, value: vwap });
  }

  return result;
}

/**
 * Transforms standard OHLCV into Heikin-Ashi candles
 */
export function convertToHeikinAshi(data: OHLCV[]): OHLCV[] {
  if (data.length === 0) return [];
  const result: OHLCV[] = [];

  let prevOpen = data[0].open;
  let prevClose = data[0].close;

  for (let i = 0; i < data.length; i++) {
    const original = data[i];
    const haClose = (original.open + original.high + original.low + original.close) / 4;
    const haOpen = i === 0 ? (original.open + original.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(original.high, haOpen, haClose);
    const haLow = Math.min(original.low, haOpen, haClose);

    result.push({
      time: original.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: original.volume,
    });

    prevOpen = haOpen;
    prevClose = haClose;
  }

  return result;
}
