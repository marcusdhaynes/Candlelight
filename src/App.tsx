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
  AlertLogEntry,
  Timeframe,
  TradeItem,
  Watchlist,
  DetailedAlert,
  PaperPosition,
} from './types';
import {
  INITIAL_ASSETS,
  INITIAL_WATCHLISTS,
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
import { PaperTradeTicket } from './components/PaperTradeTicket';
import { PaperAccountModal } from './components/PaperAccountModal';
import { SavedChartsModal } from './components/SavedChartsModal';
import type { SavedChartIdea } from './services/savedCharts';
import {combineHistoryWithLive,mergeLiveCandle} from './services/chartCandles';
import { cancelPaperOrder,evaluatePaperOrders,submitPaperOrder,estimatePaperQty,withOrderReservations,type PaperOrderRequest } from './services/paperOrders';
import { SymbolSearchModal } from './components/SymbolSearchModal';
import { IndicatorsModal } from './components/IndicatorsModal';
import { AlertsModal } from './components/AlertsModal';
import { TradeJournalModal } from './components/journal/TradeJournalModal';
import { ChartPictureInPicture, ChartPictureInPictureRef } from './components/ChartPictureInPicture';
import { ConditionalOrder, DependencyContext } from './types';
import { INITIAL_CONDITIONAL_ORDERS } from './data/initialConditionalOrders';
import { ConditionalOrderModal } from './components/orders/ConditionalOrderModal';
import { Bell } from 'lucide-react';
import { emptyPaperPortfolio, closePaperPosition, updatePaperStops, enableTrailingPaperStop, disableTrailingPaperStop, isFreshPaperQuote, accountLeverage, paperCommission, configurePaperPortfolio, type PaperPortfolio, type PaperSettings } from './services/paperTrading';
import { loadPaperAccounts, savePaperAccounts, updateActivePaperAccount, createPaperAccountRecord, type PaperAccountsState } from './services/paperAccounts';

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
    return saved ? JSON.parse(saved) : [];
  });

  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem('tv_alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const alertsRef = useRef<PriceAlert[]>(alerts);
  const previousAlertPricesRef = useRef<Record<string, number>>({});
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem('candlelight_alert_log_v1') || '[]');
      return Array.isArray(value) ? value.slice(0, 100) : [];
    } catch { return []; }
  });
  useEffect(() => {
    alertsRef.current = alerts;
    try { localStorage.setItem('tv_alerts', JSON.stringify(alerts)); }
    catch (error) { console.warn('Price alert storage unavailable', error); }
  }, [alerts]);
  useEffect(() => {
    try { localStorage.setItem('candlelight_alert_log_v1', JSON.stringify(alertLog)); }
    catch (error) { console.warn('Alert log storage unavailable', error); }
  }, [alertLog]);
  const [activeNotification, setActiveNotification] = useState<{ id: string; message: string; type: 'alert' | 'info' } | null>(null);

  // Each account owns independent cash, holdings, fills, conditional orders and fee policy.
  const [paperAccounts,setPaperAccounts]=useState<PaperAccountsState>(loadPaperAccounts);
  const activePaperRecord=paperAccounts.accounts.find(a=>a.id===paperAccounts.activeId)||paperAccounts.accounts[0];
  const paperPortfolio=activePaperRecord.portfolio;
  const {account:paperAccount,positions:paperPositions,fills:paperFills}=paperPortfolio;
  const conditionalOrders=activePaperRecord.orders;
  const setPaperPortfolio=(action:PaperPortfolio|((prev:PaperPortfolio)=>PaperPortfolio))=>
    setPaperAccounts(prev=>updateActivePaperAccount(prev,record=>({...record,
      portfolio:typeof action==='function'?action(record.portfolio):action})));
  const setConditionalOrders=(action:ConditionalOrder[]|((prev:ConditionalOrder[])=>ConditionalOrder[]))=>
    setPaperAccounts(prev=>updateActivePaperAccount(prev,record=>({...record,
      orders:typeof action==='function'?action(record.orders):action})));
  const [paperError,setPaperError]=useState('');
  const [closeReviewId,setCloseReviewId]=useState<string|null>(null);
  const [closeReviewQty,setCloseReviewQty]=useState('');
  const previousRulePrices=useRef<Record<string,number>>({});
  const heldMarketKeys=[...new Set(paperAccounts.accounts.flatMap(a=>
    [...a.portfolio.positions.map(p=>p.symbol+'|'+p.exchange),
     ...(a.portfolio.pendingOrders||[]).map(o=>o.symbol+'|'+o.exchange)]))].join('~');
  useEffect(()=>{
    const keys=heldMarketKeys.split('~').filter(Boolean);
    if(!keys.length)return;
    let cancelled=false;
    let cursor=0;
    const refresh=async()=>{
      // Rotate through independent markets to respect public API rate limits
      // while supporting arbitrarily many saved paper accounts.
      const candidates=keys.slice(cursor,cursor+16);
      cursor=(cursor+16)%keys.length;
      const batch=candidates.length?candidates:keys.slice(0,16);
      const pairs=batch.map(k=>{const [symbol,exchange]=k.split('|');
        return assets.find(a=>a.symbol===symbol&&(a.source||a.exchange)===exchange);
      }).filter((a):a is Asset=>Boolean(a));
      const quotes=await Promise.all(pairs.map(async a=>{
        const t=await fetchRealTicker24h(a).catch(()=>null);
        return t?.quoteStatus==='live'?{...a,...t}:null;
      }));
      if(cancelled)return;
      setPaperAccounts(prev=>({...prev,accounts:prev.accounts.map(a=>({...a,
        portfolio:quotes.reduce((p,q)=>q?evaluatePaperOrders(p,q):p,a.portfolio)}))}));
    };
    void refresh();
    const timer=window.setInterval(()=>{void refresh();},20000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[heldMarketKeys]);
  const selectPaperAccount=(id:string)=>{
    setPaperAccounts(prev=>prev.accounts.some(a=>a.id===id)?{...prev,activeId:id}:prev);
    setPaperError('');
  };
  const savePaperAccount=(id:string|null,name:string,settings:PaperSettings)=>{
    if(id){
      // Validate before touching React state so the dialog receives any error.
      const record=paperAccounts.accounts.find(a=>a.id===id);
      if(!record)throw new Error('Account not found.');
      const updated=configurePaperPortfolio(record.portfolio,settings,name);
      setPaperAccounts(prev=>({...prev,accounts:prev.accounts.map(a=>a.id===id?{...a,portfolio:updated}:a)}));
    }else{
      const record=createPaperAccountRecord(name,settings);
      setPaperAccounts(prev=>({activeId:record.id,accounts:[...prev.accounts,record]}));
    }
    setPaperError('');
  };
  const deletePaperAccount=(id:string)=>{
    setPaperAccounts(prev=>{
      if(prev.accounts.length<=1)return prev;
      const accounts=prev.accounts.filter(a=>a.id!==id);
      return {accounts,activeId:prev.activeId===id?accounts[0].id:prev.activeId};
    });
    setPaperError('');
  };
  useEffect(()=>{try{savePaperAccounts(paperAccounts);}catch(e){console.warn('Unable to persist paper accounts',e);}},[paperAccounts]);
  const [isBottomTradingOpen, setIsBottomTradingOpen] = useState(false);
  const [isTradeTicketOpen,setIsTradeTicketOpen]=useState(false);
  const [tradeTicketAccountSettings,setTradeTicketAccountSettings]=useState(false);
  const [isBottomTradingExpanded, setIsBottomTradingExpanded] = useState(false);

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
  const [isSavedChartsOpen,setIsSavedChartsOpen]=useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const pipRef = useRef<ChartPictureInPictureRef>(null);

  const [isConditionalOrderModalOpen, setIsConditionalOrderModalOpen] = useState(false);
  const [selectedDependencyForOrder, setSelectedDependencyForOrder] = useState<DependencyContext | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<ConditionalOrder | null>(null);

   const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
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
    // Clear the former instrument immediately; do not display its candles
    // under the next symbol while awaiting the exact-venue history response.
    setCandles([]);

    fetchHistoricalData(activeAsset, activeTimeframe).then((data) => {
      if (!isCancelled) {
        setCandles(live => combineHistoryWithLive(data,live));
        setIsLoadingCandles(false);
      }
    }).catch(() => {
      if (!isCancelled) setIsLoadingCandles(false);
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
    // A new stream must establish its own first observed price before a
    // crossing can be computed; a stale prior subscription must not trigger.
    delete previousAlertPricesRef.current[assetIdentity(activeAsset)];

    // 4. Subscribe to Real Market Data (Binance WebSocket for crypto, high-precision feed for others)
    const unsubscribe = subscribeRealMarketData(activeAsset, activeTimeframe, {
      onPriceUpdate: (newPrice, change24h, changePercent24h) => {
        if (isCancelled) return;

        const now = Date.now();
        // Price alerts are local, one-shot crossing detectors based exclusively
        // on observed live ticks. Never trigger on demonstration/delayed quotes.
        const marketKey = assetIdentity(activeAsset);
        const previous = previousAlertPricesRef.current[marketKey];
        previousAlertPricesRef.current[marketKey] = newPrice;
        if (!activeAsset.pairAddress && Number.isFinite(previous) &&
            Number.isFinite(newPrice) && newPrice > 0) {
          const hits = alertsRef.current.filter(a => a.symbol === activeAsset.symbol &&
            !a.triggered && !a.paused && Number.isFinite(a.targetPrice) && a.targetPrice > 0 &&
            (a.condition === 'cross_above'
              ? previous < a.targetPrice && newPrice >= a.targetPrice
              : previous > a.targetPrice && newPrice <= a.targetPrice));
          if (hits.length) {
            const hitIds = new Set(hits.map(a => a.id));
            const updated = alertsRef.current.map(a => hitIds.has(a.id) ? {...a, triggered:true} : a);
            alertsRef.current = updated;
            setAlerts(updated);
            const entries:AlertLogEntry[] = hits.map(a => ({
              id:a.id + '-' + now, symbol:a.symbol, price:newPrice, at:now,
              message:`${a.symbol} crossed ${a.condition === 'cross_above' ? 'above' : 'below'} ${a.targetPrice} at ${newPrice}`,
            }));
            setAlertLog(prev => [...entries, ...prev].slice(0,100));
            setActiveNotification({id:String(now),message:entries[0].message,type:'alert'});
          }
        }
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

          // Value ONLY the selected symbol at its own observed real-market tick.
          const quote={...activeAsset,price:newPrice,quoteUpdatedAt:now,
            quoteStatus:activeAsset.pairAddress?'delayed' as const:'live' as const};
          setPaperAccounts(prev=>({...prev,accounts:prev.accounts.map(a=>({...a,
            portfolio:evaluatePaperOrders(a.portfolio,quote,now)}))}));
        }
      },

      onCandleTick: (candle, isClosed) => {
        if (isCancelled) return;
        setCandles(previous=>mergeLiveCandle(previous,candle));
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

  // All new paper trades must pass through the validated right-side order ticket.
  const handleSubmitTicketOrder = (request:PaperOrderRequest):string|null => {
    try {
      const next=submitPaperOrder(paperPortfolio,activeAsset,request);
      setPaperPortfolio(next);setPaperError('');
      if(request.kind!=='market')setIsBottomTradingOpen(true);
      return null;
    }catch(e){
      const message=e instanceof Error?e.message:'Unable to submit paper order';
      setPaperError(message);return message;
    }
  };
  const executeClosePosition = (id:string,quantity?:number) => {
    const p=paperPositions.find(x=>x.id===id);
    if(!p)return;
    if(!p.lastMarkedAt || Date.now()<p.lastMarkedAt || Date.now()-p.lastMarkedAt>30000){
      setPaperError('Cannot close at an unverified stale price. Select the market and wait for its live quote.');
      return;
    }
    try {
      setPaperPortfolio(closePaperPosition(paperPortfolio,id,p.currentPrice,quantity));
      setCloseReviewId(null);
      setPaperError('');
      setActiveNotification({id:String(Date.now()),message:`Simulated close: ${quantity??p.qty} ${p.symbol} at ${p.currentPrice}`,type:'info'});
    } catch(e){setPaperError(e instanceof Error?e.message:'Close rejected');}
  };
  const handleClosePosition = (id:string) => {
    const p=paperPositions.find(x=>x.id===id);
    if(!p)return;
    // TradingView's default is review-before-close. One-click is user opt-in.
    let oneClick=false;
    try {oneClick=localStorage.getItem('candlelight_paper_one_click_v1')==='true';}catch{}
    if(oneClick){executeClosePosition(id);return;}
    setCloseReviewQty(String(p.qty));
    setCloseReviewId(id);
  };
  const handleEditPaperStops = (id:string,tp?:number,sl?:number,trailing?:number|null) => {
    try {
      let next=updatePaperStops(paperPortfolio,id,tp,sl);
      if(trailing===null)next=disableTrailingPaperStop(next,id);
      else if(trailing!==undefined)next=enableTrailingPaperStop(next,id,trailing);
      setPaperPortfolio(next);
      setPaperError('');
    }catch(e){setPaperError(e instanceof Error?e.message:'Invalid stops');}
  };
  const handleCancelPendingOrder=(id:string)=>{setPaperPortfolio(p=>cancelPaperOrder(p,id));setPaperError('');};
  const handleResetPaper = () => {
    setPaperPortfolio(emptyPaperPortfolio(paperPortfolio.settings,paperPortfolio.account.name));
    setConditionalOrders([]);
    setPaperError('');
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
    (order:ConditionalOrder,_triggerPrice:number)=>{
      if(order.symbol!==activeAsset.symbol||!isFreshPaperQuote(activeAsset)){
        setPaperError('Conditional order needs a fresh quote from the selected market.');
        return;
      }
      try{
        let next:PaperPortfolio=paperPortfolio;
        const side=order.action==='enter_short'?'Short':'Long';
        const spec=order.execution;
        const qtyFor=(kind:'market'|'limit',price:number)=>{
          if(spec.sizeUnit==='percent')return estimatePaperQty(next,activeAsset,spec.size,price);
          if(spec.sizeUnit==='usd')return spec.size/price;
          return spec.size;
        };
        const match=next.positions.find(p=>p.symbol===order.symbol
          && p.exchange===(activeAsset.source||activeAsset.exchange));
        if(order.action==='enter_long'||order.action==='enter_short'){
          const kind=spec.orderType==='limit'?'limit':'market';
          const price=kind==='limit'?(spec.limitPrice||0):activeAsset.price;
          const tp=spec.tpPrice||(spec.tpPercent?
            price*(1+(side==='Long'?1:-1)*spec.tpPercent/100):undefined);
          const sl=spec.slPrice||(spec.slPercent?
            price*(1-(side==='Long'?1:-1)*spec.slPercent/100):undefined);
          next=submitPaperOrder(next,activeAsset,{side,kind,qty:qtyFor(kind,price),
            price:kind==='limit'?price:undefined,tp,sl,timeInForce:'GTC'});
        }else if(order.action==='increase_position'){
          if(!match)throw new Error('No position to increase.');
          next=submitPaperOrder(next,activeAsset,{side:match.side,kind:'market',
            qty:qtyFor('market',activeAsset.price)});
        }else if(order.action==='exit_long'||order.action==='exit_short'){
          const expected=order.action==='exit_long'?'Long':'Short';
          if(!match||match.side!==expected)throw new Error('No matching position to close.');
          next=withOrderReservations(closePaperPosition(next,match.id,activeAsset.price));
        }else if(order.action==='tp'){
          if(!match)throw new Error('No position for take profit.');
          next=withOrderReservations(closePaperPosition(next,match.id,activeAsset.price));
        }else if(order.action==='reduce_position'){
          if(!match)throw new Error('No position to reduce.');
          const percent=Number(spec.reducePercent)||50;
          if(percent<=0||percent>100)throw new Error('Invalid reduction percentage.');
          next=withOrderReservations(closePaperPosition(next,match.id,activeAsset.price,match.qty*percent/100));
        }else if(order.action==='sl_set'){
          if(!match)throw new Error('No position to protect.');
          const value=spec.slPrice||(spec.slPercent?
            match.entryPrice*(1-(match.side==='Long'?1:-1)*spec.slPercent/100):undefined);
          if(!value)throw new Error('Choose a valid stop-loss price.');
          if(match.side==='Long'?value>=activeAsset.price:value<=activeAsset.price)
            throw new Error('Stop loss must be protective relative to the latest quote.');
          next=updatePaperStops(next,match.id,match.tp,value);
        }else if(order.action==='sl_trailing'){
          if(!match)throw new Error('No position for trailing stop.');
          next=enableTrailingPaperStop(next,match.id,Number(spec.trailingPercent));
        }else if(order.action==='cancel_all'){
          next=withOrderReservations({...next,pendingOrders:[]});
        }else{
          throw new Error('Unsupported paper order action.');
        }
        setPaperPortfolio(next);
        setConditionalOrders(prev=>prev.map(o=>o.id!==order.id?o:{
          ...o,triggerCount:o.triggerCount+1,lastTriggeredAt:Date.now(),
          status:o.conditionLogic==='WHENEVER'?'active':'triggered',
        }));
        setPaperError('');
      }catch(e){setPaperError(e instanceof Error?e.message:'Conditional order rejected');}
    },
    [activeAsset,paperPortfolio]
  );

  const handleTestTriggerConditionalOrder = useCallback(
    (order: ConditionalOrder) => {
      executeOrderAction(order, activeAsset.price);
    },
    [executeOrderAction, activeAsset.price]
  );

  // Automated Conditional Orders Evaluation Engine on Price Ticks
  useEffect(() => {
    if (conditionalOrders.length === 0 || !isFreshPaperQuote(activeAsset)) return;
    const curPrice = activeAsset.price;
    const ruleMarket=assetIdentity(activeAsset);
    const priorPrice=previousRulePrices.current[ruleMarket];
    previousRulePrices.current[ruleMarket]=curPrice;
    const activeRules = conditionalOrders.filter(
      (o) => o.status === 'active' && o.symbol === activeAsset.symbol &&
        o.triggerCount < (o.maxTriggers||9999)
    );

    activeRules.forEach((order) => {
      const results = order.conditions.map((cond) => {
        if (cond.dependencyType === 'price' || cond.dependencyType === 'drawing') {
          const thresh = cond.thresholdValue;
          if (thresh == null) return false;
          if (cond.operator === 'crosses_above') {
            return priorPrice!==undefined&&priorPrice<thresh&&curPrice>=thresh;
          }
          if (cond.operator === 'crosses_below') {
            return priorPrice!==undefined&&priorPrice>thresh&&curPrice<=thresh;
          }
          if (cond.operator === 'greater_than') return curPrice>thresh;
          if (cond.operator === 'less_than') return curPrice<thresh;
          if (cond.operator === 'touches') {
            return thresh>0&&Math.abs(curPrice-thresh)/thresh<0.003;
          }
        }
        if (cond.dependencyType === 'position') {
          const pos = paperPositions.find((p) => p.symbol === activeAsset.symbol &&
            p.exchange===(activeAsset.source||activeAsset.exchange));
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
    setAlerts(prev => prev.map(a => a.id !== id ? a : a.triggered
      ? {...a, triggered:false, paused:false}
      : {...a, paused:!a.paused}));
    setDetailedAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === 'Active' ? 'Paused' : 'Active' } : a
      )
    );
  };

  // Delete Alert
  const handleDeleteDetailedAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
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

  const handleRestoreSavedChart=(idea:SavedChartIdea)=>{
    const match=assets.find(a=>a.symbol===idea.symbol&&(a.source||a.exchange)===idea.source);
    if(!match){
      setActiveNotification({id:String(Date.now()),
        message:'Saved chart market is no longer in the current instrument directory.',
        type:'info'});
      return;
    }
    setActiveAsset(match);
    setActiveTimeframe(idea.timeframe);
    handleSetChartType(idea.chartType);
    setDrawings(structuredClone(idea.drawings));
    setIndicators(structuredClone(idea.indicators));
    setActiveNotification({id:String(Date.now()),message:'Chart restored from local saved charts.',type:'info'});
  };
  const activePosition =
    paperPositions.find(p => p.symbol===activeAsset.symbol &&
      p.exchange===(activeAsset.source||activeAsset.exchange)) || null;
  const closeReviewPosition=paperPositions.find(p=>p.id===closeReviewId);
  const closeQuantity=Number(closeReviewQty);
  const closeValid=!!closeReviewPosition && Number.isFinite(closeQuantity) &&
    closeQuantity>0 && closeQuantity<=closeReviewPosition.qty &&
    !!closeReviewPosition.lastMarkedAt && Date.now()>=closeReviewPosition.lastMarkedAt &&
    Date.now()-closeReviewPosition.lastMarkedAt<30000;
  const closePreviewFee=closeReviewPosition&&Number.isFinite(closeQuantity)&&closeQuantity>0?
    paperCommission(paperPortfolio.settings,{
      category:closeReviewPosition.category||'crypto',
      marketType:closeReviewPosition.marketType||'spot',
    },closeQuantity,closeReviewPosition.currentPrice):0;
  const closePreviewPnl=closeReviewPosition&&Number.isFinite(closeQuantity)?
    (closeReviewPosition.side==='Long'?1:-1)*
    (closeReviewPosition.currentPrice-closeReviewPosition.entryPrice)*closeQuantity-closePreviewFee:0;

  return (
    <div
      id="tradingview-app-root"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#131722] text-[#d1d4dc] font-sans antialiased"
    >
      {/* Keep the trading workspace full-size. Data/quote availability is shown at the
          actual quote and order-entry controls; do not fill the header with demo copy. */}
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
        onToggleTradingPanel={() => setIsTradeTicketOpen(prev=>!prev)}
        onOpenSavedCharts={()=>setIsSavedChartsOpen(true)}
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
            onOpenTicket={()=>setIsTradeTicketOpen(true)}
            account={paperAccount}
            positions={paperPositions}
            paperAccounts={paperAccounts.accounts}
            activePaperAccountId={paperAccounts.activeId}
            onSelectPaperAccount={selectPaperAccount}
            onSavePaperAccount={savePaperAccount}
            onDeletePaperAccount={deletePaperAccount}
            paperSettings={paperPortfolio.settings}
            onClosePosition={handleClosePosition}
            pendingOrders={paperPortfolio.pendingOrders||[]}
            onCancelPendingOrder={handleCancelPendingOrder}
            activeAsset={activeAsset}
            onEditPosition={handleEditPaperStops}
            onResetPaper={handleResetPaper}
            paperError={paperError}
            fills={paperFills}
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

        {/* Live market order entry slides in from the right; none is open at startup. */}
        <PaperTradeTicket open={isTradeTicketOpen} onClose={()=>setIsTradeTicketOpen(false)}
          asset={activeAsset} portfolio={paperPortfolio} bids={orderBook.bids} asks={orderBook.asks}
          onSubmit={handleSubmitTicketOrder} error={paperError}
          onOpenAccount={()=>setTradeTicketAccountSettings(true)}/>
        {tradeTicketAccountSettings&&<PaperAccountModal existing={activePaperRecord}
          proposedName={paperAccount.name}
          onClose={()=>setTradeTicketAccountSettings(false)}
          onSave={(name,settings)=>savePaperAccount(paperAccounts.activeId,name,settings)}/>}
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
          detailedAlerts={[...alerts.map(a => ({
            id:a.id, symbol:a.symbol,
            title:`${a.symbol} crosses ${a.condition === 'cross_above' ? 'above' : 'below'} ${a.targetPrice}`,
            message:a.notes || `Trigger at ${a.targetPrice}`, timeframe:'Live',
            status:(a.paused?'Paused':a.triggered?'Triggered':'Active') as DetailedAlert['status'],
            dateStr:new Date(a.createdAt).toLocaleString(), type:'price' as const,
          })),...detailedAlerts]}
          alertLog={alertLog}
          notification={activeNotification}
          onOpenCreateAlertModal={() => setIsAlertsOpen(true)}
          onToggleAlertStatus={handleToggleAlertStatus}
          onDeleteDetailedAlert={handleDeleteDetailedAlert}
          news={[]}
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

      {closeReviewPosition&&<div className="fixed inset-0 z-[290] bg-black/70 flex items-center justify-center p-3"
        role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCloseReviewId(null);}}>
        <section role="dialog" aria-modal="true" aria-label="Review paper position close"
          className="w-full max-w-[395px] rounded-xl border border-[#464d5c] bg-[#191d26] text-[#eff2fa] shadow-2xl p-5 space-y-4">
          <div className="flex justify-between items-center"><strong>Close position · Paper Trading</strong>
            <button title="Cancel close review" onClick={()=>setCloseReviewId(null)} className="text-[#a6adbd]">✕</button>
          </div>
          <p className="text-xs text-[#aab4c5]">Review the simulated close before executing. No real funds are involved.</p>
          <div className="flex justify-between text-xs"><span>Market</span><strong>{closeReviewPosition.exchange}:{closeReviewPosition.symbol}</strong></div>
          <div className="flex justify-between text-xs"><span>Position</span><strong>{closeReviewPosition.side} · {closeReviewPosition.qty} units</strong></div>
          <label className="text-xs text-[#aab4c5] block">Quantity to close
            <input type="number" min="0" step="any" max={closeReviewPosition.qty}
              aria-label="Close quantity" value={closeReviewQty} onChange={e=>setCloseReviewQty(e.target.value)}
              className="block w-full mt-1 bg-[#10151f] border border-[#4d5566] rounded-md px-3 py-2 text-white"/>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={()=>setCloseReviewQty(String(closeReviewPosition.qty/2))}
              className="rounded border border-[#4c5668] px-3 py-1.5 text-xs">50%</button>
            <button type="button" onClick={()=>setCloseReviewQty(String(closeReviewPosition.qty))}
              className="rounded border border-[#4c5668] px-3 py-1.5 text-xs">100%</button>
          </div>
          <div className="space-y-1.5 text-xs border-t border-[#373f4e] pt-3">
            <div className="flex justify-between"><span>Last verified observed price</span><strong>{closeReviewPosition.currentPrice}</strong></div>
            <div className="flex justify-between"><span>Est. closing commission</span><strong>{closePreviewFee.toFixed(4)} {paperPortfolio.settings.currency}</strong></div>
            <div className="flex justify-between"><span>Est. realized P&amp;L</span><strong className={closePreviewPnl>=0?'text-[#24c39b]':'text-[#fc8290]'}>{closePreviewPnl.toFixed(4)} {paperPortfolio.settings.currency}</strong></div>
          </div>
          {!closeValid&&<p role="alert" className="text-[#f5a5b3] text-xs">Invalid close size or stale quote. Wait for a fresh observed market price.</p>}
          {paperError&&<p role="alert" className="text-[#f5a5b3] text-xs">{paperError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={()=>setCloseReviewId(null)} className="rounded-md border border-[#4d5360] py-2 text-sm">Back</button>
            <button disabled={!closeValid} onClick={()=>executeClosePosition(closeReviewPosition.id,closeQuantity)}
              className="rounded-md bg-[#2962ff] disabled:bg-[#424957] py-2 text-sm font-semibold">Confirm close</button>
          </div>
        </section>
      </div>}
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

      <SavedChartsModal open={isSavedChartsOpen} onClose={()=>setIsSavedChartsOpen(false)}
        asset={activeAsset} timeframe={activeTimeframe} chartType={chartType}
        drawings={drawings} indicators={indicators} onRestore={handleRestoreSavedChart}/>
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
