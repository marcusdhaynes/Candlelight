import React, { useState, useEffect } from 'react';
import { JournalTrade, JournalTab } from '../../types';
import { INITIAL_JOURNAL_TRADES } from '../../data/sampleJournalTrades';
import {
  calculateJournalStats,
  calculateWaveScore,
} from '../../services/journalAnalytics';
import {
  BookOpen,
  LayoutDashboard,
  Calendar as CalendarIcon,
  ListFilter,
  SlidersHorizontal,
  Sparkles,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Settings,
  LayoutGrid,
  PieChart,
  ArrowLeftRight,
  Target,
  ShieldCheck,
  RefreshCw,
  FastForward,
  GripHorizontal,
  Eye,
  Sliders,
  ChevronDown,
  ZoomIn,
} from 'lucide-react';
import { JournalDashboard } from './JournalDashboard';
import { JournalCalendar } from './JournalCalendar';
import { JournalTradeLog } from './JournalTradeLog';
import { JournalEvaluator } from './JournalEvaluator';
import { JournalAiAssistant } from './JournalAiAssistant';
import { AddTradeModal } from './AddTradeModal';
import {
  JournalGridSettingsModal,
  JournalLayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
} from './JournalGridSettingsModal';

interface TradeJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol?: string;
}

export const TradeJournalModal: React.FC<TradeJournalModalProps> = ({
  isOpen,
  onClose,
  currentSymbol = '#BTCUSDT',
}) => {
  // Default to 'trades' tab to immediately display the grid view requested in image.png
  const [activeTab, setActiveTab] = useState<JournalTab>('trades');
  const [trades, setTrades] = useState<JournalTrade[]>(() => {
    const saved = localStorage.getItem('tradingview_journal_trades');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved journal trades', e);
      }
    }
    return INITIAL_JOURNAL_TRADES;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const [isMaximized, setIsMaximized] = useState(true);
  const [calendarYear, setCalendarYear] = useState(2025);
  const [calendarMonth, setCalendarMonth] = useState(4);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Screen size tracking for base resolution
  const [screenSize, setScreenSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const onResize = () => {
      setScreenSize({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const baseW = screenSize.w;
  const baseH = screenSize.h;
  const HEADER_H = 28;
  const contentBaseH = Math.max(300, baseH - HEADER_H);

  // Opacity state (persisted)
  const [windowOpacity, setWindowOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('tv_journal_window_opacity');
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.15 && val <= 1.0) return val;
    }
    return 1.0;
  });
  const [isOpacityMenuOpen, setIsOpacityMenuOpen] = useState(false);

  // Scale state down to 20% (0.20)
  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem('tv_journal_window_scale');
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.20 && val <= 1.0) return val;
    }
    return 0.85;
  });
  const [isScaleMenuOpen, setIsScaleMenuOpen] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Click outside to close menus
  useEffect(() => {
    if (!isOpacityMenuOpen && !isScaleMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#opacity-menu-popup') && !target.closest('#opacity-toggle-btn')) {
        setIsOpacityMenuOpen(false);
      }
      if (!target.closest('#scale-menu-popup') && !target.closest('#scale-toggle-btn')) {
        setIsScaleMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpacityMenuOpen, isScaleMenuOpen]);

  // Window position & size for moveable / resizable windowed mode
  const [windowPos, setWindowPos] = useState(() => {
    const bw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const bh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const savedScale = localStorage.getItem('tv_journal_window_scale');
    const initScale = savedScale ? Math.max(0.20, Math.min(1.0, parseFloat(savedScale))) : 0.85;

    const w = Math.round(bw * initScale);
    const h = 28 + Math.round((bh - 28) * initScale);
    const x = typeof window !== 'undefined' ? Math.max(10, Math.round((bw - w) / 2)) : 40;
    const y = typeof window !== 'undefined' ? Math.max(10, Math.round((bh - h) / 2)) : 30;

    const saved = localStorage.getItem('tv_journal_window_pos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.width && parsed.height) {
          return {
            x: Math.max(-w + 80, Math.min(bw - 80, parsed.x ?? x)),
            y: Math.max(0, Math.min(bh - 60, parsed.y ?? y)),
            width: parsed.width,
            height: parsed.height,
          };
        }
      } catch {}
    }
    return { x, y, width: w, height: h };
  });

  const applyScale = (newScale: number) => {
    const clampedScale = Math.max(0.20, Math.min(1.0, newScale));
    setScale(clampedScale);
    const newW = Math.round(baseW * clampedScale);
    const newH = HEADER_H + Math.round(contentBaseH * clampedScale);

    setWindowPos((prev) => {
      const maxX = Math.max(0, baseW - newW);
      const maxY = Math.max(0, baseH - newH);
      const newX = Math.min(maxX, Math.max(0, prev.x));
      const newY = Math.min(maxY, Math.max(0, prev.y));
      const updated = { x: newX, y: newY, width: newW, height: newH };
      localStorage.setItem('tv_journal_window_pos', JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem('tv_journal_window_scale', String(clampedScale));
  };

  // Drag to move window (High Performance Real-Time with RAF)
  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || isMaximized) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }
    e.preventDefault();

    setIsDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = windowPos.x;
    const initY = windowPos.y;
    let currentX = initX;
    let currentY = initY;
    let rafId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const maxX = Math.max(0, window.innerWidth - 80);
      const maxY = Math.max(0, window.innerHeight - 40);

      currentX = Math.min(maxX, Math.max(-windowPos.width + 100, initX + deltaX));
      currentY = Math.min(maxY, Math.max(0, initY + deltaY));

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setWindowPos((prev) => ({
            ...prev,
            x: currentX,
            y: currentY,
          }));
        });
      }
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setWindowPos((prev) => {
        const updated = { ...prev, x: currentX, y: currentY };
        localStorage.setItem('tv_journal_window_pos', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
  };

  // Resize window from edges & corners (Real-time proportional scale down to 20%)
  const handleStartResize = (e: React.MouseEvent, dir: string) => {
    if (e.button !== 0 || isMaximized) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = `${dir}-resize`;

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = windowPos.x;
    const initY = windowPos.y;
    const initScale = scale;
    const initW = windowPos.width;
    const initH = windowPos.height;

    let curScale = initScale;
    let curX = initX;
    let curY = initY;
    let curW = initW;
    let curH = initH;
    let rafId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let targetW = initW;
      let nextX = initX;
      let nextY = initY;

      if (dir === 'se') {
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy * (baseW / contentBaseH);
        targetW = initW + delta;
      } else if (dir === 'e') {
        targetW = initW + dx;
      } else if (dir === 's') {
        targetW = initW + dy * (baseW / contentBaseH);
      } else if (dir === 'sw') {
        const delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy * (baseW / contentBaseH);
        targetW = initW + delta;
        const testScale = Math.max(0.20, Math.min(1.0, targetW / baseW));
        const testW = Math.round(baseW * testScale);
        nextX = initX + (initW - testW);
      } else if (dir === 'w') {
        targetW = initW - dx;
        const testScale = Math.max(0.20, Math.min(1.0, targetW / baseW));
        const testW = Math.round(baseW * testScale);
        nextX = initX + (initW - testW);
      } else if (dir === 'ne') {
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy * (baseW / contentBaseH);
        targetW = initW + delta;
        const testScale = Math.max(0.20, Math.min(1.0, targetW / baseW));
        const testH = HEADER_H + Math.round(contentBaseH * testScale);
        nextY = initY + (initH - testH);
      } else if (dir === 'n') {
        targetW = initW - dy * (baseW / contentBaseH);
        const testScale = Math.max(0.20, Math.min(1.0, targetW / baseW));
        const testH = HEADER_H + Math.round(contentBaseH * testScale);
        nextY = initY + (initH - testH);
      } else if (dir === 'nw') {
        const delta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy * (baseW / contentBaseH);
        targetW = initW + delta;
        const testScale = Math.max(0.20, Math.min(1.0, targetW / baseW));
        const testW = Math.round(baseW * testScale);
        const testH = HEADER_H + Math.round(contentBaseH * testScale);
        nextX = initX + (initW - testW);
        nextY = initY + (initH - testH);
      }

      const clampedScale = Math.max(0.20, Math.min(1.0, targetW / baseW));
      const finalW = Math.round(baseW * clampedScale);
      const finalH = HEADER_H + Math.round(contentBaseH * clampedScale);

      curScale = clampedScale;
      curX = nextX;
      curY = nextY;
      curW = finalW;
      curH = finalH;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setScale(curScale);
          setWindowPos({
            x: curX,
            y: curY,
            width: curW,
            height: curH,
          });
        });
      }
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setScale(curScale);
      setWindowPos({
        x: curX,
        y: curY,
        width: curW,
        height: curH,
      });
      localStorage.setItem('tv_journal_window_scale', String(curScale));
      localStorage.setItem(
        'tv_journal_window_pos',
        JSON.stringify({ x: curX, y: curY, width: curW, height: curH })
      );
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
  };

  // Layout settings (Persisted)
  const [layoutSettings, setLayoutSettings] = useState<JournalLayoutSettings>(() => {
    const saved = localStorage.getItem('tv_journal_layout_settings');
    if (saved) {
      try {
        return { ...DEFAULT_LAYOUT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse journal layout settings', e);
      }
    }
    return DEFAULT_LAYOUT_SETTINGS;
  });

  const handleUpdateSettings = (newSettings: JournalLayoutSettings) => {
    setLayoutSettings(newSettings);
    localStorage.setItem('tv_journal_layout_settings', JSON.stringify(newSettings));
  };

  const handleResetSettings = () => {
    setLayoutSettings(DEFAULT_LAYOUT_SETTINGS);
    localStorage.setItem('tv_journal_layout_settings', JSON.stringify(DEFAULT_LAYOUT_SETTINGS));
  };

  if (!isOpen) return null;

  // Recalculate stats dynamically
  const stats = calculateJournalStats(trades);
  const waveScore = calculateWaveScore(trades);

  const handleAddTrade = (newTrade: JournalTrade) => {
    setTrades((prev) => {
      const updated = [newTrade, ...prev];
      localStorage.setItem('tradingview_journal_trades', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateTrade = (updatedTrade: JournalTrade) => {
    setTrades((prev) => {
      const updated = prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t));
      localStorage.setItem('tradingview_journal_trades', JSON.stringify(updated));
      return updated;
    });
    setEditingTrade(null);
  };

  const handleDeleteTrade = (id: string) => {
    setTrades((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      localStorage.setItem('tradingview_journal_trades', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div
      id="trade-journal-root-modal"
      className={`fixed inset-0 z-50 transition-colors duration-150 ${
        isMaximized
          ? 'w-screen h-screen m-0 p-0 overflow-hidden bg-[#0f131c] flex flex-col'
          : 'pointer-events-none bg-black/15'
      }`}
    >
      <div
        id="trade-journal-window-card"
        className={`bg-[#0f131c] flex flex-col overflow-hidden ${
          isMaximized
            ? 'w-full h-full rounded-none border-none shadow-none relative'
            : `pointer-events-auto absolute border border-[#2e3444] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] ${
                layoutSettings.roundedCorners !== false ? 'rounded-xl' : 'rounded-none'
              }`
        } ${isDragging || isResizing ? 'transition-none shadow-2xl' : 'transition-opacity duration-150'}`}
        style={
          isMaximized
            ? { width: '100vw', height: '100vh', left: 0, top: 0, opacity: 1 }
            : {
                width: `${windowPos.width}px`,
                height: `${windowPos.height}px`,
                left: `${windowPos.x}px`,
                top: `${windowPos.y}px`,
                opacity: windowOpacity,
              }
        }
      >
        {/* TOP WINDOW DRAG BAR (Visible in Windowed Mode for smooth repositioning) */}
        {!isMaximized && (
          <div
            onMouseDown={handleStartDrag}
            onDoubleClick={() => setIsMaximized(true)}
            className="h-7 bg-[#131722] border-b border-[#232836] flex items-center justify-between px-2.5 cursor-grab active:cursor-grabbing shrink-0 z-40 select-none group relative"
            title="Drag to reposition window · Double-click to maximize"
          >
            {/* Left section: Mac style window dots + Drag grip + Title + Dimensions badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={onClose}
                  className="w-2.5 h-2.5 rounded-full bg-[#f23645]/80 hover:bg-[#f23645] transition-colors cursor-pointer"
                  title="Close Journal"
                />
                <button
                  onClick={() => setIsMaximized(true)}
                  className="w-2.5 h-2.5 rounded-full bg-[#00c49f]/80 hover:bg-[#00c49f] transition-colors cursor-pointer"
                  title="Maximize Truly Fullscreen"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#848e9c] font-medium">
                <GripHorizontal className="w-3.5 h-3.5 text-[#5d6575] group-hover:text-[#2962ff] transition-colors" />
                <span className="font-semibold text-[#d1d4dc] tracking-tight">Trade Journal Pro</span>
                <span className="text-[9.5px] px-1.5 py-0.5 bg-[#1e222d] text-[#787b86] rounded font-mono border border-[#2a2e39]/60">
                  {Math.round(scale * 100)}% · {Math.round(windowPos.width)}×{Math.round(windowPos.height)}px
                </span>
              </div>
            </div>

            {/* Right section: Opacity button + Scale button + Maximize + Close */}
            <div className="flex items-center gap-1.5 text-[11px]" onClick={(e) => e.stopPropagation()}>
              {/* Opacity Button with Slider Popup */}
              <div className="relative">
                <button
                  id="opacity-toggle-btn"
                  onClick={() => {
                    setIsOpacityMenuOpen((prev) => !prev);
                    setIsScaleMenuOpen(false);
                  }}
                  className={`h-6 px-2 rounded-md text-[11px] font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
                    windowOpacity < 1
                      ? 'bg-[#2962ff]/25 text-[#2962ff] border-[#2962ff]/50 shadow-xs'
                      : 'bg-[#1e222d] text-[#848e9c] border-[#2a2e39] hover:text-white hover:bg-[#2a2e39]'
                  }`}
                  title="Window Transparency / Opacity"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{Math.round(windowOpacity * 100)}%</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>

                {/* Opacity Popup Menu */}
                {isOpacityMenuOpen && (
                  <div
                    id="opacity-menu-popup"
                    data-no-drag
                    className="absolute top-8 right-0 z-50 w-64 bg-[#181b24] border border-[#2a2e39] rounded-xl shadow-2xl p-3 text-white select-none backdrop-blur-xl"
                    style={{ opacity: 1 }}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#2a2e39] mb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Eye className="w-3.5 h-3.5 text-[#2962ff]" />
                        <span>Window Opacity</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#00ffa3]">
                        {Math.round(windowOpacity * 100)}%
                      </span>
                    </div>

                    {/* Range Slider */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-[10px] text-[#787b86]">
                        <span>Transparent (20%)</span>
                        <span>Solid (100%)</span>
                      </div>
                      <input
                        type="range"
                        min="0.20"
                        max="1.00"
                        step="0.05"
                        value={windowOpacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setWindowOpacity(val);
                          localStorage.setItem('tv_journal_window_opacity', String(val));
                        }}
                        className="w-full accent-[#2962ff] cursor-pointer h-1.5 bg-[#2a2e39] rounded-lg appearance-none"
                      />
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-5 gap-1 mb-2">
                      {[1.0, 0.8, 0.6, 0.4, 0.2].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            setWindowOpacity(preset);
                            localStorage.setItem('tv_journal_window_opacity', String(preset));
                          }}
                          className={`h-6 text-[10px] font-mono rounded-md font-medium transition-colors cursor-pointer border flex items-center justify-center ${
                            Math.abs(windowOpacity - preset) < 0.05
                              ? 'bg-[#2962ff] text-white border-[#2962ff]'
                              : 'bg-[#1e222d] text-[#848e9c] border-[#2a2e39] hover:text-white hover:bg-[#2a2e39]'
                          }`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-[#787b86] leading-relaxed">
                      Make the window transparent to see live candlestick charts behind while journaling.
                    </p>
                  </div>
                )}
              </div>

              {/* Scale Button with Quick Zoom Presets Popup */}
              <div className="relative">
                <button
                  id="scale-toggle-btn"
                  onClick={() => {
                    setIsScaleMenuOpen((prev) => !prev);
                    setIsOpacityMenuOpen(false);
                  }}
                  className={`h-6 px-2 rounded-md text-[11px] font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
                    scale < 1
                      ? 'bg-[#00ffa3]/15 text-[#00ffa3] border-[#00ffa3]/40'
                      : 'bg-[#1e222d] text-[#848e9c] border-[#2a2e39] hover:text-white hover:bg-[#2a2e39]'
                  }`}
                  title="Scale Window Size (Down to 20%)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>{Math.round(scale * 100)}%</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>

                {/* Scale Popup Menu */}
                {isScaleMenuOpen && (
                  <div
                    id="scale-menu-popup"
                    data-no-drag
                    className="absolute top-8 right-0 z-50 w-64 bg-[#181b24] border border-[#2a2e39] rounded-xl shadow-2xl p-3 text-white select-none backdrop-blur-xl"
                    style={{ opacity: 1 }}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#2a2e39] mb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <ZoomIn className="w-3.5 h-3.5 text-[#00ffa3]" />
                        <span>Scale Window</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#00ffa3]">
                        {Math.round(scale * 100)}%
                      </span>
                    </div>

                    {/* Scale Range Slider */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-[10px] text-[#787b86]">
                        <span>Mini (20%)</span>
                        <span>Full (100%)</span>
                      </div>
                      <input
                        type="range"
                        min="0.20"
                        max="1.00"
                        step="0.05"
                        value={scale}
                        onChange={(e) => {
                          applyScale(parseFloat(e.target.value));
                        }}
                        className="w-full accent-[#00ffa3] cursor-pointer h-1.5 bg-[#2a2e39] rounded-lg appearance-none"
                      />
                    </div>

                    {/* Quick Scale Presets */}
                    <div className="grid grid-cols-5 gap-1 mb-2">
                      {[1.0, 0.75, 0.5, 0.33, 0.2].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => applyScale(preset)}
                          className={`h-6 text-[10px] font-mono rounded-md font-medium transition-colors cursor-pointer border flex items-center justify-center ${
                            Math.abs(scale - preset) < 0.05
                              ? 'bg-[#00ffa3] text-black border-[#00ffa3]'
                              : 'bg-[#1e222d] text-[#848e9c] border-[#2a2e39] hover:text-white hover:bg-[#2a2e39]'
                          }`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-[#787b86] leading-relaxed">
                      Resizing scales all fonts, charts, and tables down to 20% without clipping.
                    </p>
                  </div>
                )}
              </div>

              {/* Maximize Button */}
              <button
                onClick={() => setIsMaximized(true)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#848e9c] hover:text-white hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Maximize Truly Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#848e9c] hover:text-[#f23645] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Close Journal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* WINDOW BODY (Dock Rail + Main Content Area) */}
        <div
          className={`flex-1 overflow-hidden relative ${
            isDragging || isResizing ? 'pointer-events-none select-none' : ''
          }`}
          style={
            isMaximized
              ? { width: '100%', height: '100%' }
              : {
                  width: `${windowPos.width}px`,
                  height: `${windowPos.height - HEADER_H}px`,
                }
          }
        >
          <div
            style={
              isMaximized
                ? { width: '100%', height: '100%' }
                : {
                    width: `${baseW}px`,
                    height: `${contentBaseH}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }
            }
            className="flex overflow-hidden min-h-0 relative select-auto h-full"
          >
            {/* LEFT VERTICAL DOCK RAIL (Uniform with Main Page Left Toolbar) */}
            <aside className="w-[28px] bg-[#131722] border-r border-[#232836] flex flex-col items-center py-1 px-[2px] shrink-0 select-none z-30 justify-between">
            {/* Top Section */}
            <div className="flex flex-col items-center gap-1 w-full">
              {/* Logo */}
              <div
                className="w-[24px] h-[24px] rounded-md bg-gradient-to-tr from-[#2962ff] to-[#00ffa3] flex items-center justify-center shadow-xs cursor-pointer mb-0.5"
                title="Trade Journal Pro"
                onClick={() => setActiveTab('trades')}
              >
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>

              {/* 1. Dashboard / Master Trades Grid */}
              <button
                onClick={() => setActiveTab('trades')}
                className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'trades'
                    ? 'bg-[#2962ff] text-white shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
                }`}
                title="Dashboard & Trades Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>

              {/* 2. Analytics / Overview */}
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#2962ff] text-white shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
                }`}
                title="Account Analytics & WaveScore"
              >
                <PieChart className="w-3.5 h-3.5" />
              </button>

              {/* 3. Calendar View */}
              <button
                onClick={() => setActiveTab('calendar')}
                className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-[#2962ff] text-white shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
                }`}
                title="Calendar Heatmap"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
              </button>

              {/* 4. Evaluator & Simulator */}
              <button
                onClick={() => setActiveTab('evaluator')}
                className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'evaluator'
                    ? 'bg-[#2962ff] text-white shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
                }`}
                title="Evaluator & What-If Simulator"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>

              {/* 5. AI Assistant */}
              <button
                onClick={() => setActiveTab('ai-assistant')}
                className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'ai-assistant'
                    ? 'bg-[#2962ff] text-white shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
                }`}
                title="AI Trading Coach"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#00ffa3]" />
              </button>

              <div className="w-4 h-px bg-[#232836] my-0.5" />

              {/* Additional trading tool rail icons */}
              <button
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Ledger Filter"
                onClick={() => setActiveTab('trades')}
              >
                <ListFilter className="w-3.5 h-3.5" />
              </button>

              <button
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Trade Replay / Rewind"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <button
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Risk & Profit Targets"
              >
                <Target className="w-3.5 h-3.5" />
              </button>

              <button
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Filter Parameters"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>

              <button
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Risk Rules & Guardrails"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Section (Settings & Sync Icons) */}
            <div className="flex flex-col items-center gap-1 w-full">
              {/* Intuitive Settings Gear Icon on Dock */}
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Journal Grid & Layout Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Sync / Refresh Icon */}
              <button
                onClick={() => {}}
                className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
                title="Sync Broker Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>

          {/* MAIN BODY AREA */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0f131c] min-w-0">
            {/* Tab Views */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'trades' && (
                <JournalTradeLog
                  trades={trades}
                  stats={stats}
                  layoutSettings={layoutSettings}
                  onUpdateSettings={handleUpdateSettings}
                  onResetSettings={handleResetSettings}
                  onOpenAddTrade={() => setIsAddModalOpen(true)}
                  onDeleteTrade={handleDeleteTrade}
                  onEditTrade={(trade) => setEditingTrade(trade)}
                  onSelectTrade={(trade) => {}}
                  onOpenSettings={() => setIsSettingsModalOpen(true)}
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                  onStartWindowDrag={handleStartDrag}
                  onClose={onClose}
                />
              )}

              {activeTab === 'overview' && (
                <JournalDashboard
                  stats={stats}
                  waveScore={waveScore}
                  trades={trades}
                  layoutSettings={layoutSettings}
                  calendarYear={calendarYear}
                  calendarMonth={calendarMonth}
                  onMonthChange={(y, m) => {
                    setCalendarYear(y);
                    setCalendarMonth(m);
                  }}
                  selectedDay={selectedCalendarDay}
                  onSelectDay={(dayStr) => {
                    setSelectedCalendarDay(dayStr);
                  }}
                  onNavigateToCalendar={() => setActiveTab('calendar')}
                  onOpenAddTrade={() => setIsAddModalOpen(true)}
                  onOpenSettings={() => setIsSettingsModalOpen(true)}
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                  onClose={onClose}
                />
              )}

              {activeTab === 'calendar' && (
                <JournalCalendar
                  trades={trades}
                  layoutSettings={layoutSettings}
                  calendarYear={calendarYear}
                  calendarMonth={calendarMonth}
                  onMonthChange={(y, m) => {
                    setCalendarYear(y);
                    setCalendarMonth(m);
                  }}
                  selectedDay={selectedCalendarDay}
                  onSelectDay={(dayStr) => setSelectedCalendarDay(dayStr)}
                  onOpenAddTrade={() => setIsAddModalOpen(true)}
                  onEditTrade={(trade) => setEditingTrade(trade)}
                  onClearSelectedDay={() => setSelectedCalendarDay(null)}
                  onSelectTrade={(trade) => {
                    setActiveTab('trades');
                  }}
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                  onClose={onClose}
                />
              )}

              {activeTab === 'evaluator' && (
                <JournalEvaluator
                  trades={trades}
                  stats={stats}
                  layoutSettings={layoutSettings}
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                  onClose={onClose}
                />
              )}

              {activeTab === 'ai-assistant' && (
                <JournalAiAssistant
                  trades={trades}
                  stats={stats}
                  waveScore={waveScore}
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                  onClose={onClose}
                />
              )}
            </div>
          </div>
        </div>
      </div>

        {/* 8 RESIZING HANDLES FOR WINDOWED MODE */}
        {!isMaximized && (
          <>
            {/* Right edge */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'e')}
              className="absolute top-0 right-0 bottom-0 w-2 cursor-e-resize hover:bg-[#2962ff]/40 z-50 transition-colors"
              title="Drag to resize width"
            />
            {/* Left edge */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'w')}
              className="absolute top-0 left-0 bottom-0 w-2 cursor-w-resize hover:bg-[#2962ff]/40 z-50 transition-colors"
              title="Drag to resize width"
            />
            {/* Bottom edge */}
            <div
              onMouseDown={(e) => handleStartResize(e, 's')}
              className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-[#2962ff]/40 z-50 transition-colors"
              title="Drag to resize height"
            />
            {/* Top edge */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'n')}
              className="absolute top-0 left-0 right-0 h-2 cursor-n-resize hover:bg-[#2962ff]/40 z-50 transition-colors"
              title="Drag to resize height"
            />
            {/* Bottom-right corner */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'se')}
              className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50 flex items-end justify-end p-1 hover:bg-[#2962ff]/30 group/se"
              title="Drag corner to scale size down to 20%"
            >
              <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-[#5d6575] group-hover/se:border-[#2962ff] transition-colors" />
            </div>
            {/* Bottom-left corner */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'sw')}
              className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-50 flex items-end justify-start p-1 hover:bg-[#2962ff]/30 group/sw"
              title="Drag corner to scale size down to 20%"
            >
              <div className="w-2.5 h-2.5 border-l-2 border-b-2 border-[#5d6575] group-hover/sw:border-[#2962ff] transition-colors" />
            </div>
            {/* Top-right corner */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'ne')}
              className="absolute top-0 right-0 w-5 h-5 cursor-ne-resize z-50 flex items-start justify-end p-1 hover:bg-[#2962ff]/30 group/ne"
              title="Drag corner to scale size down to 20%"
            >
              <div className="w-2.5 h-2.5 border-r-2 border-t-2 border-[#5d6575] group-hover/ne:border-[#2962ff] transition-colors" />
            </div>
            {/* Top-left corner */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'nw')}
              className="absolute top-0 left-0 w-5 h-5 cursor-nw-resize z-50 flex items-start justify-start p-1 hover:bg-[#2962ff]/30 group/nw"
              title="Drag corner to scale size down to 20%"
            >
              <div className="w-2.5 h-2.5 border-l-2 border-t-2 border-[#5d6575] group-hover/nw:border-[#2962ff] transition-colors" />
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Trade Modal */}
      <AddTradeModal
        isOpen={isAddModalOpen || !!editingTrade}
        tradeToEdit={editingTrade}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTrade(null);
        }}
        onAddTrade={handleAddTrade}
        onUpdateTrade={handleUpdateTrade}
        currentSymbol={currentSymbol}
      />

      {/* Settings Modal */}
      <JournalGridSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={layoutSettings}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={handleResetSettings}
      />
    </div>
  );
};
