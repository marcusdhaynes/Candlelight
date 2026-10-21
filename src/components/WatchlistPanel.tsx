import React, { useState } from 'react';
import { Asset, Watchlist, AssetCategory } from '../types';
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  FolderPlus,
  Sparkles,
  Info,
  Layers,
  X,
} from 'lucide-react';

interface WatchlistPanelProps {
  assets: Asset[];
  activeAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
  watchlists: Watchlist[];
  setWatchlists: React.Dispatch<React.SetStateAction<Watchlist[]>>;
  activeWatchlistId: string;
  setActiveWatchlistId: (id: string) => void;
  onOpenAddSymbolModal: () => void;
  priceFlashMap: Record<string, 'up' | 'down'>;
}

export const WatchlistPanel: React.FC<WatchlistPanelProps> = React.memo(({
  assets,
  activeAsset,
  onSelectAsset,
  watchlists,
  setWatchlists,
  activeWatchlistId,
  setActiveWatchlistId,
  onOpenAddSymbolModal,
  priceFlashMap,
}) => {
  const [isWatchlistDropdownOpen, setIsWatchlistDropdownOpen] = useState(false);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'all'>(() => {
    const saved = localStorage.getItem('tv_watchlist_filter_category');
    return saved ? (saved as AssetCategory | 'all') : 'all';
  });

  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_watchlist_details_collapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });

  React.useEffect(() => {
    localStorage.setItem('tv_watchlist_filter_category', filterCategory);
  }, [filterCategory]);

  React.useEffect(() => {
    localStorage.setItem('tv_watchlist_details_collapsed', JSON.stringify(isDetailsCollapsed));
  }, [isDetailsCollapsed]);

  const currentWatchlist =
    watchlists.find((w) => w.id === activeWatchlistId) || watchlists[0];

  // Assets in current watchlist (memoized to avoid re-filtering every render)
  const watchlistAssets = React.useMemo(() => {
    return currentWatchlist.symbols
      .map((sym) => assets.find((a) => a.symbol === sym))
      .filter((a): a is Asset => !!a)
      .filter((a) => filterCategory === 'all' || a.category === filterCategory);
  }, [currentWatchlist, assets, filterCategory]);

  const handleCreateWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const newList: Watchlist = {
      id: 'wl-' + Date.now(),
      name: newListName.trim(),
      symbols: [activeAsset.symbol],
      isCustom: true,
    };

    setWatchlists((prev) => [...prev, newList]);
    setActiveWatchlistId(newList.id);
    setNewListName('');
    setIsCreateListModalOpen(false);
  };

  const handleRemoveSymbol = (symbolToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWatchlists((prev) =>
      prev.map((wl) => {
        if (wl.id === currentWatchlist.id) {
          return {
            ...wl,
            symbols: wl.symbols.filter((s) => s !== symbolToRemove),
          };
        }
        return wl;
      })
    );
  };

  // Day range progress calculation
  const dayRangeSpread = Math.max(0.0001, activeAsset.high24h - activeAsset.low24h);
  const dayProgressPct = Math.min(
    100,
    Math.max(0, ((activeAsset.price - activeAsset.low24h) / dayRangeSpread) * 100)
  );

  // 52-week range progress calculation
  const week52High = activeAsset.week52High || activeAsset.high24h * 1.15;
  const week52Low = activeAsset.week52Low || activeAsset.low24h * 0.85;
  const week52Spread = Math.max(0.0001, week52High - week52Low);
  const week52ProgressPct = Math.min(
    100,
    Math.max(0, ((activeAsset.price - week52Low) / week52Spread) * 100)
  );

  return (
    <div id="watchlist-panel" className="flex flex-col h-full bg-[#131722] select-none text-[11px]">
      {/* Watchlist Header & Dropdown */}
      <div className="p-1.5 px-2 border-b border-[#2a2e39] bg-[#1e222d]/60">
        <div className="flex items-center justify-between mb-1.5">
          {/* Watchlist Dropdown Trigger */}
          <div className="relative">
            <button
              id="watchlist-selector-dropdown-btn"
              onClick={() => setIsWatchlistDropdownOpen(!isWatchlistDropdownOpen)}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#d1d4dc] hover:text-white transition"
            >
              <span>{currentWatchlist?.name}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>

            {isWatchlistDropdownOpen && (
              <div
                id="watchlist-dropdown-menu"
                className="absolute left-0 top-full mt-1 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl py-1 w-48 z-50 divide-y divide-[#2a2e39]"
              >
                <div className="py-0.5">
                  {watchlists.map((wl) => (
                    <button
                      key={wl.id}
                      onClick={() => {
                        setActiveWatchlistId(wl.id);
                        setIsWatchlistDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 text-[10.5px] flex items-center justify-between transition ${
                        wl.id === currentWatchlist.id
                          ? 'bg-[#2962ff]/15 text-[#2962ff] font-medium'
                          : 'text-[#d1d4dc] hover:bg-[#2a2e39]'
                      }`}
                    >
                      <span className="truncate">{wl.name}</span>
                      <span className="text-[9px] text-[#787b86] ml-2 font-mono">
                        {wl.symbols.length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-0.5">
                  <button
                    onClick={() => {
                      setIsWatchlistDropdownOpen(false);
                      setIsCreateListModalOpen(true);
                    }}
                    className="w-full text-left px-2 py-1 text-[10.5px] text-[#2962ff] hover:bg-[#2a2e39] rounded flex items-center gap-1 font-medium transition"
                  >
                    <FolderPlus className="w-3 h-3" />
                    New Watchlist...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Symbol button */}
          <button
            id="add-symbol-to-watchlist-btn"
            onClick={onOpenAddSymbolModal}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[#2962ff] bg-[#2962ff]/10 hover:bg-[#2962ff]/20 rounded transition"
            title="Add symbol to this watchlist"
          >
            <Plus className="w-3 h-3" />
            <span>Add Symbol</span>
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pt-0.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'crypto', label: 'Crypto' },
            { id: 'stocks', label: 'Stocks' },
            { id: 'forex', label: 'Forex' },
            { id: 'commodities', label: 'Commodities' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id as any)}
              className={`text-[9px] px-1.5 py-0.2 rounded font-medium transition whitespace-nowrap ${
                filterCategory === cat.id
                  ? 'bg-[#2962ff] text-white'
                  : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Watchlist Quotes Table */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]/50 min-h-0">
        {watchlistAssets.length === 0 ? (
          <div className="p-4 text-center text-[10.5px] text-[#787b86]">
            No symbols in this list. Click "Add Symbol" above to populate your watchlist.
          </div>
        ) : (
          watchlistAssets.map((asset) => {
            const isSelected = asset.symbol === activeAsset.symbol;
            const isPositive = asset.changePercent24h >= 0;
            const flash = priceFlashMap[asset.symbol];

            return (
              <div
                key={asset.symbol}
                id={`watchlist-item-${asset.symbol}`}
                onClick={() => onSelectAsset(asset)}
                className={`px-2 py-1 flex items-center justify-between cursor-pointer group transition ${
                  isSelected
                    ? 'bg-[#1e222d] border-l-2 border-[#2962ff]'
                    : 'hover:bg-[#1e222d]/60'
                } ${
                  flash === 'up'
                    ? 'bg-[#089981]/20 duration-150'
                    : flash === 'down'
                    ? 'bg-[#f23645]/20 duration-150'
                    : ''
                }`}
              >
                {/* Symbol & Name */}
                <div className="flex-1 min-w-0 pr-1.5">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[11px] text-[#d1d4dc] group-hover:text-white truncate">
                      {asset.symbol}
                    </span>
                    <span className="text-[8.5px] text-[#787b86]">{asset.exchange.split('/')[0]}</span>
                  </div>
                  <div className="text-[9.5px] text-[#787b86] truncate">{asset.name}</div>
                </div>

                {/* Price & Change */}
                <div className="text-right shrink-0">
                  <div className="font-mono text-[11px] font-semibold text-[#d1d4dc]">
                    {asset.price.toLocaleString(undefined, {
                      minimumFractionDigits: asset.digits,
                      maximumFractionDigits: asset.digits,
                    })}
                  </div>
                  <div
                    className={`font-mono text-[9.5px] font-medium flex items-center justify-end gap-0.5 ${
                      isPositive ? 'text-[#089981]' : 'text-[#f23645]'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {asset.changePercent24h.toFixed(2)}%
                  </div>
                </div>

                {/* Remove Symbol from List */}
                <button
                  onClick={(e) => handleRemoveSymbol(asset.symbol, e)}
                  className="opacity-0 group-hover:opacity-100 text-[#787b86] hover:text-[#f23645] p-0.5 ml-1 rounded hover:bg-[#2a2e39] transition"
                  title="Remove from watchlist"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Asset Details Card (TradingView bottom right panel) with collapse toggle */}
      <div
        id="asset-details-summary"
        className="border-t border-[#2a2e39] bg-[#1e222d]/80 p-2 shrink-0 text-[10.5px] text-[#d1d4dc]"
      >
        <div
          className="flex items-baseline justify-between cursor-pointer group"
          onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
          title="Click to toggle asset details"
        >
          <div className="flex items-center gap-1.5">
            <ChevronDown className={`w-3 h-3 text-[#787b86] transition-transform ${isDetailsCollapsed ? '-rotate-90' : ''}`} />
            <div>
              <div className="font-bold text-xs text-white leading-tight">{activeAsset.name}</div>
              <div className="text-[9px] text-[#787b86]">{activeAsset.exchange} • {activeAsset.currency}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-xs text-white">
              {activeAsset.price.toLocaleString(undefined, {
                minimumFractionDigits: activeAsset.digits,
                maximumFractionDigits: activeAsset.digits,
              })}
            </div>
            <div
              className={`font-mono text-[9.5px] font-semibold ${
                activeAsset.changePercent24h >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
              }`}
            >
              {activeAsset.changePercent24h >= 0 ? '+' : ''}
              {activeAsset.changePercent24h.toFixed(2)}% ({activeAsset.change24h > 0 ? '+' : ''}
              {activeAsset.change24h.toFixed(activeAsset.digits)})
            </div>
          </div>
        </div>

        {!isDetailsCollapsed && (
          <>
            {/* Day Range */}
            <div className="my-1.5">
              <div className="flex justify-between text-[9px] text-[#787b86] mb-0.5">
                <span>Day Low: {activeAsset.low24h.toFixed(activeAsset.digits)}</span>
                <span className="font-medium text-[#d1d4dc]">Day Range</span>
                <span>Day High: {activeAsset.high24h.toFixed(activeAsset.digits)}</span>
              </div>
              <div className="w-full bg-[#131722] h-1 rounded-full overflow-hidden relative">
                <div
                  className="bg-[#2962ff] h-full rounded-full transition-all duration-300"
                  style={{ width: `${dayProgressPct}%` }}
                />
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#2a2e39]/60 text-[10px]">
              <div>
                <span className="text-[#787b86]">24h Vol:</span>{' '}
                <span className="font-mono font-medium text-[#d1d4dc]">{activeAsset.volume24h}</span>
              </div>
              <div>
                <span className="text-[#787b86]">Mkt Cap:</span>{' '}
                <span className="font-mono font-medium text-[#d1d4dc]">
                  {activeAsset.marketCap || 'N/A'}
                </span>
              </div>
              {activeAsset.peRatio && (
                <div>
                  <span className="text-[#787b86]">P/E:</span>{' '}
                  <span className="font-mono font-medium text-[#d1d4dc]">{activeAsset.peRatio}</span>
                </div>
              )}
              {activeAsset.week52High && (
                <div>
                  <span className="text-[#787b86]">52W High:</span>{' '}
                  <span className="font-mono font-medium text-[#d1d4dc]">
                    ${activeAsset.week52High.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* New Watchlist Modal */}
      {isCreateListModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl p-3 w-full max-w-sm">
            <h3 className="text-xs font-semibold text-[#d1d4dc] mb-2.5">Create New Watchlist</h3>
            <form onSubmit={handleCreateWatchlist} className="space-y-2.5">
              <input
                type="text"
                placeholder="Watchlist name (e.g. Swing Trades)..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1.5 text-[11px] text-[#d1d4dc] focus:outline-none focus:border-[#2962ff]"
                autoFocus
                required
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreateListModalOpen(false)}
                  className="px-2.5 py-1 text-[11px] text-[#787b86] hover:text-[#d1d4dc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-[#2962ff] hover:bg-[#2962ff]/90 text-white rounded text-[11px] font-medium"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
