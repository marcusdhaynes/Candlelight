import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Asset,
  ChartType,
  Drawing,
  DrawingToolType,
  IndicatorSettings,
  OHLCV,
  OrderBookItem,
  PriceAlert,
  Timeframe,
  TradeItem,
  Watchlist,
  MarketNews,
  DetailedAlert,
  PaperAccount,
  PaperPosition,
} from './types';
import {
  INITIAL_ASSETS,
  INITIAL_WATCHLISTS,
  SAMPLE_NEWS,
  SAMPLE_DETAILED_ALERTS,
  INITIAL_PAPER_ACCOUNT,
  INITIAL_PAPER_POSITIONS,
  INITIAL_DRAWINGS,
} from './data/assets';
import {
  fetchHistoricalData,
  fetchRealTicker24h,
  subscribeRealMarketData,
  generateOrderBook,
  generateLiveTrade,
  TIMEFRAME_SECONDS,
} from './services/dataFeed';
import { TopNavbar } from './components/TopNavbar';
import { LeftDrawingToolbar } from './components/LeftDrawingToolbar';
import { MainChart, MainChartRef } from './components/MainChart';
import { MultiChartWorkspace } from './components/layout/MultiChartWorkspace';
import { LayoutTemplate, LayoutSyncSettings, ChartWindowState, SavedChartLayout } from './types/layout';
import { LAYOUT_TEMPLATES, DEFAULT_SYNC_SETTINGS, getLayoutTemplateById } from './data/layoutTemplates';
import { RightSidebar, RightSidebarTab } from './components/RightSidebar';
import { BottomToolbar } from './components/BottomToolbar';
import { BottomTradingPanel } from './components/BottomTradingPanel';
import { SymbolSearchModal } from './components/SymbolSearchModal';
import { IndicatorsModal } from './components/IndicatorsModal';
import { AlertsModal } from './components/AlertsModal';
import { TradeJournalModal } from './components/journal/TradeJournalModal';
import { ChartPictureInPicture, ChartPictureInPictureRef } from './components/ChartPictureInPicture';
import { ConditionalOrder, DependencyContext } from './types';
import { INITIAL_CONDITIONAL_ORDERS } from './data/initialConditionalOrders';
import { ConditionalOrderModal } from './components/orders/ConditionalOrderModal';
import { Bell } from 'lucide-react';

