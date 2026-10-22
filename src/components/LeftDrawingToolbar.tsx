import React, { useState, useEffect, useRef } from 'react';
import { DrawingToolType } from '../types';
import {
  Crosshair,
  GitCommit,
  Brush,
  Type,
  Ruler,
  ZoomIn,
  Magnet,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Star,
  PenTool,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface LeftDrawingToolbarProps {
  activeTool: DrawingToolType;
  setActiveTool: (tool: DrawingToolType) => void;
  isMagnetMode: boolean;
  setIsMagnetMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  areDrawingsHidden: boolean;
  setAreDrawingsHidden: (val: boolean | ((prev: boolean) => boolean)) => void;
  onClearDrawings: () => void;
  currentColor: string;
  setCurrentColor: (color: string) => void;
  isLocked?: boolean;
  setIsLocked?: (locked: boolean | ((prev: boolean) => boolean)) => void;
}

export interface LineToolDef {
  id: DrawingToolType;
  label: string;
  shortcut?: string;
  category: 'LINES' | 'CHANNELS' | 'PITCHFORKS';
  icon: React.ReactNode;
}

export const LINE_TOOLS_CATALOG: LineToolDef[] = [
  // LINES
  {
    id: 'trendline',
    label: 'Trendline',
    shortcut: 'Alt + T',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="4" cy="20" r="2.5" />
        <circle cx="20" cy="4" r="2.5" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </svg>
    ),
  },
  {
    id: 'ray',
    label: 'Ray',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="4" cy="20" r="2.5" />
        <line x1="6" y1="18" x2="22" y2="2" />
      </svg>
    ),
  },
  {
    id: 'info_line',
    label: 'Info line',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="4" cy="20" r="2" />
        <circle cx="20" cy="4" r="2" />
        <line x1="6" y1="18" x2="18" y2="6" />
        <rect x="7" y="11" width="7" height="6" rx="1" fill="currentColor" fillOpacity="0.25" />
      </svg>
    ),
  },
  {
    id: 'extended_line',
    label: 'Extended line',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="16" r="2" />
        <circle cx="16" cy="8" r="2" />
        <line x1="2" y1="22" x2="22" y2="2" />
      </svg>
    ),
  },
  {
    id: 'trend_angle',
    label: 'Trend angle',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="20" x2="21" y2="20" />
        <line x1="3" y1="20" x2="19" y2="4" />
        <path d="M 10 20 A 7 7 0 0 0 8 15" />
      </svg>
    ),
  },
  {
    id: 'horizontal',
    label: 'Horizontal line',
    shortcut: 'Alt + H',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="2.5" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    id: 'horizontal_ray',
    label: 'Horizontal ray',
    shortcut: 'Alt + J',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="4" cy="12" r="2.5" />
        <line x1="6.5" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    id: 'vertical',
    label: 'Vertical line',
    shortcut: 'Alt + V',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="2.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    id: 'crossline',
    label: 'Crossline',
    shortcut: 'Alt + C',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="2" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    id: 'bendline',
    label: 'Bendline',
    category: 'LINES',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="4" cy="18" r="2.5" />
        <circle cx="20" cy="18" r="2.5" />
        <path d="M 6 17 Q 12 4 18 17" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="10.5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },

  // CHANNELS
  {
    id: 'parallel_channel',
    label: 'Parallel channel',
    category: 'CHANNELS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="4" cy="16" r="1.5" />
        <circle cx="17" cy="3" r="1.5" />
        <line x1="5.5" y1="14.5" x2="15.5" y2="4.5" />
        <line x1="8.5" y1="19.5" x2="20.5" y2="7.5" />
        <line x1="7" y1="17" x2="18" y2="6" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    id: 'regression_trend',
    label: 'Regression trend',
    category: 'CHANNELS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="3,11 21,3 21,21 3,21" fill="currentColor" fillOpacity="0.15" stroke="none" />
        <line x1="3" y1="16" x2="21" y2="8" strokeWidth="2" />
        <line x1="3" y1="11" x2="21" y2="3" strokeDasharray="2 2" />
        <line x1="3" y1="21" x2="21" y2="13" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    id: 'flat_top_bottom',
    label: 'Flat top/bottom',
    category: 'CHANNELS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="4" y1="19" x2="21" y2="10" />
        <circle cx="4" cy="19" r="1.5" />
        <circle cx="21" cy="6" r="1.5" />
      </svg>
    ),
  },
  {
    id: 'disjoint_channel',
    label: 'Disjoint channel',
    category: 'CHANNELS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="10" x2="20" y2="4" />
        <line x1="4" y1="14" x2="20" y2="20" />
        <circle cx="4" cy="10" r="1.5" />
        <circle cx="4" cy="14" r="1.5" />
      </svg>
    ),
  },

  // PITCHFORKS
  {
    id: 'pitchfork',
    label: 'Pitchfork',
    category: 'PITCHFORKS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="4" cy="12" r="1.8" />
        <circle cx="11" cy="5" r="1.8" />
        <circle cx="11" cy="19" r="1.8" />
        <line x1="5.8" y1="12" x2="22" y2="12" />
        <line x1="12.8" y1="5" x2="22" y2="5" />
        <line x1="12.8" y1="19" x2="22" y2="19" />
        <line x1="11" y1="5" x2="11" y2="19" />
      </svg>
    ),
  },
  {
    id: 'schiff_pitchfork',
    label: 'Schiff pitchfork',
    category: 'PITCHFORKS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="4" cy="15.5" r="1.8" />
        <circle cx="11" cy="5" r="1.8" />
        <circle cx="11" cy="19" r="1.8" />
        <line x1="5.8" y1="15" x2="22" y2="10" />
        <line x1="12.8" y1="5" x2="22" y2="3" />
        <line x1="12.8" y1="19" x2="22" y2="17" />
        <line x1="11" y1="5" x2="11" y2="19" />
      </svg>
    ),
  },
  {
    id: 'modified_schiff_pitchfork',
    label: 'Modified Schiff pitchfork',
    category: 'PITCHFORKS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="7.5" cy="15.5" r="1.8" />
        <circle cx="11" cy="5" r="1.8" />
        <circle cx="11" cy="19" r="1.8" />
        <line x1="9" y1="14" x2="22" y2="10" />
        <line x1="12.8" y1="5" x2="22" y2="3" />
        <line x1="12.8" y1="19" x2="22" y2="17" />
        <line x1="11" y1="5" x2="11" y2="19" />
      </svg>
    ),
  },
  {
    id: 'inside_pitchfork',
    label: 'Inside pitchfork',
    category: 'PITCHFORKS',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="12" r="1.8" />
        <circle cx="5" cy="6" r="1.8" />
        <circle cx="5" cy="18" r="1.8" />
        <line x1="12.8" y1="12" x2="22" y2="12" />
        <line x1="6.8" y1="6" x2="22" y2="6" />
        <line x1="6.8" y1="18" x2="22" y2="18" />
        <line x1="5" y1="6" x2="5" y2="18" />
      </svg>
    ),
  },
];

