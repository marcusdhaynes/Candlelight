import React, { useState, useMemo } from 'react';
import { JournalTrade } from '../../types';
import { getCalendarMonthData, CalendarDaySummary } from '../../services/journalAnalytics';
import { JournalLayoutSettings } from './JournalGridSettingsModal';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  X,
  Plus,
  TrendingUp,
  Tag,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Edit3,
} from 'lucide-react';

interface JournalCalendarProps {
  trades: JournalTrade[];
  layoutSettings?: JournalLayoutSettings;
  calendarYear?: number;
  calendarMonth?: number;
  onMonthChange?: (year: number, month: number) => void;
  selectedDay?: string | null;
  onSelectDay?: (dateStr: string | null) => void;
  onClearSelectedDay?: () => void;
  onOpenAddTrade: () => void;
  onSelectTrade?: (trade: JournalTrade) => void;
  onEditTrade?: (trade: JournalTrade) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

export const JournalCalendar: React.FC<JournalCalendarProps> = ({
  trades,
  layoutSettings,
  calendarYear: propYear,
  calendarMonth: propMonth,
  onMonthChange,
  selectedDay: propSelectedDay,
  onSelectDay,
  onClearSelectedDay,
  onOpenAddTrade,
  onSelectTrade,
  onEditTrade,
  isMaximized = true,
  onToggleMaximize,
  onClose,
}) => {
  const isRounded = layoutSettings?.roundedCorners !== false;
  const cornerClass = isRounded ? 'rounded-xl' : 'rounded-none';
  const smCornerClass = isRounded ? 'rounded' : 'rounded-none';
  const [internalYear, setInternalYear] = useState(2025);
  const [internalMonth, setInternalMonth] = useState(4); // April 2025

  const calendarYear = propYear ?? internalYear;
  const calendarMonth = propMonth ?? internalMonth;

  const [selectedDayDateStr, setSelectedDayDateStr] = useState<string | null>(null);
  const activeDayDateStr = propSelectedDay !== undefined && propSelectedDay !== null ? propSelectedDay : selectedDayDateStr;

  const [filterSetup, setFilterSetup] = useState<string>('All');
  const [filterSide, setFilterSide] = useState<string>('All');
  const [filterMistake, setFilterMistake] = useState<string>('All');

  // Filter trades first if user selected filters
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterSetup !== 'All') {
        const match = t.setups?.some((s) => s.toLowerCase() === filterSetup.toLowerCase());
        if (!match) return false;
      }
      if (filterSide !== 'All' && t.side !== filterSide) return false;
      if (filterMistake !== 'All') {
        if (filterMistake === 'None' && t.mistakes && t.mistakes.length > 0) return false;
        if (filterMistake !== 'None') {
          const match = t.mistakes?.some((m) => m.toLowerCase() === filterMistake.toLowerCase());
          if (!match) return false;
        }
      }
      return true;
    });
  }, [trades, filterSetup, filterSide, filterMistake]);

  const monthData = useMemo(() => {
    return getCalendarMonthData(filteredTrades, calendarYear, calendarMonth);
  }, [filteredTrades, calendarYear, calendarMonth]);

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
    'July', 'August', 'September', 'October', 'November', 'December'
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

  const handleDaySelect = (day: CalendarDaySummary) => {
    if (day.tradeCount > 0) {
      setSelectedDayDateStr(day.dateStr);
      onSelectDay?.(day.dateStr);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedDayDateStr(null);
    onSelectDay?.(null);
    onClearSelectedDay?.();
  };

  return (
    <div id="journal-calendar-view" className="flex flex-col h-full bg-[#131722] text-[#d1d4dc] overflow-hidden">
      {/* Top Filter Bar (TradeZella Style) */}
      <div className="bg-[#1e222d] border-b border-[#2a2e39] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Symbol Filter */}
          <div className="flex items-center gap-1 bg-[#131722] px-2.5 py-1 rounded border border-[#2a2e39]">
            <span className="text-[#787b86]">Symbol</span>
            <span className="text-white font-medium">All</span>
          </div>

          {/* Setup (Good Tags) Filter */}
          <div className="flex items-center gap-1 bg-[#131722] px-2.5 py-1 rounded border border-[#2a2e39]">
            <span className="text-[#00ffa3] font-semibold">Good/Setup:</span>
            <select
              value={filterSetup}
              onChange={(e) => setFilterSetup(e.target.value)}
              className="bg-transparent text-white font-medium outline-none cursor-pointer text-xs"
            >
              <option value="All">All Good / Setups</option>
              <option value="Strong Entry">Strong Entry</option>
              <option value="Followed Setup">Followed Setup</option>
              <option value="Trailed Stop Loss">Trailed Stop Loss</option>
              <option value="Breakout">Breakout</option>
              <option value="Reversal">Reversal</option>
              <option value="Key Level Bounce">Key Level Bounce</option>
              <option value="Proper Position Sizing">Proper Position Sizing</option>
              <option value="Scaled Out at TP">Scaled Out at TP</option>
              <option value="RSI Crossed">RSI Crossed</option>
              <option value="Trend Continuation">Trend Continuation</option>
              <option value="Order Block">Order Block</option>
            </select>
          </div>

          {/* Side Filter */}
          <div className="flex items-center gap-1 bg-[#131722] px-2.5 py-1 rounded border border-[#2a2e39]">
            <span className="text-[#787b86]">Side:</span>
            <select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value)}
              className="bg-transparent text-white font-medium outline-none cursor-pointer text-xs"
            >
              <option value="All">All Sides</option>
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </select>
          </div>

          {/* Mistake (Bad Tags) Filter */}
          <div className="flex items-center gap-1 bg-[#131722] px-2.5 py-1 rounded border border-[#2a2e39]">
            <span className="text-[#ff4a7d] font-semibold">Bad/Mistake:</span>
            <select
              value={filterMistake}
              onChange={(e) => setFilterMistake(e.target.value)}
              className="bg-transparent text-white font-medium outline-none cursor-pointer text-xs"
            >
              <option value="All">All</option>
              <option value="None">No Mistakes</option>
              <option value="FOMO">FOMO</option>
              <option value="Revenge Trade">Revenge Trade</option>
              <option value="No Stop Loss">No Stop Loss</option>
              <option value="Early Exit">Early Exit</option>
              <option value="Chasing">Chasing</option>
              <option value="Greed">Greed</option>
              <option value="Overleveraged">Overleveraged</option>
              <option value="Moved Stop Loss">Moved Stop Loss</option>
              <option value="Traded Boredom">Traded Boredom</option>
              <option value="Ignored Invalidation">Ignored Invalidation</option>
            </select>
          </div>

          {(filterSetup !== 'All' || filterSide !== 'All' || filterMistake !== 'All') && (
            <button
              onClick={() => {
                setFilterSetup('All');
                setFilterSide('All');
                setFilterMistake('All');
              }}
              className="text-[11px] text-[#2962ff] hover:underline px-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Action Buttons & Window Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddTrade}
            className="flex items-center gap-1 bg-[#00c49f] hover:bg-[#00b290] text-white px-3 py-1 rounded-full text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Trade</span>
          </button>

          {/* Window controls attached directly to rightmost side */}
          {(onToggleMaximize || onClose) && <div className="h-4 w-px bg-[#232836] mx-0.5" />}

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

      {/* Calendar Header with navigation: Today, Arrows, Month Year, Total Month Return */}
      <div className="bg-[#171b26] px-4 py-2.5 border-b border-[#232836] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleGoToday}
            className="px-3 py-1 bg-[#131722] hover:bg-[#1e222d] text-[#d1d4dc] hover:text-white rounded text-xs font-semibold border border-[#232836] transition cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-[#848e9c] hover:text-white hover:bg-[#1e222d] rounded transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 text-[#848e9c] hover:text-white hover:bg-[#1e222d] rounded transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-tight">
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

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#848e9c]">
            Trades: <strong className="text-white">{monthData.totalMonthTrades}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#848e9c]">
            Wins: <strong className="text-[#00ffa3]">{monthData.totalMonthWins}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#848e9c]">
            Win Rate: <strong className="text-[#00e5ff]">{monthData.monthWinRate}%</strong>
          </span>
        </div>
      </div>

      {/* Main Calendar Body + Optional Right Drilldown Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Full Interactive Grid */}
        <div className="flex-1 flex flex-col overflow-auto p-3 custom-scrollbar">
          <div className="min-w-[700px] w-full flex-1 flex flex-col">
            {/* Weekday Column Headers (7 Days + TOTAL) */}
            <div className="grid grid-cols-8 gap-2 mb-2 text-center text-xs font-semibold tracking-wider shrink-0">
              <div className="py-1 text-[#848e9c]">SUN</div>
              <div className="py-1 text-[#848e9c]">MON</div>
              <div className="py-1 text-[#848e9c]">TUE</div>
              <div className="py-1 text-[#848e9c]">WED</div>
              <div className="py-1 text-[#848e9c]">THR</div>
              <div className="py-1 text-[#848e9c]">FRI</div>
              <div className="py-1 text-[#848e9c]">SAT</div>
              <div className="py-1 bg-[#131722] text-[#00e5ff] rounded border border-[#232836] font-bold">TOTAL</div>
            </div>

            {/* Grid Rows */}
            <div className="flex-1 flex flex-col gap-2">
              {monthData.weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-8 gap-2 flex-1 min-h-[105px]">
                  {week.days.map((day, dIdx) => {
                    const hasTrades = day.tradeCount > 0;
                    const isProfit = day.netReturn > 0;
                    const isLoss = day.netReturn < 0;
                    const isSelected = activeDayDetails?.dateStr === day.dateStr || propSelectedDay === day.dateStr;

                    return (
                      <div
                        key={dIdx}
                        onClick={() => hasTrades && handleDaySelect(day)}
                        className={`${cornerClass} p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-150 relative border select-none overflow-hidden h-full ${
                          !day.inCurrentMonth
                            ? 'bg-[#10141e]/40 border-[#1a1f2c]/50 text-[#434651]'
                            : hasTrades
                            ? isProfit
                              ? 'bg-gradient-to-b from-[#089981]/20 to-[#089981]/10 border-[#089981]/40 hover:border-[#00ffa3] cursor-pointer hover:shadow-[0_4px_20px_rgba(0,255,163,0.15)]'
                              : isLoss
                              ? 'bg-gradient-to-b from-[#f23645]/20 to-[#f23645]/10 border-[#f23645]/40 hover:border-[#ff4a7d] cursor-pointer hover:shadow-[0_4px_20px_rgba(255,74,125,0.15)]'
                              : 'bg-[#1e222d] border-[#2e3444] cursor-pointer'
                            : 'bg-[#131722]/70 border-[#232836] hover:bg-[#131722] hover:border-[#2e3444]'
                        } ${isSelected ? 'ring-2 ring-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.25)] z-10' : ''}`}
                      >
                        {/* Top Header: Day Number */}
                        <div className="flex items-center justify-between gap-1 shrink-0">
                          <span
                            className={`text-xs font-bold leading-none shrink-0 ${
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
                            <span className="text-[9.5px] text-[#d1d4dc] font-mono bg-[#131722]/80 px-1.5 py-0.5 rounded font-medium border border-[#232836] leading-none shrink-0 whitespace-nowrap">
                              {day.tradeCount}t
                            </span>
                          )}
                        </div>

                        {/* Middle: Net P&L */}
                        {hasTrades ? (
                          <div className="my-auto py-1 flex items-center">
                            <div
                              className={`text-xs sm:text-sm md:text-base font-extrabold font-mono tracking-tight truncate w-full ${
                                isProfit
                                  ? 'text-[#00ffa3]'
                                  : isLoss
                                  ? 'text-[#ff4a7d]'
                                  : 'text-white'
                              }`}
                              title={day.netReturn >= 0 ? `+$${day.netReturn.toFixed(2)}` : `-$${Math.abs(day.netReturn).toFixed(2)}`}
                            >
                              {isProfit
                                ? `+$${day.netReturn.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                : `-$${Math.abs(day.netReturn).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1" />
                        )}

                        {/* Bottom Tags Pills */}
                        {hasTrades && (
                          <div className="flex flex-wrap gap-1 mt-auto pt-1 overflow-hidden shrink-0">
                            {day.setups.slice(0, 1).map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00ffa3]/15 text-[#00ffa3] border border-[#00ffa3]/30 truncate max-w-[70px] whitespace-nowrap"
                              >
                                {s}
                              </span>
                            ))}
                            {day.mistakes.slice(0, 1).map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ff4a7d]/15 text-[#ff808b] border border-[#ff4a7d]/30 truncate max-w-[70px] whitespace-nowrap"
                              >
                                {m}
                              </span>
                            ))}
                            {day.setups.length + day.mistakes.length > 2 && (
                              <span className="text-[8px] sm:text-[8.5px] font-medium text-[#848e9c] self-center shrink-0">
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
                    className={`${cornerClass} p-2 sm:p-2.5 flex flex-col justify-between text-center font-mono border transition-colors overflow-hidden h-full ${
                      week.totalTrades > 0
                        ? week.totalReturn > 0
                          ? 'bg-gradient-to-b from-[#089981]/25 to-[#089981]/15 border-[#089981]/50 text-[#00ffa3] shadow-sm'
                          : week.totalReturn < 0
                          ? 'bg-gradient-to-b from-[#f23645]/25 to-[#f23645]/15 border-[#f23645]/50 text-[#ff4a7d] shadow-sm'
                          : 'bg-[#131722]/80 border-[#232836] text-white'
                        : 'bg-[#131722]/50 border-[#232836] text-[#5d6575]'
                    }`}
                  >
                    <div className="text-[8.5px] sm:text-[9.5px] font-bold text-[#848e9c] uppercase tracking-wider truncate shrink-0">
                      WEEK {wIdx + 1}
                    </div>
                    <div className="my-auto py-1">
                      {week.totalTrades > 0 ? (
                        <div className="text-xs sm:text-sm font-extrabold font-mono tracking-tight truncate w-full">
                          {week.totalReturn >= 0
                            ? `+$${week.totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : `-$${Math.abs(week.totalReturn).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </div>
                      ) : (
                        <div className="text-xs text-[#5d6575] font-mono">—</div>
                      )}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-[#848e9c] font-sans truncate shrink-0">
                      {week.totalTrades > 0 ? `${week.totalTrades} Trades` : 'No Trades'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Drawer: Selected Day Detailed Drilldown */}
        {activeDayDetails && (
          <div
            id="calendar-day-drilldown-drawer"
            className="w-[380px] bg-[#171b26] border-l border-[#232836] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right-4 duration-200 shrink-0"
          >
            {/* Header */}
            <div className="p-3.5 bg-[#131722] border-b border-[#232836] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{activeDayDetails.dateStr}</span>
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
                </h3>
                <div className="text-[10.5px] text-[#848e9c] mt-0.5">
                  {activeDayDetails.tradeCount} Trades executed ({activeDayDetails.winCount} Wins)
                </div>
              </div>
              <button
                onClick={handleCloseDrawer}
                className={`p-1 text-[#848e9c] hover:text-white ${smCornerClass} hover:bg-[#1e222d] transition cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Trades List for that Day */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {activeDayDetails.trades.map((trade) => {
                const isWin = trade.status === 'WIN';
                const isLoss = trade.status === 'LOSS';

                return (
                  <div
                    key={trade.id}
                    onClick={() => onSelectTrade && onSelectTrade(trade)}
                    className={`bg-[#131722] border border-[#232836] hover:border-[#2962ff] p-3 ${cornerClass} transition cursor-pointer group`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            trade.side === 'LONG'
                              ? 'bg-[#2962ff]/20 text-[#2962ff]'
                              : 'bg-[#ff4a7d]/20 text-[#ff4a7d]'
                          }`}
                        >
                          {trade.side}
                        </span>
                        <span className="font-bold text-xs text-white tracking-tight">
                          {trade.symbol}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            isWin
                              ? 'bg-[#00ffa3]/15 text-[#00ffa3] border-[#00ffa3]/30'
                              : isLoss
                              ? 'bg-[#ff4a7d]/15 text-[#ff4a7d] border-[#ff4a7d]/30'
                              : 'bg-[#787b86]/20 text-[#787b86] border-[#787b86]/30'
                          }`}
                        >
                          {trade.status}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          trade.netReturn >= 0 ? 'text-[#00ffa3]' : 'text-[#ff4a7d]'
                        }`}
                      >
                        {trade.netReturn >= 0 ? `+$${trade.netReturn.toFixed(2)}` : `-$${Math.abs(trade.netReturn).toFixed(2)}`}
                      </span>
                    </div>

                    {/* Price details */}
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-[#848e9c] py-1 border-t border-[#232836]">
                      <div>
                        Entry: <span className="text-white">${trade.entryPrice}</span>
                      </div>
                      <div>
                        Exit:{' '}
                        <span className="text-white">
                          {trade.exitPrice ? `$${trade.exitPrice}` : 'Open'}
                        </span>
                      </div>
                      <div className="text-right">
                        Size: <span className="text-white">{trade.size}</span>
                      </div>
                    </div>

                    {/* Note excerpt */}
                    {trade.note && (
                      <p className="text-[10px] text-[#848e9c] mt-1.5 line-clamp-2 italic bg-[#1e222d] p-1.5 rounded">
                        "{trade.note}"
                      </p>
                    )}

                    {/* Setups (Good) and Mistakes (Bad) tags + Edit action */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#232836]">
                      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                        {trade.setups && trade.setups.length > 0 && trade.setups.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[9px] font-bold bg-[#00ffa3]/15 text-[#00ffa3] border border-[#00ffa3]/30 px-1.5 py-0.5 rounded truncate max-w-[140px]"
                            title={`Good Tag: ${s}`}
                          >
                            ✓ {s}
                          </span>
                        ))}
                        {trade.mistakes && trade.mistakes.length > 0 && trade.mistakes.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[9px] font-bold bg-[#ff4a7d]/15 text-[#ff808b] border border-[#ff4a7d]/30 px-1.5 py-0.5 rounded truncate max-w-[140px]"
                            title={`Mistake Tag: ${m}`}
                          >
                            ⚠ {m}
                          </span>
                        ))}
                        {(!trade.setups || trade.setups.length === 0) && (!trade.mistakes || trade.mistakes.length === 0) && (
                          <span className="text-[9px] text-[#5d6575] italic">No tags selected</span>
                        )}
                      </div>
                      {onEditTrade && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTrade(trade);
                          }}
                          className="px-2 py-1 rounded bg-[#1f2433] hover:bg-[#2962ff] text-[#848e9c] hover:text-white text-[10px] font-bold border border-[#2e3444] transition flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                          title="Edit trade execution, good & bad tags"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
