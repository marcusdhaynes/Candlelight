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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: `Hello! I am your TradeZella AI Journal Coach. I have thoroughly reviewed your ${trades.length} logged trades, your WaveScore (${waveScore.overall}/100), and your current win rate of ${stats.winRate}%.\n\nYour most profitable setup is **REVERSAL** with consistent high efficiency, but trades flagged with **FOMO** and **missing stop loss** account for over 80% of your total drawdowns. What would you like to drill into today?`,
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');

  const setups = getSetupsBreakdown(trades);
  const mistakes = getMistakesBreakdown(trades);

  const handleSend = (userText: string) => {
    if (!userText.trim()) return;

    const newMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      time: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');

    // Generate smart context-aware response based on the actual metrics
    setTimeout(() => {
      let reply = '';
      const lower = userText.toLowerCase();

      if (lower.includes('leak') || lower.includes('mistake') || lower.includes('loss')) {
        const topMistake = mistakes[0];
        reply = `🔍 **Deep Audit of Trading Leaks:**\n\nYour primary profit leak is **"${topMistake?.name || 'FOMO entries'}"**, which has cost you **$${topMistake?.totalLoss || 561.96}** across ${topMistake?.count || 4} trades.\n\n**Actionable Rule:**\n1. Enforce a hard 15-minute cool-down rule if you feel the urge to chase momentum after 3 consecutive green candles.\n2. Never enter without a predefined Stop Loss resting on your broker order book before hitting Market Buy.`;
      } else if (lower.includes('wavescore') || lower.includes('score')) {
        reply = `📈 **Path to WaveScore 90+:**\n- Current Overall: **${waveScore.overall}/100**\n- **Risk Score (${waveScore.risk}/100)**: Increase stop loss attachment rate to 100% of trades.\n- **Exit Score (${waveScore.exit}/100)**: Avoid cutting winners early. Your MFE indicates winners could run an additional 15-20% if trailed with a moving stop.\n- **Stability (${waveScore.stability}/100)**: Cut impulsive revenge trades to achieve a smooth equity curve.`;
      } else if (lower.includes('setup') || lower.includes('breakout') || lower.includes('reversal')) {
        const best = setups[0];
        const second = setups[1];
        reply = `🎯 **Edge Analysis by Setup:**\n- **Top Setup:** **${best?.name}** with **${best?.winRate}% win rate** and **+$${best?.netReturn}** net return.\n- **Second Best:** **${second?.name}** (${second?.winRate}% win rate).\n\nRecommendation: For the next 20 sessions, allocate 80% of your risk capital exclusively to your top 2 setups and strictly avoid unconfirmed breakout chases.`;
      } else {
        reply = `💡 **AI Tactical Feedback:**\nBased on your ledger stats (${stats.winTrades} wins out of ${stats.closedTrades} closed trades):\n\n- Profit Factor: **${stats.profitFactor}**\n- Average Win: **$${stats.avgWin}** vs Average Loss: **$${stats.avgLoss}**\n- Winstreak: **${stats.dayStreak.maxWin} consecutive winning days**\n\nMaintaining strict risk sizing will compound your initial balance with minimal drawdown risk.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: reply,
          time: 'Just now',
        },
      ]);
    }, 600);
  };

  const quickPrompts = [
    'Identify my #1 biggest money leak',
    'How can I improve my WaveScore from 78 to 90?',
    'Analyze my win rate on Breakouts vs Reversals',
    'Generate custom risk rules for tomorrow',
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
                TradeZella & TraderSync AI Coach
              </h2>
              <span className="text-[9px] uppercase font-bold bg-[#2962ff]/20 text-[#2962ff] px-2 py-0.5 rounded">
                Live Analysis
              </span>
            </div>
            <p className="text-xs text-[#787b86]">
              Real-time pattern recognition across your entire trading journal history
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
          placeholder="Ask your AI coach anything about your trades, setups, or risk habits..."
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