export const LeftDrawingToolbar: React.FC<LeftDrawingToolbarProps> = React.memo(({
  activeTool,
  setActiveTool,
  isMagnetMode,
  setIsMagnetMode,
  areDrawingsHidden,
  setAreDrawingsHidden,
  onClearDrawings,
  currentColor,
  setCurrentColor,
  isLocked = false,
  setIsLocked,
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isLineMenuOpen, setIsLineMenuOpen] = useState(false);
  const lineMenuRef = useRef<HTMLDivElement>(null);
  const lineBtnRef = useRef<HTMLDivElement>(null);

  // Remember active tool selected within the line group
  const [selectedLineTool, setSelectedLineTool] = useState<DrawingToolType>(() => {
    const saved = localStorage.getItem('tv_selected_line_tool');
    return (saved as DrawingToolType) || 'trendline';
  });

  // Starred tools in the line dropdown (matches TradingView screenshot favorites like Ray and Parallel Channel)
  const [starredTools, setStarredTools] = useState<string[]>(() => {
    const saved = localStorage.getItem('tv_starred_drawing_tools');
    return saved ? JSON.parse(saved) : ['ray', 'parallel_channel'];
  });

  const [lockedState, setLockedState] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_drawing_locked');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('tv_drawing_stay_mode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('tv_drawing_locked', JSON.stringify(lockedState));
  }, [lockedState]);

  useEffect(() => {
    localStorage.setItem('tv_drawing_stay_mode', JSON.stringify(stayInDrawingMode));
  }, [stayInDrawingMode]);

  useEffect(() => {
    localStorage.setItem('tv_starred_drawing_tools', JSON.stringify(starredTools));
  }, [starredTools]);

  useEffect(() => {
    localStorage.setItem('tv_selected_line_tool', selectedLineTool);
  }, [selectedLineTool]);

  // Click outside to close line tools flyout menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isLineMenuOpen &&
        lineMenuRef.current &&
        !lineMenuRef.current.contains(e.target as Node) &&
        lineBtnRef.current &&
        !lineBtnRef.current.contains(e.target as Node)
      ) {
        setIsLineMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isLineMenuOpen]);

  const toggleStar = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const isCurrentActiveInLineGroup = LINE_TOOLS_CATALOG.some((t) => t.id === activeTool);
  const activeLineToolDef =
    LINE_TOOLS_CATALOG.find((t) => t.id === activeTool) ||
    LINE_TOOLS_CATALOG.find((t) => t.id === selectedLineTool) ||
    LINE_TOOLS_CATALOG[0];

  const colors = [
    '#2962ff', // blue
    '#089981', // green
    '#f23645', // red
    '#ff9800', // orange
    '#e040fb', // purple
    '#d1d4dc', // white
  ];

  const otherTools: { id: DrawingToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'fibonacci', label: 'Gann & Fibonacci Tools', icon: <GitCommit className="w-3.5 h-3.5" /> },
    { id: 'rectangle', label: 'Geometric Shapes & Brush', icon: <Brush className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text & Annotation Tools', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'measure', label: 'Measure Tool', icon: <Ruler className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside
      id="tradingview-left-toolbar"
      className="w-[32px] bg-[#131722] border-r border-[#2a2e39] py-1 px-[2px] flex flex-col items-center justify-between select-none shrink-0 z-30 overflow-visible"
    >
      {/* Top Main Tools */}
      <div className="flex flex-col items-center gap-1 w-full relative">
        {/* 1. Crosshair / Cursor */}
        <button
          id="left-tool-crosshair"
          onClick={() => setActiveTool('crosshair')}
          className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors relative group cursor-pointer ${
            activeTool === 'crosshair' || activeTool === 'cursor'
              ? 'bg-[#2962ff] text-white shadow-xs'
              : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title="Crosshair"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition z-50">
            Crosshair
          </div>
        </button>

        {/* 2. LINES / CHANNELS / PITCHFORKS TOOLBAR BUTTON & FLYOUT MENU */}
        <div ref={lineBtnRef} className="relative w-full flex justify-center">
          <button
            id="left-tool-line-group"
            onClick={() => {
              setActiveTool(activeLineToolDef.id);
              setSelectedLineTool(activeLineToolDef.id);
              setIsLineMenuOpen((prev) => !prev);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsLineMenuOpen(true);
            }}
            className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors relative group cursor-pointer ${
              isCurrentActiveInLineGroup
                ? 'bg-[#2962ff] text-white shadow-xs'
                : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
            }`}
            title={activeLineToolDef.label}
          >
            {/* Centered main icon */}
            <div className="flex items-center justify-center pointer-events-none">
              {activeLineToolDef.icon}
            </div>

            {/* TradingView Expand / Collapse Chevron (appears ONLY on hover when closed, stays visible when open) */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setIsLineMenuOpen((prev) => !prev);
              }}
              className={`absolute right-0 bottom-0 top-0 flex items-center pr-[1px] transition-opacity cursor-pointer ${
                isLineMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              } hover:text-white`}
              title={isLineMenuOpen ? 'Collapse menu' : 'Expand line tools'}
            >
              <ChevronRight className={`w-2.5 h-2.5 transition-transform duration-150 ${isLineMenuOpen ? 'rotate-180 text-white' : ''}`} />
            </span>

            {/* Hover Tooltip when flyout closed */}
            {!isLineMenuOpen && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition z-50">
                {activeLineToolDef.label}
              </div>
            )}
          </button>

          {/* TRADINGVIEW FLYOUT DROPDOWN MENU - Visible box matching image.png */}
          {isLineMenuOpen && (
            <div
              ref={lineMenuRef}
              id="tradingview-lines-flyout-menu"
              className="absolute left-[30px] top-[-4px] bg-[#1e222d] border border-[#2a2e39] rounded shadow-2xl py-1.5 w-[260px] max-h-[calc(100vh-60px)] overflow-y-auto text-[#d1d4dc] text-xs z-50 select-none divide-y divide-[#2a2e39]/80 scrollbar-thin"
            >
              {/* SECTION 1: LINES */}
              <div className="pb-1">
                <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  LINES
                </div>
                {LINE_TOOLS_CATALOG.filter((t) => t.category === 'LINES').map((tool) => {
                  const isStarred = starredTools.includes(tool.id);
                  const isToolActive = activeTool === tool.id;
                  return (
                    <div
                      key={tool.id}
                      id={`line-flyout-${tool.id}`}
                      onClick={() => {
                        setActiveTool(tool.id);
                        setSelectedLineTool(tool.id);
                        setIsLineMenuOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] cursor-pointer transition group ${
                        isToolActive ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'text-[#d1d4dc]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`${isToolActive ? 'text-[#2962ff]' : 'text-[#787b86] group-hover:text-white'}`}>
                          {tool.icon}
                        </span>
                        <span className="truncate font-normal group-hover:text-white">
                          {tool.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {tool.shortcut && (
                          <span className="text-[10px] font-mono text-[#787b86]">{tool.shortcut}</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => toggleStar(tool.id, e)}
                          className="p-0.5 hover:text-[#f7a600] transition cursor-pointer"
                          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isStarred
                                ? 'fill-[#f7a600] text-[#f7a600]'
                                : 'text-[#787b86] opacity-0 group-hover:opacity-100 hover:text-[#f7a600]'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SECTION 2: CHANNELS */}
              <div className="py-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  CHANNELS
                </div>
                {LINE_TOOLS_CATALOG.filter((t) => t.category === 'CHANNELS').map((tool) => {
                  const isStarred = starredTools.includes(tool.id);
                  const isToolActive = activeTool === tool.id;
                  return (
                    <div
                      key={tool.id}
                      id={`channel-flyout-${tool.id}`}
                      onClick={() => {
                        setActiveTool(tool.id);
                        setSelectedLineTool(tool.id);
                        setIsLineMenuOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] cursor-pointer transition group ${
                        isToolActive ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'text-[#d1d4dc]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`${isToolActive ? 'text-[#2962ff]' : 'text-[#787b86] group-hover:text-white'}`}>
                          {tool.icon}
                        </span>
                        <span className="truncate font-normal group-hover:text-white">
                          {tool.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {tool.shortcut && (
                          <span className="text-[10px] font-mono text-[#787b86]">{tool.shortcut}</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => toggleStar(tool.id, e)}
                          className="p-0.5 hover:text-[#f7a600] transition cursor-pointer"
                          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isStarred
                                ? 'fill-[#f7a600] text-[#f7a600]'
                                : 'text-[#787b86] opacity-0 group-hover:opacity-100 hover:text-[#f7a600]'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SECTION 3: PITCHFORKS */}
              <div className="pt-1 pb-0.5">
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  PITCHFORKS
                </div>
                {LINE_TOOLS_CATALOG.filter((t) => t.category === 'PITCHFORKS').map((tool) => {
                  const isStarred = starredTools.includes(tool.id);
                  const isToolActive = activeTool === tool.id;
                  return (
                    <div
                      key={tool.id}
                      id={`pitchfork-flyout-${tool.id}`}
                      onClick={() => {
                        setActiveTool(tool.id);
                        setSelectedLineTool(tool.id);
                        setIsLineMenuOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] cursor-pointer transition group ${
                        isToolActive ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'text-[#d1d4dc]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`${isToolActive ? 'text-[#2962ff]' : 'text-[#787b86] group-hover:text-white'}`}>
                          {tool.icon}
                        </span>
                        <span className="truncate font-normal group-hover:text-white">
                          {tool.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {tool.shortcut && (
                          <span className="text-[10px] font-mono text-[#787b86]">{tool.shortcut}</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => toggleStar(tool.id, e)}
                          className="p-0.5 hover:text-[#f7a600] transition cursor-pointer"
                          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isStarred
                                ? 'fill-[#f7a600] text-[#f7a600]'
                                : 'text-[#787b86] opacity-0 group-hover:opacity-100 hover:text-[#f7a600]'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. Fibonacci, Rectangle, Text, Measure Tools */}
        {otherTools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              id={`left-tool-${tool.id}`}
              onClick={() => setActiveTool(tool.id)}
              className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors relative group cursor-pointer ${
                isActive
                  ? 'bg-[#2962ff] text-white shadow-xs'
                  : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
              }`}
              title={tool.label}
            >
              {tool.icon}

              {/* Hover Tooltip on Right */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition z-50">
                {tool.label}
              </div>
            </button>
          );
        })}

        {/* Zoom Tool */}
        <button
          className="w-[26px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-px bg-[#2a2e39] my-0.5" />

        {/* Magnet Mode Toggle */}
        <button
          id="magnet-mode-toggle-btn"
          onClick={() => setIsMagnetMode((prev) => !prev)}
          className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors relative group cursor-pointer ${
            isMagnetMode
              ? 'bg-[#2962ff] text-white shadow-xs'
              : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title={isMagnetMode ? 'Magnet Mode: Enabled' : 'Magnet Mode: Disabled'}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>

        {/* Stay in Drawing Mode */}
        <button
          onClick={() => setStayInDrawingMode(!stayInDrawingMode)}
          className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            stayInDrawingMode
              ? 'bg-[#2962ff] text-white shadow-xs'
              : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title="Stay in Drawing Mode"
        >
          <PenTool className="w-3.5 h-3.5" />
        </button>

        {/* Lock All Drawings */}
        <button
          onClick={() => {
            const next = !lockedState;
            setLockedState(next);
            setIsLocked?.(next);
          }}
          className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            lockedState
              ? 'bg-[#ff9800] text-white shadow-xs'
              : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title={lockedState ? 'Unlock All Drawings' : 'Lock All Drawings'}
        >
          <Lock className="w-3.5 h-3.5" />
        </button>

        {/* Hide / Show All Drawings */}
        <button
          id="hide-drawings-toggle-btn"
          onClick={() => setAreDrawingsHidden((prev) => !prev)}
          className={`w-[26px] h-[24px] rounded-md flex items-center justify-center transition-colors relative group cursor-pointer ${
            areDrawingsHidden
              ? 'text-[#f23645] bg-[#f23645]/15'
              : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title={areDrawingsHidden ? 'Show Drawings' : 'Hide All Drawings'}
        >
          {areDrawingsHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Clear All Drawings (Trash Can) */}
        <button
          id="clear-all-drawings-btn"
          onClick={onClearDrawings}
          className="w-[26px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#f23645] hover:bg-[#1e222d] transition-colors cursor-pointer"
          title="Remove All Drawings"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Color Picker for active drawing tool */}
        <div className="relative">
          <button
            id="color-picker-trigger-btn"
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            className="w-[26px] h-[24px] rounded-md flex items-center justify-center hover:bg-[#1e222d] transition-colors cursor-pointer"
            title="Drawing Color"
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-[#2a2e39] inline-block transition-transform hover:scale-110"
              style={{ backgroundColor: currentColor }}
            />
          </button>
          {isColorPickerOpen && (
            <div className="absolute left-full ml-2 top-0 bg-[#1e222d] border border-[#2a2e39] rounded-lg p-1.5 shadow-2xl flex flex-col gap-1 z-50">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCurrentColor(c);
                    setIsColorPickerOpen(false);
                  }}
                  className="w-4 h-4 rounded-full border border-[#2a2e39] transition hover:scale-125 cursor-pointer"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Favorites Star Button directly beneath buttons */}
      <div className="w-full flex justify-center pt-1 border-t border-[#2a2e39]/60 mt-1">
        <button
          onClick={() => setIsLineMenuOpen((prev) => !prev)}
          className={`w-[26px] h-[24px] rounded-md border border-[#2a2e39] bg-[#1e222d] flex items-center justify-center transition-colors cursor-pointer ${
            starredTools.length > 0 ? 'text-[#ffb74d] hover:border-[#ffb74d]' : 'text-[#787b86] hover:text-[#d1d4dc]'
          }`}
          title={`Favorite Tools (${starredTools.length})`}
        >
          <Star className={`w-3.5 h-3.5 ${starredTools.length > 0 ? 'fill-[#ffb74d]' : ''}`} />
        </button>
      </div>
    </aside>
  );
});

LeftDrawingToolbar.displayName = 'LeftDrawingToolbar';
