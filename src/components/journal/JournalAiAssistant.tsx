import React, { useState } from 'react';
import { JournalTrade, WaveScoreData } from '../../types';
import { JournalStats, getSetupsBreakdown, getMistakesBreakdown } from '../../services/journalAnalytics';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  Award,
  User,
  CheckCircle2,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

interface JournalAiAssistantProps {
  trades: JournalTrade[];
  stats: JournalStats;
  waveScore: WaveScoreData;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

export const JournalAiAssistant: React.FC<JournalAiAssistantProps> = ({
  trades,
  stats,
  waveScore,
  isMaximized = true,
  onToggleMaximize,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    id: 'm-1', sender: 'ai',
    text: trades.length === 0
      ? 'Your journal has no recorded trades yet. Add or import genuine trades to see calculated insights. This is a local rules-based summary, not a connected AI model.'
      : `Journal summary from ${trades.length} saved trades: ${stats.closedTrades} closed, ${stats.winRate}% win rate, WaveScore ${waveScore.overall}/100. These calculations are local and are not personalized investment advice.`,
    time: 'Just now',
  }]);
  const [input, setInput] = useState('');

  const setups = getSetupsBreakdown(trades);
  const mistakes = getMistakesBreakdown(trades);

  // Deterministic, on-device journal calculations. Do not pretend an LLM was
  // consulted or invent trade-level findings missing from the saved ledger.
  const handleSend = (userText: string) => {
    if (!userText.trim()) return;
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, sender: 'user', text: userText, time: 'Just now',
    }]);
    setInput('');
    const lower = userText.toLowerCase();
    let reply = '';
    if (trades.length === 0) {
      reply = 'No real trades are recorded. Add or import trades first; the journal will not manufacture results or performance statistics.';
    } else if (lower.includes('leak') || lower.includes('mistake') || lower.includes('loss')) {
      const top = [...mistakes].sort((a,b) => Math.abs(Number(b.totalLoss)||0)-Math.abs(Number(a.totalLoss)||0))[0];
      reply = top
        ? `Largest recorded mistake category by absolute loss: ${top.name}. Recorded loss: ${top.totalLoss}; occurrences: ${top.count}. Check the underlying trades before changing your plan.`
        : 'No mistake categories are tagged in your saved trades. Tag actual mistakes to enable a breakdown.';
    } else if (lower.includes('wavescore') || lower.includes('score')) {
      reply = `Calculated WaveScore: ${waveScore.overall}/100. Risk: ${waveScore.risk}/100; Exit: ${waveScore.exit}/100; Stability: ${waveScore.stability}/100. This score summarizes saved journal data and does not predict future returns.`;
    } else if (lower.includes('setup') || lower.includes('breakout') || lower.includes('reversal')) {
      const ranked = [...setups].sort((a,b) => Number(b.netReturn)-Number(a.netReturn));
      reply = ranked.length
        ? ranked.map(s => `${s.name}: ${s.winRate}% observed win rate; net return ${s.netReturn}`).join('\n')
        : 'No setup labels exist in saved trades. Add setup tags to compare historical results.';
    } else {
      reply = `Saved trades: ${trades.length}. Closed: ${stats.closedTrades}; wins: ${stats.winTrades}; observed win rate: ${stats.winRate}%; profit factor: ${stats.lossTrades?stats.profitFactor:"N/A (no losing trades)"}. These are historical journal statistics only, not a promise of compounding, profitability or future performance.`;
    }
    setMessages(prev => [...prev, {
      id: `insight-${Date.now()}`, sender: 'ai', text: reply, time: 'Just now',
    }]);
  };

  const quickPrompts = [
    'Explain my recorded mistakes',
    'Explain my WaveScore',
    'Compare my recorded trade setups',
    'Summarize my journal performance',
  ];

  return (
    <div id="journal-ai-assistant-tab" className="flex flex-col h-full bg-[#131722] text-[#d1d4dc] max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl p-4 mb-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2962ff] to-[#00ffa3] flex items-center justify-center shadow-md">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Journal Insights
              </h2>
              <span className="text-[9px] uppercase font-bold bg-[#2962ff]/20 text-[#2962ff] px-2 py-0.5 rounded">
                Local Analysis
              </span>
            </div>
            <p className="text-xs text-[#787b86]">
              On-device calculations from the trades currently saved in this browser
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="text-right">
            <span className="text-[#787b86] block text-[10px]">WaveScore</span>
            <span className="text-[#00ffa3] font-bold">{waveScore.overall} / 100</span>
          </div>
          <div className="text-right">
            <span className="text-[#787b86] block text-[10px]">Win Rate</span>
            <span className="text-white font-bold">{stats.winRate}%</span>
          </div>

          {/* Window controls directly attached to rightmost side */}
          {(onToggleMaximize || onClose) && <div className="h-4 w-px bg-[#232836] mx-0.5" />}

          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                isMaximized
                  ? 'text-[#2962ff] bg-[#2962ff]/15 hover:bg-[#2962ff]/25 hover:text-white'
                  : 'text-[#a6adb9] hover:text-white hover:bg-[#232836]'
              }`}
              title={isMaximized ? 'Minimize to Moveable Window (Resizable to Scale)' : 'Maximize Truly Fullscreen'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#a6adb9] hover:text-[#ff4a7d] rounded hover:bg-[#232836] transition"
              title="Close Journal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${
              m.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                m.sender === 'user'
                  ? 'bg-[#2962ff] text-white'
                  : 'bg-[#1e222d] border border-[#2a2e39] text-[#00ffa3]'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-2xl rounded-xl p-3.5 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[#2962ff] text-white font-medium shadow-md'
                  : 'bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] shadow-sm whitespace-pre-line'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Prompt Pill Buttons */}
      <div className="flex flex-wrap gap-2 mb-3 shrink-0">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-[11px] bg-[#1e222d] hover:bg-[#2a2e39] text-[#d1d4dc] hover:text-white border border-[#2a2e39] px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-[#f7931a]" />
            <span>{p}</span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex items-center gap-2 bg-[#1e222d] border border-[#2a2e39] rounded-xl p-1.5 shrink-0 shadow-lg"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about recorded trades, setup tags, or measured statistics..."
          className="flex-1 bg-transparent px-3 py-2 text-xs text-white outline-none placeholder-[#787b86]"
        />
        <button
          type="submit"
          className="bg-[#2962ff] hover:bg-[#1e4bd8] text-white p-2.5 rounded-lg transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
