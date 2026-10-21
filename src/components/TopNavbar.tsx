import React, { useState, useEffect } from 'react';
import { Asset, ChartType, Timeframe, IndicatorSettings, DrawingToolType } from '../types';
import {
  Search,
  CandlestickChart,
  LineChart,
  AreaChart,
  BarChart2,
  SlidersHorizontal,
  Bell,
  Camera,
  PictureInPicture2,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Cloud,
  Settings,
  LayoutGrid,
  TrendingUp,
  GripVertical,
  Minus,
  Type,
  Maximize,
  Star,
} from 'lucide-react';
import { LayoutTemplate, LayoutSyncSettings, SavedChartLayout } from '../types/layout';
import { LayoutDropdown } from './layout/LayoutDropdown';
import { LayoutManagerDropdown } from './layout/LayoutManagerDropdown';

interface TimeframeCategory {
  id: string;
  title: string;
  items: { tf: Timeframe; label: string }[];
}

const CHRONOLOGICAL_CATEGORIES: TimeframeCategory[] = [
  {
    id: 'seconds',
    title: 'Seconds',
    items: [
      { tf: '1s', label: '1 second' },
      { tf: '5s', label: '5 seconds' },
      { tf: '15s', label: '15 seconds' },
      { tf: '30s', label: '30 seconds' },
    ],
  },
  {
    id: 'minutes',
    title: 'Minutes',
    items: [
      { tf: '1m', label: '1 minute' },
      { tf: '3m', label: '3 minutes' },
      { tf: '5m', label: '5 minutes' },
      { tf: '15m', label: '15 minutes' },
      { tf: '30m', label: '30 minutes' },
      { tf: '45m', label: '45 minutes' },
    ],
  },
  {
    id: 'hours',
    title: 'Hours',
    items: [
      { tf: '1h', label: '1 hour' },
      { tf: '2h', label: '2 hours' },
      { tf: '3h', label: '3 hours' },
      { tf: '4h', label: '4 hours' },
    ],
  },
  {
    id: 'days',
    title: 'Days & Weeks',
    items: [
      { tf: '1D', label: '1 day' },
      { tf: '1W', label: '1 week' },
      { tf: '1M', label: '1 month' },
      { tf: '3M', label: '3 months' },
      { tf: '12M', label: '12 months' },
    ],
  },
];

const ALL_TIMEFRAMES_CHRONOLOGICAL: Timeframe[] = [
  '1s',
  '5s',
  '15s',
  '30s',
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '45m',
  '1h',
  '2h',
  '3h',
  '4h',
  '1D',
  '1W',
  '1M',
  '3M',
  '12M',
];

