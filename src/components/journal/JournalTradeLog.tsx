import React, { useState, useRef, useEffect } from 'react';
import { JournalTrade } from '../../types';
import {
  JournalStats,
  getSetupsBreakdown,
  getMistakesBreakdown,
} from '../../services/journalAnalytics';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ExternalLink,
  Info,
  TrendingUp,
  Tag,
  AlertTriangle,
  Flame,
  BarChart2,
  X,
  FileText,
  SlidersHorizontal,
  Settings,
  GripVertical,
  ChevronLeft,
  MessageCircle,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  Edit3,
} from 'lucide-react';
import {
  JournalLayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
  JournalGridSettingsModal,
} from './JournalGridSettingsModal';

interface JournalTradeLogProps {
  trades: JournalTrade[];
  stats: JournalStats;
  onOpenAddTrade: () => void;
  onDeleteTrade: (id: string) => void;
  onSelectTrade?: (trade: JournalTrade) => void;
  onEditTrade?: (trade: JournalTrade) => void;
  onOpenSettings?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onStartWindowDrag?: (e: React.MouseEvent) => void;
  onClose?: () => void;
  layoutSettings?: JournalLayoutSettings;
  onUpdateSettings?: (settings: JournalLayoutSettings) => void;
  onResetSettings?: () => void;
}

