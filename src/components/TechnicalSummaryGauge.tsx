import React from 'react';
import { Asset, OHLCV } from '../types';
import { calculateRSI, calculateSMA, calculateEMA, calculateMACD } from '../services/indicators';

interface TechnicalSummaryGaugeProps {
  asset: Asset;
  candles: OHLCV[];
}

export const TechnicalSummaryGauge: React.FC<TechnicalSummaryGaugeProps> = React.memo(({ asset, candles }) => {
  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : 0;
  // Round to nearest 0.05% change to prevent micro fluctuations from triggering heavy indicator recalculation
  const priceKey = Math.round(lastClose * 1000);

  const metrics = React.useMemo(() => {
    if (candles.length < 30) return null;

    const currentPrice = candles[candles.length - 1].close;

    // Compute Oscillators
    const rsiData = calculateRSI(candles, 14);
    const latestRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 50;

    const macdData = calculateMACD(candles, 12, 26, 9);
    const latestMACD = macdData.length > 0 ? macdData[macdData.length - 1].histogram : 0;

    let oscBuy = 0;
    let oscNeutral = 0;
    let oscSell = 0;

    // RSI scoring
    if (latestRSI > 70) oscSell++;
    else if (latestRSI < 30) oscBuy++;
    else oscNeutral++;

    // MACD scoring
    if (latestMACD > 0) oscBuy++;
    else if (latestMACD < 0) oscSell++;
    else oscNeutral++;

    // Stochastic pseudo check
    if (latestRSI >= 45 && latestRSI <= 55) oscNeutral++;
    else if (latestRSI > 55) oscBuy++;
    else oscSell++;

    // Compute Moving Averages
    const sma20 = calculateSMA(candles, 20);
    const sma50 = calculateSMA(candles, Math.min(50, candles.length - 1));
    const ema9 = calculateEMA(candles, 9);
    const ema21 = calculateEMA(candles, 21);

    const valSma20 = sma20.length > 0 ? sma20[sma20.length - 1].value : currentPrice;
    const valSma50 = sma50.length > 0 ? sma50[sma50.length - 1].value : currentPrice;
    const valEma9 = ema9.length > 0 ? ema9[ema9.length - 1].value : currentPrice;
    const valEma21 = ema21.length > 0 ? ema21[ema21.length - 1].value : currentPrice;

    let maBuy = 0;
    let maNeutral = 0;
    let maSell = 0;

    [valSma20, valSma50, valEma9, valEma21].forEach((ma) => {
      if (currentPrice > ma * 1.001) maBuy++;
      else if (currentPrice < ma * 0.999) maSell++;
      else maNeutral++;
    });

    const totalBuy = oscBuy + maBuy;
    const totalSell = oscSell + maSell;
    const totalNeutral = oscNeutral + maNeutral;

    // Overall verdict
    let verdict: 'Strong Sell' | 'Sell' | 'Neutral' | 'Buy' | 'Strong Buy' = 'Neutral';
    let gaugeAngle = 0; // -90 deg (Strong Sell) to +90 deg (Strong Buy)

    if (totalBuy >= totalSell + 3) {
      verdict = 'Strong Buy';
      gaugeAngle = 65;
    } else if (totalBuy > totalSell) {
      verdict = 'Buy';
      gaugeAngle = 30;
    } else if (totalSell >= totalBuy + 3) {
      verdict = 'Strong Sell';
      gaugeAngle = -65;
    } else if (totalSell > totalBuy) {
      verdict = 'Sell';
      gaugeAngle = -30;
    } else {
      verdict = 'Neutral';
      gaugeAngle = 0;
    }

    const verdictColor =
      verdict === 'Strong Buy' || verdict === 'Buy'
        ? '#089981'
        : verdict === 'Strong Sell' || verdict === 'Sell'
        ? '#f23645'
        : '#787b86';

    return {
      latestRSI,
      oscBuy,
      oscNeutral,
      oscSell,
      maBuy,
      maNeutral,
      maSell,
      totalBuy,
      totalNeutral,
      totalSell,
      verdict,
      verdictColor,
      gaugeAngle,
    };
  }, [asset.symbol, candles.length, priceKey]);

  if (!metrics) {
    return (
      <div className="p-6 text-center text-xs text-[#787b86]">
        Calculating indicators for {asset.symbol}...
      </div>
    );
  }

  const {
    latestRSI,
    oscBuy,
    oscNeutral,
    oscSell,
    maBuy,
    maNeutral,
    maSell,
    totalBuy,
    totalNeutral,
    totalSell,
    verdict,
    verdictColor,
    gaugeAngle,
  } = metrics;

  return (
    <div id="technical-summary-panel" className="p-2.5 flex flex-col items-center bg-[#131722] text-[#d1d4dc] select-none">
      <div className="text-[10.5px] font-semibold text-[#787b86] uppercase tracking-wider mb-1">
        Technical Analysis Summary
      </div>

      {/* SVG Speedometer Gauge */}
      <div className="relative w-40 h-24 my-1 flex items-center justify-center">
        <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
          {/* Gauge background arc segments */}
          {/* Strong Sell */}
          <path
            d="M 20 100 A 80 80 0 0 1 45 45"
            fill="none"
            stroke="#f23645"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Sell */}
          <path
            d="M 50 40 A 80 80 0 0 1 85 22"
            fill="none"
            stroke="#f23645"
            strokeOpacity="0.5"
            strokeWidth="12"
          />
          {/* Neutral */}
          <path
            d="M 90 21 A 80 80 0 0 1 110 21"
            fill="none"
            stroke="#787b86"
            strokeWidth="12"
          />
          {/* Buy */}
          <path
            d="M 115 22 A 80 80 0 0 1 150 40"
            fill="none"
            stroke="#089981"
            strokeOpacity="0.5"
            strokeWidth="12"
          />
          {/* Strong Buy */}
          <path
            d="M 155 45 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#089981"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Needle pivot */}
          <circle cx="100" cy="100" r="6" fill="#d1d4dc" />

          {/* Needle */}
          <g transform={`rotate(${gaugeAngle}, 100, 100)`}>
            <polygon points="98,100 102,100 100,34" fill="#d1d4dc" />
          </g>
        </svg>

        {/* Labels below */}
        <div className="absolute bottom-0 text-center">
          <div
            className="text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ color: verdictColor }}
          >
            {verdict}
          </div>
        </div>
      </div>

      {/* Tally Breakdown */}
      <div className="w-full grid grid-cols-3 gap-1.5 bg-[#1e222d] border border-[#2a2e39] rounded-lg p-1.5 my-2 text-center">
        <div>
          <div className="text-[9px] text-[#f23645] font-semibold">SELL</div>
          <div className="text-sm font-bold font-mono text-[#f23645]">{totalSell}</div>
        </div>
        <div className="border-x border-[#2a2e39]">
          <div className="text-[9px] text-[#787b86] font-semibold">NEUTRAL</div>
          <div className="text-sm font-bold font-mono text-[#787b86]">{totalNeutral}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#089981] font-semibold">BUY</div>
          <div className="text-sm font-bold font-mono text-[#089981]">{totalBuy}</div>
        </div>
      </div>

      {/* Sub-breakdowns for Oscillators & Moving Averages */}
      <div className="w-full space-y-1.5 text-[10.5px]">
        <div className="bg-[#1e222d]/60 border border-[#2a2e39] rounded p-2">
          <div className="flex justify-between items-center mb-0.5">
            <span className="font-medium text-[#d1d4dc]">Oscillators</span>
            <span className="text-[9px] text-[#787b86]">RSI: {latestRSI.toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#f23645]">{oscSell} Sell</span>
            <span className="text-[#787b86]">{oscNeutral} Neutral</span>
            <span className="text-[#089981]">{oscBuy} Buy</span>
          </div>
        </div>

        <div className="bg-[#1e222d]/60 border border-[#2a2e39] rounded p-2">
          <div className="flex justify-between items-center mb-0.5">
            <span className="font-medium text-[#d1d4dc]">Moving Averages</span>
            <span className="text-[9px] text-[#787b86]">SMA & EMA</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#f23645]">{maSell} Sell</span>
            <span className="text-[#787b86]">{maNeutral} Neutral</span>
            <span className="text-[#089981]">{maBuy} Buy</span>
          </div>
        </div>
      </div>
    </div>
  );
});
