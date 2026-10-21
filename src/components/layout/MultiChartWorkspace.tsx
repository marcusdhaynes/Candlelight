import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Asset,
  ChartType,
  Drawing,
  DrawingToolType,
  IndicatorSettings,
  OHLCV,
  PaperPosition,
  Timeframe,
  DependencyContext,
} from '../../types';
import {
  LayoutTemplate,
  LayoutSyncSettings,
  ChartWindowState,
  LayoutBox,
} from '../../types/layout';
import { MainChart, MainChartRef } from '../MainChart';
import { fetchHistoricalData } from '../../services/dataFeed';
import { Maximize2, Minimize2, ChevronDown, Check, RotateCcw, Columns } from 'lucide-react';

interface MultiChartWorkspaceProps {
  template: LayoutTemplate;
  syncSettings: LayoutSyncSettings;
  activeAsset: Asset;
  setActiveAsset: (asset: Asset) => void;
  activeTimeframe: Timeframe;
  setActiveTimeframe: (tf: Timeframe) => void;
  chartType: ChartType;
  primaryCandles: OHLCV[];
  indicators: IndicatorSettings;
  activeTool: DrawingToolType;
  setActiveTool: (tool: DrawingToolType) => void;
  drawings: Drawing[];
  setDrawings: React.Dispatch<React.SetStateAction<Drawing[]>>;
  isMagnetMode: boolean;
  areDrawingsHidden: boolean;
  currentColor: string;
  isLogScale: boolean;
  isPercentScale: boolean;
  openPosition?: PaperPosition | null;
  onClosePosition?: (id: string) => void;
  allAssets: Asset[];
  windowStates: ChartWindowState[];
  onUpdateWindowStates: (states: ChartWindowState[]) => void;
  activeWindowIndex: number;
  setActiveWindowIndex: (index: number) => void;
  splitSizes?: number[];
  onUpdateSplitSizes?: (splits: number[]) => void;
  onOpenConditionalOrder?: (dep: DependencyContext) => void;
}

type CustomDragHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface CustomDragState {
  boxIndex: number;
  handle: CustomDragHandle;
  initialBoxes: LayoutBox[];
}

function updateCustomBoxes(
  boxIndex: number,
  handle: CustomDragHandle,
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  initialBoxes: LayoutBox[],
  snapStep: number = 0.5
): LayoutBox[] {
  const rawX = ((clientX - containerRect.left) / containerRect.width) * 100;
  const rawY = ((clientY - containerRect.top) / containerRect.height) * 100;

  const snappedX = Number((Math.round(rawX / snapStep) * snapStep).toFixed(2));
  const snappedY = Number((Math.round(rawY / snapStep) * snapStep).toFixed(2));

  const newBoxes = initialBoxes.map((b) => ({ ...b }));
  const target = { ...initialBoxes[boxIndex] };
  const minSize = Math.max(snapStep * 2, 3);

  // 1. HORIZONTAL ADJUSTMENTS
  if (handle === 'e' || handle === 'se' || handle === 'ne') {
    const oldRight = target.x + target.w;
    const newRight = Math.max(target.x + minSize, Math.min(100, snappedX));
    target.w = Number((newRight - target.x).toFixed(2));

    // Refit adjacent boxes that share this vertical boundary
    for (let j = 0; j < newBoxes.length; j++) {
      if (j === boxIndex) continue;
      const b = initialBoxes[j];
      if (Math.abs(b.x - oldRight) < 0.5) {
        const bOldRight = b.x + b.w;
        const bNewLeft = newRight;
        const bNewW = Math.max(minSize, Number((bOldRight - bNewLeft).toFixed(2)));
        newBoxes[j] = { ...newBoxes[j], x: bNewLeft, w: bNewW };
      }
    }
  } else if (handle === 'w' || handle === 'sw' || handle === 'nw') {
    const oldLeft = target.x;
    const newLeft = Math.max(0, Math.min(target.x + target.w - minSize, snappedX));
    target.w = Number((target.x + target.w - newLeft).toFixed(2));
    target.x = newLeft;

    // Refit adjacent boxes that share this vertical boundary
    for (let j = 0; j < newBoxes.length; j++) {
      if (j === boxIndex) continue;
      const b = initialBoxes[j];
      if (Math.abs(b.x + b.w - oldLeft) < 0.5) {
        const bNewW = Math.max(minSize, Number((newLeft - b.x).toFixed(2)));
        newBoxes[j] = { ...newBoxes[j], w: bNewW };
      }
    }
  }

  // 2. VERTICAL ADJUSTMENTS
  if (handle === 's' || handle === 'se' || handle === 'sw') {
    const oldBottom = target.y + target.h;
    const newBottom = Math.max(target.y + minSize, Math.min(100, snappedY));
    target.h = Number((newBottom - target.y).toFixed(2));

    // Refit adjacent boxes that share this horizontal boundary
    for (let j = 0; j < newBoxes.length; j++) {
      if (j === boxIndex) continue;
      const b = initialBoxes[j];
      if (Math.abs(b.y - oldBottom) < 0.5) {
        const bOldBottom = b.y + b.h;
        const bNewTop = newBottom;
        const bNewH = Math.max(minSize, Number((bOldBottom - bNewTop).toFixed(2)));
        newBoxes[j] = { ...newBoxes[j], y: bNewTop, h: bNewH };
      }
    }
  } else if (handle === 'n' || handle === 'ne' || handle === 'nw') {
    const oldTop = target.y;
    const newTop = Math.max(0, Math.min(target.y + target.h - minSize, snappedY));
    target.h = Number((target.y + target.h - newTop).toFixed(2));
    target.y = newTop;

    // Refit adjacent boxes that share this horizontal boundary
    for (let j = 0; j < newBoxes.length; j++) {
      if (j === boxIndex) continue;
      const b = initialBoxes[j];
      if (Math.abs(b.y + b.h - oldTop) < 0.5) {
        const bNewH = Math.max(minSize, Number((newTop - b.y).toFixed(2)));
        newBoxes[j] = { ...newBoxes[j], h: bNewH };
      }
    }
  }

  newBoxes[boxIndex] = target;
  return newBoxes;
}