interface TopNavbarProps {
  activeAsset: Asset;
  activeTimeframe: Timeframe;
  setActiveTimeframe: (tf: Timeframe) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  onOpenSymbolSearch: () => void;
  onOpenIndicators: () => void;
  onOpenAlerts: () => void;
  indicators: IndicatorSettings;
  onTakeSnapshot?: () => void;
  onTogglePip?: () => void;
  isPipActive?: boolean;
  onUndoDrawing: () => void;
  onRedoDrawing: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectQuickTool?: (tool: DrawingToolType) => void;
  activeTool?: DrawingToolType;
  onToggleTradingPanel?: () => void;
  marketStatus?: { connected: boolean; provider: string; latencyMs: number };
  // Window Layout & Multi-Chart Management
  currentTemplateId: string;
  onSelectTemplate: (template: LayoutTemplate) => void;
  syncSettings: LayoutSyncSettings;
  onUpdateSyncSettings: (settings: LayoutSyncSettings) => void;
  currentLayout: SavedChartLayout;
  savedLayouts: SavedChartLayout[];
  onSaveLayout: () => void;
  onAutosaveToggle: (enabled: boolean) => void;
  onShareToggle: (enabled: boolean) => void;
  onMakeCopy: (newName: string) => void;
  onRename: (newName: string) => void;
  onDownloadData: () => void;
  onCreateNewLayout: () => void;
  onSelectLayout: (layout: SavedChartLayout) => void;
  onDeleteLayout: (id: string) => void;
  isLayoutDropdownOpen: boolean;
  setIsLayoutDropdownOpen: (open: boolean) => void;
  isLayoutManagerOpen: boolean;
  setIsLayoutManagerOpen: (open: boolean) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = React.memo(({
  activeAsset,
  activeTimeframe,
  setActiveTimeframe,
  chartType,
  setChartType,
  onOpenSymbolSearch,
  onOpenIndicators,
  onOpenAlerts,
  indicators,
  onTakeSnapshot,
  onTogglePip,
  isPipActive = false,
  onUndoDrawing,
  onRedoDrawing,
  canUndo,
  canRedo,
  isFullscreen,
  onToggleFullscreen,
  onSelectQuickTool,
  activeTool,
  onToggleTradingPanel,
  marketStatus,
  currentTemplateId,
  onSelectTemplate,
  syncSettings,
  onUpdateSyncSettings,
  currentLayout,
  savedLayouts,
  onSaveLayout,
  onAutosaveToggle,
  onShareToggle,
  onMakeCopy,
  onRename,
  onDownloadData,
  onCreateNewLayout,
  onSelectLayout,
  onDeleteLayout,
  isLayoutDropdownOpen,
  setIsLayoutDropdownOpen,
  isLayoutManagerOpen,
  setIsLayoutManagerOpen,
}) => {
  const [isChartTypeOpen, setIsChartTypeOpen] = useState(false);
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);

  const [favoriteTimeframes, setFavoriteTimeframes] = useState<Timeframe[]>(() => {
    const saved = localStorage.getItem('tv_favorite_timeframes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return ['1m', '5m', '15m', '30m', '1h', '4h'];
  });

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('tv_tf_collapsed_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('tv_favorite_timeframes', JSON.stringify(favoriteTimeframes));
  }, [favoriteTimeframes]);

  useEffect(() => {
    localStorage.setItem('tv_tf_collapsed_categories', JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  const toggleFavoriteTimeframe = (tf: Timeframe, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((item) => item !== tf) : [...prev, tf]
    );
  };

  const toggleCategoryCollapse = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Favorited intervals displayed as buttons on the left, ordered chronologically
  const favoritedButtons = ALL_TIMEFRAMES_CHRONOLOGICAL.filter((tf) =>
    favoriteTimeframes.includes(tf)
  );

  // If the active timeframe is not among the starred favorites, show it as an additional button so the user knows what's selected
  const visibleButtons = [...favoritedButtons];
  if (!favoriteTimeframes.includes(activeTimeframe)) {
    visibleButtons.push(activeTimeframe);
  }

  const chartTypes: { id: ChartType; label: string; group: string; icon: React.ReactNode }[] = [
    {
      id: 'candlestick',
      label: 'Candles',
      group: 'Candles & Bars',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="9" y1="2" x2="9" y2="6" />
          <rect x="6" y="6" width="6" height="11" fill="currentColor" fillOpacity="0.8" rx="0.5" />
          <line x1="9" y1="17" x2="9" y2="22" />
          <line x1="16" y1="5" x2="16" y2="9" />
          <rect x="13" y="9" width="6" height="7" fill="none" stroke="currentColor" rx="0.5" />
          <line x1="16" y1="16" x2="16" y2="20" />
        </svg>
      ),
    },
    {
      id: 'bar',
      label: 'Bars',
      group: 'Candles & Bars',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="3" x2="8" y2="21" />
          <line x1="5" y1="8" x2="8" y2="8" />
          <line x1="8" y1="15" x2="11" y2="15" />
          <line x1="16" y1="5" x2="16" y2="19" />
          <line x1="13" y1="14" x2="16" y2="14" />
          <line x1="16" y1="9" x2="19" y2="9" />
        </svg>
      ),
    },
    {
      id: 'hollow',
      label: 'Hollow Candles',
      group: 'Candles & Bars',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="3" x2="8" y2="7" />
          <rect x="5" y="7" width="6" height="9" fill="none" stroke="currentColor" rx="0.5" />
          <line x1="8" y1="16" x2="8" y2="21" />
          <line x1="16" y1="4" x2="16" y2="9" />
          <rect x="13" y="9" width="6" height="7" fill="currentColor" rx="0.5" />
          <line x1="16" y1="16" x2="16" y2="20" />
        </svg>
      ),
    },
    {
      id: 'heikin-ashi',
      label: 'Heikin Ashi',
      group: 'Candles & Bars',
      icon: (
        <svg className="w-4 h-4 text-[#2962ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="9" y1="3" x2="9" y2="6" />
          <rect x="6" y="6" width="6" height="12" fill="currentColor" fillOpacity="0.9" rx="0.5" />
          <line x1="9" y1="18" x2="9" y2="21" />
          <line x1="16" y1="6" x2="16" y2="8" />
          <rect x="13" y="8" width="6" height="9" fill="currentColor" fillOpacity="0.4" rx="0.5" />
          <line x1="16" y1="17" x2="16" y2="19" />
        </svg>
      ),
    },
    {
      id: 'line',
      label: 'Line',
      group: 'Continuous Lines',
      icon: <LineChart className="w-4 h-4" />,
    },
    {
      id: 'area',
      label: 'Area',
      group: 'Continuous Lines',
      icon: <AreaChart className="w-4 h-4" />,
    },
    {
      id: 'baseline',
      label: 'Baseline',
      group: 'Continuous Lines',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <line x1="2" y1="12" x2="22" y2="12" stroke="#787b86" strokeDasharray="2 2" />
          <path d="M3 14 L8 7 L13 9 L17 4 L21 6" stroke="#089981" />
          <path d="M3 14 L8 7 L13 9 L17 4 L21 6 L21 12 L3 12 Z" fill="#089981" fillOpacity="0.25" stroke="none" />
          <path d="M3 12 L7 17 L12 15 L17 20 L21 18" stroke="#f23645" />
          <path d="M3 12 L7 17 L12 15 L17 20 L21 18 L21 12 Z" fill="#f23645" fillOpacity="0.2" stroke="none" />
        </svg>
      ),
    },
    {
      id: 'step-line',
      label: 'Step Line',
      group: 'Continuous Lines',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 18 L8 18 L8 12 L14 12 L14 6 L21 6" />
        </svg>
      ),
    },
    {
      id: 'column',
      label: 'Columns',
      group: 'Range & Distribution',
      icon: <BarChart2 className="w-4 h-4" />,
    },
    {
      id: 'high-low',
      label: 'High-Low',
      group: 'Range & Distribution',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="4" x2="6" y2="20" />
          <line x1="12" y1="8" x2="12" y2="17" />
          <line x1="18" y1="6" x2="18" y2="19" />
        </svg>
      ),
    },
  ];

  const [favoriteChartTypes, setFavoriteChartTypes] = useState<ChartType[]>(() => {
    const saved = localStorage.getItem('tv_favorite_chart_types');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return ['candlestick'];
  });

  useEffect(() => {
    localStorage.setItem('tv_favorite_chart_types', JSON.stringify(favoriteChartTypes));
  }, [favoriteChartTypes]);

  const toggleFavoriteChartType = (cType: ChartType, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteChartTypes((prev) =>
      prev.includes(cType) ? prev.filter((item) => item !== cType) : [...prev, cType]
    );
  };

  // Favorited chart styles displayed as quick buttons within this section
  const visibleChartTypeButtons = chartTypes
    .filter((ct) => favoriteChartTypes.includes(ct.id))
    .map((ct) => ct.id);

  // If the active chart type is not in favorites, show it so user has immediate active feedback
  if (!visibleChartTypeButtons.includes(chartType)) {
    visibleChartTypeButtons.push(chartType);
  }

  const activeIndicatorsCount =
    (indicators.sma20.enabled ? 1 : 0) +
    (indicators.sma50.enabled ? 1 : 0) +
    (indicators.sma200.enabled ? 1 : 0) +
    (indicators.ema9.enabled ? 1 : 0) +
    (indicators.ema21.enabled ? 1 : 0) +
    (indicators.bollingerBands.enabled ? 1 : 0) +
    (indicators.vwap.enabled ? 1 : 0) +
    (indicators.rsi.enabled ? 1 : 0) +
    (indicators.macd.enabled ? 1 : 0) +
    (indicators.volume.enabled ? 1 : 0);

  const renderAssetIcon = (asset: Asset) => {
    const sym = asset.symbol.toUpperCase();
    if (sym.includes('BTC') || sym.includes('XBT')) {
      return (
        <div className="w-4 h-4 rounded-full bg-[#f7931a] flex items-center justify-center text-white font-bold text-[9px] shrink-0 shadow-2xs">
          ₿
        </div>
      );
    }
    if (sym.includes('ETH')) {
      return (
        <div className="w-4 h-4 rounded-full bg-[#627eea] flex items-center justify-center text-white text-[9px] shrink-0 shadow-2xs">
          Ξ
        </div>
      );
    }
    if (sym.includes('SOL')) {
      return (
        <div className="w-4 h-4 rounded-full bg-[#131722] border border-[#2a2e39] flex items-center justify-center shrink-0">
          <div className="w-2.5 h-2 flex flex-col justify-between">
            <div className="h-0.5 w-full bg-[#00ffa3] rounded-xs" />
            <div className="h-0.5 w-full bg-[#dc1fff] rounded-xs" />
          </div>
        </div>
      );
    }
    if (sym.includes('ARB')) {
      return (
        <div className="w-4 h-4 rounded-full bg-[#28a0f0] flex items-center justify-center text-white font-bold text-[8px] shrink-0 shadow-2xs">
          A
        </div>
      );
    }
    if (sym.includes('BNB')) {
      return (
        <div className="w-4 h-4 rounded-full bg-[#f3ba2f] flex items-center justify-center text-black font-bold text-[8px] shrink-0">
          ❖
        </div>
      );
    }
    if (sym.includes('XRP')) {
      return (
        <div className="w-4 h-4 rounded-full bg-black border border-[#2a2e39] flex items-center justify-center text-white font-bold text-[8px] shrink-0">
          ✕
        </div>
      );
    }
    if (sym.includes('DOGE')) {
      return (
        <div className="w-4 h-4 rounded-full bg-[#c2a633] flex items-center justify-center text-white font-bold text-[8px] shrink-0">
          Ð
        </div>
      );
    }
    return (
      <div className="w-4 h-4 rounded-full bg-[#2a2e39] flex items-center justify-center text-white font-bold text-[8px] shrink-0">
        {sym.replace(/^PF_/, '').replace(/^PI_/, '').slice(0, 1)}
      </div>
    );
  };

  return (
    <header
      id="tradingview-top-navbar"
      className="h-8 bg-[#131722] border-b border-[#2a2e39] px-1.5 flex items-center justify-between text-[11px] select-none z-50 shrink-0 relative overflow-visible"
    >
      {/* Left Section: User Avatar, Symbol Search, Timeframes, Chart Styles, Indicators, Tools */}
      <div className="flex items-center gap-0.5 py-0.5 overflow-visible">
        {/* User Avatar with Green Circle 'M' and Red Badge '7' */}
        <div className="relative mr-1 shrink-0 cursor-pointer">
          <div className="w-5.5 h-5.5 rounded-full bg-[#089981] flex items-center justify-center font-bold text-white text-[10px] shadow-xs">
            M
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f23645] text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-[#131722]">
            7
          </span>
        </div>

        {/* Symbol Button with Search Modal Trigger */}
        <div className="flex items-center bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] rounded transition px-1 py-0.5 gap-1 shadow-xs">
          <button
            id="symbol-search-trigger"
            onClick={onOpenSymbolSearch}
            className="flex items-center gap-1.5 font-bold text-[#d1d4dc] hover:text-white text-[11px]"
            title={`Symbol Search: ${activeAsset.symbol} - ${activeAsset.name} (${activeAsset.source || activeAsset.exchange})`}
          >
            {renderAssetIcon(activeAsset)}
            <span className="text-white font-bold tracking-tight">{activeAsset.symbol}</span>
            <span className="text-[9px] text-[#787b86] font-medium uppercase px-1 py-0.2 bg-[#131722] rounded-xs">
              {activeAsset.source || activeAsset.exchange}
            </span>
            {marketStatus?.connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#089981] animate-pulse" title="Real-Time Market Stream Connected" />
            )}
            <Search className="w-3 h-3 text-[#787b86]" />
          </button>
          <div className="h-3 w-px bg-[#2a2e39]" />
          <button
            id="compare-symbol-btn"
            onClick={onOpenSymbolSearch}
            className="p-0.5 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#131722] rounded transition"
            title="Compare or Add Symbol (+)"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

        {/* Timeframe Selectors: buttons to the left are favorited/starred intervals */}
        <div className="flex items-center gap-0.5">
          {visibleButtons.map((tf) => (
            <button
              key={tf}
              id={`tf-btn-${tf}`}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                activeTimeframe === tf
                  ? 'bg-[#2962ff] text-white font-semibold shadow-xs'
                  : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
              }`}
              title={`Timeframe ${tf}`}
            >
              {tf}
            </button>
          ))}

          {/* Timeframe Dropdown with Collapsible Chronological Categories */}
          <div className="relative z-50">
            <button
              id="timeframe-dropdown-trigger"
              onClick={() => setIsTimeframeDropdownOpen(!isTimeframeDropdownOpen)}
              className={`p-0.5 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition ${
                isTimeframeDropdownOpen ? 'bg-[#1e222d] text-[#2962ff]' : ''
              }`}
              title="More intervals"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {isTimeframeDropdownOpen && (
              <>
                {/* Backdrop to close dropdown on click outside */}
                <div
                  className="fixed inset-0 z-[95] cursor-default"
                  onClick={() => setIsTimeframeDropdownOpen(false)}
                />

                <div
                  id="timeframe-collapsible-dropdown"
                  className="absolute top-full left-0 mt-1 w-56 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-[100] max-h-96 overflow-y-auto scrollbar-thin select-none"
                >
                  <div className="px-3 py-1 text-[11px] font-semibold text-[#d1d4dc] border-b border-[#2a2e39]/60 mb-0.5 flex items-center justify-between">
                    <span>Intervals</span>
                    <span className="text-[10px] text-[#787b86] font-normal">Click ★ to pin</span>
                  </div>

                  {CHRONOLOGICAL_CATEGORIES.map((category) => {
                    const isCollapsed = Boolean(collapsedCategories[category.id]);
                    return (
                      <div key={category.id} className="border-b border-[#2a2e39]/30 last:border-b-0 py-0.5">
                        {/* Collapsible Category Header */}
                        <div
                          onClick={(e) => toggleCategoryCollapse(category.id, e)}
                          className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-[#787b86] uppercase tracking-wider cursor-pointer hover:text-[#d1d4dc] hover:bg-[#2a2e39]/40 transition rounded mx-1"
                        >
                          <div className="flex items-center gap-1.5">
                            {isCollapsed ? (
                              <ChevronRight className="w-3 h-3 text-[#787b86]" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-[#787b86]" />
                            )}
                            <span>{category.title}</span>
                          </div>
                          <span className="text-[9px] text-[#787b86]/70 font-mono">
                            {category.items.length}
                          </span>
                        </div>

                        {/* Category Items */}
                        {!isCollapsed && (
                          <div className="flex flex-col mt-0.5">
                            {category.items.map((item) => {
                              const isFav = favoriteTimeframes.includes(item.tf);
                              const isActive = activeTimeframe === item.tf;
                              return (
                                <div
                                  key={item.tf}
                                  id={`timeframe-option-${item.tf}`}
                                  onClick={() => {
                                    setActiveTimeframe(item.tf);
                                    setIsTimeframeDropdownOpen(false);
                                  }}
                                  className={`flex items-center justify-between px-2.5 py-1 text-xs cursor-pointer group transition mx-1 rounded ${
                                    isActive
                                      ? 'bg-[#2962ff]/20 text-[#2962ff] font-semibold'
                                      : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-7 font-mono text-left font-semibold">{item.tf}</span>
                                    <span className="text-[11px] text-[#787b86] group-hover:text-[#d1d4dc]">
                                      {item.label}
                                    </span>
                                  </div>
                                  <button
                                    id={`star-tf-${item.tf}`}
                                    onClick={(e) => toggleFavoriteTimeframe(item.tf, e)}
                                    className={`p-1 rounded transition hover:scale-110 ${
                                      isFav
                                        ? 'text-[#ffb74d]'
                                        : 'text-transparent group-hover:text-[#787b86] hover:!text-[#ffb74d]'
                                    }`}
                                    title={isFav ? 'Remove from favorite buttons' : 'Add to favorite buttons'}
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${isFav ? 'fill-[#ffb74d]' : ''}`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

        {/* Chart Style Section: favorited chart type buttons + dropdown menu */}
        <div className="relative z-50 flex items-center gap-0.5">
          {visibleChartTypeButtons.map((tId) => {
            const item = chartTypes.find((c) => c.id === tId);
            if (!item) return null;
            const isActive = chartType === tId;
            return (
              <button
                key={tId}
                id={`chart-type-btn-${tId}`}
                onClick={() => setChartType(tId)}
                className={`p-1 rounded transition flex items-center justify-center ${
                  isActive
                    ? 'bg-[#2962ff] text-white shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
                }`}
                title={item.label}
              >
                {item.icon}
              </button>
            );
          })}

          <button
            id="chart-type-selector-btn"
            onClick={() => setIsChartTypeOpen(!isChartTypeOpen)}
            className={`p-0.5 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition ${
              isChartTypeOpen ? 'bg-[#1e222d] text-[#2962ff]' : ''
            }`}
            title="Chart Style"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          {isChartTypeOpen && (
            <>
              <div
                className="fixed inset-0 z-[95] cursor-default"
                onClick={() => setIsChartTypeOpen(false)}
              />
              <div
                id="chart-type-dropdown-menu"
                className="absolute top-full left-0 mt-1 w-52 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-[100] select-none max-h-[85vh] overflow-y-auto"
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-[#d1d4dc] border-b border-[#2a2e39]/60 mb-1 flex items-center justify-between">
                  <span>Chart Styles</span>
                  <span className="text-[10px] text-[#787b86] font-normal">Click ★ to pin</span>
                </div>
                {['Candles & Bars', 'Continuous Lines', 'Range & Distribution'].map((grpName, grpIdx) => {
                  const grpItems = chartTypes.filter((c) => c.group === grpName);
                  if (grpItems.length === 0) return null;
                  return (
                    <div key={grpName} className="mb-1">
                      {grpIdx > 0 && <div className="h-px bg-[#2a2e39]/50 my-1 mx-2" />}
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
                        {grpName}
                      </div>
                      {grpItems.map((item) => {
                        const isFav = favoriteChartTypes.includes(item.id);
                        const isActive = chartType === item.id;
                        return (
                          <div
                            key={item.id}
                            id={`chart-type-option-${item.id}`}
                            onClick={() => {
                              setChartType(item.id);
                              setIsChartTypeOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer group transition mx-1 rounded ${
                              isActive
                                ? 'bg-[#2962ff]/20 text-[#2962ff] font-semibold'
                                : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={
                                  isActive
                                    ? 'text-[#2962ff]'
                                    : 'text-[#787b86] group-hover:text-[#d1d4dc]'
                                }
                              >
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </div>
                            <button
                              id={`star-chart-type-${item.id}`}
                              onClick={(e) => toggleFavoriteChartType(item.id, e)}
                              className={`p-1 rounded transition hover:scale-110 ${
                                isFav
                                  ? 'text-[#ffb74d]'
                                  : 'text-transparent group-hover:text-[#787b86] hover:!text-[#ffb74d]'
                              }`}
                              title={
                                isFav
                                  ? 'Remove from favorite buttons'
                                  : 'Add to favorite buttons'
                              }
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  isFav ? 'fill-[#ffb74d]' : ''
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

        {/* Indicators Dialog Trigger */}
        <button
          id="open-indicators-modal-btn"
          onClick={onOpenIndicators}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#1e222d] text-[#d1d4dc] hover:text-white transition font-medium text-[11px]"
        >
          <SlidersHorizontal className="w-3 h-3 text-[#2962ff]" />
          <span>Indicators</span>
          {activeIndicatorsCount > 0 && (
            <span className="ml-0.5 px-1 py-0.2 bg-[#2962ff]/20 text-[#2962ff] rounded-full text-[9px] font-bold">
              {activeIndicatorsCount}
            </span>
          )}
          <ChevronDown className="w-2.5 h-2.5 text-[#787b86]" />
        </button>

        {/* Multi-Chart Quad Split Grid Icon */}
        <button
          className="p-1 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          title="Select Chart Layout Grid"
        >
          <LayoutGrid className="w-3 h-3" />
        </button>

        {/* Alert Trigger */}
        <button
          id="open-alerts-modal-btn"
          onClick={onOpenAlerts}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition text-[11px]"
          title="Create Price Alert"
        >
          <Bell className="w-3 h-3" />
          <span>Alert</span>
        </button>

        {/* Bar Replay Trigger */}
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition text-[11px]"
          title="Bar Replay Simulator"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Replay</span>
        </button>

        <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            id="undo-drawing-btn"
            onClick={onUndoDrawing}
            disabled={!canUndo}
            className={`p-1 rounded transition ${
              canUndo ? 'text-[#d1d4dc] hover:bg-[#1e222d]' : 'text-[#787b86]/40 cursor-not-allowed'
            }`}
            title="Undo Drawing (Ctrl+Z)"
          >
            <Undo2 className="w-3 h-3" />
          </button>
          <button
            id="redo-drawing-btn"
            onClick={onRedoDrawing}
            disabled={!canRedo}
            className={`p-1 rounded transition ${
              canRedo ? 'text-[#d1d4dc] hover:bg-[#1e222d]' : 'text-[#787b86]/40 cursor-not-allowed'
            }`}
            title="Redo Drawing (Ctrl+Y)"
          >
            <Redo2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Center Floating Quick Drawing Favorite Pill Toolbar (as shown in screenshot!) */}
      <div className="hidden xl:flex items-center gap-0.5 bg-[#1e222d] border border-[#2a2e39] rounded-md px-1.5 py-0.5 shadow-md">
        <GripVertical className="w-2.5 h-2.5 text-[#787b86] cursor-grab" />
        <button
          onClick={() => onSelectQuickTool?.('trendline')}
          className={`p-0.5 rounded transition ${
            activeTool === 'trendline' ? 'bg-[#2962ff] text-white' : 'text-[#787b86] hover:text-white'
          }`}
          title="Trend Line"
        >
          <span className="font-bold text-[11px]">/</span>
        </button>
        <button
          onClick={() => onSelectQuickTool?.('ray')}
          className={`p-0.5 rounded transition ${
            activeTool === 'ray' ? 'bg-[#2962ff] text-white' : 'text-[#787b86] hover:text-white'
          }`}
          title="Ray"
        >
          <TrendingUp className="w-3 h-3" />
        </button>
        <button
          onClick={() => onSelectQuickTool?.('measure')}
          className={`p-0.5 rounded transition ${
            activeTool === 'measure' ? 'bg-[#2962ff] text-white' : 'text-[#787b86] hover:text-white'
          }`}
          title="Measure / Price Range"
        >
          <Maximize className="w-3 h-3" />
        </button>
        <button
          onClick={() => onSelectQuickTool?.('text')}
          className={`p-0.5 rounded transition ${
            activeTool === 'text' ? 'bg-[#2962ff] text-white' : 'text-[#787b86] hover:text-white'
          }`}
          title="Text Note"
        >
          <Type className="w-3 h-3" />
        </button>
        <div className="w-px h-2.5 bg-[#2a2e39]" />
        <button
          className="p-0.5 text-[#ffb74d] hover:text-[#ffa726] rounded transition"
          title="Favorites Toolbar Toggle"
        >
          <Star className="w-2.5 h-2.5 fill-[#ffb74d]" />
        </button>
      </div>

      {/* Right Section: Layout Grid Picker (to the left of Unnamed), Layout Manager, Search, Settings, Fullscreen, Camera, Trade, Publish */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Window Layout Options Dropdown (Directly to the left of Unnamed) */}
        <LayoutDropdown
          currentTemplateId={currentTemplateId}
          onSelectTemplate={onSelectTemplate}
          syncSettings={syncSettings}
          onUpdateSyncSettings={onUpdateSyncSettings}
          isOpen={isLayoutDropdownOpen}
          onClose={() => setIsLayoutDropdownOpen(false)}
          onToggle={() => {
            setIsLayoutDropdownOpen(!isLayoutDropdownOpen);
            if (!isLayoutDropdownOpen) setIsLayoutManagerOpen(false);
          }}
        />

        {/* Unnamed / Active Layout Manager Dropdown */}
        <LayoutManagerDropdown
          currentLayout={currentLayout}
          savedLayouts={savedLayouts}
          onSaveLayout={onSaveLayout}
          onAutosaveToggle={onAutosaveToggle}
          onShareToggle={onShareToggle}
          onMakeCopy={onMakeCopy}
          onRename={onRename}
          onDownloadData={onDownloadData}
          onCreateNewLayout={onCreateNewLayout}
          onSelectLayout={onSelectLayout}
          onDeleteLayout={onDeleteLayout}
          isOpen={isLayoutManagerOpen}
          onClose={() => setIsLayoutManagerOpen(false)}
          onToggle={() => {
            setIsLayoutManagerOpen(!isLayoutManagerOpen);
            if (!isLayoutManagerOpen) setIsLayoutDropdownOpen(false);
          }}
          activeSymbol={activeAsset.symbol}
          activeTimeframe={activeTimeframe}
        />

        {/* Quick Search */}
        <button
          onClick={onOpenSymbolSearch}
          className="p-1 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          title="Quick Search"
        >
          <Search className="w-3 h-3" />
        </button>

        {/* Settings Gear */}
        <button
          className="p-1 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          title="Chart Properties / Settings"
        >
          <Settings className="w-3 h-3" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          id="toggle-fullscreen-btn"
          onClick={onToggleFullscreen}
          className="p-1 text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>

        {/* Picture-in-Picture (PiP) Button */}
        <button
          id="popout-mini-chart-btn"
          onClick={onTogglePip}
          className={`p-1 rounded transition relative ${
            isPipActive
              ? 'text-white bg-[#2962ff] shadow-xs'
              : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title={isPipActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture (Overlay on other tabs/windows)'}
        >
          <PictureInPicture2 className="w-3 h-3" />
        </button>

        {/* Live Market Feed Status Pill */}
        {marketStatus && (
          <div
            id="market-stream-status-pill"
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-[#1e222d] border border-[#2a2e39] rounded text-[10px] cursor-help"
            title={`Market Data Feed: ${marketStatus.provider} (Ping: ${marketStatus.latencyMs}ms)`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                marketStatus.connected ? 'bg-[#089981] animate-pulse' : 'bg-[#f23645]'
              }`}
            />
            <span className="font-mono text-[9px] font-bold text-[#d1d4dc]">
              {marketStatus.connected ? 'LIVE' : 'SYNCING'}
            </span>
            {marketStatus.latencyMs > 0 && (
              <span className="text-[8px] text-[#787b86] font-mono">{marketStatus.latencyMs}ms</span>
            )}
          </div>
        )}

        {/* Trade Button (opens bottom trading panel or order entry) */}
        <button
          id="trade-action-btn"
          onClick={onToggleTradingPanel}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#1e222d] hover:bg-[#2a2e39] text-[#d1d4dc] hover:text-white rounded border border-[#2a2e39] font-medium transition text-[11px]"
        >
          <span>Trade</span>
        </button>

        {/* Publish Button (High-contrast rounded pill with dark text, matching TradingView!) */}
        <button
          id="publish-action-btn"
          onClick={() => {
            alert('Chart published to private ideas repository!');
          }}
          className="px-2.5 py-0.5 bg-white hover:bg-white/90 text-[#131722] font-bold rounded-full transition shadow-xs text-[11px]"
        >
          Publish
        </button>
      </div>
    </header>
  );
});
