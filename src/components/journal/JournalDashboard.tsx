import React, { useState, useMemo } from 'react';
import { JournalTrade, WaveScoreData } from '../../types';
import { JournalStats, getCalendarMonthData, CalendarDaySummary } from '../../services/journalAnalytics';
import { WaveScoreRadar } from './WaveScoreRadar';
import { JournalLayoutSettings } from './JournalGridSettingsModal';
import {
  TrendingUp,
  Flame,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  Plus,
  Settings,
  X,
  Sparkles,
  ChevronDown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface JournalDashboardProps {
  stats: JournalStats;
  waveScore: WaveScoreData;
  trades: JournalTrade[];
  layoutSettings?: JournalLayoutSettings;
  calendarYear?: number;
  calendarMonth?: number;
  onMonthChange?: (year: number, month: number) => void;
  selectedDay?: string | null;
  onSelectDay?: (dateStr: string | null) => void;
  onNavigateToCalendar?: () => void;
  onOpenAddTrade?: () => void;
  onOpenSettings?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

export const JournalDashboard: React.FC<JournalDashboardProps> = ({
  stats,
  waveScore,
  trades,
  layoutSettings,
  calendarYear: propYear,
  calendarMonth: propMonth,
  onMonthChange,
  selectedDay: propSelectedDay,
  onSelectDay,
  onNavigateToCalendar,
  onOpenAddTrade,
  onOpenSettings,
  isMaximized = true,
  onToggleMaximize,
  onClose,
}) => {
  const isRounded = layoutSettings?.roundedCorners !== false;
  const cornerClass = isRounded ? 'rounded-xl' : 'rounded-none';
  const innerCornerClass = isRounded ? 'rounded-lg' : 'rounded-none';
  const smCornerClass = isRounded ? 'rounded' : 'rounded-none';
  const barCornerClass = isRounded ? 'rounded-full' : 'rounded-none';

  const getGapClass = () => {
    if (layoutSettings?.spacing === 'compact') return 'gap-1.5';
    if (layoutSettings?.spacing === 'spacious') return 'gap-4';
    return 'gap-2.5';
  };

  const getPaddingClass = () => {
    if (layoutSettings?.spacing === 'compact') return 'p-1.5';
    if (layoutSettings?.spacing === 'spacious') return 'p-4';
    return 'p-3';
  };
  // Calendar month state for the calendar heatmap widget
  const [internalYear, setInternalYear] = useState(2025);
  const [internalMonth, setInternalMonth] = useState(4); // April 2025
  const calendarYear = propYear ?? internalYear;
  const calendarMonth = propMonth ?? internalMonth;

  const [selectedDayDateStr, setSelectedDayDateStr] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('All Time');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  const activeDayDateStr = propSelectedDay !== undefined && propSelectedDay !== null ? propSelectedDay : selectedDayDateStr;

  const monthData = useMemo(() => {
    return getCalendarMonthData(trades, calendarYear, calendarMonth);
  }, [trades, calendarYear, calendarMonth]);

  const activeDayDetails = useMemo(() => {
    if (!activeDayDateStr) return null;
    return (
      monthData.weeks
        .flatMap((w) => w.days)
        .find((d) => d.dateStr === activeDayDateStr && d.tradeCount > 0) || null
    );
  }, [activeDayDateStr, monthData]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    let y = calendarYear;
    let m = calendarMonth;
    if (m === 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
    setInternalYear(y);
    setInternalMonth(m);
    onMonthChange?.(y, m);
  };

  const handleNextMonth = () => {
    let y = calendarYear;
    let m = calendarMonth;
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
    setInternalYear(y);
    setInternalMonth(m);
    onMonthChange?.(y, m);
  };

  const handleGoToday = () => {
    setInternalYear(2025);
    setInternalMonth(4);
    onMonthChange?.(2025, 4);
  };

  const handleDayClick = (day: CalendarDaySummary) => {
    if (day.tradeCount > 0) {
      if (activeDayDateStr === day.dateStr) {
        setSelectedDayDateStr(null);
        onSelectDay?.(null);
      } else {
        setSelectedDayDateStr(day.dateStr);
        onSelectDay?.(day.dateStr);
      }
    }
  };

  // Sparkline generator helper matching cyan glow theme
  const renderSparkline = (points: number[], color = '#00e5ff', height = 34, width = 130) => {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = width / (points.length - 1);

    const pts = points
      .map((p, i) => {
        const x = i * step;
        const y = height - ((p - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="dashSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts}
        />
      </svg>
    );
  };

  // Arc Gauge for Winrate matching top cards
  const renderWinrateArc = (pct: number) => {
    const r = 32;
    const circumference = Math.PI * r;
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-[90px] h-[50px] overflow-hidden">
        <svg width="90" height="52" className="overflow-visible">
          {/* Background Arc */}
          <path
            d="M 13,44 A 32,32 0 0,1 77,44"
            fill="none"
            stroke="#232836"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Foreground Arc (Cyan) */}
          <path
            d="M 13,44 A 32,32 0 0,1 77,44"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0f131c] text-[#d1d4dc] overflow-hidden select-none font-sans text-xs">
      {/* Top Header Bar with attached Window Controls on the rightmost side */}
      <div className="bg-[#131722] px-3 py-1.5 border-b border-[#232836] flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Tab Title & Quick Summary Badges */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-[#2563eb] text-white flex items-center justify-center shadow-xs">
            <PieChart className="w-3.5 h-3.5 fill-current" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-white">Account Overview & WaveScore</span>
            <span className="text-[10px] uppercase font-bold bg-[#2563eb]/20 text-[#38bdf8] border border-[#2563eb]/30 px-1.5 py-0.2 rounded">
              Performance
            </span>
          </div>

          {/* Quick Metrics Chips */}
          <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-[#232836] font-mono text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-[#848e9c]">Net P&L:</span>
              <span className={`font-bold ${stats.totalNetReturn >= 0 ? 'text-[#00ffa3]' : 'text-[#ff4a7d]'}`}>
                {stats.totalNetReturn >= 0
                  ? `+$${stats.totalNetReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  : `-$${Math.abs(stats.totalNetReturn).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </span>
            </div>
            <span className="text-[#232836]">•</span>
            <div className="flex items-center gap-1">
              <span className="text-[#848e9c]">Win %:</span>
              <span className="font-bold text-[#00e5ff]">{stats.winRate}%</span>
            </div>
            <span className="text-[#232836]">•</span>
            <div className="flex items-center gap-1">
              <span className="text-[#848e9c]">PF:</span>
              <span className="font-bold text-[#00e5ff]">{stats.winLossRatio.toFixed(2)} :1</span>
            </div>
          </div>
        </div>

        {/* Right Actions & Window Controls (Cleanly attached to rightmost side!) */}
        <div className="flex items-center gap-2">
          {/* Date Selector */}
          <div className="relative">
            <button
              onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <CalendarIcon className="w-3 h-3 text-[#787b86]" />
              <span>{dateRange}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {isDateMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All Time', 'This Month', 'Last 30 Days', 'Year to Date'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDateRange(d);
                      setIsDateMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      dateRange === d ? 'text-[#00e5ff] font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + Add Trade Button */}
          {onOpenAddTrade && (
            <button
              onClick={onOpenAddTrade}
              className="bg-[#00c49f] hover:bg-[#00b290] text-white px-3 py-1 rounded-full text-xs font-bold transition shadow-sm flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Trade</span>
            </button>
          )}

          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-[#a6adb9] hover:text-white rounded hover:bg-[#1e2433] transition"
              title="Layout Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Vertical Divider */}
          <div className="h-4 w-px bg-[#232836] mx-0.5" />

          {/* Attached Fullscreen / Maximize Button */}
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                isMaximized
                  ? 'text-[#2962ff] bg-[#2962ff]/15 hover:bg-[#2962ff]/25 hover:text-white'
                  : 'text-[#a6adb9] hover:text-white hover:bg-[#1f2433]'
              }`}
              title={isMaximized ? 'Minimize to Moveable Window (Resizable to Scale)' : 'Maximize Truly Fullscreen'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Attached Close (X) Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#a6adb9] hover:text-[#ff4a7d] rounded hover:bg-[#1f2433] transition"
              title="Close Journal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <div id="journal-dashboard-tab" className={`flex-1 overflow-y-auto ${getPaddingClass()} ${getGapClass()} flex flex-col`}>
        {/* ROW 1: METRIC TILES + WAVESCORE RADAR + EQUITY BALANCE */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 ${getGapClass()}`}>
          {/* Column 1 (4 Cols): Key Metrics + Streaks */}
          <div className={`lg:col-span-4 flex flex-col justify-between ${getGapClass()} h-full`}>
            {/* Trade Count Card */}
            <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 flex items-center justify-between shadow-sm flex-1`}>
              <div>
                <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">Trade Count</div>
                <div className="text-2xl font-bold font-mono text-white mt-0.5 tracking-tight">
                  {stats.totalTrades}
                </div>
                <div className="text-[10px] text-[#00ffa3] font-mono mt-0.5 font-semibold">
                  +12 this week
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {renderSparkline(
                  stats.equityCurve.slice(-14).map((p) => p.balance),
                  '#00e5ff',
                  32,
                  110
                )}
              </div>
            </div>

            {/* Split: Winrate & Profit Factor */}
            <div className={`grid grid-cols-2 ${getGapClass()} flex-1`}>
              {/* Winrate */}
              <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 flex flex-col justify-between shadow-sm h-full`}>
                <div>
                  <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">Win %</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">{stats.winRate}%</div>
                </div>
                <div className="flex justify-center mt-1">
                  {renderWinrateArc(stats.winRate)}
                </div>
              </div>

              {/* Profit / Loss Ratio */}
              <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 flex flex-col justify-between shadow-sm h-full`}>
                <div>
                  <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">P/L Ratio</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {stats.winLossRatio.toFixed(2)} :1
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className={`h-1.5 w-full bg-[#131722] ${barCornerClass} overflow-hidden flex`}>
                    <div
                      className="bg-[#00ffa3] h-full"
                      style={{
                        width: `${Math.round(
                          (stats.avgWin / (stats.avgWin + (stats.avgLoss || 1))) * 100
                        )}%`,
                      }}
                    />
                    <div
                      className="bg-[#ff4a7d] h-full"
                      style={{
                        width: `${Math.round(
                          (stats.avgLoss / (stats.avgWin + (stats.avgLoss || 1))) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-[#00ffa3] font-bold">${stats.avgWin}</span>
                    <span className="text-[#ff4a7d] font-bold">-${stats.avgLoss}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Winstreak Card */}
            <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 shadow-sm flex-1 flex flex-col justify-between`}>
              <div className="text-xs font-bold text-white mb-2">Winstreak & Momentum</div>
              <div className={`grid grid-cols-2 ${getGapClass()} flex-1 items-center`}>
                {/* Days Streak */}
                <div className={`flex items-center gap-2 bg-[#131722] p-2.5 ${innerCornerClass} border border-[#232836] h-full`}>
                  <Flame className="w-4 h-4 text-[#f59e0b] shrink-0" />
                  <div>
                    <div className="text-base font-bold font-mono text-white leading-tight">
                      {stats.dayStreak.current}
                    </div>
                    <div className="text-[9px] text-[#848e9c]">Days Current</div>
                  </div>
                  <div className="ml-auto flex flex-col items-end text-[9px] font-mono gap-0.5">
                    <span className={`bg-[#00ffa3]/20 text-[#00ffa3] font-bold px-1 ${smCornerClass}`}>
                      {stats.dayStreak.maxWin} W
                    </span>
                    <span className={`bg-[#ff4a7d]/20 text-[#ff4a7d] font-bold px-1 ${smCornerClass}`}>
                      {stats.dayStreak.maxLoss} L
                    </span>
                  </div>
                </div>

                {/* Trades Streak */}
                <div className={`flex items-center gap-2 bg-[#131722] p-2.5 ${innerCornerClass} border border-[#232836] h-full`}>
                  <Flame className="w-4 h-4 text-[#f59e0b] shrink-0" />
                  <div>
                    <div className="text-base font-bold font-mono text-white leading-tight">
                      {stats.tradeStreak.current}
                    </div>
                    <div className="text-[9px] text-[#848e9c]">Trades Current</div>
                  </div>
                  <div className="ml-auto flex flex-col items-end text-[9px] font-mono gap-0.5">
                    <span className={`bg-[#00ffa3]/20 text-[#00ffa3] font-bold px-1 ${smCornerClass}`}>
                      {stats.tradeStreak.maxWin} W
                    </span>
                    <span className={`bg-[#ff4a7d]/20 text-[#ff4a7d] font-bold px-1 ${smCornerClass}`}>
                      {stats.tradeStreak.maxLoss} L
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 (4 Cols): WaveScore Radar */}
          <div className="lg:col-span-4">
            <WaveScoreRadar data={waveScore} roundedCorners={isRounded} />
          </div>

          {/* Column 3 (4 Cols): Balance Chart & Equity Curve */}
          <div className={`lg:col-span-4 bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 flex flex-col justify-between shadow-sm`}>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">Current Balance</div>
                  <div className="text-2xl font-bold font-mono text-white mt-0.5">
                    ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-[10px] text-[#848e9c] flex items-center gap-1 font-mono">
                  Range: <CalendarIcon className="w-3 h-3 text-[#00e5ff]" />
                </span>
              </div>

              {/* Balance SVG Chart with Glowing Gradient Curve */}
              <div className="my-2.5 h-[130px] w-full relative">
                {(() => {
                  const curve = stats.equityCurve;
                  if (curve.length < 2) return null;
                  const balances = curve.map((c) => c.balance);
                  const min = Math.min(...balances);
                  const max = Math.max(...balances);
                  const range = max - min || 1;
                  const w = 300;
                  const h = 120;
                  const pts = balances
                    .map((b, i) => {
                      const x = (i / (balances.length - 1)) * w;
                      const y = h - ((b - min) / range) * (h - 20) - 10;
                      return `${x},${y}`;
                    })
                    .join(' ');

                  return (
                    <div className={`w-full h-full flex flex-col justify-between bg-[#131722] ${innerCornerClass} p-2 border border-[#232836] relative overflow-hidden`}>
                      {/* Dotted Grid Pattern Background */}
                      <div
                        className="absolute inset-0 opacity-15"
                        style={{
                          backgroundImage: 'radial-gradient(#60a5fa 1px, transparent 1px)',
                          backgroundSize: '10px 10px',
                        }}
                      />
                      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible z-10">
                        <defs>
                          <linearGradient id="eqBalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#eqBalGrad)" />
                        <polyline
                          points={pts}
                          fill="none"
                          stroke="#00e5ff"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-[#848e9c] pt-2 border-t border-[#232836]">
              <span>Initial: $25,000.00</span>
              <span className="text-[#00ffa3] font-bold">
                +{((stats.totalNetReturn / 25000) * 100).toFixed(2)}% Return
              </span>
            </div>
          </div>
        </div>

        {/* ROW 2: PERFORMANCE & RISK SUMMARY + MINI MONTHLY CALENDAR */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 ${getGapClass()}`}>
          {/* Performance & Risk Summary Panel (4 Cols) */}
          <div className={`lg:col-span-4 bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 flex flex-col justify-between shadow-sm space-y-3`}>
            <div>
              <div className="text-xs font-bold text-white mb-2">Performance & Risk Edge</div>
              <div className="flex items-center justify-between pb-2.5 border-b border-[#232836]">
                <div>
                  <div className="text-[10px] text-[#848e9c]">Gain %</div>
                  <div className="text-lg font-bold font-mono text-[#00ffa3]">
                    +{((stats.totalNetReturn / 25000) * 100).toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-[#848e9c] font-mono">0.00% Abs</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#848e9c]">NET P&L</div>
                  <div
                    className={`text-lg font-bold font-mono ${
                      stats.totalNetReturn >= 0 ? 'text-[#00ffa3]' : 'text-[#ff4a7d]'
                    }`}
                  >
                    {stats.totalNetReturn >= 0
                      ? `+$${stats.totalNetReturn.toFixed(2)}`
                      : `-$${Math.abs(stats.totalNetReturn).toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* Period Returns */}
              <div className="pt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#848e9c] flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3 h-3 text-[#00e5ff]" /> Period Returns
                  </span>
                  <div className={`flex items-center gap-1 bg-[#131722] p-0.5 ${smCornerClass} border border-[#232836]`}>
                    <span className={`px-1.5 py-0.2 bg-[#232836] text-white text-[9px] ${smCornerClass} font-bold`}>
                      %
                    </span>
                    <span className="px-1.5 py-0.2 text-[#848e9c] text-[9px]">
                      $
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                  <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                    <div className="text-[9px] text-[#848e9c]">Daily</div>
                    <div className="text-xs font-bold text-[#00ffa3]">+0.05%</div>
                  </div>
                  <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                    <div className="text-[9px] text-[#848e9c]">Weekly</div>
                    <div className="text-xs font-bold text-[#00ffa3]">+0.26%</div>
                  </div>
                  <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                    <div className="text-[9px] text-[#848e9c]">Monthly</div>
                    <div className="text-xs font-bold text-[#00ffa3]">+1.06%</div>
                  </div>
                  <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                    <div className="text-[9px] text-[#848e9c]">Annualized</div>
                    <div className="text-xs font-bold text-[#00ffa3]">+14.15%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Section */}
            <div className="pt-2.5 border-t border-[#232836]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-[#ff4a7d]" /> Risk Guardrails
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Max Balance Drawdown</span>
                  <span className="text-[#ff4a7d] font-bold">{stats.maxDrawdown}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Current Balance</span>
                  <span className="text-white font-bold">
                    ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Highest Balance</span>
                  <span className="text-white font-bold">
                    ${stats.highestBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Calendar Heatmap Widget (8 Cols) - Matches Full Calendar Styling & Syncs */}
          <div className={`lg:col-span-8 bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 shadow-sm flex flex-col justify-between relative`}>
            {/* Calendar Header with navigation: Today, Arrows, Month Year, Total Month Return & Stats */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#232836]">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGoToday}
                  className="px-2.5 py-1 bg-[#131722] hover:bg-[#1e222d] text-[#d1d4dc] hover:text-white rounded text-xs font-semibold border border-[#232836] transition cursor-pointer"
                >
                  Today
                </button>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 text-[#848e9c] hover:text-white hover:bg-[#1e222d] rounded transition cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 text-[#848e9c] hover:text-white hover:bg-[#1e222d] rounded transition cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-1">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {monthNames[calendarMonth - 1]} {calendarYear}
                  </h2>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      monthData.totalMonthReturn >= 0
                        ? 'bg-[#00ffa3]/10 text-[#00ffa3] border-[#00ffa3]/30 shadow-[0_0_12px_rgba(0,255,163,0.12)]'
                        : 'bg-[#ff4a7d]/10 text-[#ff4a7d] border-[#ff4a7d]/30 shadow-[0_0_12px_rgba(255,74,125,0.12)]'
                    }`}
                  >
                    {monthData.totalMonthReturn >= 0
                      ? `+$${monthData.totalMonthReturn.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : `-$${Math.abs(monthData.totalMonthReturn).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>

              {/* Month Summary Stats Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#848e9c]">
                  Trades: <strong className="text-white">{monthData.totalMonthTrades}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#848e9c]">
                  Wins: <strong className="text-[#00ffa3]">{monthData.totalMonthWins}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#848e9c]">
                  Win Rate: <strong className="text-[#00e5ff]">{monthData.monthWinRate}%</strong>
                </span>
                {onNavigateToCalendar && (
                  <button
                    onClick={onNavigateToCalendar}
                    className="ml-1 px-2 py-0.5 rounded bg-[#2962ff]/15 hover:bg-[#2962ff]/25 text-[#2962ff] hover:text-[#5c8cff] border border-[#2962ff]/30 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Open Full Calendar Heatmap View"
                  >
                    Full View →
                  </button>
                )}
              </div>
            </div>

            {/* Calendar Grid Table */}
            <div className="mt-2.5 overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Weekday Column Headers (7 Days + TOTAL) */}
                <div className="grid grid-cols-8 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-semibold tracking-wider">
                  <div className="py-1 text-[#848e9c]">SUN</div>
                  <div className="py-1 text-[#848e9c]">MON</div>
                  <div className="py-1 text-[#848e9c]">TUE</div>
                  <div className="py-1 text-[#848e9c]">WED</div>
                  <div className="py-1 text-[#848e9c]">THR</div>
                  <div className="py-1 text-[#848e9c]">FRI</div>
                  <div className="py-1 text-[#848e9c]">SAT</div>
                  <div className="py-1 bg-[#131722] text-[#00e5ff] rounded border border-[#232836] font-bold">TOTAL</div>
                </div>

                {/* Weeks Rows */}
                <div className="space-y-1.5 sm:space-y-2">
                  {monthData.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="grid grid-cols-8 gap-1.5 sm:gap-2">
                      {week.days.map((day, dIdx) => {
                        const hasTrades = day.tradeCount > 0;
                        const isProfit = day.netReturn > 0;
                        const isLoss = day.netReturn < 0;
                        const isSelected = activeDayDetails?.dateStr === day.dateStr || propSelectedDay === day.dateStr;

                        return (
                          <div
                            key={dIdx}
                            onClick={() => hasTrades && handleDayClick(day)}
                            className={`${smCornerClass} p-2 flex flex-col justify-between transition-all duration-150 relative border select-none min-h-[74px] ${
                              !day.inCurrentMonth
                                ? 'bg-[#10141e]/40 border-[#1a1f2c]/50 text-[#434651]'
                                : hasTrades
                                ? isProfit
                                  ? 'bg-gradient-to-b from-[#089981]/20 to-[#089981]/10 border-[#089981]/40 hover:border-[#00ffa3] cursor-pointer hover:shadow-[0_4px_16px_rgba(0,255,163,0.15)]'
                                  : isLoss
                                  ? 'bg-gradient-to-b from-[#f23645]/20 to-[#f23645]/10 border-[#f23645]/40 hover:border-[#ff4a7d] cursor-pointer hover:shadow-[0_4px_16px_rgba(255,74,125,0.15)]'
                                  : 'bg-[#1e222d] border-[#2e3444] cursor-pointer'
                                : 'bg-[#131722]/70 border-[#232836] hover:bg-[#131722] hover:border-[#2e3444]'
                            } ${isSelected ? 'ring-2 ring-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.25)] z-10' : ''}`}
                          >
                            {/* Top Header: Day Number + Trade count */}
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold ${
                                  !day.inCurrentMonth
                                    ? 'text-[#5d6575]/50'
                                    : hasTrades
                                    ? 'text-white'
                                    : 'text-[#848e9c]'
                                }`}
                              >
                                {day.dayNum}
                              </span>
                              {hasTrades && (
                                <span className="text-[9px] text-[#d1d4dc] font-mono bg-[#131722]/80 px-1.5 py-0.2 rounded font-medium border border-[#232836]">
                                  {day.tradeCount}t
                                </span>
                              )}
                            </div>

                            {/* Middle: Net P&L */}
                            {hasTrades ? (
                              <div className="my-0.5">
                                <div
                                  className={`text-xs font-extrabold font-mono tracking-tight ${
                                    isProfit
                                      ? 'text-[#00ffa3]'
                                      : isLoss
                                      ? 'text-[#ff4a7d]'
                                      : 'text-white'
                                  }`}
                                >
                                  {isProfit
                                    ? `+$${day.netReturn.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                                    : `-$${Math.abs(day.netReturn).toLocaleString(undefined, { minimumFractionDigits: 1 })}`}
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1" />
                            )}

                            {/* Bottom Tags Pills */}
                            {hasTrades && (
                              <div className="flex flex-wrap gap-1 mt-auto pt-0.5">
                                {day.setups.slice(0, 1).map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="text-[7.5px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-[#00ffa3]/15 text-[#00ffa3] border border-[#00ffa3]/30 truncate max-w-[55px]"
                                  >
                                    {s}
                                  </span>
                                ))}
                                {day.mistakes.slice(0, 1).map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="text-[7.5px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-[#ff4a7d]/15 text-[#ff808b] border border-[#ff4a7d]/30 truncate max-w-[55px]"
                                  >
                                    {m}
                                  </span>
                                ))}
                                {day.setups.length + day.mistakes.length > 2 && (
                                  <span className="text-[7.5px] font-medium text-[#848e9c]">
                                    +{day.setups.length + day.mistakes.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 8th Column: Weekly Total Block */}
                      <div
                        className={`min-h-[74px] p-2 ${smCornerClass} border flex flex-col justify-between text-center font-mono transition-colors ${
                          week.totalTrades > 0
                            ? week.totalReturn > 0
                              ? 'bg-gradient-to-b from-[#089981]/25 to-[#089981]/15 border-[#089981]/50 text-[#00ffa3] shadow-sm'
                              : week.totalReturn < 0
                              ? 'bg-gradient-to-b from-[#f23645]/25 to-[#f23645]/15 border-[#f23645]/50 text-[#ff4a7d] shadow-sm'
                              : 'bg-[#131722]/80 border-[#232836] text-white'
                            : 'bg-[#131722]/50 border-[#232836] text-[#5d6575]'
                        }`}
                      >
                        <div className="text-[8.5px] font-bold text-[#848e9c] uppercase tracking-wider">
                          W{wIdx + 1} TOTAL
                        </div>
                        <div className="my-0.5">
                          {week.totalTrades > 0 ? (
                            <div className="text-xs font-extrabold font-mono tracking-tight">
                              {week.totalReturn >= 0
                                ? `+$${week.totalReturn.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                                : `-$${Math.abs(week.totalReturn).toLocaleString(undefined, { minimumFractionDigits: 1 })}`}
                            </div>
                          ) : (
                            <div className="text-xs text-[#5d6575] font-mono">—</div>
                          )}
                        </div>
                        <div className="text-[9px] text-[#848e9c] font-sans">
                          {week.totalTrades > 0 ? `${week.totalTrades} Trades` : 'No Trades'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Day Drilldown Modal / Drawer inside Dashboard */}
            {activeDayDetails && (
              <div className={`mt-3 pt-3 border-t border-[#232836] bg-[#131722] ${innerCornerClass} p-3 border border-[#232836]`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Selected Day: {activeDayDetails.dateStr}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        activeDayDetails.netReturn >= 0
                          ? 'bg-[#00ffa3]/15 text-[#00ffa3] border-[#00ffa3]/30'
                          : 'bg-[#ff4a7d]/15 text-[#ff4a7d] border-[#ff4a7d]/30'
                      }`}
                    >
                      {activeDayDetails.netReturn >= 0
                        ? `+$${activeDayDetails.netReturn.toFixed(2)}`
                        : `-$${Math.abs(activeDayDetails.netReturn).toFixed(2)}`}
                    </span>
                    <span className="text-[10px] text-[#848e9c]">
                      ({activeDayDetails.tradeCount} trades, {activeDayDetails.winCount} wins)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onNavigateToCalendar && (
                      <button
                        onClick={onNavigateToCalendar}
                        className="text-[11px] text-[#2962ff] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                      >
                        Open Full Day View <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedDayDateStr(null);
                        onSelectDay?.(null);
                      }}
                      className="p-1 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition cursor-pointer"
                      title="Close Day View"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Day Trades Mini List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto">
                  {activeDayDetails.trades.map((trade) => {
                    const isWin = trade.status === 'WIN';
                    const isLoss = trade.status === 'LOSS';
                    return (
                      <div
                        key={trade.id}
                        className="bg-[#181b24] border border-[#2a2e39] rounded p-2 text-xs flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{trade.symbol}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                              trade.side === 'LONG'
                                ? 'bg-[#089981]/20 text-[#089981]'
                                : 'bg-[#f23645]/20 text-[#f23645]'
                            }`}
                          >
                            {trade.side}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-[#787b86]">{trade.time}</span>
                          <span
                            className={`font-mono font-bold ${
                              isWin ? 'text-[#089981]' : isLoss ? 'text-[#f23645]' : 'text-[#787b86]'
                            }`}
                          >
                            {trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