export const JournalTradeLog: React.FC<JournalTradeLogProps> = ({
  trades,
  stats,
  onOpenAddTrade,
  onDeleteTrade,
  onSelectTrade,
  onEditTrade,
  onOpenSettings,
  isMaximized = true,
  onToggleMaximize,
  onStartWindowDrag,
  onClose,
  layoutSettings: propLayoutSettings,
  onUpdateSettings,
  onResetSettings,
}) => {
  // Layout Settings State (Persisted in localStorage fallback)
  const [localLayoutSettings, setLocalLayoutSettings] = useState<JournalLayoutSettings>(() => {
    const saved = localStorage.getItem('tv_journal_layout_settings');
    if (saved) {
      try {
        return { ...DEFAULT_LAYOUT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse journal layout settings', e);
      }
    }
    return DEFAULT_LAYOUT_SETTINGS;
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Active settings: prefer prop passed from parent modal, fallback to local
  const layoutSettings = propLayoutSettings || localLayoutSettings;

  // Save settings when changed
  const updateLayoutSettings = (newSettings: JournalLayoutSettings) => {
    if (onUpdateSettings) {
      onUpdateSettings(newSettings);
    }
    setLocalLayoutSettings(newSettings);
    localStorage.setItem('tv_journal_layout_settings', JSON.stringify(newSettings));
  };

  const resetLayoutSettings = () => {
    if (onResetSettings) {
      onResetSettings();
    }
    setLocalLayoutSettings(DEFAULT_LAYOUT_SETTINGS);
    localStorage.setItem('tv_journal_layout_settings', JSON.stringify(DEFAULT_LAYOUT_SETTINGS));
  };

  // Drag and Drop state for grid cards
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Splitter state for Resizable Main Table vs Right Column
  const [isResizingSplitter, setIsResizingSplitter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter states matching image
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSymbol, setFilterSymbol] = useState('All');
  const [filterSetup, setFilterSetup] = useState('All');
  const [filterSide, setFilterSide] = useState('All');
  const [filterMistake, setFilterMistake] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPortfolio, setFilterPortfolio] = useState('All');
  const [filterDate, setFilterDate] = useState('All');

  // Open active filter dropdowns
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Table selection & expansion state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pagination for right sidebar widgets
  const [setupsPage, setSetupsPage] = useState(1);
  const [mistakesPage, setMistakesPage] = useState(1);

  // Timeline scrubber state
  const [scrubberPosition, setScrubberPosition] = useState(72);

  // Resize split handler (mouse drag)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSplitter || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      if (newRatio >= 0.4 && newRatio <= 0.85) {
        updateLayoutSettings({
          ...layoutSettings,
          horizontalSplitRatio: Number(newRatio.toFixed(3)),
        });
      }
    };

    const handleMouseUp = () => {
      if (isResizingSplitter) {
        setIsResizingSplitter(false);
      }
    };

    if (isResizingSplitter) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplitter, layoutSettings]);

  // Filter trades
  const filtered = trades.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSymbol = t.symbol.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchSetups = t.setups?.some((s) => s.toLowerCase().includes(q));
      if (!matchSymbol && !matchNote && !matchSetups) return false;
    }
    if (filterSymbol !== 'All' && t.symbol !== filterSymbol) return false;
    if (filterSetup !== 'All' && (!t.setups || !t.setups.includes(filterSetup))) return false;
    if (filterSide !== 'All' && t.side !== filterSide) return false;
    if (filterStatus !== 'All' && t.status !== filterStatus) return false;
    if (filterPortfolio !== 'All' && t.portfolio !== filterPortfolio) return false;
    if (filterMistake !== 'All') {
      if (filterMistake === 'None' && t.mistakes && t.mistakes.length > 0) return false;
      if (filterMistake !== 'None' && (!t.mistakes || !t.mistakes.includes(filterMistake))) return false;
    }
    return true;
  });

  const uniqueSymbols = Array.from(new Set(trades.map((t) => t.symbol)));
  const setupsBreakdown = getSetupsBreakdown(trades);
  const mistakesBreakdown = getMistakesBreakdown(trades);

  // Checkbox handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => onDeleteTrade(id));
    setSelectedIds(new Set());
  };

  // Drag and Drop handlers for reordering sections
  const handleDragStart = (id: string) => {
    setDraggingCardId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggingCardId && draggingCardId !== id) {
      setDragOverCardId(id);
    }
  };

  const handleDrop = (targetId: string, group: 'top' | 'right') => {
    if (!draggingCardId || draggingCardId === targetId) {
      setDraggingCardId(null);
      setDragOverCardId(null);
      return;
    }

    if (group === 'top') {
      const currentList = [...layoutSettings.topRowOrder];
      const fromIdx = currentList.indexOf(draggingCardId);
      const toIdx = currentList.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        currentList.splice(fromIdx, 1);
        currentList.splice(toIdx, 0, draggingCardId);
        updateLayoutSettings({ ...layoutSettings, topRowOrder: currentList });
      }
    } else if (group === 'right') {
      const currentList = [...layoutSettings.rightColumnOrder];
      const fromIdx = currentList.indexOf(draggingCardId);
      const toIdx = currentList.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        currentList.splice(fromIdx, 1);
        currentList.splice(toIdx, 0, draggingCardId);
        updateLayoutSettings({ ...layoutSettings, rightColumnOrder: currentList });
      }
    }

    setDraggingCardId(null);
    setDragOverCardId(null);
  };

  // Helper styles based on settings
  const cornerClass = layoutSettings.roundedCorners ? 'rounded-xl' : 'rounded-none';
  const tableCornerClass = layoutSettings.roundedCorners ? 'rounded-xl' : 'rounded-none';
  const innerCornerClass = layoutSettings.roundedCorners ? 'rounded-lg' : 'rounded-none';
  const smCornerClass = layoutSettings.roundedCorners ? 'rounded' : 'rounded-none';
  const barCornerClass = layoutSettings.roundedCorners ? 'rounded-full' : 'rounded-none';

  // Spacing helper: compact = snug (gap-1, p-1), normal = standard (gap-2.5, p-2.5), spacious = wide (gap-4, p-4)
  const getGapClass = () => {
    if (layoutSettings.spacing === 'compact') return 'gap-1';
    if (layoutSettings.spacing === 'spacious') return 'gap-4';
    return 'gap-2.5';
  };

  const getPaddingClass = () => {
    if (layoutSettings.spacing === 'compact') return 'p-1';
    if (layoutSettings.spacing === 'spacious') return 'p-4';
    return 'p-2.5';
  };

  const getCardPaddingClass = () => {
    if (layoutSettings.spacing === 'compact') return 'p-2.5';
    if (layoutSettings.spacing === 'spacious') return 'p-4.5';
    return 'p-3.5';
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleDocClick = () => setActiveDropdown(null);
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, []);

  // Check section visibility
  const isSecEnabled = (id: string) => layoutSettings.enabledSections[id] !== false;

  const hideSection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayoutSettings({
      ...layoutSettings,
      enabledSections: {
        ...layoutSettings.enabledSections,
        [id]: false,
      },
    });
  };

  // Active top cards filtered by enabled status
  const visibleTopCards = layoutSettings.topRowOrder.filter((id) => isSecEnabled(id));
  const visibleRightCards = layoutSettings.rightColumnOrder.filter((id) => isSecEnabled(id));

  return (
    <div
      id="journal-tradelog-view"
      className="flex flex-col h-full bg-[#0f131c] text-[#d1d4dc] overflow-hidden select-none font-sans text-xs"
    >
      {/* Top Filter and Actions Bar (Exact TradeZella / TraderSync look from image.png) */}
      <div
        onMouseDown={onStartWindowDrag}
        onDoubleClick={onToggleMaximize}
        className="bg-[#131722] px-3 py-1.5 border-b border-[#232836] flex flex-wrap items-center justify-between gap-2 shrink-0 z-20 cursor-default select-none"
        title={!isMaximized ? "Drag on empty space to reposition window" : undefined}
      >
        {/* Left Filters Row */}
        <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Active Filter Icon Pill */}
          <div className="w-6 h-6 rounded bg-[#2563eb] text-white flex items-center justify-center shadow-xs">
            <Filter className="w-3.5 h-3.5 fill-current" />
          </div>

          {/* Symbol Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'symbol' ? null : 'symbol')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterSymbol === 'All' ? 'Symbol' : filterSymbol}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'symbol' && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50 max-h-56 overflow-y-auto">
                <button
                  onClick={() => {
                    setFilterSymbol('All');
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition ${
                    filterSymbol === 'All' ? 'text-[#00e5ff] font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                  }`}
                >
                  All Symbols
                </button>
                {uniqueSymbols.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => {
                      setFilterSymbol(sym);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono transition ${
                      filterSymbol === sym ? 'text-[#00e5ff] font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Setup Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'setup' ? null : 'setup')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterSetup === 'All' ? 'Setup' : filterSetup}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'setup' && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All', 'BREAKOUT', 'REVERSAL', 'RSI CROSSED', 'BU-OB', 'BOUNCE', 'FOMO'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setFilterSetup(s);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      filterSetup === s ? 'text-[#00ffa3] font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Side Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'side' ? null : 'side')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterSide === 'All' ? 'Side' : filterSide}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'side' && (
              <div className="absolute left-0 top-full mt-1 w-32 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All', 'LONG', 'SHORT'].map((side) => (
                  <button
                    key={side}
                    onClick={() => {
                      setFilterSide(side);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      filterSide === side ? 'text-[#00ffa3] font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mistake Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'mistake' ? null : 'mistake')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterMistake === 'All' ? 'Mistake' : filterMistake}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'mistake' && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All', 'None', 'fomo', "didn't set up stop loss", 'Greed', 'Market crash', 'News'].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setFilterMistake(m);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs capitalize transition ${
                      filterMistake === m ? 'text-[#f43f5e] font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {m === 'None' ? 'No Mistakes' : m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterStatus === 'All' ? 'Status' : filterStatus}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'status' && (
              <div className="absolute left-0 top-full mt-1 w-32 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All', 'WIN', 'LOSS', 'OPEN', 'BE'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setFilterStatus(st);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      filterStatus === st ? 'text-white font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Portfolio Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'portfolio' ? null : 'portfolio')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterPortfolio === 'All' ? 'Portfolio' : filterPortfolio}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'portfolio' && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All', 'Main Account', 'Crypto Prop', 'Scalp Desk'].map((pf) => (
                  <button
                    key={pf}
                    onClick={() => {
                      setFilterPortfolio(pf);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      filterPortfolio === pf ? 'text-white font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {pf}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'date' ? null : 'date')}
              className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition"
            >
              <span>{filterDate === 'All' ? 'Date' : filterDate}</span>
              <ChevronDown className="w-3 h-3 text-[#787b86]" />
            </button>
            {activeDropdown === 'date' && (
              <div className="absolute left-0 top-full mt-1 w-36 bg-[#171b26] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50">
                {['All', 'Today', 'This Week', 'This Month', 'Year to Date'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setFilterDate(d);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      filterDate === d ? 'text-white font-bold bg-[#2962ff]/20' : 'text-[#d1d4dc] hover:bg-[#1f2433]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Tags */}
          <button className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] flex items-center gap-1 text-[11px] font-medium transition">
            <span>Custom Tags</span>
            <ChevronDown className="w-3 h-3 text-[#787b86]" />
          </button>

          {/* More... */}
          <button className="bg-[#171b26] hover:bg-[#1f2433] text-[#a6adb9] hover:text-white px-2.5 py-1 rounded border border-[#262c3d] text-[11px] font-medium transition">
            More...
          </button>

          {/* Search bar inside header */}
          <div className="flex items-center gap-1.5 bg-[#171b26] px-2.5 py-1 rounded border border-[#262c3d] text-xs ml-1">
            <Search className="w-3 h-3 text-[#787b86]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white outline-none w-28 placeholder-[#787b86] text-[11px]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#787b86] hover:text-white">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Actions (AI, Grid Settings, Add Trade, Refresh) */}
        <div className="flex items-center gap-2">
          {/* AI Snowflake / Sparkles */}
          <button
            className="p-1.5 text-[#a6adb9] hover:text-white rounded hover:bg-[#1e2433] transition"
            title="AI Pattern Engine"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00ffa3]" />
          </button>

          {/* Grid Layout & Customize Icon (Opens Settings) */}
          <button
            onClick={() => (onOpenSettings ? onOpenSettings() : setIsSettingsModalOpen(true))}
            className="p-1.5 text-[#a6adb9] hover:text-white rounded hover:bg-[#1e2433] transition cursor-pointer"
            title="Grid & Section Layout Settings"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          {/* + Add Trade (Solid Green Pill matching Image) */}
          <button
            onClick={onOpenAddTrade}
            className="bg-[#00c49f] hover:bg-[#00b290] text-white px-3 py-1 rounded-full text-xs font-bold transition shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Trade</span>
          </button>

          {/* Reload / Sync Icon */}
          <button
            onClick={() => {}}
            className="p-1.5 text-[#a6adb9] hover:text-white rounded hover:bg-[#1e2433] transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Dedicated Settings Gear Icon */}
          <button
            onClick={() => (onOpenSettings ? onOpenSettings() : setIsSettingsModalOpen(true))}
            className="p-1.5 text-[#a6adb9] hover:text-white rounded hover:bg-[#1e2433] transition cursor-pointer"
            title="Grid Settings (Corners, Spacing, Sections)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Window controls cleanly attached to the rightmost side */}
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

      {/* Main Resizable Grid Container */}
      <div className={`flex-1 flex flex-col overflow-hidden ${getPaddingClass()} ${getGapClass()}`}>
        {/* ROW 1: TOP 3 METRIC CARDS (Draggable & Resizable within Grid) */}
        {visibleTopCards.length > 0 && (
          <div className={`grid grid-cols-1 md:grid-cols-${visibleTopCards.length} ${getGapClass()} shrink-0`}>
            {visibleTopCards.map((cardId) => {
              const isOver = dragOverCardId === cardId;
              const isDragging = draggingCardId === cardId;

              if (cardId === 'accumulative-return') {
                return (
                  <div
                    key="accumulative-return"
                    draggable
                    onDragStart={() => handleDragStart('accumulative-return')}
                    onDragOver={(e) => handleDragOver(e, 'accumulative-return')}
                    onDrop={() => handleDrop('accumulative-return', 'top')}
                    className={`bg-[#171b26] border ${
                      isOver ? 'border-[#00e5ff] shadow-lg shadow-[#00e5ff]/20' : 'border-[#232836]'
                    } ${cornerClass} ${getCardPaddingClass()} flex items-center justify-between relative group transition-all duration-150 ${
                      isDragging ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {/* Hover Drag & Hide Controls */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                      <div
                        className="cursor-grab text-[#787b86] hover:text-white p-0.5"
                        title="Drag to reposition card"
                      >
                        <GripVertical className="w-3 h-3" />
                      </div>
                      <button
                        onClick={(e) => hideSection('accumulative-return', e)}
                        className="text-[#787b86] hover:text-[#f43f5e] p-0.5"
                        title="Hide section (re-add in Settings)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">
                        Accumulative Return Net $
                      </div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">
                        ${stats.totalNetReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Cyan Glowing Area Sparkline Curve (Exact from image.png) */}
                    <div className="w-[125px] h-[34px]">
                      <svg width="125" height="34" className="overflow-visible">
                        <defs>
                          <linearGradient id="cyanSparkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 0 28 Q 20 28, 40 24 T 80 14 T 110 8 L 125 6"
                          fill="none"
                          stroke="#00e5ff"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 0 28 Q 20 28, 40 24 T 80 14 T 110 8 L 125 6 L 125 34 L 0 34 Z"
                          fill="url(#cyanSparkGrad)"
                        />
                      </svg>
                    </div>
                  </div>
                );
              }

              if (cardId === 'profit-loss-ratio') {
                return (
                  <div
                    key="profit-loss-ratio"
                    draggable
                    onDragStart={() => handleDragStart('profit-loss-ratio')}
                    onDragOver={(e) => handleDragOver(e, 'profit-loss-ratio')}
                    onDrop={() => handleDrop('profit-loss-ratio', 'top')}
                    className={`bg-[#171b26] border ${
                      isOver ? 'border-[#00e5ff] shadow-lg shadow-[#00e5ff]/20' : 'border-[#232836]'
                    } ${cornerClass} ${getCardPaddingClass()} flex items-center justify-between relative group transition-all duration-150 ${
                      isDragging ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {/* Hover Drag & Hide Controls */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                      <div
                        className="cursor-grab text-[#787b86] hover:text-white p-0.5"
                        title="Drag to reposition card"
                      >
                        <GripVertical className="w-3 h-3" />
                      </div>
                      <button
                        onClick={(e) => hideSection('profit-loss-ratio', e)}
                        className="text-[#787b86] hover:text-[#f43f5e] p-0.5"
                        title="Hide section (re-add in Settings)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">
                        Profit/Loss Ratio
                      </div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">
                        {stats.winLossRatio.toFixed(2)} :1
                      </div>
                    </div>

                    {/* Smooth Purple/Cyan Sparkline (Exact from image.png) */}
                    <div className="w-[125px] h-[34px]">
                      <svg width="125" height="34" className="overflow-visible">
                        <path
                          d="M 0 12 Q 25 10, 45 22 T 85 24 T 115 25 L 125 25"
                          fill="none"
                          stroke="#8b5cf6"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 85 24 L 125 25"
                          fill="none"
                          stroke="#00e5ff"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                );
              }

              if (cardId === 'win-rate') {
                return (
                  <div
                    key="win-rate"
                    draggable
                    onDragStart={() => handleDragStart('win-rate')}
                    onDragOver={(e) => handleDragOver(e, 'win-rate')}
                    onDrop={() => handleDrop('win-rate', 'top')}
                    className={`bg-[#171b26] border ${
                      isOver ? 'border-[#00e5ff] shadow-lg shadow-[#00e5ff]/20' : 'border-[#232836]'
                    } ${cornerClass} ${getCardPaddingClass()} flex items-center justify-between relative group transition-all duration-150 ${
                      isDragging ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {/* Hover Drag & Hide Controls */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                      <div
                        className="cursor-grab text-[#787b86] hover:text-white p-0.5"
                        title="Drag to reposition card"
                      >
                        <GripVertical className="w-3 h-3" />
                      </div>
                      <button
                        onClick={(e) => hideSection('win-rate', e)}
                        className="text-[#787b86] hover:text-[#f43f5e] p-0.5"
                        title="Hide section (re-add in Settings)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#848e9c] font-medium tracking-tight">
                        Win %
                      </div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">
                        {stats.winRate}%
                      </div>
                    </div>

                    {/* Circular Arc Ring (Exact from image.png) */}
                    <div className="w-9 h-9 flex items-center justify-center relative">
                      <svg width="36" height="36" className="-rotate-90">
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#232836"
                          strokeWidth="3.5"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#00e5ff"
                          strokeWidth="3.5"
                          strokeDasharray={87.96}
                          strokeDashoffset={87.96 - (stats.winRate / 100) * 87.96}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}

        {/* ROW 2: MAIN WORKSPACE (Resizable Table Split + Right Column Cards) */}
        <div
          ref={containerRef}
          className={`flex-1 flex overflow-hidden ${getGapClass()} relative`}
        >
          {/* MASTER TRADES TABLE (Resizable Width) */}
          {isSecEnabled('trade-log') && (
            <div
              style={{
                width: visibleRightCards.length > 0 ? `${layoutSettings.horizontalSplitRatio * 100}%` : '100%',
              }}
              className={`bg-[#171b26] border border-[#232836] ${tableCornerClass} flex flex-col overflow-hidden shrink-0 transition-all duration-75`}
            >
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-[#141721] sticky top-0 z-10 border-b border-[#232836] text-[#6b7280] font-semibold select-none">
                    <tr className="h-7.5">
                      <th className="py-1 px-2.5 w-7 text-center">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center justify-center text-[#787b86] hover:text-white"
                        >
                          {selectedIds.size === filtered.length && filtered.length > 0 ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#2563eb]" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </th>
                      <th className="py-1 px-1.5 w-5" />
                      <th className="py-1 px-2 text-[10px] uppercase font-bold tracking-wider">STATUS</th>
                      <th className="py-1 px-2 text-[10px] uppercase font-bold tracking-wider">SIDE</th>
                      <th className="py-1 px-2.5 text-[10px] uppercase font-bold tracking-wider">SYMBOL</th>
                      <th className="py-1 px-2.5 text-[10px] uppercase font-bold tracking-wider">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-white">
                          <span>OPEN DATE</span>
                          <ChevronDown className="w-2.5 h-2.5" />
                        </div>
                      </th>
                      <th className="py-1 px-2.5 text-right text-[10px] uppercase font-bold tracking-wider">ENTRY</th>
                      <th className="py-1 px-2.5 text-right text-[10px] uppercase font-bold tracking-wider">SIZE</th>
                      <th className="py-1 px-2.5 text-[10px] uppercase font-bold tracking-wider">CLOSE DATE</th>
                      <th className="py-1 px-2.5 text-right text-[10px] uppercase font-bold tracking-wider">EXIT</th>
                      <th className="py-1 px-2.5 text-right text-[10px] uppercase font-bold tracking-wider">COST</th>
                      <th className="py-1 px-2.5 text-right text-[10px] uppercase font-bold tracking-wider">NET RETURN</th>
                      <th className="py-1 px-2.5 text-right text-[10px] uppercase font-bold tracking-wider">NET RETURN %</th>
                      <th className="py-1 px-2.5 text-[10px] uppercase font-bold tracking-wider">SETUPS</th>
                      <th className="py-1 px-2 text-[10px] uppercase font-bold tracking-wider">NOTE</th>
                      <th className="py-1 px-2 text-[10px] uppercase font-bold tracking-wider">MISTAKES</th>
                      <th className="py-1 px-2 text-center w-7">
                        <button
                          onClick={() => (onOpenSettings ? onOpenSettings() : setIsSettingsModalOpen(true))}
                          className="p-1 text-[#787b86] hover:text-white rounded hover:bg-[#232836] transition cursor-pointer"
                          title="Configure Table & Layout Settings"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2330]">
                    {filtered.map((trade) => {
                      const isSelected = selectedIds.has(trade.id);
                      const isExpanded = expandedId === trade.id;
                      const isWin = trade.status === 'WIN';
                      const isLoss = trade.status === 'LOSS';
                      const isOpen = trade.status === 'OPEN';

                      return (
                        <React.Fragment key={trade.id}>
                          <tr
                            onClick={() => onSelectTrade?.(trade)}
                            className={`h-8 hover:bg-[#1a1f2c] transition group cursor-pointer ${
                              isSelected ? 'bg-[#2962ff]/10' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-1 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleSelect(trade.id)}
                                className="text-[#6b7280] hover:text-white flex items-center justify-center mx-auto"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-3 h-3 text-[#2563eb]" />
                                ) : (
                                  <Square className="w-3 h-3" />
                                )}
                              </button>
                            </td>

                            {/* Expand Row Chevron */}
                            <td className="py-1 px-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                                className="text-[#6b7280] hover:text-white transition"
                              >
                                <ChevronRight
                                  className={`w-3 h-3 transition-transform ${
                                    isExpanded ? 'rotate-90 text-[#00e5ff]' : ''
                                  }`}
                                />
                              </button>
                            </td>

                            {/* STATUS Pill (Exact solid colors from image) */}
                            <td className="py-1 px-2">
                              {isWin && (
                                <span className="px-2 py-0.5 bg-[#00c49f] text-white font-bold rounded text-[10px] inline-block tracking-tight">
                                  WIN
                                </span>
                              )}
                              {isLoss && (
                                <span className="px-2 py-0.5 bg-[#ff4a7d] text-white font-bold rounded text-[10px] inline-block tracking-tight">
                                  LOSS
                                </span>
                              )}
                              {isOpen && (
                                <span className="px-2 py-0.5 bg-[#f59e0b] text-white font-bold rounded text-[10px] inline-block tracking-tight">
                                  OPEN
                                </span>
                              )}
                              {trade.status === 'BE' && (
                                <span className="px-2 py-0.5 bg-[#6b7280] text-white font-bold rounded text-[10px] inline-block tracking-tight">
                                  BE
                                </span>
                              )}
                            </td>

                            {/* SIDE Pill (Outlined dark badge from image) */}
                            <td className="py-1 px-2">
                              {trade.side === 'LONG' ? (
                                <span className="px-2 py-0.5 bg-[#0e2238] border border-[#1e4976] text-[#38bdf8] font-bold rounded text-[10px]">
                                  LONG
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-[#2d1222] border border-[#5d1c3e] text-[#f472b6] font-bold rounded text-[10px]">
                                  SHORT
                                </span>
                              )}
                            </td>

                            {/* SYMBOL (Cyan text from image) */}
                            <td className="py-1 px-2.5 font-mono font-bold text-[#00e5ff]">
                              {trade.symbol}
                            </td>

                            {/* OPEN DATE */}
                            <td className="py-1 px-2.5 text-[#9ca3af] font-mono whitespace-nowrap">
                              {trade.openDate.slice(0, 10)}
                            </td>

                            {/* ENTRY */}
                            <td className="py-1 px-2.5 text-right font-mono text-[#d1d4dc]">
                              {trade.entryPrice.toLocaleString()}
                            </td>

                            {/* SIZE */}
                            <td className="py-1 px-2.5 text-right font-mono text-[#9ca3af]">
                              {trade.size}
                            </td>

                            {/* CLOSE DATE */}
                            <td className="py-1 px-2.5 text-[#9ca3af] font-mono whitespace-nowrap">
                              {trade.closeDate ? trade.closeDate.slice(0, 10) : '—'}
                            </td>

                            {/* EXIT */}
                            <td className="py-1 px-2.5 text-right font-mono text-[#d1d4dc]">
                              {trade.exitPrice !== undefined ? trade.exitPrice.toLocaleString() : '—'}
                            </td>

                            {/* COST */}
                            <td className="py-1 px-2.5 text-right font-mono text-[#9ca3af]">
                              ${trade.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '—'}
                            </td>

                            {/* NET RETURN (Cyan for profit, Pink for loss) */}
                            <td
                              className={`py-1 px-2.5 text-right font-mono font-bold ${
                                trade.netReturn >= 0 ? 'text-[#00e5ff]' : 'text-[#ff4a7d]'
                              }`}
                            >
                              {trade.netReturn >= 0
                                ? `$${trade.netReturn.toFixed(2)}`
                                : `-$${Math.abs(trade.netReturn).toFixed(2)}`}
                            </td>

                            {/* NET RETURN % */}
                            <td
                              className={`py-1 px-2.5 text-right font-mono ${
                                trade.netReturnPercent >= 0 ? 'text-[#00e5ff]' : 'text-[#ff4a7d]'
                              }`}
                            >
                              {trade.netReturnPercent >= 0
                                ? `${trade.netReturnPercent.toFixed(2)}%`
                                : `${trade.netReturnPercent.toFixed(2)}%`}
                            </td>

                            {/* SETUPS (Good Tags - Green) */}
                            <td className="py-1 px-2.5">
                              <div className="flex flex-wrap gap-1">
                                {trade.setups && trade.setups.length > 0 ? (
                                  trade.setups.map((s, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 bg-[#00ffa3]/15 border border-[#00ffa3]/30 text-[#00ffa3] rounded text-[9.5px] font-bold inline-flex items-center gap-0.5"
                                      title={`Good Execution: ${s}`}
                                    >
                                      ✓ {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[#4b5563]">—</span>
                                )}
                              </div>
                            </td>

                            {/* NOTE */}
                            <td className="py-1 px-2 text-[#9ca3af] max-w-xs truncate text-[10px]">
                              {trade.note || ''}
                            </td>

                            {/* MISTAKES (Bad Tags - Red) */}
                            <td className="py-1 px-2">
                              {trade.mistakes && trade.mistakes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {trade.mistakes.map((m, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 bg-[#ff4a7d]/15 border border-[#ff4a7d]/30 text-[#ff808b] rounded text-[9.5px] font-bold inline-flex items-center gap-0.5"
                                      title={`Mistake: ${m}`}
                                    >
                                      ⚠ {m}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#4b5563]">—</span>
                              )}
                            </td>

                            {/* Actions (Edit & Delete) */}
                            <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                {onEditTrade && (
                                  <button
                                    onClick={() => onEditTrade(trade)}
                                    className="text-[#848e9c] hover:text-[#2962ff] p-1 rounded hover:bg-[#232836] transition cursor-pointer"
                                    title="Edit Trade, Good & Bad Tags"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onDeleteTrade(trade.id)}
                                  className="text-[#4b5563] hover:text-[#ff4a7d] p-1 rounded hover:bg-[#232836] transition cursor-pointer"
                                  title="Delete Trade"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Trade Detail Drawer */}
                          {isExpanded && (
                            <tr className="bg-[#131722]/80">
                              <td colSpan={17} className="p-3 border-y border-[#232836]">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                  <div className="bg-[#171b26] p-2.5 rounded border border-[#232836] space-y-1 font-mono">
                                    <div className="text-[10px] text-[#848e9c] font-bold uppercase mb-1">
                                      Risk & Execution Metrics
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#6b7280]">Stop Loss:</span>
                                      <span className="text-white">${trade.stopLoss || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#6b7280]">Take Profit:</span>
                                      <span className="text-white">${trade.takeProfit || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#6b7280]">Planned R:R:</span>
                                      <span className="text-white">{trade.plannedRR ? `1 : ${trade.plannedRR}` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#6b7280]">Realized R:R:</span>
                                      <span className={trade.realizedRR && trade.realizedRR >= 0 ? 'text-[#00e5ff]' : 'text-[#ff4a7d]'}>
                                        {trade.realizedRR ? `1 : ${trade.realizedRR}` : '—'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-[#171b26] p-2.5 rounded border border-[#232836] space-y-1">
                                    <div className="text-[10px] text-[#848e9c] font-bold uppercase mb-1">
                                      Notes & Psychology
                                    </div>
                                    <p className="text-[#d1d4dc] text-[11px] italic leading-relaxed">
                                      {trade.note || 'No notes entered for this trade.'}
                                    </p>
                                    {trade.emotion && (
                                      <div className="pt-1 flex items-center gap-1.5">
                                        <span className="text-[#6b7280] text-[10px]">Mindset:</span>
                                        <span className="px-2 py-0.5 bg-[#2563eb]/20 text-[#38bdf8] rounded text-[10px] font-bold">
                                          {trade.emotion}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="bg-[#171b26] p-2.5 rounded border border-[#232836] space-y-1">
                                    <div className="text-[10px] text-[#848e9c] font-bold uppercase mb-1">
                                      Snapshot & Metadata
                                    </div>
                                    <div className="flex justify-between text-[#9ca3af] font-mono text-[10px]">
                                      <span>Portfolio:</span>
                                      <span className="text-white">{trade.portfolio || 'Main Account'}</span>
                                    </div>
                                    <div className="flex justify-between text-[#9ca3af] font-mono text-[10px]">
                                      <span>Trade ID:</span>
                                      <span className="text-white">{trade.id}</span>
                                    </div>
                                    <div className="mt-2 h-14 bg-[#131722] rounded flex items-center justify-center text-[#6b7280] text-[10px]">
                                      Chart snapshot anchored at execution
                                    </div>
                                    {onEditTrade && (
                                      <div className="pt-2 flex justify-end">
                                        <button
                                          onClick={() => onEditTrade(trade)}
                                          className="px-2.5 py-1 rounded bg-[#2962ff]/20 hover:bg-[#2962ff] text-[#38bdf8] hover:text-white border border-[#2962ff]/40 text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          <span>Edit Trade & Tags</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DRAGGABLE RESIZER SPLITTER (Between Table and Right Analytics Drawer) */}
          {isSecEnabled('trade-log') && visibleRightCards.length > 0 && (
            <div
              onMouseDown={() => setIsResizingSplitter(true)}
              className="w-1.5 hover:w-2 hover:bg-[#2563eb] cursor-col-resize transition-all z-20 flex items-center justify-center group shrink-0 select-none bg-transparent"
              title="Drag horizontally to resize table and right sidebar"
            >
              <div className="w-0.5 h-8 bg-[#2a3142] group-hover:bg-white rounded-full transition" />
            </div>
          )}

          {/* RIGHT COLUMN CARDS (Resizable, Draggable & Reorderable within Grid) */}
          {visibleRightCards.length > 0 && (
            <div
              style={{
                width: isSecEnabled('trade-log')
                  ? `${(1 - layoutSettings.horizontalSplitRatio) * 100}%`
                  : '100%',
              }}
              className={`flex flex-col ${getGapClass()} overflow-y-auto shrink-0`}
            >
              {visibleRightCards.map((cardId) => {
                const isOver = dragOverCardId === cardId;
                const isDragging = draggingCardId === cardId;

                {/* Sub-Card 1: Account Performance */}
                if (cardId === 'account-performance') {
                  return (
                    <div
                      key="account-performance"
                      draggable
                      onDragStart={() => handleDragStart('account-performance')}
                      onDragOver={(e) => handleDragOver(e, 'account-performance')}
                      onDrop={() => handleDrop('account-performance', 'right')}
                      className={`bg-[#171b26] border ${
                        isOver ? 'border-[#00e5ff] shadow-lg shadow-[#00e5ff]/20' : 'border-[#232836]'
                      } ${cornerClass} ${getCardPaddingClass()} relative group transition-all duration-150 shrink-0 ${
                        isDragging ? 'opacity-50' : 'opacity-100'
                      }`}
                    >
                      {/* Drag & Hide Controls */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                        <div className="cursor-grab text-[#787b86] hover:text-white p-0.5">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        <button
                          onClick={(e) => hideSection('account-performance', e)}
                          className="text-[#787b86] hover:text-[#f43f5e] p-0.5"
                          title="Hide section"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-xs font-bold text-white mb-2">Account Performance</div>

                      {/* 3 mini stats row */}
                      <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] mb-2.5">
                        <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                          <div className="text-[#6b7280] text-[9px] uppercase">AVG RETURN</div>
                          <div className="font-bold text-white mt-0.5">${stats.avgWin}</div>
                        </div>
                        <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                          <div className="text-[#6b7280] text-[9px] uppercase">AVG RETURN %</div>
                          <div className="font-bold text-white mt-0.5">+{stats.avgReturnPct}%</div>
                        </div>
                        <div className={`bg-[#131722] p-1.5 ${smCornerClass} border border-[#232836]`}>
                          <div className="text-[#6b7280] text-[9px] uppercase">WIN %</div>
                          <div className="font-bold text-white mt-0.5">{stats.winRate}%</div>
                        </div>
                      </div>

                      {/* Dotted Grid Profit Chart with Glowing Cyan Line (Exact from image.png) */}
                      <div className={`h-28 w-full bg-[#131722] ${innerCornerClass} border border-[#232836] relative overflow-hidden flex items-end p-2`}>
                        {/* Dot pattern background */}
                        <div
                          className="absolute inset-0 opacity-15"
                          style={{
                            backgroundImage: 'radial-gradient(#60a5fa 1px, transparent 1px)',
                            backgroundSize: '10px 10px',
                          }}
                        />

                        {/* Climbing smooth curve */}
                        <svg className="w-full h-full overflow-visible z-10" preserveAspectRatio="none" viewBox="0 0 100 60">
                          <defs>
                            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 0 55 L 12 52 L 20 40 L 28 32 L 40 33 L 48 24 L 60 20 L 72 15 L 85 12 L 100 8"
                            fill="none"
                            stroke="#00e5ff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 0 55 L 12 52 L 20 40 L 28 32 L 40 33 L 48 24 L 60 20 L 72 15 L 85 12 L 100 8 L 100 60 L 0 60 Z"
                            fill="url(#profitGrad)"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                }

                {/* Sub-Card 2: Setups */}
                if (cardId === 'setups-card') {
                  const setupsList = [
                    { name: 'Bounce', val: '$107.30', pct: 20, isWin: true },
                    { name: 'Breakout', val: '-$2,764.26', pct: 60, isWin: false },
                    { name: 'Breakout Day', val: '-$500.13', pct: 30, isWin: false },
                    { name: 'BU-OB', val: '$42.62', pct: 15, isWin: true },
                    { name: 'Bull Move', val: '$133.80', pct: 25, isWin: true },
                    { name: 'Follow KOL', val: '$1,785.36', pct: 45, isWin: true },
                    { name: 'FOMO', val: '$37,614.63', pct: 90, isWin: true },
                  ];

                  return (
                    <div
                      key="setups-card"
                      draggable
                      onDragStart={() => handleDragStart('setups-card')}
                      onDragOver={(e) => handleDragOver(e, 'setups-card')}
                      onDrop={() => handleDrop('setups-card', 'right')}
                      className={`bg-[#171b26] border ${
                        isOver ? 'border-[#00e5ff] shadow-lg shadow-[#00e5ff]/20' : 'border-[#232836]'
                      } ${cornerClass} ${getCardPaddingClass()} relative group transition-all duration-150 shrink-0 ${
                        isDragging ? 'opacity-50' : 'opacity-100'
                      }`}
                    >
                      {/* Drag & Hide Controls */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                        <div className="cursor-grab text-[#787b86] hover:text-white p-0.5">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        <button
                          onClick={(e) => hideSection('setups-card', e)}
                          className="text-[#787b86] hover:text-[#f43f5e] p-0.5"
                          title="Hide section"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-xs font-bold text-white mb-2">Setups</div>

                      <div className="space-y-1.5 text-[11px] font-mono">
                        {setupsList.map((item, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[#d1d4dc]">{item.name}</span>
                              <span className={item.isWin ? 'text-[#00ffa3] font-bold' : 'text-[#ff4a7d] font-bold'}>
                                {item.val}
                              </span>
                            </div>
                            <div className={`h-1 w-full bg-[#131722] ${barCornerClass} overflow-hidden`}>
                              <div
                                className={`h-full ${barCornerClass} ${item.isWin ? 'bg-[#00ffa3]' : 'bg-[#ff4a7d]'}`}
                                style={{ width: `${item.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Card Footer: View Report & Pagination */}
                      <div className="mt-3 pt-2 border-t border-[#232836] flex items-center justify-between text-[10px] text-[#6b7280]">
                        <button className="text-[#a6adb9] hover:text-white transition">
                          View Report
                        </button>
                        <div className="flex items-center gap-1">
                          <span>{setupsPage} of 5</span>
                          <button
                            onClick={() => setSetupsPage((p) => Math.max(1, p - 1))}
                            className="p-0.5 hover:text-white"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setSetupsPage((p) => Math.min(5, p + 1))}
                            className="p-0.5 hover:text-white"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                {/* Sub-Card 3: Mistakes */}
                if (cardId === 'mistakes-card') {
                  const mistakesList = [
                    { name: 'didnt set up stop loss', val: '$2,663.20', pct: 35, isWin: true },
                    { name: 'fomo', val: '$5,367.48', pct: 55, isWin: true },
                    { name: 'Greed', val: '-$192.59', pct: 15, isWin: false },
                    { name: 'Market crash', val: '$25,559.71', pct: 85, isWin: true },
                    { name: 'News', val: '-$214.66', pct: 20, isWin: false },
                    { name: 'No Move', val: '-$420.15', pct: 25, isWin: false },
                    { name: 'No Setup', val: '-$574.26', pct: 30, isWin: false },
                  ];

                  return (
                    <div
                      key="mistakes-card"
                      draggable
                      onDragStart={() => handleDragStart('mistakes-card')}
                      onDragOver={(e) => handleDragOver(e, 'mistakes-card')}
                      onDrop={() => handleDrop('mistakes-card', 'right')}
                      className={`bg-[#171b26] border ${
                        isOver ? 'border-[#00e5ff] shadow-lg shadow-[#00e5ff]/20' : 'border-[#232836]'
                      } ${cornerClass} ${getCardPaddingClass()} relative group transition-all duration-150 shrink-0 ${
                        isDragging ? 'opacity-50' : 'opacity-100'
                      }`}
                    >
                      {/* Drag & Hide Controls */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                        <div className="cursor-grab text-[#787b86] hover:text-white p-0.5">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        <button
                          onClick={(e) => hideSection('mistakes-card', e)}
                          className="text-[#787b86] hover:text-[#f43f5e] p-0.5"
                          title="Hide section"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-xs font-bold text-white mb-2">Mistakes</div>

                      <div className="space-y-1.5 text-[11px] font-mono">
                        {mistakesList.map((item, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[#d1d4dc]">{item.name}</span>
                              <span className={item.isWin ? 'text-[#00ffa3] font-bold' : 'text-[#ff4a7d] font-bold'}>
                                {item.val}
                              </span>
                            </div>
                            <div className={`h-1 w-full bg-[#131722] ${barCornerClass} overflow-hidden`}>
                              <div
                                className={`h-full ${barCornerClass} ${item.isWin ? 'bg-[#00ffa3]' : 'bg-[#ff4a7d]'}`}
                                style={{ width: `${item.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Card Footer: View Report & Pagination */}
                      <div className="mt-3 pt-2 border-t border-[#232836] flex items-center justify-between text-[10px] text-[#6b7280]">
                        <button className="text-[#a6adb9] hover:text-white transition">
                          View Report
                        </button>
                        <div className="flex items-center gap-1">
                          <span>{mistakesPage} of 3</span>
                          <button
                            onClick={() => setMistakesPage((p) => Math.max(1, p - 1))}
                            className="p-0.5 hover:text-white"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setMistakesPage((p) => Math.min(3, p + 1))}
                            className="p-0.5 hover:text-white"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: BOTTOM SCRUBBER & TIMELINE STATUS BAR (Exact match to image.png) */}
      <div className="bg-[#131722] border-t border-[#232836] px-4 py-2 flex items-center justify-between text-[11px] font-mono text-[#848e9c] shrink-0 relative z-10">
        {/* Left: Trades count */}
        <div className="flex items-center gap-2">
          <span>Trades:</span>
          <span className="text-white font-bold">{filtered.length}/{trades.length}</span>
        </div>

        {/* Center: Interactive Scrubber Slider Track */}
        <div className="flex-1 max-w-xl mx-6 flex items-center relative">
          <input
            type="range"
            min="0"
            max="100"
            value={scrubberPosition}
            onChange={(e) => setScrubberPosition(Number(e.target.value))}
            className="w-full h-1 bg-[#232836] rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
          />
        </div>

        {/* Right: Net Return Summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>Return:</span>
            <span className="text-[#00ffa3] font-bold text-xs">
              ${stats.totalNetReturn >= 0 ? stats.totalNetReturn.toLocaleString('en-US', { minimumFractionDigits: 2 }) : `-${Math.abs(stats.totalNetReturn).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </span>
          </div>

          {/* Floating Chat Bubble Icon (Exact green circular icon from image) */}
          <div
            className="w-7 h-7 rounded-full bg-[#00c49f] hover:bg-[#00b290] text-white flex items-center justify-center cursor-pointer shadow-md transition"
            title="Chat with Trade Assistant"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
          </div>
        </div>
      </div>

      {/* Grid Settings Modal (Corner styles, Spacing, Enable/Disable Sections) */}
      {!onOpenSettings && (
        <JournalGridSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={layoutSettings}
          onUpdateSettings={updateLayoutSettings}
          onResetSettings={resetLayoutSettings}
        />
      )}
    </div>
  );
};
