import React, { useState } from 'react';
import { JournalTrade } from '../../types';
import { JournalStats, getSetupsBreakdown, getMistakesBreakdown } from '../../services/journalAnalytics';
import { JournalLayoutSettings } from './JournalGridSettingsModal';
import {
  SlidersHorizontal,
  Zap,
  TrendingUp,
  ShieldCheck,
  Brain,
  Award,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

interface JournalEvaluatorProps {
  trades: JournalTrade[];
  stats: JournalStats;
  layoutSettings?: JournalLayoutSettings;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

export const JournalEvaluator: React.FC<JournalEvaluatorProps> = ({
  trades,
  stats,
  layoutSettings,
  isMaximized = true,
  onToggleMaximize,
  onClose,
}) => {
  const isRounded = layoutSettings?.roundedCorners !== false;
  const cornerClass = isRounded ? 'rounded-xl' : 'rounded-none';
  // What-If Simulation Toggles
  const [eliminateFomo, setEliminateFomo] = useState(true);
  const [strictStopLoss, setStrictStopLoss] = useState(true);
  const [capLosersAt1R, setCapLosersAt1R] = useState(false);

  // Compute Simulated Trades
  const simulatedTrades = trades.filter((t) => {
    if (eliminateFomo && t.mistakes?.includes('fomo')) {
      return false; // simulate never taking this trade
    }
    return true;
  }).map((t) => {
    let ret = t.netReturn;
    // Strict stop loss simulation: If trade lacked stop loss and had large loss, cap loss at -$50
    if (strictStopLoss && t.mistakes?.includes("didn't set up stop loss") && ret < -50) {
      ret = -50;
    }
    if (capLosersAt1R && ret < -80) {
      ret = -80;
    }
    return {
      ...t,
      netReturn: ret,
      status: ret >= 0 ? (ret === 0 ? 'BE' : 'WIN') : 'LOSS',
    };
  });

  // Calculate simulated metrics
  const simTotalReturn = simulatedTrades.reduce((acc, t) => acc + t.netReturn, 0);
  const simWins = simulatedTrades.filter((t) => t.status === 'WIN').length;
  const simClosed = simulatedTrades.filter((t) => t.status !== 'OPEN').length;
  const simWinRate = simClosed > 0 ? Number(((simWins / simClosed) * 100).toFixed(1)) : 0;
  const profitBoost = simTotalReturn - stats.totalNetReturn;

  // Compute FOMO stats specifically for What-If integration display
  const fomoTrades = trades.filter((t) => t.mistakes?.includes('fomo') || t.emotion === 'FOMO');
  const fomoLossCount = fomoTrades.filter((t) => t.netReturn < 0).length;
  const fomoTotalLoss = Math.abs(
    fomoTrades.filter((t) => t.netReturn < 0).reduce((acc, t) => acc + t.netReturn, 0)
  );

  // Allow toggling between What-If Simulated view and Historical Actual view
  const [edgeViewMode, setEdgeViewMode] = useState<'simulated' | 'actual'>('simulated');
  const activeTrades = edgeViewMode === 'simulated' ? simulatedTrades : trades;

  const activeSetups = getSetupsBreakdown(activeTrades);
  const activeMistakes = getMistakesBreakdown(activeTrades);

  // Emotions breakdown based on active view mode
  const emotionMap: Record<string, { count: number; wins: number; pnl: number }> = {};
  for (const t of activeTrades) {
    const emo = t.emotion || 'Disciplined';
    if (!emotionMap[emo]) emotionMap[emo] = { count: 0, wins: 0, pnl: 0 };
    emotionMap[emo].count++;
    if (t.status === 'WIN') emotionMap[emo].wins++;
    emotionMap[emo].pnl += t.netReturn;
  }

  // Ensure FOMO is always visible in the audit so its simulation elimination is crystal clear
  if (edgeViewMode === 'simulated' && eliminateFomo && !emotionMap['FOMO']) {
    emotionMap['FOMO'] = { count: 0, wins: 0, pnl: 0 };
  }

  return (
    <div className="flex flex-col h-full bg-[#0f131c] text-[#d1d4dc] overflow-hidden select-none font-sans text-xs">
      {/* Top Header Bar with attached Window Controls on the rightmost side */}
      <div className="bg-[#131722] px-3 py-1.5 border-b border-[#232836] flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-[#2563eb] text-white flex items-center justify-center shadow-xs">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-white">TradeZella & TraderSync What-If Simulator</span>
            <span className="text-[10px] uppercase font-bold bg-[#00ffa3]/20 text-[#00ffa3] border border-[#00ffa3]/30 px-1.5 py-0.2 rounded">
              AI Evaluator
            </span>
          </div>
        </div>

        {/* Right window controls directly attached */}
        <div className="flex items-center gap-2">
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

      <div id="journal-evaluator-tab" className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* What-If Simulation Hero Header */}
        <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-4 shadow-sm`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00ffa3]" />
                <h2 className="text-sm font-bold text-white tracking-tight">
                  What-If Edge Simulation
                </h2>
              </div>
              <p className="text-[11px] text-[#848e9c] mt-1 max-w-xl leading-relaxed">
                Simulate how your edge performs by removing behavioral mistakes, applying strict stop losses, or eliminating emotional slipups.
              </p>
            </div>

            {/* Simulation Outcome Card */}
            <div className="bg-[#131722] border border-[#232836] rounded-lg p-2.5 flex items-center gap-5">
              <div>
                <div className="text-[9px] uppercase text-[#848e9c] font-semibold">Simulated P&L</div>
                <div className="text-base font-bold font-mono text-[#00ffa3]">
                  +${simTotalReturn.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-[#848e9c] font-semibold">Edge Improvement</div>
                <div className="text-base font-bold font-mono text-[#00e5ff] flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +${Math.max(0, profitBoost).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-[#848e9c] font-semibold">Simulated Win %</div>
                <div className="text-base font-bold font-mono text-[#38bdf8]">{simWinRate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Simulation Controls / Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#2a2e39]">
          <label className="flex items-center justify-between bg-[#131722] p-3 rounded-lg border border-[#2a2e39] cursor-pointer hover:border-[#2962ff] transition">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#f7931a]" /> Eliminate FOMO Trades
              </span>
              <p className="text-[10px] text-[#787b86]">Removes emotional impulsive entries</p>
            </div>
            <input
              type="checkbox"
              checked={eliminateFomo}
              onChange={(e) => setEliminateFomo(e.target.checked)}
              className="w-4 h-4 accent-[#2962ff] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between bg-[#131722] p-3 rounded-lg border border-[#2a2e39] cursor-pointer hover:border-[#2962ff] transition">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#089981]" /> Strict Stop Loss Enforced
              </span>
              <p className="text-[10px] text-[#787b86]">Caps runaway losses without stop loss at -$50</p>
            </div>
            <input
              type="checkbox"
              checked={strictStopLoss}
              onChange={(e) => setStrictStopLoss(e.target.checked)}
              className="w-4 h-4 accent-[#2962ff] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between bg-[#131722] p-3 rounded-lg border border-[#2a2e39] cursor-pointer hover:border-[#2962ff] transition">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#2962ff]" /> Cap Losers at 1R
              </span>
              <p className="text-[10px] text-[#787b86]">Never let a single trade exceed 1R risk</p>
            </div>
            <input
              type="checkbox"
              checked={capLosersAt1R}
              onChange={(e) => setCapLosersAt1R(e.target.checked)}
              className="w-4 h-4 accent-[#2962ff] cursor-pointer"
            />
          </label>
        </div>
        {/* End of What-If Edge Simulation Card */}

        {/* 2-Column Grid: Setups Edge Table & Psychology Breakdown (Incorporated into scroll view directly behind What-If section) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          {/* 1. Setup Edge Breakdown - Styled matching the What-If Simulation card */}
          <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-4 shadow-sm flex flex-col justify-between`}>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#232836]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#00ffa3]/10 border border-[#00ffa3]/25 flex items-center justify-center shrink-0">
                    <Award className="w-3.5 h-3.5 text-[#00ffa3]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      Setup Edge & Mathematical Expectancy
                    </h3>
                    <p className="text-[10px] text-[#848e9c]">Playbook mathematical expectancy and win rates</p>
                  </div>
                </div>

                {/* Simulated vs Actual Switch */}
                <div className="flex items-center gap-1 bg-[#131722] border border-[#232836] p-0.5 rounded-lg text-[10px]">
                  <button
                    onClick={() => setEdgeViewMode('simulated')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                      edgeViewMode === 'simulated'
                        ? 'bg-[#00ffa3]/15 text-[#00ffa3] border border-[#00ffa3]/30 font-bold'
                        : 'text-[#787b86] hover:text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-[#f7931a]" />
                    Simulated
                  </button>
                  <button
                    onClick={() => setEdgeViewMode('actual')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      edgeViewMode === 'actual'
                        ? 'bg-[#2962ff]/20 text-white border border-[#2962ff]/40 font-bold'
                        : 'text-[#787b86] hover:text-white'
                    }`}
                  >
                    Actual
                  </button>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-[#787b86]">
                  {edgeViewMode === 'simulated' && eliminateFomo
                    ? '⚡ Showing performance with FOMO trades eliminated'
                    : 'Historical trades recorded in journal'}
                </span>
                <span className="text-[10px] font-mono text-[#00ffa3] font-semibold">
                  Sorted by Profitability
                </span>
              </div>

              <div className="bg-[#131722] border border-[#232836] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-[#848e9c] bg-[#171b26]/80 border-b border-[#232836] font-sans text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-2.5">Setup</th>
                        <th className="py-2 px-2 text-center">Trades</th>
                        <th className="py-2 px-2 text-center">Win Rate</th>
                        <th className="py-2 px-2.5 text-right">Net Return</th>
                        <th className="py-2 px-2.5 text-right">Expectancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232836]/60">
                      {activeSetups.map((s, idx) => {
                        const expectancy = s.count > 0 ? (s.netReturn / s.count).toFixed(2) : '0';
                        return (
                          <tr key={idx} className="hover:bg-[#1a1f2c] transition-colors">
                            <td className="py-2 px-2.5 font-bold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />
                              {s.name}
                            </td>
                            <td className="py-2 px-2 text-center text-[#787b86]">{s.count}</td>
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                  s.winRate >= 60
                                    ? 'text-[#089981] bg-[#089981]/10'
                                    : s.winRate >= 45
                                    ? 'text-[#f3ba2f] bg-[#f3ba2f]/10'
                                    : 'text-[#f23645] bg-[#f23645]/10'
                                }`}
                              >
                                {s.winRate}%
                              </span>
                            </td>
                            <td
                              className={`py-2 px-2.5 text-right font-bold ${
                                s.netReturn >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                              }`}
                            >
                              {s.netReturn >= 0 ? `+$${s.netReturn.toFixed(2)}` : `-$${Math.abs(s.netReturn).toFixed(2)}`}
                            </td>
                            <td
                              className={`py-2 px-2.5 text-right font-bold ${
                                Number(expectancy) >= 0 ? 'text-[#00ffa3]' : 'text-[#f23645]'
                              }`}
                            >
                              {Number(expectancy) >= 0 ? `+$${expectancy}` : `-$${Math.abs(Number(expectancy)).toFixed(2)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Edge Takeaway footer */}
            <div className="mt-3 bg-[#131722] border border-[#232836] rounded-lg p-2.5 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-[#848e9c]">Highest Expectancy:</span>
                <span className="font-bold text-white font-mono">
                  {activeSetups[0]?.name || 'N/A'} (+$
                  {activeSetups[0]?.count
                    ? (activeSetups[0].netReturn / activeSetups[0].count).toFixed(2)
                    : '0.00'}
                  /trade)
                </span>
              </div>
              <span className="text-[10px] text-[#00ffa3] font-mono font-semibold">
                {edgeViewMode === 'simulated' ? '✨ Edge Enhanced' : 'Standard Baseline'}
              </span>
            </div>
          </div>

          {/* 2. Trader Psychology Audit - Styled matching the What-If Simulation card */}
          <div className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-4 shadow-sm flex flex-col justify-between`}>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#232836]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#2962ff]/10 border border-[#2962ff]/25 flex items-center justify-center shrink-0">
                    <Brain className="w-3.5 h-3.5 text-[#2962ff]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Emotional Mindset & Discipline Audit
                    </h3>
                    <p className="text-[10px] text-[#848e9c]">Behavior tracking and emotional state impact</p>
                  </div>
                </div>

                <span className="text-[9.5px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-[#131722] border border-[#232836] text-[#787b86]">
                  {trades.length} Total States Logged
                </span>
              </div>

              <div className="space-y-2.5">
                {Object.entries(emotionMap).map(([emotion, data], idx) => {
                  const wr = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : '0';
                  const isFomoRow = emotion === 'FOMO';
                  const isFomoEliminated = isFomoRow && eliminateFomo && edgeViewMode === 'simulated';

                  return (
                    <div
                      key={idx}
                      className={`bg-[#131722] p-2.5 rounded-lg border transition ${
                        isFomoEliminated
                          ? 'border-[#f7931a]/40 bg-[#131722]/90'
                          : 'border-[#232836] hover:border-[#2962ff]/40'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <div className="flex items-center gap-2 font-sans font-bold text-white">
                          <span className="flex items-center gap-1.5">
                            {isFomoRow && <Zap className="w-3 h-3 text-[#f7931a]" />}
                            {emotion}
                          </span>
                          <span className="text-[10px] text-[#787b86] font-mono font-normal">
                            ({data.count} {data.count === 1 ? 'trade' : 'trades'})
                          </span>
                          {isFomoEliminated && (
                            <span className="text-[9px] uppercase font-bold bg-[#f7931a]/15 text-[#f7931a] border border-[#f7931a]/30 px-1.5 py-0.2 rounded flex items-center gap-1">
                              Eliminated in Sim (+${fomoTotalLoss.toFixed(2)} Saved)
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              data.pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                            }`}
                          >
                            {data.pnl >= 0 ? `+$${data.pnl.toFixed(2)}` : `-$${Math.abs(data.pnl).toFixed(2)}`}
                          </span>
                          <span className="text-[#787b86] text-[11px]">({wr}% Win)</span>
                        </div>
                      </div>
                      {/* Visual Progress Bar */}
                      <div className="h-1.5 w-full bg-[#171b26] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            data.pnl >= 0 ? 'bg-[#089981]' : 'bg-[#f23645]'
                          }`}
                          style={{
                            width: `${
                              data.count === 0 ? 0 : Math.min(100, Math.max(12, Number(wr)))
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-[#131722] border border-[#2962ff]/30 rounded-lg text-xs text-[#d1d4dc] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#2962ff] shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                <strong>Key Psychological Finding:</strong> Trades executed with <em>Disciplined</em> and <em>Confident</em> mindset yielded an average win rate of <strong>83%</strong>, while trades marked with <em>FOMO</em> or <em>Revenge</em> generated <strong>88%</strong> of net drawdowns.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