export const MultiChartWorkspace = forwardRef<MainChartRef, MultiChartWorkspaceProps>(
  (
    {
      template,
      syncSettings,
      activeAsset,
      setActiveAsset,
      activeTimeframe,
      setActiveTimeframe,
      chartType,
      primaryCandles,
      indicators,
      activeTool,
      setActiveTool,
      drawings,
      setDrawings,
      isMagnetMode,
      areDrawingsHidden,
      currentColor,
      isLogScale,
      isPercentScale,
      openPosition,
      onClosePosition,
      allAssets,
      windowStates,
      onUpdateWindowStates,
      activeWindowIndex,
      setActiveWindowIndex,
      splitSizes,
      onUpdateSplitSizes,
      onOpenConditionalOrder,
    },
    ref
  ) => {
    // Primary active chart ref
    const chartRefs = useRef<Map<number, MainChartRef>>(new Map());

    // Single pane maximized state
    const [maximizedPaneIndex, setMaximizedPaneIndex] = useState<number | null>(null);

    // Draggable split positions (percentages 0..100)
    const [splits, setSplits] = useState<number[]>(() => {
      if (splitSizes && splitSizes.length > 0) return splitSizes;
      return [50, 50];
    });

    // Secondary inner splits (e.g. for right side in 1-left, 2-right)
    const [innerSplits, setInnerSplits] = useState<number[]>([50, 50]);

    // Custom Grid state for freeform resizing on grid
    const [snapStep, setSnapStep] = useState<number>(0.5); // fine 0.5% snap step (200 snap points)
    const [customGridBoxes, setCustomGridBoxes] = useState<LayoutBox[]>(() => {
      if (template.isCustomGrid || template.type === 'custom-grid') {
        const saved = localStorage.getItem(`tv_custom_boxes_${template.rowCategory}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length === template.count) return parsed;
          } catch {}
        }
      }
      return template.boxes.map((b) => ({ ...b }));
    });
    const latestBoxesRef = useRef(customGridBoxes);
    latestBoxesRef.current = customGridBoxes;

    const [activeDragInfo, setActiveDragInfo] = useState<{
      boxIndex: number;
      handle: CustomDragHandle;
      width: number;
      height: number;
    } | null>(null);
    const customDragRef = useRef<CustomDragState | null>(null);

    // Synchronize custom boxes when template switches
    useEffect(() => {
      if (template.isCustomGrid || template.type === 'custom-grid') {
        const saved = localStorage.getItem(`tv_custom_boxes_${template.rowCategory}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length === template.count) {
              setCustomGridBoxes(parsed);
              return;
            }
          } catch {}
        }
        setCustomGridBoxes(template.boxes.map((b) => ({ ...b })));
      }
    }, [template.id, template.count, template.rowCategory]);

    // Independent candle cache for multi-window setups with different symbols or timeframes
    const [windowCandles, setWindowCandles] = useState<Record<string, OHLCV[]>>({});
    const inFlightRequestsRef = useRef<Set<string>>(new Set());

    // Track dragging divider
    const containerRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef<{
      type: 'col' | 'row' | 'inner-col' | 'inner-row';
      index: number;
      startX: number;
      startY: number;
      startSplits: number[];
    } | null>(null);

    // Expose active chart methods to parent
    useImperativeHandle(ref, () => ({
      fitContent: () => {
        const activeRef = chartRefs.current.get(activeWindowIndex);
        activeRef?.fitContent();
      },
      selectRange: (days: number) => {
        const activeRef = chartRefs.current.get(activeWindowIndex);
        activeRef?.selectRange(days);
      },
      takeSnapshot: () => {
        const activeRef = chartRefs.current.get(activeWindowIndex);
        activeRef?.takeSnapshot();
      },
      getChart: () => {
        const activeRef = chartRefs.current.get(activeWindowIndex);
        return activeRef?.getChart() || null;
      },
    }));

    // Ensure we have window states initialized for each pane
    useEffect(() => {
      const neededCount = template.count;
      if (windowStates.length < neededCount) {
        const newStates = [...windowStates];
        const defaultAssets = [activeAsset, ...allAssets.filter((a) => a.symbol !== activeAsset.symbol)];
        const defaultTimeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D'];

        for (let i = windowStates.length; i < neededCount; i++) {
          const assetChoice = defaultAssets[i % defaultAssets.length];
          const tfChoice = defaultTimeframes[i % defaultTimeframes.length];
          newStates.push({
            id: `win-${i}`,
            symbol: syncSettings.symbol ? activeAsset.symbol : assetChoice.symbol,
            timeframe: syncSettings.interval ? activeTimeframe : tfChoice,
            chartType: chartType,
          });
        }
        onUpdateWindowStates(newStates);
      }
    }, [template.count, windowStates.length, syncSettings.symbol, syncSettings.interval, activeAsset.symbol, activeTimeframe, chartType, onUpdateWindowStates]);

    // Handle Symbol Sync: When syncSettings.symbol is on and activeAsset changes, propagate to all windows
    useEffect(() => {
      if (syncSettings.symbol && windowStates.length > 0) {
        const isOutdated = windowStates.some((w) => w.symbol !== activeAsset.symbol);
        if (isOutdated) {
          const updated = windowStates.map((w) => ({ ...w, symbol: activeAsset.symbol }));
          onUpdateWindowStates(updated);
        }
      }
    }, [syncSettings.symbol, activeAsset.symbol, onUpdateWindowStates]);

    // Handle Interval Sync: When syncSettings.interval is on and activeTimeframe changes, propagate to all windows
    useEffect(() => {
      if (syncSettings.interval && windowStates.length > 0) {
        const isOutdated = windowStates.some((w) => w.timeframe !== activeTimeframe);
        if (isOutdated) {
          const updated = windowStates.map((w) => ({ ...w, timeframe: activeTimeframe }));
          onUpdateWindowStates(updated);
        }
      }
    }, [syncSettings.interval, activeTimeframe, onUpdateWindowStates]);

    // Fetch candles for secondary windows if symbol/timeframe differs from primary
    useEffect(() => {
      if (template.count <= 1) return;

      windowStates.slice(0, template.count).forEach((win, index) => {
        const isPrimary =
          index === 0 ||
          (win.symbol === activeAsset.symbol && win.timeframe === activeTimeframe);

        if (!isPrimary) {
          const key = `${win.symbol}_${win.timeframe}`;
          if (!windowCandles[key] && !inFlightRequestsRef.current.has(key)) {
            inFlightRequestsRef.current.add(key);
            const assetObj = allAssets.find((a) => a.symbol === win.symbol) || activeAsset;
            fetchHistoricalData(assetObj, win.timeframe)
              .then((data) => {
                setWindowCandles((prev) => ({ ...prev, [key]: data }));
              })
              .finally(() => {
                inFlightRequestsRef.current.delete(key);
              });
          }
        }
      });
    }, [template.count, windowStates, activeAsset.symbol, activeTimeframe, allAssets]);

    // Mouse Drag Listeners for Resizing Dividers and Custom Grid
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        // 1. Custom Grid dragging
        if (customDragRef.current && containerRef.current) {
          const { boxIndex, handle, initialBoxes } = customDragRef.current;
          const rect = containerRef.current.getBoundingClientRect();
          const updatedBoxes = updateCustomBoxes(
            boxIndex,
            handle,
            e.clientX,
            e.clientY,
            rect,
            initialBoxes,
            snapStep
          );
          setCustomGridBoxes(updatedBoxes);
          const cur = updatedBoxes[boxIndex];
          setActiveDragInfo({
            boxIndex,
            handle,
            width: Number(cur.w.toFixed(1)),
            height: Number(cur.h.toFixed(1)),
          });
          return;
        }

        // 2. Preset Split dragging
        if (!draggingRef.current || !containerRef.current) return;
        const { type, startX, startY, startSplits } = draggingRef.current;
        const rect = containerRef.current.getBoundingClientRect();

        if (type === 'col') {
          const deltaX = e.clientX - startX;
          const deltaPercent = (deltaX / rect.width) * 100;
          const newLeft = Math.max(15, Math.min(85, startSplits[0] + deltaPercent));
          const updated = [newLeft, 100 - newLeft];
          setSplits(updated);
          onUpdateSplitSizes?.(updated);
        } else if (type === 'row') {
          const deltaY = e.clientY - startY;
          const deltaPercent = (deltaY / rect.height) * 100;
          const newTop = Math.max(15, Math.min(85, startSplits[0] + deltaPercent));
          const updated = [newTop, 100 - newTop];
          setSplits(updated);
          onUpdateSplitSizes?.(updated);
        } else if (type === 'inner-row') {
          const deltaY = e.clientY - startY;
          const deltaPercent = (deltaY / rect.height) * 100;
          const newTop = Math.max(15, Math.min(85, startSplits[0] + deltaPercent));
          setInnerSplits([newTop, 100 - newTop]);
        } else if (type === 'inner-col') {
          const deltaX = e.clientX - startX;
          const deltaPercent = (deltaX / rect.width) * 100;
          const newLeft = Math.max(15, Math.min(85, startSplits[0] + deltaPercent));
          setInnerSplits([newLeft, 100 - newLeft]);
        }
      };

      const handleMouseUp = () => {
        if (customDragRef.current) {
          if (template.rowCategory) {
            localStorage.setItem(
              `tv_custom_boxes_${template.rowCategory}`,
              JSON.stringify(latestBoxesRef.current)
            );
          }
          customDragRef.current = null;
          setActiveDragInfo(null);
        }

        draggingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [onUpdateSplitSizes, snapStep, template.rowCategory]);

    const startCustomDrag = (
      e: React.MouseEvent,
      boxIndex: number,
      handle: CustomDragHandle
    ) => {
      e.preventDefault();
      e.stopPropagation();

      let cursor = 'default';
      if (handle === 'e' || handle === 'w') cursor = 'col-resize';
      else if (handle === 'n' || handle === 's') cursor = 'row-resize';
      else if (handle === 'se' || handle === 'nw') cursor = 'nwse-resize';
      else if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize';

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';

      customDragRef.current = {
        boxIndex,
        handle,
        initialBoxes: customGridBoxes.map((b) => ({ ...b })),
      };
    };

    const autoBalanceCustomGrid = () => {
      const initial = template.boxes.map((b) => ({ ...b }));
      setCustomGridBoxes(initial);
      if (template.rowCategory) {
        localStorage.setItem(
          `tv_custom_boxes_${template.rowCategory}`,
          JSON.stringify(initial)
        );
      }
    };

    const resetCustomGrid = () => {
      const initial = template.boxes.map((b) => ({ ...b }));
      setCustomGridBoxes(initial);
      if (template.rowCategory) {
        localStorage.removeItem(`tv_custom_boxes_${template.rowCategory}`);
      }
    };

    const startDrag = (
      e: React.MouseEvent,
      type: 'col' | 'row' | 'inner-col' | 'inner-row',
      index: number
    ) => {
      e.preventDefault();
      document.body.style.cursor = type.includes('col') ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      draggingRef.current = {
        type,
        index,
        startX: e.clientX,
        startY: e.clientY,
        startSplits: type.startsWith('inner') ? [...innerSplits] : [...splits],
      };
    };

    const resetSplits = () => {
      setSplits([50, 50]);
      setInnerSplits([50, 50]);
      onUpdateSplitSizes?.([50, 50]);
    };

    // Render a single window's chart
    const renderWindowChart = (winIndex: number) => {
      const win = windowStates[winIndex] || {
        id: `win-${winIndex}`,
        symbol: activeAsset.symbol,
        timeframe: activeTimeframe,
      };

      const winAsset = allAssets.find((a) => a.symbol === win.symbol) || activeAsset;
      const winTimeframe = win.timeframe || activeTimeframe;
      const key = `${win.symbol}_${win.timeframe}`;
      const isPrimary =
        winIndex === 0 ||
        (win.symbol === activeAsset.symbol && win.timeframe === activeTimeframe);
      const currentCandles = isPrimary ? primaryCandles : windowCandles[key] || primaryCandles;
      const isActive = activeWindowIndex === winIndex;
      const isMaximized = maximizedPaneIndex === winIndex;

      return (
        <div
          key={winIndex}
          onClick={() => {
            setActiveWindowIndex(winIndex);
            if (!syncSettings.symbol) setActiveAsset(winAsset);
            if (!syncSettings.interval) setActiveTimeframe(winTimeframe);
          }}
          className={`relative h-full w-full flex flex-col overflow-hidden bg-[#131722] transition-shadow ${
            template.count > 1 && isActive
              ? 'ring-2 ring-[#2962ff] z-10 shadow-lg'
              : 'border-2 border-[#2c303c] shadow-xs'
          }`}
        >
          {/* Mini Window Header Pill (Only shown in multi-window mode) */}
          {template.count > 1 && (
            <div className="absolute top-1.5 left-2 z-20 flex items-center gap-1 bg-[#1e222d]/90 backdrop-blur-xs border border-[#2a2e39] rounded px-1.5 py-0.5 text-[10px] shadow-sm select-none">
              <span className="font-bold text-white tracking-tight">{winAsset.symbol}</span>
              <span className="text-[#787b86] font-mono">{winTimeframe}</span>

              {/* Quick Maximize / Minimize button for this pane */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMaximizedPaneIndex(isMaximized ? null : winIndex);
                }}
                className="ml-1 p-0.5 text-[#787b86] hover:text-white rounded transition"
                title={isMaximized ? 'Restore Split View' : 'Maximize Pane'}
              >
                {isMaximized ? (
                  <Minimize2 className="w-3 h-3 text-[#00ffa3]" />
                ) : (
                  <Maximize2 className="w-3 h-3" />
                )}
              </button>
            </div>
          )}

          {/* Actual Chart Component */}
          <div className="flex-1 w-full h-full min-h-0 min-w-0">
            <MainChart
              ref={(chartRefInstance) => {
                if (chartRefInstance) {
                  chartRefs.current.set(winIndex, chartRefInstance);
                } else {
                  chartRefs.current.delete(winIndex);
                }
              }}
              asset={winAsset}
              timeframe={winTimeframe}
              chartType={template.count === 1 || winIndex === activeWindowIndex ? chartType : (win?.chartType || chartType)}
              candles={currentCandles}
              indicators={indicators}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              drawings={drawings}
              setDrawings={setDrawings}
              isMagnetMode={isMagnetMode}
              areDrawingsHidden={areDrawingsHidden}
              currentColor={currentColor}
              isLogScale={isLogScale}
              isPercentScale={isPercentScale}
              openPosition={openPosition}
              onClosePosition={onClosePosition}
              onOpenConditionalOrder={onOpenConditionalOrder}
            />
          </div>
        </div>
      );
    };

    // If one pane is maximized, show only that pane
    if (maximizedPaneIndex !== null && template.count > 1) {
      return (
        <div className="h-full w-full relative overflow-hidden bg-[#131722]">
          {renderWindowChart(maximizedPaneIndex)}
        </div>
      );
    }

    // CUSTOM FREEFORM GRID WITH REAL-TIME GRID SNAPPING & ADJUSTMENT
    if (template.isCustomGrid || template.type === 'custom-grid') {
      return (
        <div
          ref={containerRef}
          className="h-full w-full relative bg-[#131722] overflow-hidden select-none"
        >
          {/* Floating Real-Time Dimension Badge during dragging (grid lines are invisible) */}
          {activeDragInfo && (
            <div className="absolute bottom-3 left-3 bg-[#1e222d]/95 border border-[#2962ff] text-white px-2.5 py-1 rounded shadow-lg flex items-center gap-2 text-xs font-mono z-50 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[#00ffa3] animate-pulse" />
              <span className="font-semibold text-[#d1d4dc]">
                Window {activeDragInfo.boxIndex + 1}:
              </span>
              <span className="text-[#2962ff] font-bold">
                {activeDragInfo.width}% × {activeDragInfo.height}%
              </span>
              <span className="text-[#787b86]">|</span>
              <span className="text-[#00ffa3] text-[11px]">Snapped ({snapStep}%)</span>
            </div>
          )}

          {/* Floating Control Bar for Custom Grid Mode */}
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 bg-[#181b24]/95 backdrop-blur-xs border border-[#2a2e39] rounded px-2 py-1 shadow-md text-xs">
            <div className="flex items-center gap-1 text-[#00ffa3] font-medium text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ffa3]" />
              <span>Custom {template.rowCategory}-Grid</span>
            </div>

            <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

            {/* Snap Toggle */}
            <button
              onClick={() =>
                setSnapStep((s) => (s === 0.5 ? 0.25 : s === 0.25 ? 0.1 : s === 0.1 ? 1 : 0.5))
              }
              className="text-[#848e9c] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#262b37] text-[10px] font-mono transition"
              title="Click to toggle fine snap step (0.5%, 0.25%, 0.1%, 1%)"
            >
              Snap: {snapStep}%
            </button>

            {/* Auto-Balance */}
            <button
              onClick={autoBalanceCustomGrid}
              className="text-[#848e9c] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#262b37] text-[10px] transition flex items-center gap-1"
              title="Balance all window sections evenly"
            >
              <Columns className="w-3 h-3" />
              <span>Balance</span>
            </button>

            {/* Reset */}
            <button
              onClick={resetCustomGrid}
              className="text-[#848e9c] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#262b37] text-[10px] transition flex items-center gap-1"
              title="Reset layout back to initial layout"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Render All Resizable Grid Boxes */}
          {customGridBoxes.map((box, idx) => {
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.w}%`,
                  height: `${box.h}%`,
                }}
                className="p-1 group/custom-box"
              >
                <div className="relative w-full h-full overflow-hidden rounded-sm bg-[#131722] border-2 border-[#363a45] shadow-md">
                  {renderWindowChart(idx)}

                  {/* 8 Resizing Handles with high-visibility indicators */}
                  {/* Right edge */}
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'e')}
                    className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize hover:bg-[#2962ff]/50 z-20 transition-colors flex items-center justify-end pr-0.5 group-hover/custom-box:opacity-100 opacity-70"
                    title="Drag to resize width (snaps to grid in real time)"
                  >
                    <div className="w-1 h-6 bg-[#4a5060] rounded-full" />
                  </div>
                  {/* Left edge */}
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'w')}
                    className="absolute top-0 left-0 bottom-0 w-3 cursor-col-resize hover:bg-[#2962ff]/50 z-20 transition-colors flex items-center justify-start pl-0.5 group-hover/custom-box:opacity-100 opacity-70"
                    title="Drag to resize width (snaps to grid in real time)"
                  >
                    <div className="w-1 h-6 bg-[#4a5060] rounded-full" />
                  </div>
                  {/* Bottom edge */}
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 's')}
                    className="absolute bottom-0 left-0 right-0 h-3 cursor-row-resize hover:bg-[#2962ff]/50 z-20 transition-colors flex items-end justify-center pb-0.5 group-hover/custom-box:opacity-100 opacity-70"
                    title="Drag to resize height (snaps to grid in real time)"
                  >
                    <div className="h-1 w-6 bg-[#4a5060] rounded-full" />
                  </div>
                  {/* Top edge */}
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'n')}
                    className="absolute top-0 left-0 right-0 h-3 cursor-row-resize hover:bg-[#2962ff]/50 z-20 transition-colors flex items-start justify-center pt-0.5 group-hover/custom-box:opacity-100 opacity-70"
                    title="Drag to resize height (snaps to grid in real time)"
                  >
                    <div className="h-1 w-6 bg-[#4a5060] rounded-full" />
                  </div>

                  {/* Corners */}
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'se')}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-[#262b37] border-l border-t border-[#363a45] hover:bg-[#2962ff] z-30 transition-colors flex items-center justify-center shadow-xs"
                    title="Drag corner to adjust width & height simultaneously"
                  >
                    <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-white" />
                  </div>
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'sw')}
                    className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize bg-[#262b37] border-r border-t border-[#363a45] hover:bg-[#2962ff] z-30 transition-colors flex items-center justify-center shadow-xs"
                    title="Drag corner to adjust width & height simultaneously"
                  >
                    <div className="w-1.5 h-1.5 border-l-2 border-b-2 border-white" />
                  </div>
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'ne')}
                    className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize bg-[#262b37] border-l border-b border-[#363a45] hover:bg-[#2962ff] z-30 transition-colors flex items-center justify-center shadow-xs"
                    title="Drag corner to adjust width & height simultaneously"
                  >
                    <div className="w-1.5 h-1.5 border-r-2 border-t-2 border-white" />
                  </div>
                  <div
                    onMouseDown={(e) => startCustomDrag(e, idx, 'nw')}
                    className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize bg-[#262b37] border-r border-b border-[#363a45] hover:bg-[#2962ff] z-30 transition-colors flex items-center justify-center shadow-xs"
                    title="Drag corner to adjust width & height simultaneously"
                  >
                    <div className="w-1.5 h-1.5 border-l-2 border-t-2 border-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // 1. SINGLE WINDOW (100% full screen)
    if (template.type === 'single' || template.count === 1) {
      return (
        <div className="h-full w-full relative overflow-hidden bg-[#131722]">
          {renderWindowChart(0)}
        </div>
      );
    }

    // 2. COLUMNS (2, 3, 4, 5, 6, 7, 8, etc.)
    if (template.type === 'cols') {
      const count = template.cols || template.count;
      return (
        <div ref={containerRef} className="h-full w-full flex overflow-hidden relative bg-[#131722]">
          {Array.from({ length: count }).map((_, idx) => (
            <React.Fragment key={idx}>
              <div
                style={{
                  width: `${idx === 0 ? splits[0] : 100 - splits[0]}%`,
                  flex: count > 2 ? 1 : undefined,
                }}
                className="h-full min-w-[10%] min-h-0 overflow-hidden"
              >
                {renderWindowChart(idx)}
              </div>
              {idx < count - 1 && (
                <div
                  onMouseDown={(e) => startDrag(e, 'col', idx)}
                  onDoubleClick={resetSplits}
                  className="w-2.5 hover:w-3 bg-[#262a36] hover:bg-[#2962ff] cursor-col-resize z-30 transition-all flex items-center justify-center shrink-0 group border-x border-[#383d4c] shadow-sm"
                  title="Drag to resize columns, double-click to balance"
                >
                  <div className="w-1 h-8 bg-[#525868] group-hover:bg-white rounded-full transition-colors" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }

    // 3. ROWS (2, 3, 4, 5, 6, 8, etc.)
    if (template.type === 'rows') {
      const count = template.rows || template.count;
      return (
        <div ref={containerRef} className="h-full w-full flex flex-col overflow-hidden relative bg-[#131722]">
          {Array.from({ length: count }).map((_, idx) => (
            <React.Fragment key={idx}>
              <div
                style={{
                  height: `${idx === 0 ? splits[0] : 100 - splits[0]}%`,
                  flex: count > 2 ? 1 : undefined,
                }}
                className="w-full min-h-[10%] min-w-0 overflow-hidden"
              >
                {renderWindowChart(idx)}
              </div>
              {idx < count - 1 && (
                <div
                  onMouseDown={(e) => startDrag(e, 'row', idx)}
                  onDoubleClick={resetSplits}
                  className="h-2.5 hover:h-3 bg-[#262a36] hover:bg-[#2962ff] cursor-row-resize z-30 transition-all flex items-center justify-center shrink-0 group border-y border-[#383d4c] shadow-sm"
                  title="Drag to resize rows, double-click to balance"
                >
                  <div className="h-1 w-8 bg-[#525868] group-hover:bg-white rounded-full transition-colors" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }

    // 4. GRID (2x2, 3x2, 2x3, 4x2, 3x3, 4x4, etc.)
    if (template.type === 'grid') {
      const cols = template.cols || 2;
      const rows = template.rows || 2;
      return (
        <div
          ref={containerRef}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
          className="h-full w-full gap-2 p-1 bg-[#262a36] overflow-hidden"
        >
          {Array.from({ length: template.count }).map((_, idx) => (
            <div key={idx} className="h-full w-full min-h-0 min-w-0 overflow-hidden">
              {renderWindowChart(idx)}
            </div>
          ))}
        </div>
      );
    }

    // 5. LEFT - RIGHT (e.g. 1 left, 2 right; 1 left, 3 right; 3 left, 1 right)
    if (template.type === 'left-right') {
      const leftCount = template.leftCount || 1;
      const rightCount = template.rightCount || 2;
      return (
        <div ref={containerRef} className="h-full w-full flex overflow-hidden relative bg-[#131722]">
          {/* Left Column */}
          <div
            style={{ width: `${splits[0]}%` }}
            className="h-full flex flex-col min-w-[15%] overflow-hidden"
          >
            {Array.from({ length: leftCount }).map((_, idx) => (
              <div key={idx} className="flex-1 min-h-0 overflow-hidden">
                {renderWindowChart(idx)}
              </div>
            ))}
          </div>

          {/* Draggable Vertical Divider between Left & Right */}
          <div
            onMouseDown={(e) => startDrag(e, 'col', 0)}
            onDoubleClick={resetSplits}
            className="w-2.5 hover:w-3 bg-[#262a36] hover:bg-[#2962ff] cursor-col-resize z-30 transition-all flex items-center justify-center shrink-0 group border-x border-[#383d4c] shadow-sm"
            title="Drag to resize, double-click to balance"
          >
            <div className="w-1 h-8 bg-[#525868] group-hover:bg-white rounded-full transition-colors" />
          </div>

          {/* Right Column */}
          <div
            style={{ width: `${100 - splits[0]}%` }}
            className="h-full flex flex-col min-w-[15%] overflow-hidden"
          >
            {Array.from({ length: rightCount }).map((_, idx) => {
              const winIdx = leftCount + idx;
              return (
                <React.Fragment key={winIdx}>
                  <div
                    style={{
                      height:
                        rightCount === 2
                          ? `${idx === 0 ? innerSplits[0] : 100 - innerSplits[0]}%`
                          : undefined,
                      flex: rightCount > 2 ? 1 : undefined,
                    }}
                    className="min-h-0 overflow-hidden"
                  >
                    {renderWindowChart(winIdx)}
                  </div>
                  {idx < rightCount - 1 && (
                    <div
                      onMouseDown={(e) => startDrag(e, 'inner-row', idx)}
                      onDoubleClick={() => setInnerSplits([50, 50])}
                      className="h-2.5 hover:h-3 bg-[#262a36] hover:bg-[#2962ff] cursor-row-resize z-20 transition-all flex items-center justify-center shrink-0 group border-y border-[#383d4c] shadow-sm"
                      title="Drag to resize inner panes, double click to balance"
                    >
                      <div className="h-1 w-8 bg-[#525868] group-hover:bg-white rounded-full transition-colors" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    }

    // 6. TOP - BOTTOM (e.g. 1 top, 2 bottom; 1 top, 3 bottom; 2 top, 1 bottom)
    if (template.type === 'top-bottom') {
      const topCount = template.topCount || 1;
      const bottomCount = template.bottomCount || 2;
      return (
        <div ref={containerRef} className="h-full w-full flex flex-col overflow-hidden relative bg-[#131722]">
          {/* Top Row */}
          <div
            style={{ height: `${splits[0]}%` }}
            className="w-full flex min-h-[15%] overflow-hidden"
          >
            {Array.from({ length: topCount }).map((_, idx) => (
              <div key={idx} className="flex-1 min-w-0 overflow-hidden">
                {renderWindowChart(idx)}
              </div>
            ))}
          </div>

          {/* Draggable Horizontal Divider between Top & Bottom */}
          <div
            onMouseDown={(e) => startDrag(e, 'row', 0)}
            onDoubleClick={resetSplits}
            className="h-2.5 hover:h-3 bg-[#262a36] hover:bg-[#2962ff] cursor-row-resize z-30 transition-all flex items-center justify-center shrink-0 group border-y border-[#383d4c] shadow-sm"
            title="Drag to resize, double-click to balance"
          >
            <div className="h-1 w-8 bg-[#525868] group-hover:bg-white rounded-full transition-colors" />
          </div>

          {/* Bottom Row */}
          <div
            style={{ height: `${100 - splits[0]}%` }}
            className="w-full flex min-h-[15%] overflow-hidden"
          >
            {Array.from({ length: bottomCount }).map((_, idx) => {
              const winIdx = topCount + idx;
              return (
                <React.Fragment key={winIdx}>
                  <div
                    style={{
                      width:
                        bottomCount === 2
                          ? `${idx === 0 ? innerSplits[0] : 100 - innerSplits[0]}%`
                          : undefined,
                      flex: bottomCount > 2 ? 1 : undefined,
                    }}
                    className="min-w-0 overflow-hidden"
                  >
                    {renderWindowChart(winIdx)}
                  </div>
                  {idx < bottomCount - 1 && (
                    <div
                      onMouseDown={(e) => startDrag(e, 'inner-col', idx)}
                      onDoubleClick={() => setInnerSplits([50, 50])}
                      className="w-2.5 hover:w-3 bg-[#262a36] hover:bg-[#2962ff] cursor-col-resize z-20 transition-all flex items-center justify-center shrink-0 group border-x border-[#383d4c] shadow-sm"
                      title="Drag to resize inner panes, double click to balance"
                    >
                      <div className="w-1 h-8 bg-[#525868] group-hover:bg-white rounded-full transition-colors" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    }

    // Default fallback: Single chart
    return (
      <div className="h-full w-full relative overflow-hidden bg-[#131722]">
        {renderWindowChart(0)}
      </div>
    );
  }
);

MultiChartWorkspace.displayName = 'MultiChartWorkspace';
