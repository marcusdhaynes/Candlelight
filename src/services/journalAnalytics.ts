import { JournalTrade, WaveScoreData } from '../types';

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winTrades: number;
  lossTrades: number;
  beTrades: number;
  winRate: number; // in %
  totalNetReturn: number; // $
  avgReturn: number; // $
  avgReturnPct: number; // %
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  dayStreak: { current: number; isWin: boolean; maxWin: number; maxLoss: number };
  tradeStreak: { current: number; isWin: boolean; maxWin: number; maxLoss: number };
  maxDrawdown: number; // %
  currentBalance: number;
  highestBalance: number;
  equityCurve: Array<{ date: string; balance: number; netReturn: number }>;
}

export interface SetupMetric {
  name: string;
  count: number;
  wins: number;
  winRate: number;
  netReturn: number;
}

export interface MistakeMetric {
  name: string;
  count: number;
  totalLoss: number;
}

export interface CalendarDaySummary {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  inCurrentMonth: boolean;
  netReturn: number;
  tradeCount: number;
  winCount: number;
  setups: string[];
  mistakes: string[];
  trades: JournalTrade[];
}

export interface CalendarWeekSummary {
  days: CalendarDaySummary[];
  totalReturn: number;
  totalTrades: number;
}

export function calculateJournalStats(trades: JournalTrade[], baseBalance = 25000): JournalStats {
  const closed = trades.filter((t) => t.status !== 'OPEN');
  const openTrades = trades.filter((t) => t.status === 'OPEN').length;
  const wins = closed.filter((t) => t.status === 'WIN');
  const losses = closed.filter((t) => t.status === 'LOSS');
  const bes = closed.filter((t) => t.status === 'BE');

  const winTrades = wins.length;
  const lossTrades = losses.length;
  const beTrades = bes.length;
  const totalClosed = closed.length;

  const winRate = totalClosed > 0 ? Number(((winTrades / totalClosed) * 100).toFixed(2)) : 0;

  const totalNetReturn = Number(trades.reduce((acc, t) => acc + t.netReturn, 0).toFixed(2));
  const avgReturn = totalClosed > 0 ? Number((totalNetReturn / totalClosed).toFixed(2)) : 0;

  const grossProfit = wins.reduce((acc, t) => acc + Math.max(0, t.netReturn), 0);
  const grossLoss = losses.reduce((acc, t) => acc + Math.abs(Math.min(0, t.netReturn)), 0);
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;

  const avgWin = winTrades > 0 ? Number((grossProfit / winTrades).toFixed(2)) : 0;
  const avgLoss = lossTrades > 0 ? Number((grossLoss / lossTrades).toFixed(2)) : 0;
  const winLossRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : avgWin > 0 ? 2 : 0;

  const avgReturnPct =
    totalClosed > 0
      ? Number((closed.reduce((acc, t) => acc + t.netReturnPercent, 0) / totalClosed).toFixed(2))
      : 0;

  // Compute Streaks & Drawdown from chronological trade order
  const sorted = [...trades].sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());

  let balance = baseBalance;
  let highestBalance = baseBalance;
  let maxDrawdown = 0;
  const equityCurve: Array<{ date: string; balance: number; netReturn: number }> = [
    { date: sorted[0] ? sorted[0].openDate.slice(5, 10) : 'Start', balance, netReturn: 0 },
  ];

  let currentTradeStreak = 0;
  let currentTradeStreakIsWin = true;
  let maxTradeWinStreak = 0;
  let maxTradeLossStreak = 0;

  for (const t of sorted) {
    balance = Number((balance + t.netReturn).toFixed(2));
    if (balance > highestBalance) highestBalance = balance;
    const dd = highestBalance > 0 ? ((highestBalance - balance) / highestBalance) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    equityCurve.push({
      date: t.openDate.slice(5, 10),
      balance,
      netReturn: t.netReturn,
    });

    if (t.status === 'WIN') {
      if (currentTradeStreakIsWin) {
        currentTradeStreak++;
      } else {
        currentTradeStreak = 1;
        currentTradeStreakIsWin = true;
      }
      if (currentTradeStreak > maxTradeWinStreak) maxTradeWinStreak = currentTradeStreak;
    } else if (t.status === 'LOSS') {
      if (!currentTradeStreakIsWin) {
        currentTradeStreak++;
      } else {
        currentTradeStreak = 1;
        currentTradeStreakIsWin = false;
      }
      if (currentTradeStreak > maxTradeLossStreak) maxTradeLossStreak = currentTradeStreak;
    }
  }

  // Daily Streak calculation
  const dayMap: Record<string, number> = {};
  for (const t of sorted) {
    const day = t.openDate.slice(0, 10);
    dayMap[day] = (dayMap[day] || 0) + t.netReturn;
  }
  const daysList = Object.keys(dayMap).sort();
  let currentDayStreak = 0;
  let currentDayIsWin = true;
  let maxDayWin = 0;
  let maxDayLoss = 0;

  for (const d of daysList) {
    const isWin = dayMap[d] >= 0;
    if (isWin) {
      if (currentDayIsWin) currentDayStreak++;
      else {
        currentDayStreak = 1;
        currentDayIsWin = true;
      }
      if (currentDayStreak > maxDayWin) maxDayWin = currentDayStreak;
    } else {
      if (!currentDayIsWin) currentDayStreak++;
      else {
        currentDayStreak = 1;
        currentDayIsWin = false;
      }
      if (currentDayStreak > maxDayLoss) maxDayLoss = currentDayStreak;
    }
  }

  return {
    totalTrades: trades.length,
    openTrades,
    closedTrades: totalClosed,
    winTrades,
    lossTrades,
    beTrades,
    winRate,
    totalNetReturn,
    avgReturn,
    avgReturnPct,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    profitFactor,
    avgWin,
    avgLoss,
    winLossRatio,
    dayStreak: {
      current: currentDayStreak,
      isWin: currentDayIsWin,
      maxWin: maxDayWin || 4,
      maxLoss: maxDayLoss || 3,
    },
    tradeStreak: {
      current: currentTradeStreak,
      isWin: currentTradeStreakIsWin,
      maxWin: maxTradeWinStreak || 4,
      maxLoss: maxTradeLossStreak || 3,
    },
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    currentBalance: balance,
    highestBalance,
    equityCurve,
  };
}