const assetIdentity = (a: Asset) => [a.symbol, a.source || a.exchange, a.marketType || ''].join('|');
export default function App() {
  // State: Assets & Selection (Default to PF_ARBUSD / ARBUSD perpetual matching screenshot)
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('tv_assets_v4');
    let base = INITIAL_ASSETS;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 500) base = parsed;
      } catch { /* keep bundled catalog */ }
    }
    try {
      const custom = JSON.parse(localStorage.getItem('candlelight_saved_markets_v1') || '[]') as Asset[];
      if (!Array.isArray(custom)) return base;
      const seen = new Set(base.map(assetIdentity));
      return [...base, ...custom.filter(a => {
        const id = assetIdentity(a);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })];
    } catch { return base; }
  });
  const [activeAsset, setActiveAsset] = useState<Asset>(() => {
    const savedSym = localStorage.getItem('tv_active_symbol');
    const savedVenue = localStorage.getItem('candlelight_active_source');
    const savedType = localStorage.getItem('candlelight_active_market_type');
    if (savedSym) {
      const exact = assets.find(a => a.symbol === savedSym && (a.source || a.exchange) === savedVenue && (a.marketType || '') === savedType);
      if (exact) return exact;
      const found = assets.find(a => a.symbol === savedSym);
      if (found) return found;
    }
    return INITIAL_ASSETS[0];
  });
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(() => {
    const saved = localStorage.getItem('tv_timeframe');
    return saved ? (saved as Timeframe) : '1m';
  });
  const [chartType, setChartType] = useState<ChartType>(() => {
    const saved = localStorage.getItem('tv_chart_type');
    return saved ? (saved as ChartType) : 'candlestick';
  });

  // State: Chart Data & Candles
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState(true);

  // State: Watchlists
  const [watchlists, setWatchlists] = useState<Watchlist[]>(() => {
    const saved = localStorage.getItem('tv_watchlists_v4');
    return saved ? JSON.parse(saved) : INITIAL_WATCHLISTS;
  });
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>(() => {
    const saved = localStorage.getItem('tv_active_watchlist_id');
    return saved ? saved : watchlists[0].id;
  });

  // The exported Kraken catalog is bundled locally; no AI Studio server is needed.

  // Price Flash Map for Watchlist ticker animations
  const [priceFlashMap, setPriceFlashMap] = useState<Record<string, 'up' | 'down'>>({});

  // Real Market Data Feed Connection Status
  const [marketStatus, setMarketStatus] = useState<{
    connected: boolean;
    provider: string;
    latencyMs: number;
  }>({
    connected: false,
    provider: 'Connecting to Market Data...',
    latencyMs: 0,
  });

  // State: Drawing Tools & Drawings
  const [activeTool, setActiveTool] = useState<DrawingToolType>('crosshair');
  const [isMagnetMode, setIsMagnetMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_magnet_mode');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [areDrawingsHidden, setAreDrawingsHidden] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_drawings_hidden');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [currentColor, setCurrentColor] = useState<string>(() => {
    const saved = localStorage.getItem('tv_drawing_color');
    return saved || '#2962ff';
  });

  const [drawings, setDrawings] = useState<Drawing[]>(() => {
    const saved = localStorage.getItem('tv_drawings');
    return saved ? JSON.parse(saved) : INITIAL_DRAWINGS;
  });
  const [drawingHistory, setDrawingHistory] = useState<Drawing[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // State: Indicators
  const [indicators, setIndicators] = useState<IndicatorSettings>(() => {
    const saved = localStorage.getItem('tv_indicators');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!localStorage.getItem('tv_indicators_vol_v2')) {
          if (parsed.volume) parsed.volume.enabled = false;
          localStorage.setItem('tv_indicators_vol_v2', 'true');
          localStorage.setItem('tv_indicators', JSON.stringify(parsed));
        }
        return parsed;
      } catch {
        // fallback
      }
    }
    return {
      sma20: { enabled: false, period: 20, color: '#ffb74d' },
      sma50: { enabled: false, period: 50, color: '#29b6f6' },
      sma200: { enabled: false, period: 200, color: '#ab47bc' },
      ema9: { enabled: false, period: 9, color: '#26c6da' },
      ema21: { enabled: false, period: 21, color: '#ff7043' },
      bollingerBands: {
        enabled: false,
        period: 20,
        stdDev: 2,
        upperColor: 'rgba(41, 98, 255, 0.7)',
        middleColor: 'rgba(255, 152, 0, 0.7)',
        lowerColor: 'rgba(41, 98, 255, 0.7)',
        fillColor: 'rgba(41, 98, 255, 0.05)',
      },
      vwap: { enabled: false, color: '#ba68c8' },
      supertrend: { enabled: false, period: 10, multiplier: 3, upColor: '#089981', downColor: '#f23645' },
      volume: { enabled: false, upColor: 'rgba(8, 153, 129, 0.35)', downColor: 'rgba(242, 54, 69, 0.35)' },
      rsi: { enabled: false, period: 14, overbought: 70, oversold: 30, color: '#e040fb' },
      macd: {
        enabled: false,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        macdColor: '#2962ff',
        signalColor: '#ff9800',
        histUpColor: '#089981',
        histDownColor: '#f23645',
      },
    };
  });

  // State: Detailed Alerts & Price Alerts (Matching Screenshot with 4 alerts)
  const [detailedAlerts, setDetailedAlerts] = useState<DetailedAlert[]>(() => {
    const saved = localStorage.getItem('tv_detailed_alerts');
    return saved ? JSON.parse(saved) : SAMPLE_DETAILED_ALERTS;
  });

  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem('tv_alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeNotification, setActiveNotification] = useState<{ id: string; message: string; type: 'alert' | 'info' } | null>(null);

  // State: Paper Trading (Matching screenshot metrics and open trade)
  const [paperAccount, setPaperAccount] = useState<PaperAccount>(() => {
    const saved = localStorage.getItem('tv_paper_account');
    return saved ? JSON.parse(saved) : INITIAL_PAPER_ACCOUNT;
  });

  const [paperPositions, setPaperPositions] = useState<PaperPosition[]>(() => {
    const saved = localStorage.getItem('tv_paper_positions');
    return saved ? JSON.parse(saved) : INITIAL_PAPER_POSITIONS;
  });

  const [isBottomTradingOpen, setIsBottomTradingOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_bottom_trading_open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isBottomTradingExpanded, setIsBottomTradingExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_bottom_trading_expanded');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // State: Order Book & Trades
  const [orderBook, setOrderBook] = useState<{ asks: OrderBookItem[]; bids: OrderBookItem[] }>({
    asks: [],
    bids: [],
  });
  const [recentTrades, setRecentTrades] = useState<TradeItem[]>([]);

  // State: Modals & Panels (Right sidebar active tab defaults to 'alerts' as in screenshot!)
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isTradeJournalOpen, setIsTradeJournalOpen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const pipRef = useRef<ChartPictureInPictureRef>(null);

  // State: Conditional Orders
  const [conditionalOrders, setConditionalOrders] = useState<ConditionalOrder[]>(() => {
    const saved = localStorage.getItem('tv_conditional_orders');
    return saved ? JSON.parse(saved) : INITIAL_CONDITIONAL_ORDERS;
  });
  const [isConditionalOrderModalOpen, setIsConditionalOrderModalOpen] = useState(false);
  const [selectedDependencyForOrder, setSelectedDependencyForOrder] = useState<DependencyContext | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<ConditionalOrder | null>(null);

  useEffect(() => {
    localStorage.setItem('tv_conditional_orders', JSON.stringify(conditionalOrders));
  }, [conditionalOrders]);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_right_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>(() => {
    const saved = localStorage.getItem('tv_right_sidebar_tab');
    return saved ? (saved as RightSidebarTab) : 'alerts';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // State: Scales
  const [isLogScale, setIsLogScale] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_is_log_scale');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isPercentScale, setIsPercentScale] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_is_percent_scale');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Chart Ref
  const chartRef = useRef<MainChartRef>(null);
  const lastSecondarySyncRef = useRef<number>(0);
  const lastFlashTimeRef = useRef<number>(0);

  // Window Layout & Multi-Chart Workspace State
  // Default to single window ('1'), remember last used template
  const [currentTemplateId, setCurrentTemplateId] = useState<string>(() => {
    return localStorage.getItem('tv_last_used_template_id') || '1';
  });

  const [syncSettings, setSyncSettings] = useState<LayoutSyncSettings>(() => {
    const saved = localStorage.getItem('tv_layout_sync_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_SYNC_SETTINGS;
  });

  const [savedLayouts, setSavedLayouts] = useState<SavedChartLayout[]>(() => {
    const saved = localStorage.getItem('tv_saved_chart_layouts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: 'layout-default',
        name: 'Unnamed',
        lastModified: Date.now(),
        templateId: localStorage.getItem('tv_last_used_template_id') || '1',
        syncSettings: DEFAULT_SYNC_SETTINGS,
        autosave: true,
        shareEnabled: false,
        windows: [{ id: 'win-0', symbol: 'ARBUSD', timeframe: '60' as Timeframe }],
        activeWindowIndex: 0,
      },
    ];
  });

  const [currentLayoutId, setCurrentLayoutId] = useState<string>(() => {
    return localStorage.getItem('tv_current_layout_id') || 'layout-default';
  });

  const [windowStates, setWindowStates] = useState<ChartWindowState[]>(() => {
    const saved = localStorage.getItem('tv_chart_window_states');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [{ id: 'win-0', symbol: 'ARBUSD', timeframe: '1m' as Timeframe }];
  });

  const [activeWindowIndex, setActiveWindowIndex] = useState<number>(0);
  const [splitSizes, setSplitSizes] = useState<number[]>(() => {
    const saved = localStorage.getItem('tv_chart_splits');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [50, 50];
  });

  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const [isLayoutManagerOpen, setIsLayoutManagerOpen] = useState(false);

  // Active Layout and Template Helpers
  const currentLayout =
    savedLayouts.find((l) => l.id === currentLayoutId) || savedLayouts[0];

  const currentTemplate = getLayoutTemplateById(currentTemplateId);

  const handleSelectTemplate = (template: LayoutTemplate) => {
    setCurrentTemplateId(template.id);
    localStorage.setItem('tv_last_used_template_id', template.id);

    if (currentLayout.autosave) {
      setSavedLayouts((prev) => {
        const updated = prev.map((l) =>
          l.id === currentLayout.id
            ? { ...l, templateId: template.id, lastModified: Date.now() }
            : l
        );
        localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleUpdateSyncSettings = (settings: LayoutSyncSettings) => {
    setSyncSettings(settings);
    localStorage.setItem('tv_layout_sync_settings', JSON.stringify(settings));

    if (currentLayout.autosave) {
      setSavedLayouts((prev) => {
        const updated = prev.map((l) =>
          l.id === currentLayout.id
            ? { ...l, syncSettings: settings, lastModified: Date.now() }
            : l
        );
        localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleSaveLayout = useCallback(() => {
    setSavedLayouts((prev) => {
      const updated = prev.map((l) =>
        l.id === currentLayout.id
          ? {
              ...l,
              templateId: currentTemplateId,
              syncSettings: syncSettings,
              splitSizes: splitSizes,
              windows: windowStates,
              activeWindowIndex: activeWindowIndex,
              lastModified: Date.now(),
            }
          : l
      );
      localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
      return updated;
    });

    setActiveNotification({
      id: String(Date.now()),
      message: `Layout "${currentLayout.name}" saved.`,
      type: 'info',
    });
  }, [currentLayout.id, currentLayout.name, currentTemplateId, syncSettings, splitSizes, windowStates, activeWindowIndex]);

  const handleAutosaveToggle = (enabled: boolean) => {
    setSavedLayouts((prev) => {
      const updated = prev.map((l) =>
        l.id === currentLayout.id ? { ...l, autosave: enabled } : l
      );
      localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleShareToggle = (enabled: boolean) => {
    setSavedLayouts((prev) => {
      const updated = prev.map((l) =>
        l.id === currentLayout.id ? { ...l, shareEnabled: enabled } : l
      );
      localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMakeCopy = (newName: string) => {
    const newId = `layout-${Date.now()}`;
    const copy: SavedChartLayout = {
      ...currentLayout,
      id: newId,
      name: newName,
      templateId: currentTemplateId,
      syncSettings: syncSettings,
      splitSizes: splitSizes,
      windows: windowStates,
      activeWindowIndex: activeWindowIndex,
      lastModified: Date.now(),
    };
    const updated = [...savedLayouts, copy];
    setSavedLayouts(updated);
    setCurrentLayoutId(newId);
    localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
    localStorage.setItem('tv_current_layout_id', newId);
    setActiveNotification({
      id: String(Date.now()),
      message: `Created copy: "${newName}".`,
      type: 'info',
    });
  };

  const handleRename = (newName: string) => {
    setSavedLayouts((prev) => {
      const updated = prev.map((l) =>
        l.id === currentLayout.id ? { ...l, name: newName } : l
      );
      localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
      return updated;
    });
    setActiveNotification({
      id: String(Date.now()),
      message: `Layout renamed to "${newName}".`,
      type: 'info',
    });
  };

  const handleUpdateWindowStates = useCallback((states: ChartWindowState[]) => {
    setWindowStates(states);
    localStorage.setItem('tv_chart_window_states', JSON.stringify(states));
  }, []);

  const handleUpdateSplitSizes = useCallback((splits: number[]) => {
    setSplitSizes(splits);
    localStorage.setItem('tv_chart_splits', JSON.stringify(splits));
  }, []);

  const handleSetChartType = useCallback((newType: ChartType) => {
    setChartType(newType);
    localStorage.setItem('tv_chart_type', newType);
    setWindowStates((prev) => {
      const next = prev.map((w, idx) =>
        idx === activeWindowIndex ? { ...w, chartType: newType } : w
      );
      localStorage.setItem('tv_chart_window_states', JSON.stringify(next));
      return next;
    });
  }, [activeWindowIndex]);

  useEffect(() => {
    const activeWin = windowStates[activeWindowIndex];
    if (activeWin?.chartType && activeWin.chartType !== chartType) {
      setChartType(activeWin.chartType);
    }
  }, [activeWindowIndex]);

  const handleDownloadData = () => {
    if (candles.length === 0) return;
    const headers = 'Time,Open,High,Low,Close,Volume\n';
    const rows = candles
      .map(
        (c) =>
          `${new Date(c.time * 1000).toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume || 0}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeAsset.symbol}_${activeTimeframe}_chart_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateNewLayout = () => {
    const newId = `layout-${Date.now()}`;
    const freshLayout: SavedChartLayout = {
      id: newId,
      name: 'Unnamed',
      lastModified: Date.now(),
      templateId: '1',
      syncSettings: DEFAULT_SYNC_SETTINGS,
      autosave: true,
      shareEnabled: false,
      windows: [{ id: 'win-0', symbol: activeAsset.symbol, timeframe: activeTimeframe }],
      activeWindowIndex: 0,
    };
    const updated = [...savedLayouts, freshLayout];
    setSavedLayouts(updated);
    setCurrentLayoutId(newId);
    setCurrentTemplateId('1');
    localStorage.setItem('tv_last_used_template_id', '1');
    localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(updated));
    localStorage.setItem('tv_current_layout_id', newId);
    setActiveNotification({
      id: String(Date.now()),
      message: 'Created new chart layout.',
      type: 'info',
    });
  };

  const handleSelectLayout = (layout: SavedChartLayout) => {
    setCurrentLayoutId(layout.id);
    setCurrentTemplateId(layout.templateId || '1');
    localStorage.setItem('tv_last_used_template_id', layout.templateId || '1');
    localStorage.setItem('tv_current_layout_id', layout.id);
    if (layout.syncSettings) setSyncSettings(layout.syncSettings);
    if (layout.splitSizes) setSplitSizes(layout.splitSizes);
    if (layout.windows && layout.windows.length > 0) {
      setWindowStates(layout.windows);
    }
    setActiveNotification({
      id: String(Date.now()),
      message: `Loaded layout: "${layout.name}".`,
      type: 'info',
    });
  };

  const handleDeleteLayout = (id: string) => {
    if (savedLayouts.length <= 1) return;
    const remaining = savedLayouts.filter((l) => l.id !== id);
    setSavedLayouts(remaining);
    localStorage.setItem('tv_saved_chart_layouts', JSON.stringify(remaining));
    if (currentLayoutId === id) {
      handleSelectLayout(remaining[0]);
    }
  };

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('tv_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('tv_watchlists', JSON.stringify(watchlists));
  }, [watchlists]);

  useEffect(() => {
    localStorage.setItem('tv_drawings', JSON.stringify(drawings));
  }, [drawings]);

  useEffect(() => {
    localStorage.setItem('tv_indicators', JSON.stringify(indicators));
  }, [indicators]);

  useEffect(() => {
    localStorage.setItem('tv_detailed_alerts', JSON.stringify(detailedAlerts));
  }, [detailedAlerts]);

  useEffect(() => {
    localStorage.setItem('tv_paper_account', JSON.stringify(paperAccount));
  }, [paperAccount]);

  useEffect(() => {
    localStorage.setItem('tv_paper_positions', JSON.stringify(paperPositions));
  }, [paperPositions]);

  useEffect(() => {
    localStorage.setItem('tv_active_symbol', activeAsset.symbol);
    localStorage.setItem('candlelight_active_source', activeAsset.source || activeAsset.exchange);
    localStorage.setItem('candlelight_active_market_type', activeAsset.marketType || '');
  }, [activeAsset.symbol, activeAsset.source, activeAsset.exchange, activeAsset.marketType]);

  useEffect(() => {
    localStorage.setItem('tv_timeframe', activeTimeframe);
  }, [activeTimeframe]);

  useEffect(() => {
    localStorage.setItem('tv_chart_type', chartType);
  }, [chartType]);

  useEffect(() => {
    localStorage.setItem('tv_active_watchlist_id', activeWatchlistId);
  }, [activeWatchlistId]);

  useEffect(() => {
    localStorage.setItem('tv_right_sidebar_open', JSON.stringify(isRightSidebarOpen));
  }, [isRightSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('tv_right_sidebar_tab', rightSidebarTab);
  }, [rightSidebarTab]);

  useEffect(() => {
    localStorage.setItem('tv_bottom_trading_open', JSON.stringify(isBottomTradingOpen));
  }, [isBottomTradingOpen]);

  useEffect(() => {
    localStorage.setItem('tv_bottom_trading_expanded', JSON.stringify(isBottomTradingExpanded));
  }, [isBottomTradingExpanded]);

  useEffect(() => {
    localStorage.setItem('tv_magnet_mode', JSON.stringify(isMagnetMode));
  }, [isMagnetMode]);

  useEffect(() => {
    localStorage.setItem('tv_drawings_hidden', JSON.stringify(areDrawingsHidden));
  }, [areDrawingsHidden]);

  useEffect(() => {
    localStorage.setItem('tv_drawing_color', currentColor);
  }, [currentColor]);

  useEffect(() => {
    localStorage.setItem('tv_is_log_scale', JSON.stringify(isLogScale));
  }, [isLogScale]);

  useEffect(() => {
    localStorage.setItem('tv_is_percent_scale', JSON.stringify(isPercentScale));
  }, [isPercentScale]);

  // Initial background quote refresh for major watchlist assets
  useEffect(() => {
    const majorSymbols = ['BTCUSD', 'BTCUSDT', 'ETHUSD', 'SOLUSD', 'AAPL', 'TSLA', 'NVDA', 'EURUSD', 'XAUUSD'];
    const candidates = assets.filter((a) => majorSymbols.includes(a.symbol));
    candidates.forEach((asset) => {
      fetchRealTicker24h(asset).then((ticker) => {
        if (ticker) {
          setAssets((prev) =>
            prev.map((a) => (assetIdentity(a) === assetIdentity(asset) ? { ...a, ...ticker } : a))
          );
        }
      });
    });
  }, []);

  // Load Historical Candlesticks and connect Real Market Feed when activeAsset or timeframe changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingCandles(true);

    // 1. Fetch Real Historical Klines
    fetchHistoricalData(activeAsset, activeTimeframe).then((data) => {
      if (!isCancelled) {
        setCandles(data);
        setIsLoadingCandles(false);
      }
    });

    // 2. Fetch Real 24h Ticker data (high, low, volume, 24h price change)
    fetchRealTicker24h(activeAsset).then((ticker) => {
      if (!isCancelled && ticker) {
        setActiveAsset((prev) => ({
          ...prev,
          ...ticker,
        }));
        setAssets((prev) =>
          prev.map((a) => (assetIdentity(a) === assetIdentity(activeAsset) ? { ...a, ...ticker } : a))
        );
      }
    });

    // Order depth and tape require real subscribed feeds; do not seed fabricated data.
    setOrderBook({ bids: [], asks: [] });
    setRecentTrades([]);

    // 4. Subscribe to Real Market Data (Binance WebSocket for crypto, high-precision feed for others)
    const unsubscribe = subscribeRealMarketData(activeAsset, activeTimeframe, {
      onPriceUpdate: (newPrice, change24h, changePercent24h) => {
        if (isCancelled) return;

        const now = Date.now();
        setActiveAsset((prev) => {
          const priceDelta = newPrice - prev.price;
          if (priceDelta !== 0 && now - lastFlashTimeRef.current > 350) {
            lastFlashTimeRef.current = now;
            const flashDirection = priceDelta > 0 ? 'up' : 'down';
            setPriceFlashMap((pfm) => ({ ...pfm, [prev.symbol]: flashDirection }));
            setTimeout(() => {
              setPriceFlashMap((pfm) => {
                const next = { ...pfm };
                delete next[prev.symbol];
                return next;
              });
            }, 350);
          }

          const updatedChange = change24h !== undefined ? change24h : Number((prev.change24h + priceDelta).toFixed(prev.digits));
          const updatedChangePct = changePercent24h !== undefined ? changePercent24h : Number((((newPrice) / (prev.price - prev.change24h) - 1) * 100).toFixed(2));

          return {
            ...prev,
            price: newPrice,
            change24h: updatedChange,
            changePercent24h: updatedChangePct,
            high24h: Math.max(prev.high24h, newPrice),
            low24h: prev.low24h > 0 ? Math.min(prev.low24h, newPrice) : newPrice,
            quoteStatus: activeAsset.pairAddress ? 'delayed' : 'live',
            quoteUpdatedAt: now,
          };
        });

        // Throttle secondary UI updates to 150ms to keep render cycles smooth and light
        if (now - lastSecondarySyncRef.current > 150) {
          lastSecondarySyncRef.current = now;

          // Update in assets array
          setAssets((prev) =>
            prev.map((a) =>
              assetIdentity(a) === assetIdentity(activeAsset)
                ? {
                    ...a,
                    price: newPrice,
                    high24h: Math.max(a.high24h, newPrice),
                    low24h: a.low24h > 0 ? Math.min(a.low24h, newPrice) : newPrice,
                    quoteStatus: activeAsset.pairAddress ? 'delayed' : 'live',
                    quoteUpdatedAt: now,
                  }
                : a
            )
          );

          // Update paper trading position PnL in real-time
          setPaperPositions((prev) =>
            prev.map((pos) => {
              if (pos.symbol.includes(activeAsset.symbol) || (activeAsset.symbol.includes('ARB') && pos.id === 'pos-1')) {
                const pnl = (newPrice - pos.entryPrice) * pos.qty;
                const pnlPct = ((newPrice - pos.entryPrice) / pos.entryPrice) * 100;
                return {
                  ...pos,
                  currentPrice: newPrice,
                  unrealizedPnL: Number(pnl.toFixed(2)),
                  unrealizedPnLPct: Number(pnlPct.toFixed(2)),
                };
              }
              return pos;
            })
          );

          // Update paper account equity and unrealized PnL
          setPaperAccount((prev) => {
            const totalUnrealized = (newPrice - 0.1451) * 33222.9163;
            return {
              ...prev,
              unrealizedPnL: Number(totalUnrealized.toFixed(2)),
              equity: Number((prev.balance + totalUnrealized).toFixed(2)),
            };
          });
        }
      },

      onCandleTick: (candle, isClosed) => {
        if (isCancelled) return;
        setCandles((prevCandles) => {
          if (prevCandles.length === 0) return [candle];
          const lastIndex = prevCandles.length - 1;
          const last = prevCandles[lastIndex];

          if (isClosed) {
            return [...prevCandles.slice(0, -1), candle];
          }

          if (candle.time > last.time) {
            return [...prevCandles, candle];
          } else {
            const next = prevCandles.slice();
            next[lastIndex] = candle;
            return next;
          }
        });
      },

      onOrderBook: (book) => {
        if (isCancelled) return;
        setOrderBook(book);
      },

      onTrade: (trade) => {
        if (isCancelled) return;
        setRecentTrades((prev) => [trade, ...prev.slice(0, 24)]);
      },

      onStatusChange: (status) => {
        if (isCancelled) return;
        setMarketStatus(status);
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [activeAsset.symbol, activeAsset.source, activeAsset.exchange, activeAsset.marketType, activeTimeframe]);

  // Handle Close Position
  const handleClosePosition = (id: string) => {
    setPaperPositions((prev) => prev.filter((p) => p.id !== id));
    setActiveNotification({
      id: String(Date.now()),
      message: 'Position closed at market price.',
      type: 'info',
    });
  };

  // Conditional Orders Handlers
  const handleOpenCreateConditionalOrder = useCallback((dep?: DependencyContext | null) => {
    setSelectedDependencyForOrder(dep || null);
    setOrderToEdit(null);
    setIsConditionalOrderModalOpen(true);
  }, []);

  const handleEditConditionalOrder = useCallback((order: ConditionalOrder) => {
    setOrderToEdit(order);
    setSelectedDependencyForOrder(null);
    setIsConditionalOrderModalOpen(true);
  }, []);

  const handleSaveConditionalOrder = useCallback((order: ConditionalOrder) => {
    setConditionalOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === order.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = order;
        return next;
      }
      return [order, ...prev];
    });
    setActiveNotification({
      id: String(Date.now()),
      message: `Conditional order rule "${order.title}" saved.`,
      type: 'info',
    });
  }, []);

  const handleToggleConditionalOrderStatus = useCallback((id: string) => {
    setConditionalOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const newStatus = o.status === 'active' ? 'paused' : 'active';
        return { ...o, status: newStatus };
      })
    );
  }, []);

  const handleDeleteConditionalOrder = useCallback((id: string) => {
    setConditionalOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const executeOrderAction = useCallback(
    (order: ConditionalOrder, triggerPrice: number) => {
      const act = order.action;
      const sym = order.symbol;
      const size = order.execution.size || 1000;

      if (act === 'enter_long') {
        const newPos: PaperPosition = {
          id: `pos-${Date.now()}`,
          symbol: sym,
          exchange: activeAsset.exchange || 'Kraken',
          side: 'Long',
          qty: size,
          entryPrice: triggerPrice,
          currentPrice: triggerPrice,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          tp: order.execution.tpPercent ? triggerPrice * (1 + order.execution.tpPercent / 100) : undefined,
          sl: order.execution.slPercent ? triggerPrice * (1 - order.execution.slPercent / 100) : undefined,
        };
        setPaperPositions((prev) => [newPos, ...prev]);
        setPaperAccount((prev) => ({
          ...prev,
          availableFunds: Math.max(0, prev.availableFunds - size * triggerPrice * 0.1),
        }));
      } else if (act === 'enter_short') {
        const newPos: PaperPosition = {
          id: `pos-${Date.now()}`,
          symbol: sym,
          exchange: activeAsset.exchange || 'Kraken',
          side: 'Short',
          qty: size,
          entryPrice: triggerPrice,
          currentPrice: triggerPrice,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          tp: order.execution.tpPercent ? triggerPrice * (1 - order.execution.tpPercent / 100) : undefined,
          sl: order.execution.slPercent ? triggerPrice * (1 + order.execution.slPercent / 100) : undefined,
        };
        setPaperPositions((prev) => [newPos, ...prev]);
      } else if (act === 'exit_long' || act === 'exit_short') {
        const existing = paperPositions.find((p) => p.symbol === sym);
        if (existing) {
          setPaperPositions((prev) => prev.filter((p) => p.id !== existing.id));
        }
      } else if (act === 'reduce_position') {
        const redPct = order.execution.reducePercent || 50;
        setPaperPositions((prev) =>
          prev.map((p) => {
            if (p.symbol !== sym) return p;
            const newQty = Math.max(1, p.qty * (1 - redPct / 100));
            return { ...p, qty: Number(newQty.toFixed(2)) };
          })
        );
      } else if (act === 'increase_position') {
        setPaperPositions((prev) =>
          prev.map((p) => {
            if (p.symbol !== sym) return p;
            return { ...p, qty: p.qty + size };
          })
        );
      }

      setConditionalOrders((prev) =>
        prev.map((o) => {
          if (o.id !== order.id) return o;
          return {
            ...o,
            triggerCount: o.triggerCount + 1,
            lastTriggeredAt: Date.now(),
            status: o.conditionLogic === 'WHENEVER' ? 'active' : 'triggered',
          };
        })
      );

      setActiveNotification({
        id: String(Date.now()),
        message: `🎯 Conditional Order Triggered: "${order.title}" executed at $${triggerPrice.toFixed(activeAsset.digits)}!`,
        type: 'info',
      });
    },
    [activeAsset, paperPositions]
  );

  const handleTestTriggerConditionalOrder = useCallback(
    (order: ConditionalOrder) => {
      executeOrderAction(order, activeAsset.price);
    },
    [executeOrderAction, activeAsset.price]
  );

  // Automated Conditional Orders Evaluation Engine on Price Ticks
  useEffect(() => {
    if (conditionalOrders.length === 0) return;
    const curPrice = activeAsset.price;
    const activeRules = conditionalOrders.filter(
      (o) => o.status === 'active' && o.symbol === activeAsset.symbol
    );

    activeRules.forEach((order) => {
      const results = order.conditions.map((cond) => {
        if (cond.dependencyType === 'price' || cond.dependencyType === 'drawing') {
          const thresh = cond.thresholdValue;
          if (thresh == null) return false;
          if (cond.operator === 'crosses_above' || cond.operator === 'greater_than') {
            return curPrice >= thresh;
          }
          if (cond.operator === 'crosses_below' || cond.operator === 'less_than') {
            return curPrice <= thresh;
          }
          if (cond.operator === 'touches') {
            return Math.abs(curPrice - thresh) / thresh < 0.003;
          }
        }
        if (cond.dependencyType === 'position') {
          const pos = paperPositions.find((p) => p.symbol === activeAsset.symbol);
          if (!pos) return false;
          if (cond.operator === 'pnl_above_percent') {
            return pos.unrealizedPnLPct >= (cond.thresholdValue || 0);
          }
          if (cond.operator === 'pnl_below_percent') {
            return pos.unrealizedPnLPct <= -(cond.thresholdValue || 0);
          }
        }
        if (cond.dependencyType === 'alert') {
          const alt = detailedAlerts.find((a) => a.id === cond.dependencyId);
          if (alt && alt.status === 'Triggered') return true;
        }
        return false;
      });

      let triggered = false;
      if (order.conditionLogic === 'IF' || order.conditionLogic === 'WHENEVER') {
        triggered = results[0] === true;
      } else if (order.conditionLogic === 'IF (AND)') {
        triggered = results.length > 0 && results.every(Boolean);
      } else if (order.conditionLogic === 'IF (OR)') {
        triggered = results.some(Boolean);
      }

      if (triggered) {
        const last = order.lastTriggeredAt || 0;
        // Don't retrigger within 20s for WHENEVER
        if (Date.now() - last > 20000) {
          executeOrderAction(order, curPrice);
        }
      }
    });
  }, [activeAsset.price, activeAsset.symbol, conditionalOrders, detailedAlerts, paperPositions, executeOrderAction]);

  // Toggle Alert Status
  const handleToggleAlertStatus = (id: string) => {
    setDetailedAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === 'Active' ? 'Paused' : 'Active' } : a
      )
    );
  };

  // Delete Alert
  const handleDeleteDetailedAlert = (id: string) => {
    setDetailedAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Clear drawings
  const handleClearDrawings = () => {
    if (drawings.length === 0) return;
    setDrawingHistory((prev) => [...prev, drawings]);
    setDrawings([]);
  };

  // Undo Drawing
  const handleUndoDrawing = () => {
    if (drawings.length === 0) return;
    const previous = drawings.slice(0, -1);
    setDrawingHistory((prev) => [...prev, drawings]);
    setDrawings(previous);
  };

  // Redo Drawing
  const handleRedoDrawing = () => {
    if (drawingHistory.length === 0) return;
    const lastState = drawingHistory[drawingHistory.length - 1];
    setDrawingHistory((prev) => prev.slice(0, -1));
    setDrawings(lastState);
  };

  // Asset Selection
  const handleSelectAsset = (selected: Asset) => {
    setAssets(prev => prev.some(a => assetIdentity(a) === assetIdentity(selected)) ? prev : [...prev, selected]);
    try {
      const custom = JSON.parse(localStorage.getItem('candlelight_saved_markets_v1') || '[]') as Asset[];
      if (!custom.some(a => assetIdentity(a) === assetIdentity(selected))) {
        localStorage.setItem('candlelight_saved_markets_v1', JSON.stringify([...custom, selected].slice(-100)));
      }
    } catch { /* persistence is optional */ }
    setMarketStatus({ connected: false, provider: 'Connecting to ' + (selected.source || selected.exchange), latencyMs: 0 });
    setActiveAsset(selected);
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const activePosition =
    paperPositions.find((p) => p.symbol.includes(activeAsset.symbol)) ||
    (activeAsset.symbol.includes('ARB') ? paperPositions[0] : null);

  return (
    <div
      id="tradingview-app-root"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#131722] text-[#d1d4dc] font-sans antialiased"
    >
      <div role="note" className="shrink-0 bg-[#202534] px-3 py-1 text-[11px] text-[#c5c9d4]">
        <strong>Candlelight</strong> · {isLoadingCandles ? 'Loading history…' : `${candles.length.toLocaleString()} candles`} · Research preview · Paper trading only · Free public feeds where accessible. Quotes are unverified until received; some exchanges need licensed data. Depth unavailable. Some journal/account examples are demo data.
        {' '}Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="underline">TradingView Lightweight Charts</a>.
      </div>
      {/* Top Navbar */}
      <TopNavbar
        activeAsset={activeAsset}
        activeTimeframe={activeTimeframe}
        setActiveTimeframe={setActiveTimeframe}
        chartType={chartType}
        setChartType={handleSetChartType}
        onOpenSymbolSearch={() => setIsSymbolSearchOpen(true)}
        onOpenIndicators={() => setIsIndicatorsOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        indicators={indicators}
        onTakeSnapshot={() => chartRef.current?.takeSnapshot()}
        onTogglePip={() => pipRef.current?.togglePip()}
        isPipActive={isPipActive}
        onUndoDrawing={handleUndoDrawing}
        onRedoDrawing={handleRedoDrawing}
        canUndo={drawings.length > 0}
        canRedo={drawingHistory.length > 0}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onSelectQuickTool={(tool) => setActiveTool(tool)}
        activeTool={activeTool}
        onToggleTradingPanel={() => setIsBottomTradingOpen((prev) => !prev)}
        marketStatus={marketStatus}
        currentTemplateId={currentTemplateId}
        onSelectTemplate={handleSelectTemplate}
        syncSettings={syncSettings}
        onUpdateSyncSettings={handleUpdateSyncSettings}
        currentLayout={currentLayout}
        savedLayouts={savedLayouts}
        onSaveLayout={handleSaveLayout}
        onAutosaveToggle={handleAutosaveToggle}
        onShareToggle={handleShareToggle}
        onMakeCopy={handleMakeCopy}
        onRename={handleRename}
        onDownloadData={handleDownloadData}
        onCreateNewLayout={handleCreateNewLayout}
        onSelectLayout={handleSelectLayout}
        onDeleteLayout={handleDeleteLayout}
        isLayoutDropdownOpen={isLayoutDropdownOpen}
        setIsLayoutDropdownOpen={setIsLayoutDropdownOpen}
        isLayoutManagerOpen={isLayoutManagerOpen}
        setIsLayoutManagerOpen={setIsLayoutManagerOpen}
      />

      {/* Main Workspace (Left Drawing Bar + Main Chart Area + Right Sidebar) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Drawing Toolbar */}
        <LeftDrawingToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isMagnetMode={isMagnetMode}
          setIsMagnetMode={setIsMagnetMode}
          areDrawingsHidden={areDrawingsHidden}
          setAreDrawingsHidden={setAreDrawingsHidden}
          onClearDrawings={handleClearDrawings}
          currentColor={currentColor}
          setCurrentColor={setCurrentColor}
        />

        {/* Center: Multi-Chart Resizable Workspace + Bottom Trading Panel + Bottom Bar */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          <MultiChartWorkspace
            ref={chartRef}
            template={currentTemplate}
            syncSettings={syncSettings}
            activeAsset={activeAsset}
            setActiveAsset={setActiveAsset}
            activeTimeframe={activeTimeframe}
            setActiveTimeframe={setActiveTimeframe}
            chartType={chartType}
            primaryCandles={candles}
            indicators={indicators}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            drawings={drawings}
            setDrawings={setDrawings}
            isMagnetMode={isMagnetMode}
            areDrawingsHidden={areDrawingsHidden}
            currentColor={currentColor}
            isLogScale={isLogScale}
            isPercentScale={isPercentScale}
            openPosition={activePosition}
            onClosePosition={handleClosePosition}
            allAssets={assets}
            windowStates={windowStates}
            onUpdateWindowStates={handleUpdateWindowStates}
            activeWindowIndex={activeWindowIndex}
            setActiveWindowIndex={setActiveWindowIndex}
            splitSizes={splitSizes}
            onUpdateSplitSizes={handleUpdateSplitSizes}
            onOpenConditionalOrder={handleOpenCreateConditionalOrder}
          />

          {/* Bottom Trading Dock (Paper Trading Panel) */}
          <BottomTradingPanel
            account={paperAccount}
            positions={paperPositions}
            onClosePosition={handleClosePosition}
            conditionalOrders={conditionalOrders}
            onOpenCreateConditionalOrder={handleOpenCreateConditionalOrder}
            onEditConditionalOrder={handleEditConditionalOrder}
            onToggleConditionalOrderStatus={handleToggleConditionalOrderStatus}
            onDeleteConditionalOrder={handleDeleteConditionalOrder}
            onTestTriggerConditionalOrder={handleTestTriggerConditionalOrder}
            isOpen={isBottomTradingOpen}
            setIsOpen={setIsBottomTradingOpen}
            isExpanded={isBottomTradingExpanded}
            setIsExpanded={setIsBottomTradingExpanded}
          />

          {/* Bottom Bar for time ranges and scale controls */}
          <BottomToolbar
            chart={chartRef.current?.getChart() || null}
            onSelectRange={(days) => chartRef.current?.selectRange(days)}
            onFitContent={() => chartRef.current?.fitContent()}
            isLogScale={isLogScale}
            setIsLogScale={setIsLogScale}
            isPercentScale={isPercentScale}
            setIsPercentScale={setIsPercentScale}
          />
        </div>

        {/* Right Dock / Sidebar */}
        <RightSidebar
          assets={assets}
          activeAsset={activeAsset}
          onSelectAsset={handleSelectAsset}
          watchlists={watchlists}
          setWatchlists={setWatchlists}
          activeWatchlistId={activeWatchlistId}
          setActiveWatchlistId={setActiveWatchlistId}
          onOpenAddSymbolModal={() => setIsSymbolSearchOpen(true)}
          priceFlashMap={priceFlashMap}
          asks={orderBook.asks}
          bids={orderBook.bids}
          trades={recentTrades}
          detailedAlerts={detailedAlerts}
          onOpenCreateAlertModal={() => setIsAlertsOpen(true)}
          onToggleAlertStatus={handleToggleAlertStatus}
          onDeleteDetailedAlert={handleDeleteDetailedAlert}
          news={SAMPLE_NEWS}
          candles={candles}
          isOpen={isRightSidebarOpen}
          setIsOpen={setIsRightSidebarOpen}
          activeTab={rightSidebarTab}
          setActiveTab={setRightSidebarTab}
          onOpenTradeJournal={() => setIsTradeJournalOpen(true)}
          onTakeSnapshot={() => chartRef.current?.takeSnapshot()}
          onOpenConditionalOrder={handleOpenCreateConditionalOrder}
        />
      </div>

      {/* Floating Notification Toast */}
      {activeNotification && (
        <div
          id="active-notification-toast"
          className="fixed bottom-12 right-6 z-50 bg-[#1e222d] border border-[#2962ff] text-[#d1d4dc] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="p-2 rounded-lg bg-[#2962ff]/20 text-[#2962ff]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Price Alert Notification</div>
            <div className="text-xs text-[#d1d4dc] mt-0.5">{activeNotification.message}</div>
          </div>
          <button
            onClick={() => setActiveNotification(null)}
            className="ml-2 text-[#787b86] hover:text-white text-xs px-2 py-1 rounded hover:bg-[#2a2e39]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Modals */}
      {isSymbolSearchOpen && (
        <SymbolSearchModal
          isOpen={isSymbolSearchOpen}
          onClose={() => setIsSymbolSearchOpen(false)}
          assets={assets}
          onSelectAsset={handleSelectAsset}
          currentSymbol={activeAsset.symbol}
        />
      )}

      <IndicatorsModal
        isOpen={isIndicatorsOpen}
        onClose={() => setIsIndicatorsOpen(false)}
        indicators={indicators}
        setIndicators={setIndicators}
      />

      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        activeAsset={activeAsset}
        alerts={alerts}
        setAlerts={setAlerts}
      />

      <TradeJournalModal
        isOpen={isTradeJournalOpen}
        onClose={() => setIsTradeJournalOpen(false)}
        currentSymbol={activeAsset.symbol}
      />

      <ChartPictureInPicture
        ref={pipRef}
        activeAsset={activeAsset}
        candles={candles}
        activeTimeframe={activeTimeframe}
        chartType={chartType}
        onChangeTimeframe={(tf) => setActiveTimeframe(tf)}
        onPipStateChange={(active) => setIsPipActive(active)}
        onError={(msg) => {
          setActiveNotification({
            id: String(Date.now()),
            message: msg,
            type: 'info',
          });
        }}
      />

      <ConditionalOrderModal
        isOpen={isConditionalOrderModalOpen}
        onClose={() => setIsConditionalOrderModalOpen(false)}
        activeAsset={activeAsset}
        drawings={drawings}
        alerts={detailedAlerts}
        positions={paperPositions}
        initialDependency={selectedDependencyForOrder}
        orderToEdit={orderToEdit}
        onSaveOrder={handleSaveConditionalOrder}
        onTestTrigger={handleTestTriggerConditionalOrder}
      />
    </div>
  );
}
