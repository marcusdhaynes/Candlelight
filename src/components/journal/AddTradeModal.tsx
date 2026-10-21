import React, { useState, useEffect } from 'react';
import { JournalTrade, JournalSide, JournalStatus } from '../../types';
import { SAMPLE_SETUPS_LIST, SAMPLE_MISTAKES_LIST } from '../../data/sampleJournalTrades';
import {
  X,
  Plus,
  Check,
  DollarSign,
  ShieldAlert,
  Brain,
  ThumbsUp,
  AlertTriangle,
  Edit3,
} from 'lucide-react';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrade: (trade: JournalTrade) => void;
  onUpdateTrade?: (trade: JournalTrade) => void;
  tradeToEdit?: JournalTrade | null;
  currentSymbol?: string;
}

export const AddTradeModal: React.FC<AddTradeModalProps> = ({
  isOpen,
  onClose,
  onAddTrade,
  onUpdateTrade,
  tradeToEdit,
  currentSymbol = '#BTCUSDT',
}) => {
  const isEditing = Boolean(tradeToEdit);

  const [symbol, setSymbol] = useState(currentSymbol);
  const [side, setSide] = useState<JournalSide>('LONG');
  const [entryPrice, setEntryPrice] = useState<string>('88500');
  const [exitPrice, setExitPrice] = useState<string>('91200');
  const [size, setSize] = useState<string>('0.15');
  const [stopLoss, setStopLoss] = useState<string>('87500');
  const [takeProfit, setTakeProfit] = useState<string>('92000');
  const [status, setStatus] = useState<JournalStatus>('WIN');
  const [selectedSetups, setSelectedSetups] = useState<string[]>(['Strong Entry', 'Followed Setup']);
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([]);
  const [note, setNote] = useState<string>('Clean breakout of 4H resistance zone with strong volume.');
  const [emotion, setEmotion] = useState<'Confident' | 'Disciplined' | 'FOMO' | 'Greed' | 'Hesitant' | 'Revenge'>('Disciplined');
  const [portfolio, setPortfolio] = useState('Main Account');

  // Custom tag inputs
  const [customGoodTag, setCustomGoodTag] = useState('');
  const [customBadTag, setCustomBadTag] = useState('');
  const [availableGoodTags, setAvailableGoodTags] = useState<string[]>(SAMPLE_SETUPS_LIST);
  const [availableBadTags, setAvailableBadTags] = useState<string[]>(SAMPLE_MISTAKES_LIST);

  // Sync state when opening or when tradeToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (tradeToEdit) {
      setSymbol(tradeToEdit.symbol);
      setSide(tradeToEdit.side);
      setEntryPrice(String(tradeToEdit.entryPrice));
      setExitPrice(tradeToEdit.exitPrice !== undefined ? String(tradeToEdit.exitPrice) : '');
      setSize(String(tradeToEdit.size));
      setStopLoss(tradeToEdit.stopLoss !== undefined ? String(tradeToEdit.stopLoss) : '');
      setTakeProfit(tradeToEdit.takeProfit !== undefined ? String(tradeToEdit.takeProfit) : '');
      setStatus(tradeToEdit.status);
      setSelectedSetups(tradeToEdit.setups || []);
      setSelectedMistakes(tradeToEdit.mistakes || []);
      setNote(tradeToEdit.note || '');
      setEmotion(tradeToEdit.emotion || 'Disciplined');
      setPortfolio(tradeToEdit.portfolio || 'Main Account');

      // Ensure any existing trade tags are in the available lists
      if (tradeToEdit.setups && tradeToEdit.setups.length > 0) {
        setAvailableGoodTags((prev) => Array.from(new Set([...prev, ...tradeToEdit.setups])));
      }
      if (tradeToEdit.mistakes && tradeToEdit.mistakes.length > 0) {
        setAvailableBadTags((prev) => Array.from(new Set([...prev, ...tradeToEdit.mistakes])));
      }
    } else {
      setSymbol(currentSymbol);
      setSide('LONG');
      setEntryPrice('88500');
      setExitPrice('91200');
      setSize('0.15');
      setStopLoss('87500');
      setTakeProfit('92000');
      setStatus('WIN');
      setSelectedSetups(['Strong Entry', 'Followed Setup']);
      setSelectedMistakes([]);
      setNote('Clean breakout of 4H resistance zone with strong volume.');
      setEmotion('Disciplined');
      setPortfolio('Main Account');
    }
  }, [isOpen, tradeToEdit?.id]);

  if (!isOpen) return null;

  const toggleSetup = (s: string) => {
    setSelectedSetups((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleMistake = (m: string) => {
    setSelectedMistakes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleAddCustomGoodTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customGoodTag.trim();
    if (!trimmed) return;
    if (!availableGoodTags.includes(trimmed)) {
      setAvailableGoodTags((prev) => [...prev, trimmed]);
    }
    if (!selectedSetups.includes(trimmed)) {
      setSelectedSetups((prev) => [...prev, trimmed]);
    }
    setCustomGoodTag('');
  };

  const handleAddCustomBadTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customBadTag.trim();
    if (!trimmed) return;
    if (!availableBadTags.includes(trimmed)) {
      setAvailableBadTags((prev) => [...prev, trimmed]);
    }
    if (!selectedMistakes.includes(trimmed)) {
      setSelectedMistakes((prev) => [...prev, trimmed]);
    }
    setCustomBadTag('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(entryPrice) || 0;
    const exit = exitPrice ? parseFloat(exitPrice) : undefined;
    const qty = parseFloat(size) || 1;
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;

    let netReturn = 0;
    let netReturnPct = 0;
    const cost = entry * qty;

    if (exit !== undefined) {
      if (side === 'LONG') {
        netReturn = (exit - entry) * qty;
      } else {
        netReturn = (entry - exit) * qty;
      }
      netReturnPct = cost > 0 ? (netReturn / cost) * 100 : 0;
    }

    const tradeData: JournalTrade = {
      id: tradeToEdit ? tradeToEdit.id : `tr-${Date.now()}`,
      symbol: symbol.startsWith('#') ? symbol : `#${symbol}`,
      side,
      status,
      openDate: tradeToEdit ? tradeToEdit.openDate : new Date().toISOString().replace('T', ' ').slice(0, 19),
      closeDate: exit ? (tradeToEdit?.closeDate || new Date().toISOString().replace('T', ' ').slice(0, 19)) : undefined,
      entryPrice: entry,
      exitPrice: exit,
      size: qty,
      cost: Number(cost.toFixed(2)),
      netReturn: Number(netReturn.toFixed(2)),
      netReturnPercent: Number(netReturnPct.toFixed(2)),
      setups: selectedSetups,
      mistakes: selectedMistakes,
      efficiency: status === 'WIN' ? 88 : 45,
      note,
      stopLoss: sl,
      takeProfit: tp,
      emotion,
      portfolio,
    };

    if (isEditing && onUpdateTrade) {
      onUpdateTrade(tradeData);
    } else {
      onAddTrade(tradeData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#171b26] border border-[#232836] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-[#131722] border-b border-[#232836] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isEditing
                  ? 'bg-[#2962ff]/20 text-[#2962ff]'
                  : 'bg-[#00ffa3]/20 text-[#00ffa3]'
              }`}
            >
              {isEditing ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight">
                {isEditing ? 'Edit Trade Execution' : 'Log Trade to Journal'}
              </h3>
              <p className="text-[11px] text-[#848e9c]">
                {isEditing
                  ? `Update execution tags, good/bad behaviors, and exit prices`
                  : 'Record execution details, multiple good (green) & bad (red) tags'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#848e9c] hover:text-white rounded-lg hover:bg-[#1f2433] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
          {/* Symbol, Side, Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-[#2962ff]"
              />
            </div>
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Side</label>
              <div className="grid grid-cols-2 gap-1 bg-[#131722] p-1 rounded-lg border border-[#232836]">
                <button
                  type="button"
                  onClick={() => setSide('LONG')}
                  className={`py-1 rounded font-bold transition cursor-pointer ${
                    side === 'LONG' ? 'bg-[#2962ff] text-white' : 'text-[#848e9c] hover:text-white'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SHORT')}
                  className={`py-1 rounded font-bold transition cursor-pointer ${
                    side === 'SHORT' ? 'bg-[#ff4a7d] text-white' : 'text-[#848e9c] hover:text-white'
                  }`}
                >
                  SHORT
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JournalStatus)}
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white outline-none focus:border-[#2962ff] cursor-pointer"
              >
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
                <option value="OPEN">OPEN</option>
                <option value="BE">BREAKEVEN</option>
              </select>
            </div>
          </div>

          {/* Pricing & Sizing: Entry, Exit, Size */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Entry Price ($)</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                required
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-[#2962ff]"
              />
            </div>
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Exit Price ($)</label>
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="Optional if open"
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-[#2962ff]"
              />
            </div>
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Position Size (Units)</label>
              <input
                type="number"
                step="any"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                required
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-[#2962ff]"
              />
            </div>
          </div>

          {/* Risk Management: Stop Loss, Take Profit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-[#ff4a7d]" /> Stop Loss Price ($)
              </label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-[#2962ff]"
              />
            </div>
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-[#00ffa3]" /> Take Profit Price ($)
              </label>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-[#2962ff]"
              />
            </div>
          </div>

          {/* SECTION 1: GOOD (GREEN) TAGS SELECTION (Multi-select) */}
          <div className="bg-[#131722] border border-[#232836] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[#00ffa3] font-bold flex items-center gap-1.5 text-xs">
                <ThumbsUp className="w-3.5 h-3.5 text-[#00ffa3]" />
                <span>Good Behaviors & Setups (Select multiple)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/30 px-1.5 py-0.5 rounded">
                  {selectedSetups.length} selected
                </span>
                {selectedSetups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSetups([])}
                    className="text-[10px] text-[#848e9c] hover:text-[#ff4a7d] transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg bg-[#171b26]/70 border border-[#232836] custom-scrollbar mb-2">
              {availableGoodTags.map((s) => {
                const isSelected = selectedSetups.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSetup(s)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all duration-150 border cursor-pointer flex items-center gap-1 select-none ${
                      isSelected
                        ? 'bg-[#00ffa3]/20 text-[#00ffa3] border-[#00ffa3] shadow-[0_0_10px_rgba(0,255,163,0.2)]'
                        : 'bg-[#131722] text-[#848e9c] border-[#232836] hover:text-[#00ffa3] hover:border-[#00ffa3]/40'
                    }`}
                  >
                    {isSelected ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                    <span>{s}</span>
                  </button>
                );
              })}
            </div>

            {/* Add Custom Good Tag */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customGoodTag}
                onChange={(e) => setCustomGoodTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomGoodTag(e);
                  }
                }}
                placeholder="+ Add custom good tag (e.g. Trailed Stop Loss)"
                className="flex-1 bg-[#171b26] border border-[#232836] rounded-md px-2.5 py-1 text-white text-[11px] outline-none focus:border-[#00ffa3]"
              />
              <button
                type="button"
                onClick={handleAddCustomGoodTag}
                className="px-2.5 py-1 bg-[#00ffa3]/20 hover:bg-[#00ffa3]/30 text-[#00ffa3] border border-[#00ffa3]/40 rounded-md text-[11px] font-bold transition cursor-pointer"
              >
                Add Good
              </button>
            </div>
          </div>

          {/* SECTION 2: BAD (RED) TAGS SELECTION (Multi-select) */}
          <div className="bg-[#131722] border border-[#232836] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[#ff4a7d] font-bold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-[#ff4a7d]" />
                <span>Mistakes & Leaks (Select multiple)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#ff4a7d] bg-[#ff4a7d]/10 border border-[#ff4a7d]/30 px-1.5 py-0.5 rounded">
                  {selectedMistakes.length} selected
                </span>
                {selectedMistakes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMistakes([])}
                    className="text-[10px] text-[#848e9c] hover:text-[#ff4a7d] transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg bg-[#171b26]/70 border border-[#232836] custom-scrollbar mb-2">
              {availableBadTags.map((m) => {
                const isSelected = selectedMistakes.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMistake(m)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all duration-150 border cursor-pointer flex items-center gap-1 select-none ${
                      isSelected
                        ? 'bg-[#ff4a7d]/20 text-[#ff4a7d] border-[#ff4a7d] shadow-[0_0_10px_rgba(255,74,125,0.2)]'
                        : 'bg-[#131722] text-[#848e9c] border-[#232836] hover:text-[#ff4a7d] hover:border-[#ff4a7d]/40'
                    }`}
                  >
                    {isSelected ? <AlertTriangle className="w-3 h-3 stroke-[2.5]" /> : null}
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>

            {/* Add Custom Bad Tag */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customBadTag}
                onChange={(e) => setCustomBadTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomBadTag(e);
                  }
                }}
                placeholder="+ Add custom mistake tag (e.g. Revenge Trade)"
                className="flex-1 bg-[#171b26] border border-[#232836] rounded-md px-2.5 py-1 text-white text-[11px] outline-none focus:border-[#ff4a7d]"
              />
              <button
                type="button"
                onClick={handleAddCustomBadTag}
                className="px-2.5 py-1 bg-[#ff4a7d]/20 hover:bg-[#ff4a7d]/30 text-[#ff4a7d] border border-[#ff4a7d]/40 rounded-md text-[11px] font-bold transition cursor-pointer"
              >
                Add Bad
              </button>
            </div>
          </div>

          {/* Psychology / Emotion and Portfolio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium flex items-center gap-1">
                <Brain className="w-3 h-3 text-[#2962ff]" /> Emotional State
              </label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value as any)}
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white outline-none focus:border-[#2962ff] cursor-pointer"
              >
                <option value="Disciplined">Disciplined</option>
                <option value="Confident">Confident</option>
                <option value="FOMO">FOMO</option>
                <option value="Greed">Greed</option>
                <option value="Hesitant">Hesitant</option>
                <option value="Revenge">Revenge</option>
              </select>
            </div>
            <div>
              <label className="block text-[#848e9c] mb-1 font-medium">Portfolio / Account</label>
              <select
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
                className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white outline-none focus:border-[#2962ff] cursor-pointer"
              >
                <option value="Main Account">Main Account</option>
                <option value="Crypto Prop">Crypto Prop</option>
                <option value="Scalp Desk">Scalp Desk</option>
              </select>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[#848e9c] mb-1 font-medium">Trade Log Notes & Rules Review</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you see? Did you follow your trading plan? Any lessons learned?"
              className="w-full bg-[#131722] border border-[#232836] rounded-lg px-3 py-2 text-white outline-none focus:border-[#2962ff] resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex justify-end gap-2 border-t border-[#232836]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#131722] hover:bg-[#1f2433] text-[#d1d4dc] hover:text-white rounded-lg font-semibold transition border border-[#232836] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-white rounded-lg font-bold transition shadow-md cursor-pointer flex items-center gap-1.5 ${
                isEditing
                  ? 'bg-[#2962ff] hover:bg-[#1e4bd8]'
                  : 'bg-[#089981] hover:bg-[#00ffa3] hover:text-black'
              }`}
            >
              {isEditing ? <Edit3 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Update Trade' : 'Save to Journal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
