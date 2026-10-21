import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { MARKET_SOURCES, sourceInfo } from '../data/marketSources';
import { discoverPublicMarkets } from '../services/marketDiscovery';
import { fetchRealTicker24h } from '../services/dataFeed';
import { Asset, AssetCategory } from '../types';
import { Search, X, ChevronDown, Check } from 'lucide-react';

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  currentSymbol: string;
}

type FilterCategory = 'all' | AssetCategory;

const CATEGORY_TABS: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'funds', label: 'Funds' },
  { id: 'futures', label: 'Futures' },
  { id: 'forex', label: 'Forex' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'indices', label: 'Indices' },
  { id: 'bonds', label: 'Bonds' },
  { id: 'economy', label: 'Economy' },
  { id: 'options', label: 'Option' },
];

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  isOpen,
  onClose,
  assets,
  onSelectAsset,
  currentSymbol,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedExchangeType, setSelectedExchangeType] = useState<string>('all');

  const [sourceSearch, setSourceSearch] = useState('');
  const [discovered, setDiscovered] = useState<Asset[]>([]);
  const [discoveryErrors, setDiscoveryErrors] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [resultLimit, setResultLimit] = useState(150);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, Partial<Asset>>>({});
  const deferredSearch = useDeferredValue(search);
  const quoteKey = (a: Asset) => `${a.source || a.exchange}:${a.marketType || ''}:${a.symbol}`;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsDiscovering(true);
    discoverPublicMarkets().then(results => {
      if (cancelled) return;
      setDiscovered(results.flatMap(r => r.assets));
      setDiscoveryErrors(results.filter(r => r.error).map(r => `${r.source}: ${r.error}`));
    }).finally(() => { if (!cancelled) setIsDiscovering(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const allAssets = useMemo(() => {
    const seen = new Set<string>();
    return [...assets, ...discovered].filter(a => {
      const key = quoteKey(a);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assets, discovered]);

  useEffect(() => { setResultLimit(150); }, [selectedCategory, selectedSource, selectedType, selectedExchangeType, deferredSearch]);

  const [openDropdown, setOpenDropdown] = useState<'source' | 'type' | 'exchange' | null>(null);

  // Every listed source is selectable; listings without a working feed remain explicitly unverified.
  const availableSources = useMemo(() => {
    const names = new Set([...MARKET_SOURCES.map(s => s.name), ...allAssets.map(a => a.source || a.exchange)]);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [allAssets]);
  const sourceCounts = useMemo(() => {
    const map = new Map<string, number>();
    allAssets.forEach(a => {
      new Set([a.source, a.exchange].filter(Boolean).map(v => v!.toLowerCase())).forEach(key =>
        map.set(key, (map.get(key) || 0) + 1));
    });
    return map;
  }, [allAssets]);
  const matchingSources = useMemo(() =>
    availableSources.filter(s => s.toLowerCase().includes(sourceSearch.trim().toLowerCase())),
    [availableSources, sourceSearch]);

  // Filtering
  const filteredAssets = useMemo(() => {
    const list = allAssets.filter((asset) => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'crypto' && asset.category !== 'crypto') return false;
        if (selectedCategory === 'stocks' && asset.category !== 'stocks') return false;
        if (selectedCategory === 'funds' && asset.category !== 'funds') return false;
        if (selectedCategory === 'futures' && asset.category !== 'futures' && asset.marketType !== 'futures' && asset.marketType !== 'swap') return false;
        if (selectedCategory === 'forex' && asset.category !== 'forex') return false;
        if (selectedCategory === 'indices' && asset.category !== 'indices') return false;
        if (selectedCategory === 'bonds' && asset.category !== 'bonds') return false;
        if (selectedCategory === 'economy' && asset.category !== 'economy') return false;
        if (selectedCategory === 'options' && asset.category !== 'options') return false;
        if (selectedCategory === 'commodities' && asset.category !== 'commodities') return false;
      }

      // Source filter
      if (selectedSource !== 'all') {
        const sourceMatch = [asset.source, asset.exchange].some(value => value?.toLowerCase() === selectedSource.toLowerCase());
        if (!sourceMatch) return false;
      }

      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'spot' && asset.marketType !== 'spot') return false;
        if (selectedType === 'swap' && asset.marketType !== 'swap') return false;
        if (selectedType === 'index' && asset.marketType !== 'index') return false;
        if (selectedType === 'futures' && asset.marketType !== 'futures') return false;
        if (selectedType === 'fundamental' && asset.category !== 'economy' && asset.peRatio === undefined) return false;
      }

      // Exchange type filter
      if (selectedExchangeType !== 'all') {
        const providerKind = sourceInfo(asset.source || asset.exchange)?.kind;
        const isDex = providerKind === 'DEX' || (asset.isDefi === true && asset.isCex !== true);
        const isCex = providerKind === 'CEX' || (asset.isCex === true && !isDex);
        if (selectedExchangeType === 'dex' && !isDex) return false;
        if (selectedExchangeType === 'cex' && !isCex) return false;
      }

      // Search term
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase().trim();
        const matchesSymbol = asset.symbol.toLowerCase().includes(q);
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesExchange = asset.exchange.toLowerCase().includes(q);
        const matchesSource = (asset.source || '').toLowerCase().includes(q);
        const matchesPerp = (q.includes('perp') || q.includes('swap') || q.includes('future')) && (asset.marketType === 'swap' || asset.marketType === 'futures');
        if (!matchesSymbol && !matchesName && !matchesExchange && !matchesSource && !matchesPerp) {
          return false;
        }
      }

      return true;
    });

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim();
      return list.sort((a, b) => {
        const aExact = a.symbol.toLowerCase() === q;
        const bExact = b.symbol.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = a.symbol.toLowerCase().startsWith(q) || a.symbol.toLowerCase().startsWith('pf_' + q);
        const bStarts = b.symbol.toLowerCase().startsWith(q) || b.symbol.toLowerCase().startsWith('pf_' + q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0;
      });
    }

    return list;
  }, [allAssets, selectedCategory, selectedSource, selectedType, selectedExchangeType, deferredSearch]);

  // Refresh just the visible leaders, not thousands of symbols. Provider-specific calls
  // are throttled and cannot silently substitute quotes from a different venue.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const leaders = filteredAssets.slice(0, 12).filter(a => ['Kraken', 'Kraken Futures', 'Coinbase', 'Binance', 'Binance.US', 'OKX', 'Bybit'].includes(a.source || a.exchange));
    const refresh = async () => {
      const updates = await Promise.all(leaders.map(async a => {
        const quote = await fetchRealTicker24h(a).catch(() => null);
        return quote ? [quoteKey(a), quote] as const : null;
      }));
      if (!cancelled) setLiveQuotes(prev => ({
        ...prev,
        ...Object.fromEntries(updates.filter((entry): entry is readonly [string, Partial<Asset>] => entry !== null)),
      }));
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isOpen, filteredAssets.slice(0, 12).map(quoteKey).join('|')]);

  if (!isOpen) return null;

  // Render official brand logo for asset
  const renderAssetLogo = (asset: Asset) => {
    const sym = asset.symbol.toUpperCase();
    if (sym.startsWith('BTC')) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#f7931a] flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
          ₿
        </div>
      );
    }
    if (sym.startsWith('ETH')) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#627eea] flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
          <svg viewBox="0 0 256 417" className="w-3.5 h-3.5 fill-current">
            <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fill="#fff" />
            <path d="M127.962 0L0 212.32l127.962 75.639V0z" fill="#fff" fillOpacity="0.8" />
            <path d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" fill="#fff" />
            <path d="M127.962 416.905v-104.72L0 236.585z" fill="#fff" fillOpacity="0.8" />
          </svg>
        </div>
      );
    }
    if (sym.startsWith('SOL')) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#131722] border border-[#2a2e39] flex items-center justify-center shrink-0">
          <div className="w-3.5 h-3 flex flex-col justify-between">
            <div className="h-0.5 w-full bg-[#00ffa3] rounded-xs" />
            <div className="h-0.5 w-full bg-[#03e1ff] rounded-xs ml-0.5" />
            <div className="h-0.5 w-full bg-[#dc1fff] rounded-xs" />
          </div>
        </div>
      );
    }
    if (sym.startsWith('ARB')) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#28a0f0] flex items-center justify-center text-white font-bold text-[10px] shadow-xs shrink-0">
          A
        </div>
      );
    }
    if (sym.startsWith('BNB')) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#f3ba2f] flex items-center justify-center text-black font-black text-[10px] shadow-xs shrink-0">
          ❖
        </div>
      );
    }
    if (sym.startsWith('XRP')) {
      return (
        <div className="w-6 h-6 rounded-full bg-black border border-[#2a2e39] flex items-center justify-center text-white font-bold text-[10px] shrink-0">
          ✕
        </div>
      );
    }
    if (sym.startsWith('DOGE')) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#c2a633] flex items-center justify-center text-white font-black text-xs shrink-0">
          Ð
        </div>
      );
    }
    if (asset.category === 'stocks') {
      return (
        <div className="w-6 h-6 rounded-full bg-[#2962ff]/20 text-[#2962ff] border border-[#2962ff]/40 flex items-center justify-center text-[10px] font-bold shrink-0">
          {sym.substring(0, 2)}
        </div>
      );
    }
    if (asset.category === 'forex') {
      return (
        <div className="w-6 h-6 rounded-full bg-[#089981]/20 text-[#089981] border border-[#089981]/40 flex items-center justify-center text-[10px] font-bold shrink-0">
          FX
        </div>
      );
    }
    if (asset.category === 'indices') {
      return (
        <div className="w-6 h-6 rounded-full bg-[#ff9800]/20 text-[#ff9800] border border-[#ff9800]/40 flex items-center justify-center text-[10px] font-bold shrink-0">
          IX
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full bg-[#1e222d] border border-[#2a2e39] flex items-center justify-center text-[10px] font-bold text-[#d1d4dc] shrink-0">
        {sym.substring(0, 2)}
      </div>
    );
  };

  // Render exchange badge with authentic official logo icon
  const renderExchangeBadge = (exchange: string) => {
    const ex = exchange.toUpperCase();

    if (ex.includes('BITSTAMP')) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold text-white">Bitstamp</span>
          <div className="w-4 h-4 rounded-xs bg-[#00ab4e] flex items-center justify-center text-white font-black text-[9px] shadow-2xs">
            B
          </div>
        </div>
      );
    }
    if (ex.includes('BINANCE')) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold text-white">Binance</span>
          <div className="w-4 h-4 rounded-full bg-[#f0b90b] flex items-center justify-center shadow-2xs">
            <div className="w-2 h-2 rotate-45 border-2 border-black" />
          </div>
        </div>
      );
    }
    if (ex.includes('COINBASE')) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold text-white">Coinbase</span>
          <div className="w-4 h-4 rounded-full bg-[#0052ff] flex items-center justify-center text-white font-bold text-[9px] shadow-2xs">
            C
          </div>
        </div>
      );
    }
    if (ex.includes('BYBIT')) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold text-white">Bybit</span>
          <div className="px-1 py-0.2 rounded-xs bg-[#17181e] border border-[#2a2e39] text-[#f7a600] font-black text-[8px]">
            BYBIT
          </div>
        </div>
      );
    }
    if (ex.includes('INDEX') || ex.includes('CRYPTO')) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold text-white">{exchange}</span>
          <div className="w-4 h-4 rounded-xs bg-black border border-[#2a2e39] flex items-center justify-center text-white font-bold text-[9px]">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
              <path d="M4 19h4v-7H4v7zm6 0h4V5h-4v14zm6 0h4v-11h-4v11z" />
            </svg>
          </div>
        </div>
      );
    }
    if (ex.includes('KRAKEN')) {
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] font-bold text-white">Kraken</span>
          <div className="w-4 h-4 rounded-full bg-[#5841d8] flex items-center justify-center text-white font-bold text-[9px] shadow-2xs">
            K
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[12px] font-bold text-white">{exchange}</span>
      </div>
    );
  };

  return (
    <div
      id="symbol-search-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        id="symbol-search-modal-window"
        className="bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] text-[#d1d4dc] ring-1 ring-white/5 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown(null);
        }}
      >
        {/* Top Header: "Symbol search" and Real-time Feeds Badge and Close "X" Button */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2.5 border-b border-[#2a2e39]/40">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold text-white tracking-tight">
              Symbol search
            </h2>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#089981]/15 border border-[#089981]/30 text-[#089981] text-[11px] font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#089981] animate-pulse" />
              <span>Public market feeds · live when verified</span>
            </div>
          </div>
          <button
            id="close-symbol-search-modal"
            onClick={onClose}
            className="text-[#787b86] hover:text-white p-1.5 rounded-lg hover:bg-[#2a2e39] transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar with Magnifying Glass and Keyboard Icon */}
        <div className="px-5 py-3">
          <div className="relative flex items-center bg-[#131722] border border-[#2a2e39] focus-within:border-[#2962ff] focus-within:ring-2 focus-within:ring-[#2962ff]/20 rounded-lg transition-all shadow-inner">
            <Search className="w-4 h-4 text-[#787b86] ml-3.5 shrink-0 pointer-events-none" />
            <input
              id="symbol-search-input"
              type="text"
              placeholder="Search symbol, currency, or company name (e.g. BTC, ETH, AAPL, NVDA)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none pl-3 pr-20 py-2.5 text-sm text-[#d1d4dc] placeholder-[#787b86] focus:outline-none"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mr-2 p-1 text-[#787b86] hover:text-white rounded hover:bg-[#2a2e39] transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Keyboard shortcut icon */}
            <div className="pr-3 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39] text-[#787b86] text-[10px] font-mono">
                ESC
              </span>
            </div>
          </div>
        </div>

        {/* Primary Filter Tabs: All, Stocks, Funds, Futures, Forex, Crypto, Indices, Bonds, Economy, Options */}
        <div className="px-5 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-[#2a2e39]/60 bg-[#171b26]/40">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                id={`search-tab-${tab.id}`}
                onClick={() => setSelectedCategory(tab.id)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all font-medium ${
                  isSelected
                    ? 'bg-white text-[#131722] font-semibold shadow-xs'
                    : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Secondary Sub-filters: All sources ⌵, All types ⌵, All exchange types ⌵ */}
        <div className="px-5 py-2 flex items-center justify-between text-xs border-b border-[#2a2e39]/60 relative z-30 bg-[#1e222d]">
          <div className="flex items-center gap-3">
            {/* Sources Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === 'source' ? null : 'source');
                }}
                className="flex items-center gap-1 text-[#787b86] hover:text-[#d1d4dc] transition py-1 px-2 rounded hover:bg-[#2a2e39]/50"
              >
                <span>{selectedSource === 'all' ? 'All sources' : selectedSource}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {openDropdown === 'source' && (
                <div
                  className="absolute left-0 top-full mt-1 w-72 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 max-h-80 overflow-y-auto z-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    onClick={() => {
                      setSelectedSource('all');
                      setOpenDropdown(null);
                    }}
                    className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer hover:bg-[#2a2e39] ${
                      selectedSource === 'all' ? 'text-[#2962ff] font-medium' : 'text-[#d1d4dc]'
                    }`}
                  >
                    <span>All sources</span>
                    {selectedSource === 'all' && <Check className="w-3.5 h-3.5 text-[#2962ff]" />}
                  </div>
                  <div className="sticky top-0 bg-[#1e222d] p-2 border-b border-[#2a2e39]">
                    <input value={sourceSearch} onChange={e => setSourceSearch(e.target.value)}
                      onClick={e => e.stopPropagation()} placeholder="Find any provider..."
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#2962ff]" />
                  </div>
                  {matchingSources.map((src) => (
                    <div
                      key={src}
                      onClick={() => {
                        setSelectedSource(src);
                        setOpenDropdown(null);
                      }}
                      className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer hover:bg-[#2a2e39] ${
                        selectedSource === src ? 'text-[#2962ff] font-medium' : 'text-[#d1d4dc]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0"><span className="truncate">{src}</span>
                      <span className="text-[9px] text-[#787b86] shrink-0">{sourceCounts.get(src.toLowerCase()) || '—'}</span></span>
                      {selectedSource === src && <Check className="w-3.5 h-3.5 text-[#2962ff]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Types Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === 'type' ? null : 'type');
                }}
                className="flex items-center gap-1 text-[#787b86] hover:text-[#d1d4dc] transition py-1 px-2 rounded hover:bg-[#2a2e39]/50"
              >
                <span>{selectedType === 'all' ? 'All types' : selectedType.toUpperCase()}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {openDropdown === 'type' && (
                <div
                  className="absolute left-0 top-full mt-1 w-40 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 z-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  {['all', 'spot', 'swap', 'futures', 'index', 'fundamental'].map((t) => (
                    <div
                      key={t}
                      onClick={() => {
                        setSelectedType(t);
                        setOpenDropdown(null);
                      }}
                      className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer hover:bg-[#2a2e39] ${
                        selectedType === t ? 'text-[#2962ff] font-medium' : 'text-[#d1d4dc]'
                      }`}
                    >
                      <span className="capitalize">{t === 'all' ? 'All types' : t}</span>
                      {selectedType === t && <Check className="w-3.5 h-3.5 text-[#2962ff]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exchange Types Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === 'exchange' ? null : 'exchange');
                }}
                className="flex items-center gap-1 text-[#787b86] hover:text-[#d1d4dc] transition py-1 px-2 rounded hover:bg-[#2a2e39]/50"
              >
                <span>
                  {selectedExchangeType === 'all'
                    ? 'All exchanges'
                    : selectedExchangeType.toUpperCase()}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {openDropdown === 'exchange' && (
                <div
                  className="absolute left-0 top-full mt-1 w-44 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 z-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  {['all', 'cex', 'dex'].map((et) => (
                    <div
                      key={et}
                      onClick={() => {
                        setSelectedExchangeType(et);
                        setOpenDropdown(null);
                      }}
                      className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer hover:bg-[#2a2e39] ${
                        selectedExchangeType === et ? 'text-[#2962ff] font-medium' : 'text-[#d1d4dc]'
                      }`}
                    >
                      <span>{et === 'all' ? 'All exchanges' : et.toUpperCase()}</span>
                      {selectedExchangeType === et && <Check className="w-3.5 h-3.5 text-[#2962ff]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-[#787b86]">
            {filteredAssets.length.toLocaleString()} symbols {isDiscovering ? '· loading exchanges…' : ''}
          </div>
        </div>

        {/* Results Column Headers */}
        <div className="px-5 py-1.5 grid grid-cols-12 text-[10px] font-semibold text-[#787b86] uppercase tracking-wider bg-[#131722]/50 border-b border-[#2a2e39]/40">
          <div className="col-span-6">Symbol & Description</div>
          <div className="col-span-3 text-right">Price / freshness</div>
          <div className="col-span-3 text-right">Source / Feed</div>
        </div>

        {/* Results List matching TradingView rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]/40 min-h-72">
          {filteredAssets.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#787b86]">
              <div>No verified instruments found for these filters.</div>
              {selectedSource !== 'all' && (
                <div className="mt-2 text-xs">Provider directories are searchable, but not every exchange exposes a free browser-accessible feed.</div>
              )}
              {isDiscovering && <div className="mt-2 text-xs">Checking public exchange catalogs…</div>}
            </div>
          ) : (
            filteredAssets.slice(0, resultLimit).map((originalAsset) => {
              const asset = { ...originalAsset, ...(liveQuotes[quoteKey(originalAsset)] || {}) };
              const verified = asset.quoteStatus === 'live' && !!asset.quoteUpdatedAt && Date.now() - asset.quoteUpdatedAt < 60_000;
              const isCurrent = asset.symbol === currentSymbol;
              const isPositive = asset.changePercent24h >= 0;

              return (
                <div
                  key={`${asset.symbol}-${asset.exchange}-${asset.marketType}`}
                  id={`symbol-item-${asset.symbol}`}
                  onClick={() => {
                    onSelectAsset(asset);
                    onClose();
                  }}
                  className={`px-5 py-2.5 grid grid-cols-12 items-center cursor-pointer transition ${
                    isCurrent
                      ? 'bg-[#2962ff]/15 border-l-2 border-[#2962ff]'
                      : 'hover:bg-[#2a2e39]/50'
                  }`}
                >
                  {/* Left: Coin Icon & Symbol & Name */}
                  <div className="col-span-6 flex items-center gap-3 min-w-0 pr-2">
                    {renderAssetLogo(asset)}

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-white tracking-wide">
                          {asset.symbol}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#2962ff]/30 text-[#2962ff] font-semibold uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#787b86] truncate">
                        {asset.name}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Live Real-Time Price & 24h Change */}
                  <div className="col-span-3 flex flex-col items-end justify-center">
                    <span className="font-mono text-[13px] font-semibold text-white">
                      {verified && Number.isFinite(asset.price) ? asset.price.toLocaleString(undefined, {
                        minimumFractionDigits: Math.min(asset.digits, 6),
                        maximumFractionDigits: Math.min(asset.digits, 8),
                      }) + ' ' + asset.currency : '—'}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-medium ${
                        isPositive ? 'text-[#089981]' : 'text-[#f23645]'
                      }`}
                    >
                      {verified ? `${isPositive ? '+' : ''}${asset.changePercent24h.toFixed(2)}%` : 'No verified quote'}
                    </span>
                  </div>

                  {/* Right: Exchange / Source with Live Status */}
                  <div className="col-span-3 flex flex-col items-end gap-1">
                    {renderExchangeBadge(asset.source || asset.exchange)}
                    <div className="flex items-center gap-1 text-[9px] text-[#787b86]">
                      <span className={`w-1.5 h-1.5 rounded-full ${verified ? 'bg-[#089981]' : 'bg-[#787b86]'}`} />
                      <span>{verified ? 'LIVE' : 'UNVERIFIED'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredAssets.length > resultLimit && (
          <button onClick={() => setResultLimit(v => v + 150)} className="py-2 text-xs font-medium text-[#8cadff] hover:text-white bg-[#1a2030] border-t border-[#2a2e39]">
            Show 150 more · {Math.max(0, filteredAssets.length - resultLimit).toLocaleString()} remaining
          </button>
        )}
        {/* Bottom Footer: TradingView style status & keyboard shortcuts */}
        <div className="px-5 py-2.5 border-t border-[#2a2e39]/60 flex items-center justify-between text-[11px] text-[#787b86] bg-[#171b26]">
          <span>{isDiscovering ? 'Discovering public exchange markets…' : `${allAssets.length.toLocaleString()} instruments indexed`}
            {discoveryErrors.length ? ` · ${discoveryErrors.length} providers unavailable` : ''}
            {' · Unverified quotes are intentionally hidden'}</span>
          <div className="flex items-center gap-3 text-[10px]">
            <span><kbd className="px-1 py-0.5 rounded bg-[#2a2e39] text-[#d1d4dc]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-[#2a2e39] text-[#d1d4dc]">↓</kbd> navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#2a2e39] text-[#d1d4dc]">↵</kbd> select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#2a2e39] text-[#d1d4dc]">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
