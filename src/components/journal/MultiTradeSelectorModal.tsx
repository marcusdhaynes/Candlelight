import React, { useState, useMemo } from 'react';
import { JournalTrade } from '../../types';
import {
  X,
  Edit3,
  Calendar,
  Clock,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Square,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MultiTradeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: JournalTrade[];
  onSelectTradeToEdit: (trade: JournalTrade) => void;
}

type SortField =
  | 'time'
  | 'symbol'
  | 'amount'
  | 'netReturn'
  | 'side'
  | 'status'
  | 'cost'
  | 'realizedRR';

export const MultiTradeSelectorModal: React.FC<MultiTradeSelectorModalProps> = ({
  isOpen,
  onClose,
  trades,
  onSelectTradeToEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterSide, setFilterSide] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(
    trades[0]?.id || null
  );

  const availableSymbols = useMemo(() => {
    return Array.from(new Set(trades.map((t) => t.symbol)));
  }, [trades]);

  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];

    // Filter by search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          t.setups?.some((s) => s.toLowerCase().includes(q)) ||
          t.mistakes?.some((m) => m.toLowerCase().includes(q)) ||
          t.id.toLowerCase().includes(q) ||
          t.portfolio?.toLowerCase().includes(q)
      );
    }

    // Filter by side
    if (filterSide !== 'ALL') {
      result = result.filter((t) => t.side === filterSide);
    }

    // Filter by status
    if (filterStatus !== 'ALL') {
      result = result.filter((t) => t.status === filterStatus);
    }

    // Filter by symbol
    if (filterSymbol !== 'ALL') {
      result = result.filter((t) => t.symbol === filterSymbol);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'time': {
          const timeA = new Date(a.openDate).getTime();
          const timeB = new Date(b.openDate).getTime();
          comparison = timeA - timeB;
          break;
        }
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'amount':
          comparison = a.size - b.size;
          break;
        case 'netReturn':
          comparison = a.netReturn - b.netReturn;
          break;
        case 'side':
          comparison = a.side.localeCompare(b.side);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'cost':
          comparison = (a.cost || 0) - (b.cost || 0);
          break;
        case 'realizedRR':
          comparison = (a.realizedRR || 0) - (b.realizedRR || 0);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [trades, searchTerm, sortField, sortDirection, filterSide, filterStatus, filterSymbol]);

  if (!isOpen || trades.length === 0) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const selectedTrade = trades.find((t) => t.id === highlightedTradeId) || filteredAndSortedTrades[0] || trades[0];

  return (
    <div
      id="multi-trade-selector-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#121620] border border-[#262c3d] rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#171b26] border-b border-[#232836]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2962ff]/15 border border-[#2962ff]/30 flex items-center justify-center text-[#2962ff]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Multiple Trades Selected ({trades.length})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2962ff]/20 text-[#38bdf8] border border-[#2962ff]/30 font-mono">
                  Choose Trade to Edit
                </span>
              </div>
              <p className="text-[11px] text-[#848e9c]">
                Filter, sort by timestamp, symbol, size, or profit/loss, then click to open in editor.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#848e9c] hover:text-white rounded-md hover:bg-[#232836] transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-5 py-3 bg-[#141722] border-b border-[#232836] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="flex items-center gap-1.5 bg-[#181d2a] px-2.5 py-1.5 rounded-md border border-[#262c3d] text-xs">
              <Search className="w-3.5 h-3.5 text-[#787b86]" />
              <input
                type="text"
                placeholder="Search symbol, note, tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-white outline-none w-44 placeholder-[#6b7280] text-xs"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-[#787b86] hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Symbol Filter */}
            <div className="flex items-center gap-1 bg-[#181d2a] px-2 py-1 rounded-md border border-[#262c3d]">
              <span className="text-[10px] text-[#848e9c]">Symbol:</span>
              <select
                value={filterSymbol}
                onChange={(e) => setFilterSymbol(e.target.value)}
                className="bg-transparent text-xs text-white outline-none font-medium cursor-pointer"
              >
                <option value="ALL" className="bg-[#181d2a]">All ({availableSymbols.length})</option>
                {availableSymbols.map((sym) => (
                  <option key={sym} value={sym} className="bg-[#181d2a]">
                    {sym}
                  </option>
                ))}
              </select>
            </div>

            {/* Side Filter */}
            <div className="flex items-center gap-1 bg-[#181d2a] px-2 py-1 rounded-md border border-[#262c3d]">
              <span className="text-[10px] text-[#848e9c]">Side:</span>
              <select
                value={filterSide}
                onChange={(e) => setFilterSide(e.target.value)}
                className="bg-transparent text-xs text-white outline-none font-medium cursor-pointer"
              >
                <option value="ALL" className="bg-[#181d2a]">All</option>
                <option value="LONG" className="bg-[#181d2a]">Long</option>
                <option value="SHORT" className="bg-[#181d2a]">Short</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[#181d2a] px-2 py-1 rounded-md border border-[#262c3d]">
              <span className="text-[10px] text-[#848e9c]">Result:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-xs text-white outline-none font-medium cursor-pointer"
              >
                <option value="ALL" className="bg-[#181d2a]">All</option>
                <option value="WIN" className="bg-[#181d2a]">Win</option>
                <option value="LOSS" className="bg-[#181d2a]">Loss</option>
                <option value="BE" className="bg-[#181d2a]">Break Even</option>
                <option value="OPEN" className="bg-[#181d2a]">Open</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-[#848e9c] font-mono">
            Showing <strong className="text-white">{filteredAndSortedTrades.length}</strong> of {trades.length}
          </div>
        </div>

        {/* Content: Master Table + Detail Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Trades Selection Table */}
          <div className="flex-1 overflow-y-auto border-r border-[#232836]">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-[#151924] sticky top-0 z-10 border-b border-[#232836] text-[#848e9c] font-semibold select-none">
                <tr className="h-8">
                  <th
                    onClick={() => handleSort('time')}
                    className="py-1.5 px-3 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>TIME / DATE</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'time' ? 'text-[#00e5ff]' : 'text-[#5d6575]'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('symbol')}
                    className="py-1.5 px-3 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>SYMBOL</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'symbol' ? 'text-[#00e5ff]' : 'text-[#5d6575]'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('side')}
                    className="py-1.5 px-2 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>SIDE</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'side' ? 'text-[#00e5ff]' : 'text-[#5d6575]'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('amount')}
                    className="py-1.5 px-3 text-right cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>AMOUNT / SIZE</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'amount' ? 'text-[#00e5ff]' : 'text-[#5d6575]'}`} />
                    </div>
                  </th>
                  <th className="py-1.5 px-3 text-right text-[#848e9c]">
                    ENTRY
                  </th>
                  <th
                    onClick={() => handleSort('netReturn')}
                    className="py-1.5 px-3 text-right cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>P&L / RETURN</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'netReturn' ? 'text-[#00e5ff]' : 'text-[#5d6575]'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-1.5 px-2.5 text-center cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>STATUS</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'status' ? 'text-[#00e5ff]' : 'text-[#5d6575]'}`} />
                    </div>
                  </th>
                  <th className="py-1.5 px-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2330]">
                {filteredAndSortedTrades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#848e9c]">
                      No trades matched the search filters.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedTrades.map((trade) => {
                    const isWin = trade.status === 'WIN';
                    const isLoss = trade.status === 'LOSS';
                    const isHighlighted = highlightedTradeId === trade.id;

                    return (
                      <tr
                        key={trade.id}
                        onClick={() => setHighlightedTradeId(trade.id)}
                        onDoubleClick={() => onSelectTradeToEdit(trade)}
                        className={`h-9 transition cursor-pointer select-none ${
                          isHighlighted
                            ? 'bg-[#2962ff]/20 hover:bg-[#2962ff]/25'
                            : 'hover:bg-[#181d2a]'
                        }`}
                      >
                        {/* Time */}
                        <td className="py-1.5 px-3 font-mono text-[#a6adb9] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-[#00e5ff] shrink-0" />
                            <span>{trade.openDate.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                        </td>

                        {/* Symbol */}
                        <td className="py-1.5 px-3 font-mono font-bold text-[#00e5ff]">
                          {trade.symbol}
                        </td>

                        {/* Side */}
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-tight ${
                              trade.side === 'LONG'
                                ? 'bg-[#089981]/20 text-[#00ffa3] border border-[#089981]/30'
                                : 'bg-[#f23645]/20 text-[#ff4a7d] border border-[#f23645]/30'
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>

                        {/* Size / Amount */}
                        <td className="py-1.5 px-3 text-right font-mono text-white font-medium">
                          {trade.size}
                        </td>

                        {/* Entry Price */}
                        <td className="py-1.5 px-3 text-right font-mono text-[#d1d4dc]">
                          ${trade.entryPrice.toLocaleString()}
                        </td>

                        {/* Net Return */}
                        <td
                          className={`py-1.5 px-3 text-right font-mono font-bold ${
                            isWin ? 'text-[#00ffa3]' : isLoss ? 'text-[#ff4a7d]' : 'text-white'
                          }`}
                        >
                          {trade.netReturn >= 0
                            ? `+$${trade.netReturn.toFixed(2)}`
                            : `-$${Math.abs(trade.netReturn).toFixed(2)}`}
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                              isWin
                                ? 'bg-[#00ffa3]/15 text-[#00ffa3] border border-[#00ffa3]/30'
                                : isLoss
                                ? 'bg-[#ff4a7d]/15 text-[#ff4a7d] border border-[#ff4a7d]/30'
                                : 'bg-[#787b86]/20 text-[#d1d4dc] border border-[#787b86]/30'
                            }`}
                          >
                            {trade.status}
                          </span>
                        </td>

                        {/* Action: Open in Editor */}
                        <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectTradeToEdit(trade)}
                            className="px-2.5 py-1 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white text-[10.5px] font-bold flex items-center gap-1 transition shadow-sm cursor-pointer mx-auto"
                            title="Open Editor Similar to Add Trade"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Preview Panel on the Right */}
          {selectedTrade && (
            <div className="w-72 bg-[#141722] p-4 flex flex-col justify-between overflow-y-auto shrink-0 space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#232836]">
                  <div>
                    <span className="text-[10px] text-[#848e9c] font-medium">Selected Trade</span>
                    <h4 className="text-base font-bold text-white font-mono flex items-center gap-2">
                      {selectedTrade.symbol}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          selectedTrade.side === 'LONG'
                            ? 'bg-[#089981]/20 text-[#00ffa3]'
                            : 'bg-[#f23645]/20 text-[#ff4a7d]'
                        }`}
                      >
                        {selectedTrade.side}
                      </span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#848e9c]">P&L</span>
                    <div
                      className={`text-sm font-bold font-mono ${
                        selectedTrade.netReturn >= 0 ? 'text-[#00ffa3]' : 'text-[#ff4a7d]'
                      }`}
                    >
                      {selectedTrade.netReturn >= 0
                        ? `+$${selectedTrade.netReturn.toFixed(2)}`
                        : `-$${Math.abs(selectedTrade.netReturn).toFixed(2)}`}
                    </div>
                  </div>
                </div>

                {/* Parameters Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-[#181d2a] p-2 rounded border border-[#232836]">
                    <div className="text-[9.5px] text-[#848e9c]">Open Timestamp</div>
                    <div className="text-white text-[10.5px] mt-0.5 truncate">
                      {selectedTrade.openDate.slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  <div className="bg-[#181d2a] p-2 rounded border border-[#232836]">
                    <div className="text-[9.5px] text-[#848e9c]">Amount / Size</div>
                    <div className="text-white text-xs mt-0.5 font-bold">
                      {selectedTrade.size} units
                    </div>
                  </div>
                  <div className="bg-[#181d2a] p-2 rounded border border-[#232836]">
                    <div className="text-[9.5px] text-[#848e9c]">Entry Price</div>
                    <div className="text-white text-xs mt-0.5">
                      ${selectedTrade.entryPrice.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-[#181d2a] p-2 rounded border border-[#232836]">
                    <div className="text-[9.5px] text-[#848e9c]">Exit Price</div>
                    <div className="text-white text-xs mt-0.5">
                      {selectedTrade.exitPrice ? `$${selectedTrade.exitPrice.toLocaleString()}` : '—'}
                    </div>
                  </div>
                  <div className="bg-[#181d2a] p-2 rounded border border-[#232836]">
                    <div className="text-[9.5px] text-[#848e9c]">Stop Loss</div>
                    <div className="text-white text-xs mt-0.5">
                      {selectedTrade.stopLoss ? `$${selectedTrade.stopLoss}` : '—'}
                    </div>
                  </div>
                  <div className="bg-[#181d2a] p-2 rounded border border-[#232836]">
                    <div className="text-[9.5px] text-[#848e9c]">Take Profit</div>
                    <div className="text-white text-xs mt-0.5">
                      {selectedTrade.takeProfit ? `$${selectedTrade.takeProfit}` : '—'}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div className="text-[10px] text-[#848e9c] font-semibold mb-1">Setups & Mistakes</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTrade.setups && selectedTrade.setups.length > 0 && selectedTrade.setups.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 bg-[#00ffa3]/15 text-[#00ffa3] border border-[#00ffa3]/30 rounded text-[9.5px] font-bold"
                      >
                        ✓ {s}
                      </span>
                    ))}
                    {selectedTrade.mistakes && selectedTrade.mistakes.length > 0 && selectedTrade.mistakes.map((m, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 bg-[#ff4a7d]/15 text-[#ff808b] border border-[#ff4a7d]/30 rounded text-[9.5px] font-bold"
                      >
                        ⚠ {m}
                      </span>
                    ))}
                    {(!selectedTrade.setups || selectedTrade.setups.length === 0) &&
                      (!selectedTrade.mistakes || selectedTrade.mistakes.length === 0) && (
                        <span className="text-[10px] text-[#5d6575] italic">No execution tags</span>
                      )}
                  </div>
                </div>

                {/* Note */}
                {selectedTrade.note && (
                  <div className="bg-[#181d2a] p-2.5 rounded border border-[#232836] text-[10.5px]">
                    <div className="text-[9.5px] text-[#848e9c] font-semibold mb-1">Journal Note</div>
                    <p className="text-[#d1d4dc] italic leading-relaxed line-clamp-3">
                      "{selectedTrade.note}"
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Big CTA to edit this trade */}
              <button
                onClick={() => onSelectTradeToEdit(selectedTrade)}
                className="w-full py-2.5 px-3 bg-[#00c49f] hover:bg-[#00b290] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Open in Trade Editor</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#171b26] border-t border-[#232836] flex items-center justify-between text-xs text-[#848e9c]">
          <span>Double-click any trade row or click "Edit" to launch the trade editor.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#232836] hover:bg-[#2e3444] text-[#d1d4dc] hover:text-white rounded text-xs transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