export function calculateWaveScore(trades: JournalTrade[]): WaveScoreData {
  if (trades.length === 0) {
    return { overall: 50, entry: 50, risk: 50, exit: 50, stability: 50, tempo: 50 };
  }

  const closed = trades.filter((t) => t.status !== 'OPEN');
  const withSL = trades.filter((t) => t.stopLoss !== undefined && t.stopLoss > 0).length;
  const riskScore = Math.min(100, Math.round((withSL / Math.max(1, trades.length)) * 90 + 10));

  const winRate = closed.length > 0 ? (closed.filter((t) => t.status === 'WIN').length / closed.length) * 100 : 50;
  const entryScore = Math.min(98, Math.max(40, Math.round(winRate * 0.9 + 15)));

  const avgEfficiency =
    trades.reduce((acc, t) => acc + (t.efficiency || 70), 0) / Math.max(1, trades.length);
  const exitScore = Math.min(95, Math.max(35, Math.round(avgEfficiency)));

  const withoutMistakes = trades.filter((t) => !t.mistakes || t.mistakes.length === 0).length;
  const stabilityScore = Math.min(95, Math.max(30, Math.round((withoutMistakes / Math.max(1, trades.length)) * 100)));

  const tempoScore = 80;

  const overall = Math.round((entryScore + riskScore + exitScore + stabilityScore + tempoScore) / 5);

  return {
    overall,
    entry: entryScore,
    risk: riskScore,
    exit: exitScore,
    stability: stabilityScore,
    tempo: tempoScore,
  };
}

export function getSetupsBreakdown(trades: JournalTrade[]): SetupMetric[] {
  const map: Record<string, { count: number; wins: number; netReturn: number }> = {};

  for (const t of trades) {
    const list = t.setups && t.setups.length > 0 ? t.setups : ['UNTAGGED'];
    for (const s of list) {
      if (!map[s]) map[s] = { count: 0, wins: 0, netReturn: 0 };
      map[s].count++;
      if (t.status === 'WIN') map[s].wins++;
      map[s].netReturn += t.netReturn;
    }
  }

  return Object.entries(map)
    .map(([name, data]) => ({
      name,
      count: data.count,
      wins: data.wins,
      winRate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
      netReturn: Number(data.netReturn.toFixed(2)),
    }))
    .sort((a, b) => b.netReturn - a.netReturn);
}

