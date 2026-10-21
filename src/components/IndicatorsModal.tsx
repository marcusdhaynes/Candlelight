import React, { useState } from 'react';
import { IndicatorSettings } from '../types';
import { X, Search, Check, SlidersHorizontal, BarChart3, TrendingUp, Activity } from 'lucide-react';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicators: IndicatorSettings;
  setIndicators: React.Dispatch<React.SetStateAction<IndicatorSettings>>;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  isOpen,
  onClose,
  indicators,
  setIndicators,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'trend' | 'oscillators' | 'volatility'>('all');

  if (!isOpen) return null;

  const indicatorList = [
    {
      id: 'sma20',
      name: 'Moving Average (SMA 20)',
      category: 'trend',
      description: 'Simple Moving Average 20 periods for short-term trend direction',
      enabled: indicators.sma20.enabled,
      color: indicators.sma20.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          sma20: { ...prev.sma20, enabled: !prev.sma20.enabled },
        })),
    },
    {
      id: 'sma50',
      name: 'Moving Average (SMA 50)',
      category: 'trend',
      description: 'Medium-term benchmark institutional trend filter',
      enabled: indicators.sma50.enabled,
      color: indicators.sma50.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          sma50: { ...prev.sma50, enabled: !prev.sma50.enabled },
        })),
    },
    {
      id: 'sma200',
      name: 'Moving Average (SMA 200)',
      category: 'trend',
      description: 'Long-term bull/bear market dividing line (Golden / Death Cross)',
      enabled: indicators.sma200.enabled,
      color: indicators.sma200.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          sma200: { ...prev.sma200, enabled: !prev.sma200.enabled },
        })),
    },
    {
      id: 'ema9',
      name: 'Exponential Moving Average (EMA 9)',
      category: 'trend',
      description: 'Fast responsive momentum exponential moving average',
      enabled: indicators.ema9.enabled,
      color: indicators.ema9.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          ema9: { ...prev.ema9, enabled: !prev.ema9.enabled },
        })),
    },
    {
      id: 'ema21',
      name: 'Exponential Moving Average (EMA 21)',
      category: 'trend',
      description: 'Dynamic support and pullback bounce continuation line',
      enabled: indicators.ema21.enabled,
      color: indicators.ema21.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          ema21: { ...prev.ema21, enabled: !prev.ema21.enabled },
        })),
    },
    {
      id: 'bollingerBands',
      name: 'Bollinger Bands (20, 2)',
      category: 'volatility',
      description: 'Volatility envelope showing dynamic standard deviation expansion/contraction',
      enabled: indicators.bollingerBands.enabled,
      color: indicators.bollingerBands.upperColor,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          bollingerBands: { ...prev.bollingerBands, enabled: !prev.bollingerBands.enabled },
        })),
    },
    {
      id: 'vwap',
      name: 'VWAP (Volume Weighted Average Price)',
      category: 'trend',
      description: 'Institutional volume-weighted benchmark average intraday price',
      enabled: indicators.vwap.enabled,
      color: indicators.vwap.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          vwap: { ...prev.vwap, enabled: !prev.vwap.enabled },
        })),
    },
    {
      id: 'volume',
      name: 'Volume (Histogram)',
      category: 'oscillators',
      description: 'Bar trading volume with green/red bar coloration',
      enabled: indicators.volume.enabled,
      color: indicators.volume.upColor,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          volume: { ...prev.volume, enabled: !prev.volume.enabled },
        })),
    },
    {
      id: 'rsi',
      name: 'Relative Strength Index (RSI 14)',
      category: 'oscillators',
      description: 'Wilder momentum oscillator tracking overbought (>70) and oversold (<30)',
      enabled: indicators.rsi.enabled,
      color: indicators.rsi.color,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          rsi: { ...prev.rsi, enabled: !prev.rsi.enabled },
        })),
    },
    {
      id: 'macd',
      name: 'MACD (12, 26, 9)',
      category: 'oscillators',
      description: 'Moving Average Convergence Divergence momentum oscillator with histogram',
      enabled: indicators.macd.enabled,
      color: indicators.macd.macdColor,
      toggle: () =>
        setIndicators((prev) => ({
          ...prev,
          macd: { ...prev.macd, enabled: !prev.macd.enabled },
        })),
    },
  ];

  const filtered = indicatorList.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div
      id="indicators-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="indicators-modal-window"
        className="bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2e39]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-[#2962ff]" />
            <h2 className="text-base font-semibold text-[#d1d4dc]">Indicators, Metrics & Strategies</h2>
          </div>
          <button
            id="close-indicators-modal-btn"
            onClick={onClose}
            className="text-[#787b86] hover:text-[#d1d4dc] p-1 rounded hover:bg-[#2a2e39] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[#2a2e39] bg-[#131722]/50">
          <div className="relative">
            <Search className="w-4 h-4 text-[#787b86] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-indicators-input"
              type="text"
              placeholder="Search indicators (e.g., RSI, Moving Average, Bollinger)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg pl-9 pr-3 py-2 text-sm text-[#d1d4dc] placeholder-[#787b86] focus:outline-none focus:border-[#2962ff]"
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mt-3">
            {[
              { id: 'all', label: 'All Indicators' },
              { id: 'trend', label: 'Trend' },
              { id: 'oscillators', label: 'Oscillators' },
              { id: 'volatility', label: 'Volatility' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                  activeCategory === cat.id
                    ? 'bg-[#2962ff] text-white'
                    : 'bg-[#131722] text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Indicators */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39] p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#787b86]">No indicators match your search.</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                id={`indicator-row-${item.id}`}
                onClick={item.toggle}
                className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition ${
                  item.enabled ? 'bg-[#2962ff]/10 border border-[#2962ff]/30' : 'hover:bg-[#2a2e39]/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <div className="text-sm font-medium text-[#d1d4dc] flex items-center gap-2">
                      {item.name}
                      {item.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2962ff] text-white font-mono">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#787b86] mt-0.5">{item.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                      item.enabled
                        ? 'bg-[#2962ff] text-white'
                        : 'border border-[#363c4e] text-transparent hover:border-[#2962ff]'
                    }`}
                  >
                    <Check className={`w-4 h-4 ${item.enabled ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2a2e39] bg-[#131722]/50 flex justify-between items-center text-xs text-[#787b86]">
          <span>
            {indicatorList.filter((i) => i.enabled).length} active indicator
            {indicatorList.filter((i) => i.enabled).length === 1 ? '' : 's'} on chart
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2962ff] text-white font-medium hover:bg-[#2962ff]/90 transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