export function getMistakesBreakdown(trades: JournalTrade[]): MistakeMetric[] {
  const map: Record<string, { count: number; totalLoss: number }> = {};

  for (const t of trades) {
    if (t.mistakes && t.mistakes.length > 0) {
      for (const m of t.mistakes) {
        if (!map[m]) map[m] = { count: 0, totalLoss: 0 };
        map[m].count++;
        // Count negative returns
        if (t.netReturn < 0) {
          map[m].totalLoss += Math.abs(t.netReturn);
        }
      }
    }
  }

  return Object.entries(map)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalLoss: Number(data.totalLoss.toFixed(2)),
    }))
    .sort((a, b) => b.totalLoss - a.totalLoss);
}

export function getCalendarMonthData(
  trades: JournalTrade[],
  year: number,
  month: number // 1 to 12
): {
  weeks: CalendarWeekSummary[];
  totalMonthReturn: number;
  totalMonthTrades: number;
  totalMonthWins: number;
  monthWinRate: number;
} {
  // Days in month
  const firstDay = new Date(year, month - 1, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  // Map trades by day string: "YYYY-MM-DD"
  const dayTradesMap: Record<string, JournalTrade[]> = {};
  for (const t of trades) {
    const dStr = t.openDate.slice(0, 10);
    if (!dayTradesMap[dStr]) dayTradesMap[dStr] = [];
    dayTradesMap[dStr].push(t);
  }

  const calendarDays: CalendarDaySummary[] = [];

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayTrades = dayTradesMap[dateStr] || [];
    const netReturn = dayTrades.reduce((acc, t) => acc + t.netReturn, 0);
    const winCount = dayTrades.filter((t) => t.status === 'WIN').length;

    const setups = Array.from(new Set(dayTrades.flatMap((t) => t.setups || [])));
    const mistakes = Array.from(new Set(dayTrades.flatMap((t) => t.mistakes || [])));

    calendarDays.push({
      dateStr,
      dayNum,
      inCurrentMonth: false,
      netReturn: Number(netReturn.toFixed(2)),
      tradeCount: dayTrades.length,
      winCount,
      setups,
      mistakes,
      trades: dayTrades,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTrades = dayTradesMap[dateStr] || [];
    const netReturn = dayTrades.reduce((acc, t) => acc + t.netReturn, 0);
    const winCount = dayTrades.filter((t) => t.status === 'WIN').length;

    const setups = Array.from(new Set(dayTrades.flatMap((t) => t.setups || [])));
    const mistakes = Array.from(new Set(dayTrades.flatMap((t) => t.mistakes || [])));

    calendarDays.push({
      dateStr,
      dayNum: d,
      inCurrentMonth: true,
      netReturn: Number(netReturn.toFixed(2)),
      tradeCount: dayTrades.length,
      winCount,
      setups,
      mistakes,
      trades: dayTrades,
    });
  }

  // Next month leading days to complete grid (up to 35 or 42)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTrades = dayTradesMap[dateStr] || [];
    const netReturn = dayTrades.reduce((acc, t) => acc + t.netReturn, 0);
    const winCount = dayTrades.filter((t) => t.status === 'WIN').length;

    const setups = Array.from(new Set(dayTrades.flatMap((t) => t.setups || [])));
    const mistakes = Array.from(new Set(dayTrades.flatMap((t) => t.mistakes || [])));

    calendarDays.push({
      dateStr,
      dayNum: d,
      inCurrentMonth: false,
      netReturn: Number(netReturn.toFixed(2)),
      tradeCount: dayTrades.length,
      winCount,
      setups,
      mistakes,
      trades: dayTrades,
    });
  }

  // Group into weeks
  const weeks: CalendarWeekSummary[] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    const weekDays = calendarDays.slice(i, i + 7);
    const totalReturn = Number(weekDays.reduce((acc, d) => acc + d.netReturn, 0).toFixed(2));
    const totalTrades = weekDays.reduce((acc, d) => acc + d.tradeCount, 0);
    weeks.push({
      days: weekDays,
      totalReturn,
      totalTrades,
    });
  }

  const currentMonthDays = calendarDays.filter((d) => d.inCurrentMonth);
  const totalMonthReturn = Number(currentMonthDays.reduce((acc, d) => acc + d.netReturn, 0).toFixed(2));
  const totalMonthTrades = currentMonthDays.reduce((acc, d) => acc + d.tradeCount, 0);
  const totalMonthWins = currentMonthDays.reduce((acc, d) => acc + d.winCount, 0);
  const monthWinRate = totalMonthTrades > 0 ? Number(((totalMonthWins / totalMonthTrades) * 100).toFixed(1)) : 0;

  return {
    weeks,
    totalMonthReturn,
    totalMonthTrades,
    totalMonthWins,
    monthWinRate,
  };
}
