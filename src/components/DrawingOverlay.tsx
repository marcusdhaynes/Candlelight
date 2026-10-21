import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { Drawing, DrawingPoint, DrawingToolType, OHLCV, DependencyContext } from '../types';
import { Trash2, Check, Sparkles, Magnet, Zap } from 'lucide-react';

interface DrawingOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<any> | null;
  activeTool: DrawingToolType;
  setActiveTool: (tool: DrawingToolType) => void;
  drawings: Drawing[];
  setDrawings: React.Dispatch<React.SetStateAction<Drawing[]>>;
  isMagnetMode: boolean;
  areDrawingsHidden: boolean;
  currentColor: string;
  candles?: OHLCV[];
  onOpenConditionalOrder?: (dep: DependencyContext) => void;
}

interface BendDragState {
  drawingId: string;
  type: 'bend' | 'p0' | 'p1';
  t: number; // parametric position along curve [0.1..0.9]
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  chart,
  series,
  activeTool,
  setActiveTool,
  drawings,
  setDrawings,
  isMagnetMode,
  areDrawingsHidden,
  currentColor,
  candles = [],
  onOpenConditionalOrder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inProgressPoints, setInProgressPoints] = useState<DrawingPoint[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [drawingContextMenu, setDrawingContextMenu] = useState<{
    x: number;
    y: number;
    drawing: Drawing;
  } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInputVal, setTextInputVal] = useState('');
  const [, setRenderTrigger] = useState(0);

  // Active snap to a bendline
  const [activeSnap, setActiveSnap] = useState<{
    x: number;
    y: number;
    drawingId: string;
  } | null>(null);

  // Adobe Flash / Animate Bendline drag state
  const bendDragRef = useRef<BendDragState | null>(null);
  const [isBending, setIsBending] = useState(false);
  const [hoveredBendInfo, setHoveredBendInfo] = useState<{
    drawingId: string;
    t: number;
    x: number;
    y: number;
  } | null>(null);

  // Close drawing context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setDrawingContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleDrawingClick = useCallback((e: React.MouseEvent, drawing: Drawing) => {
    e.stopPropagation();
    setSelectedDrawingId(drawing.id);
  }, []);

  const handleDrawingDoubleClick = useCallback(
    (e: React.MouseEvent, drawing: Drawing) => {
      e.stopPropagation();
      onOpenConditionalOrder?.({
        type: 'drawing',
        drawing,
        id: drawing.id,
        label: `${drawing.type.toUpperCase()} (${drawing.label || `#${drawing.id.slice(0, 4)}`})`,
        price: drawing.points[0]?.price,
      });
    },
    [onOpenConditionalOrder]
  );

  const handleDrawingContextMenu = useCallback((e: React.MouseEvent, drawing: Drawing) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDrawingId(drawing.id);
    setDrawingContextMenu({
      x: e.clientX,
      y: e.clientY,
      drawing,
    });
  }, []);

  // Subscribe to chart zoom / scroll to keep SVG overlay aligned
  useEffect(() => {
    if (!chart) return;
    const timeScale = chart.timeScale();
    const handleRangeChange = () => {
      setRenderTrigger((v) => v + 1);
    };

    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
    };
  }, [chart]);

  // Convert time & price to pixel X & Y
  const getCoordinates = useCallback(
    (point: DrawingPoint): { x: number; y: number } | null => {
      if (!chart || !series) return null;
      try {
        const timeScale = chart.timeScale();
        const x = timeScale.timeToCoordinate(point.time as any);
        const y = series.priceToCoordinate(point.price);
        if (x === null || y === null) return null;
        return { x, y };
      } catch {
        return null;
      }
    },
    [chart, series]
  );

  // Convert pixel coords (relX, relY) to time & price
  const getPointFromCoords = useCallback(
    (relX: number, relY: number): DrawingPoint | null => {
      if (!chart || !series) return null;
      try {
        const timeScale = chart.timeScale();
        const time = timeScale.coordinateToTime(relX);
        const price = series.coordinateToPrice(relY);
        if (time === null || price === null) return null;
        return { time: Number(time), price: Number(price) };
      } catch {
        return null;
      }
    },
    [chart, series]
  );

  const getPointFromClientXY = useCallback(
    (clientX: number, clientY: number): DrawingPoint | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      return getPointFromCoords(relX, relY);
    },
    [getPointFromCoords]
  );

  // --------------------------------------------------------------------------
  // BENDLINE SNAP ENGINE:
  // "the user can snap the edge of other lines to ANY point on a bendline if it is close enough"
  // --------------------------------------------------------------------------
  const findClosestPointOnBendlines = useCallback(
    (
      x: number,
      y: number,
      threshold: number = 16
    ): { x: number; y: number; drawingId: string; distance: number; t: number } | null => {
      let best: { x: number; y: number; drawingId: string; distance: number; t: number } | null = null;
      let minDistance = threshold;

      for (const drawing of drawings) {
        if (drawing.type !== 'bendline' || drawing.points.length < 2) continue;
        const p0 = getCoordinates(drawing.points[0]);
        const p1 = getCoordinates(drawing.points[1]);
        if (!p0 || !p1) continue;

        const pc = drawing.controlPoint
          ? getCoordinates(drawing.controlPoint)
          : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        if (!pc) continue;

        // Discretize quadratic Bézier curve into 64 sample segments
        const STEPS = 64;
        for (let i = 0; i <= STEPS; i++) {
          const t = i / STEPS;
          const u = 1 - t;
          const bx = u * u * p0.x + 2 * u * t * pc.x + t * t * p1.x;
          const by = u * u * p0.y + 2 * u * t * pc.y + t * t * p1.y;

          const dist = Math.hypot(x - bx, y - by);
          if (dist < minDistance) {
            minDistance = dist;
            best = {
              x: bx,
              y: by,
              drawingId: drawing.id,
              distance: dist,
              t,
            };
          }
        }
      }

      return best;
    },
    [drawings, getCoordinates]
  );

  // --------------------------------------------------------------------------
  // POINTER MOVE & SNAP DETECTION
  // --------------------------------------------------------------------------
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Handle Adobe Flash/Animate Bend Dragging
    if (bendDragRef.current && bendDragRef.current.type === 'bend') {
      const { drawingId, t } = bendDragRef.current;
      const bendline = drawings.find((d) => d.id === drawingId);
      if (bendline && bendline.points.length >= 2) {
        const p0 = getCoordinates(bendline.points[0]);
        const p1 = getCoordinates(bendline.points[1]);
        if (p0 && p1) {
          // Adobe Flash/Animate Bézier inversion formula:
          // B(t) = (1-t)^2 P0 + 2(1-t)t Pc + t^2 P1 => Pc = (B(t) - (1-t)^2 P0 - t^2 P1) / (2(1-t)t)
          const clampedT = Math.max(0.12, Math.min(0.88, t));
          const u = 1 - clampedT;
          const denom = 2 * u * clampedT;

          const pcX = (rawX - u * u * p0.x - clampedT * clampedT * p1.x) / denom;
          const pcY = (rawY - u * u * p0.y - clampedT * clampedT * p1.y) / denom;

          const pcPoint = getPointFromCoords(pcX, pcY);
          if (pcPoint) {
            setDrawings((prev) =>
              prev.map((d) => (d.id === drawingId ? { ...d, controlPoint: pcPoint } : d))
            );
          }
        }
      }
      setCursorPos({ x: rawX, y: rawY });
      return;
    }

    // Check if cursor is close enough to any bendline for snapping
    const snapDistance = isMagnetMode ? 28 : 16;
    const snap = findClosestPointOnBendlines(rawX, rawY, snapDistance);

    if (snap) {
      setActiveSnap({ x: snap.x, y: snap.y, drawingId: snap.drawingId });
      setCursorPos({ x: snap.x, y: snap.y });
    } else {
      setActiveSnap(null);
      setCursorPos({ x: rawX, y: rawY });
    }

    // Check hover along bendlines for Flash bend cursor indicator
    if (activeTool === 'cursor' || activeTool === 'crosshair' || activeTool === 'bendline') {
      const hoverInfo = findClosestPointOnBendlines(rawX, rawY, 12);
      if (hoverInfo && hoverInfo.t >= 0.08 && hoverInfo.t <= 0.92) {
        setHoveredBendInfo({
          drawingId: hoverInfo.drawingId,
          t: hoverInfo.t,
          x: hoverInfo.x,
          y: hoverInfo.y,
        });
      } else {
        setHoveredBendInfo(null);
      }
    } else {
      setHoveredBendInfo(null);
    }
  };

  const handlePointerUp = () => {
    if (bendDragRef.current) {
      bendDragRef.current = null;
      setIsBending(false);
    }
  };

  // --------------------------------------------------------------------------
  // POINTER DOWN (Drawing Placement & Bendline Interaction)
  // --------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent default chart pan when in drawing mode or bending
    if (activeTool === 'cursor' || activeTool === 'crosshair') {
      // Check if clicked directly on a bendline to bend it (Adobe Flash/Animate style)
      if (hoveredBendInfo) {
        e.stopPropagation();
        bendDragRef.current = {
          drawingId: hoveredBendInfo.drawingId,
          type: 'bend',
          t: hoveredBendInfo.t,
        };
        setIsBending(true);
        setSelectedDrawingId(hoveredBendInfo.drawingId);
        return;
      }
      return;
    }

    e.stopPropagation();

    // Check if user clicked on bendline while bendline tool or drawing tool is active
    if (hoveredBendInfo && inProgressPoints.length === 0 && activeTool === 'bendline') {
      bendDragRef.current = {
        drawingId: hoveredBendInfo.drawingId,
        type: 'bend',
        t: hoveredBendInfo.t,
      };
      setIsBending(true);
      setSelectedDrawingId(hoveredBendInfo.drawingId);
      return;
    }

    // Effective click point: if snapped to bendline, use snapped coordinate!
    let effectivePoint: DrawingPoint | null = null;
    if (activeSnap) {
      effectivePoint = getPointFromCoords(activeSnap.x, activeSnap.y);
    }
    if (!effectivePoint) {
      effectivePoint = getPointFromClientXY(e.clientX, e.clientY);
    }
    if (!effectivePoint) return;

    // 1. ONE-POINT TOOLS: horizontal, horizontal_ray, vertical, crossline, text
    if (activeTool === 'horizontal') {
      const newDrawing: Drawing = {
        id: 'draw-' + Date.now(),
        type: 'horizontal',
        points: [effectivePoint],
        color: currentColor,
        lineWidth: 2,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setActiveTool('cursor');
      return;
    }

    if (activeTool === 'horizontal_ray') {
      const newDrawing: Drawing = {
        id: 'draw-' + Date.now(),
        type: 'horizontal_ray',
        points: [effectivePoint],
        color: currentColor,
        lineWidth: 2,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setActiveTool('cursor');
      return;
    }

    if (activeTool === 'vertical') {
      const newDrawing: Drawing = {
        id: 'draw-' + Date.now(),
        type: 'vertical',
        points: [effectivePoint],
        color: currentColor,
        lineWidth: 2,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setActiveTool('cursor');
      return;
    }

    if (activeTool === 'crossline') {
      const newDrawing: Drawing = {
        id: 'draw-' + Date.now(),
        type: 'crossline',
        points: [effectivePoint],
        color: currentColor,
        lineWidth: 1.5,
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setActiveTool('cursor');
      return;
    }

    if (activeTool === 'text') {
      const newId = 'draw-' + Date.now();
      const newDrawing: Drawing = {
        id: newId,
        type: 'text',
        points: [effectivePoint],
        color: currentColor,
        lineWidth: 1,
        text: 'Note',
      };
      setDrawings((prev) => [...prev, newDrawing]);
      setEditingTextId(newId);
      setTextInputVal('Note');
      setActiveTool('cursor');
      return;
    }

    // 2. THREE-POINT TOOLS: parallel_channel, flat_top_bottom, disjoint_channel, pitchfork, schiff_pitchfork, modified_schiff_pitchfork, inside_pitchfork
    const is3PointTool = [
      'parallel_channel',
      'flat_top_bottom',
      'disjoint_channel',
      'pitchfork',
      'schiff_pitchfork',
      'modified_schiff_pitchfork',
      'inside_pitchfork',
    ].includes(activeTool);

    if (is3PointTool) {
      if (inProgressPoints.length === 0) {
        setInProgressPoints([effectivePoint]);
        return;
      } else if (inProgressPoints.length === 1) {
        setInProgressPoints([inProgressPoints[0], effectivePoint]);
        return;
      } else {
        // Point 3 completes the tool!
        const p1 = inProgressPoints[0];
        const p2 = inProgressPoints[1];
        const p3 = effectivePoint;

        const newDrawing: Drawing = {
          id: 'draw-' + Date.now(),
          type: activeTool,
          points: [p1, p2, p3],
          channelPoint: p3,
          channelOffset: p3.price - p2.price,
          color: currentColor,
          lineWidth: 2,
        };
        setDrawings((prev) => [...prev, newDrawing]);
        setInProgressPoints([]);
        setActiveTool('cursor');
        return;
      }
    }

    // 3. TWO-POINT TOOLS: trendline, ray, info_line, extended_line, trend_angle, regression_trend, bendline, rectangle, measure, fibonacci
    if (inProgressPoints.length === 0) {
      setInProgressPoints([effectivePoint]);
    } else {
      const p1 = inProgressPoints[0];
      const p2 = effectivePoint;

      // For Bendline: initial control point is the exact midpoint (straight line)
      const controlPoint: DrawingPoint = {
        time: Math.round((p1.time + p2.time) / 2),
        price: (p1.price + p2.price) / 2,
      };

      const newDrawing: Drawing = {
        id: 'draw-' + Date.now(),
        type: activeTool,
        points: [p1, p2],
        controlPoint: activeTool === 'bendline' ? controlPoint : undefined,
        color: currentColor,
        lineWidth: 2,
      };

      setDrawings((prev) => [...prev, newDrawing]);
      setInProgressPoints([]);
      setSelectedDrawingId(newDrawing.id);
      setActiveTool('cursor');
    }
  };

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS (Alt+T, Alt+H, Alt+J, Alt+V, Alt+C, Escape, Delete)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in modal input
      if (editingTextId) return;

      if (e.altKey) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          setActiveTool('trendline');
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          setActiveTool('horizontal');
        } else if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          setActiveTool('horizontal_ray');
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          setActiveTool('vertical');
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          setActiveTool('crossline');
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          setDrawings((prev) => prev.filter((d) => d.id !== selectedDrawingId));
          setSelectedDrawingId(null);
        }
      }

      if (e.key === 'Escape') {
        setInProgressPoints([]);
        setActiveTool('cursor');
        setSelectedDrawingId(null);
        bendDragRef.current = null;
        setIsBending(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, editingTextId, setActiveTool, setDrawings]);

  if (areDrawingsHidden) return null;

  const isInteractiveDrawing = activeTool !== 'cursor' && activeTool !== 'crosshair';

  return (
    <div
      ref={containerRef}
      id="tradingview-drawing-overlay"
      className={`absolute inset-0 z-10 select-none overflow-hidden ${
        isBending
          ? 'cursor-grabbing pointer-events-auto'
          : hoveredBendInfo
          ? 'cursor-pointer pointer-events-auto'
          : isInteractiveDrawing
          ? 'cursor-crosshair pointer-events-auto'
          : 'pointer-events-none'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <svg className="w-full h-full pointer-events-none overflow-visible">
        {/* SVG Defs for markers & gradients */}
        <defs>
          <filter id="snap-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---------------------------------------------------------------- */}
        {/* RENDER SAVED DRAWINGS                                            */}
        {/* ---------------------------------------------------------------- */}
        {drawings.map((drawing) => {
          const isSelected = selectedDrawingId === drawing.id;
          const stroke = drawing.color || '#2962ff';

          const renderDrawingContent = () => {
          // 1. HORIZONTAL LINE (Alt + H)
          if (drawing.type === 'horizontal') {
            const p = getCoordinates(drawing.points[0]);
            if (!p) return null;
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line
                  x1={0}
                  y1={p.y}
                  x2="100%"
                  y2={p.y}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : drawing.lineWidth}
                  strokeDasharray="4 3"
                />
                <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 3.5} fill={stroke} />
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={stroke} strokeWidth={1.5} />
                )}
                <rect x="94%" y={p.y - 9} width="55" height="18" rx="3" fill="#1e222d" stroke={stroke} strokeWidth="1" />
                <text x="94.5%" y={p.y + 3.5} fill="#d1d4dc" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {drawing.points[0].price.toFixed(2)}
                </text>
              </g>
            );
          }

          // 2. HORIZONTAL RAY (Alt + J)
          if (drawing.type === 'horizontal_ray') {
            const p = getCoordinates(drawing.points[0]);
            if (!p) return null;
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line
                  x1={p.x}
                  y1={p.y}
                  x2="100%"
                  y2={p.y}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : drawing.lineWidth}
                />
                <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 3.5} fill={stroke} />
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={stroke} strokeWidth={1.5} />
                )}
              </g>
            );
          }

          // 3. VERTICAL LINE (Alt + V)
          if (drawing.type === 'vertical') {
            const p = getCoordinates(drawing.points[0]);
            if (!p) return null;
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line
                  x1={p.x}
                  y1={0}
                  x2={p.x}
                  y2="100%"
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : drawing.lineWidth}
                  strokeDasharray="4 3"
                />
                <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 3.5} fill={stroke} />
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={stroke} strokeWidth={1.5} />
                )}
              </g>
            );
          }

          // 4. CROSSLINE (Alt + C)
          if (drawing.type === 'crossline') {
            const p = getCoordinates(drawing.points[0]);
            if (!p) return null;
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line x1={0} y1={p.y} x2="100%" y2={p.y} stroke={stroke} strokeWidth={1} strokeDasharray="3 3" />
                <line x1={p.x} y1={0} x2={p.x} y2="100%" stroke={stroke} strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={p.x} cy={p.y} r={4} fill={stroke} />
                {isSelected && <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={stroke} strokeWidth={1.5} />}
              </g>
            );
          }

          // 5. TRENDLINE (Alt + T)
          if (drawing.type === 'trendline' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const deltaPrice = drawing.points[1].price - drawing.points[0].price;
            const pctChange = ((deltaPrice / drawing.points[0].price) * 100).toFixed(2);

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : drawing.lineWidth}
                />
                <circle cx={p1.x} cy={p1.y} r={isSelected ? 5 : 3.5} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={isSelected ? 5 : 3.5} fill={stroke} />

                {isSelected && (
                  <g transform={`translate(${(p1.x + p2.x) / 2}, ${(p1.y + p2.y) / 2 - 12})`}>
                    <rect x="-35" y="-12" width="70" height="18" rx="4" fill="#131722" stroke={stroke} strokeWidth="1" />
                    <text x="0" y="0" fill="#d1d4dc" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {deltaPrice > 0 ? '+' : ''}
                      {deltaPrice.toFixed(2)} ({pctChange}%)
                    </text>
                  </g>
                )}
              </g>
            );
          }

          // 6. RAY
          if (drawing.type === 'ray' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const targetX = p1.x + (dx / len) * 4000;
            const targetY = p1.y + (dy / len) * 4000;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={targetX}
                  y2={targetY}
                  stroke={stroke}
                  strokeWidth={isSelected ? 3 : drawing.lineWidth}
                />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />
              </g>
            );
          }

          // 7. INFO LINE (Comprehensive TradingView Info Badge)
          if (drawing.type === 'info_line' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const deltaPrice = drawing.points[1].price - drawing.points[0].price;
            const pctChange = ((deltaPrice / drawing.points[0].price) * 100).toFixed(2);
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const pixelDist = Math.round(Math.hypot(dx, dy));
            const angleRad = Math.atan2(-dy, dx);
            const angleDeg = (angleRad * (180 / Math.PI)).toFixed(1);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={isSelected ? 3 : drawing.lineWidth} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />

                {/* Info Card attached at midpoint */}
                <g transform={`translate(${midX}, ${midY - 28})`}>
                  <rect x="-65" y="-16" width="130" height="34" rx="5" fill="#171b26" stroke={stroke} strokeWidth="1.2" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.5))" />
                  <text x="0" y="-3" fill="#ffffff" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    {deltaPrice >= 0 ? '+' : ''}{deltaPrice.toFixed(2)} ({pctChange}%)
                  </text>
                  <text x="0" y="10" fill="#787b86" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    {pixelDist}px • {angleDeg}°
                  </text>
                </g>
              </g>
            );
          }

          // 8. EXTENDED LINE (Extends infinitely in both directions)
          if (drawing.type === 'extended_line' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const x1 = p1.x - (dx / len) * 4000;
            const y1 = p1.y - (dy / len) * 4000;
            const x2 = p2.x + (dx / len) * 4000;
            const y2 = p2.y + (dy / len) * 4000;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={isSelected ? 3 : drawing.lineWidth} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />
              </g>
            );
          }

          // 9. TREND ANGLE (Displays angle arc & degrees)
          if (drawing.type === 'trend_angle' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angleDeg = (-Math.atan2(dy, dx) * (180 / Math.PI)).toFixed(1);
            const arcRadius = 32;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={isSelected ? 3 : drawing.lineWidth} />
                {/* Horizontal reference baseline */}
                <line x1={p1.x} y1={p1.y} x2={p1.x + 60} y2={p1.y} stroke="#787b86" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />

                {/* Angle Arc */}
                <path
                  d={`M ${p1.x + arcRadius} ${p1.y} A ${arcRadius} ${arcRadius} 0 0 ${dy < 0 ? 0 : 1} ${
                    p1.x + Math.cos(-Number(angleDeg) * (Math.PI / 180)) * arcRadius
                  } ${p1.y + Math.sin(-Number(angleDeg) * (Math.PI / 180)) * arcRadius}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="1.5"
                />

                <rect x={p1.x + 40} y={p1.y - 18} width="48" height="18" rx="3" fill="#131722" stroke={stroke} strokeWidth="1" />
                <text x={p1.x + 64} y={p1.y - 6} fill="#ffffff" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  {angleDeg}°
                </text>
              </g>
            );
          }

          // 10. BENDLINE (Adobe Flash / Animate style bendable Bézier line with Snap target!)
          if (drawing.type === 'bendline' && drawing.points.length >= 2) {
            const p0 = getCoordinates(drawing.points[0]);
            const p1 = getCoordinates(drawing.points[1]);
            if (!p0 || !p1) return null;

            const pc = drawing.controlPoint
              ? getCoordinates(drawing.controlPoint)
              : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
            if (!pc) return null;

            const pathD = `M ${p0.x} ${p0.y} Q ${pc.x} ${pc.y} ${p1.x} ${p1.y}`;
            const isHovered = hoveredBendInfo?.drawingId === drawing.id;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                {/* Thick transparent hit-box path for effortless Adobe Flash/Animate hovering & dragging */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    const closest = findClosestPointOnBendlines(clickX, clickY, 20);
                    bendDragRef.current = {
                      drawingId: drawing.id,
                      type: 'bend',
                      t: closest ? closest.t : 0.5,
                    };
                    setIsBending(true);
                    setSelectedDrawingId(drawing.id);
                  }}
                />

                {/* Primary visible Bézier curve */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isSelected ? 3.5 : isHovered ? 3 : drawing.lineWidth}
                  strokeLinecap="round"
                />

                {/* Endpoints */}
                <circle cx={p0.x} cy={p0.y} r={isSelected ? 5.5 : 4} fill={stroke} stroke="#ffffff" strokeWidth={1} />
                <circle cx={p1.x} cy={p1.y} r={isSelected ? 5.5 : 4} fill={stroke} stroke="#ffffff" strokeWidth={1} />

                {/* Interactive Apex Bend Handle (like Flash / Animate control handle) */}
                {(isSelected || isHovered) && (
                  <g>
                    {/* Dashed control guide when selected */}
                    <line x1={(p0.x + p1.x) / 2} y1={(p0.y + p1.y) / 2} x2={pc.x} y2={pc.y} stroke={stroke} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                    <circle
                      cx={pc.x}
                      cy={pc.y}
                      r={isSelected ? 5.5 : 4.5}
                      fill="#089981"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      title="Drag to bend"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        bendDragRef.current = {
                          drawingId: drawing.id,
                          type: 'bend',
                          t: 0.5,
                        };
                        setIsBending(true);
                        setSelectedDrawingId(drawing.id);
                      }}
                    />
                  </g>
                )}
              </g>
            );
          }

          // 11. PARALLEL CHANNEL
          if (drawing.type === 'parallel_channel' && drawing.points.length >= 2) {
            const p0 = getCoordinates(drawing.points[0]);
            const p1 = getCoordinates(drawing.points[1]);
            if (!p0 || !p1) return null;

            const p2 = drawing.points[2] ? getCoordinates(drawing.points[2]) : null;
            // Default offset perpendicular
            const defaultOffY = 40;
            const offX = p2 ? p2.x - p0.x : 0;
            const offY = p2 ? p2.y - p0.y : defaultOffY;

            const p0_2 = { x: p0.x + offX, y: p0.y + offY };
            const p1_2 = { x: p1.x + offX, y: p1.y + offY };
            const mid0 = { x: (p0.x + p0_2.x) / 2, y: (p0.y + p0_2.y) / 2 };
            const mid1 = { x: (p1.x + p1_2.x) / 2, y: (p1.y + p1_2.y) / 2 };

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                {/* Shaded polygon */}
                <polygon
                  points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p1_2.x},${p1_2.y} ${p0_2.x},${p0_2.y}`}
                  fill={stroke}
                  fillOpacity={0.15}
                />
                {/* Baseline */}
                <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={stroke} strokeWidth={isSelected ? 3 : 2} />
                {/* Parallel line */}
                <line x1={p0_2.x} y1={p0_2.y} x2={p1_2.x} y2={p1_2.y} stroke={stroke} strokeWidth={isSelected ? 3 : 2} />
                {/* 50% Midline */}
                <line x1={mid0.x} y1={mid0.y} x2={mid1.x} y2={mid1.y} stroke={stroke} strokeWidth={1} strokeDasharray="4 3" />

                <circle cx={p0.x} cy={p0.y} r={4} fill={stroke} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                {p2 && <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />}
              </g>
            );
          }

          // 12. REGRESSION TREND
          if (drawing.type === 'regression_trend' && drawing.points.length >= 2) {
            const p0 = getCoordinates(drawing.points[0]);
            const p1 = getCoordinates(drawing.points[1]);
            if (!p0 || !p1) return null;

            const channelHeight = 36;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                {/* Shaded band */}
                <polygon
                  points={`${p0.x},${p0.y - channelHeight} ${p1.x},${p1.y - channelHeight} ${p1.x},${p1.y + channelHeight} ${p0.x},${p0.y + channelHeight}`}
                  fill={stroke}
                  fillOpacity={0.14}
                />
                {/* Central regression line */}
                <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={stroke} strokeWidth={2} />
                {/* Upper band (+2 sigma) */}
                <line x1={p0.x} y1={p0.y - channelHeight} x2={p1.x} y2={p1.y - channelHeight} stroke={stroke} strokeWidth={1.2} strokeDasharray="3 3" />
                {/* Lower band (-2 sigma) */}
                <line x1={p0.x} y1={p0.y + channelHeight} x2={p1.x} y2={p1.y + channelHeight} stroke={stroke} strokeWidth={1.2} strokeDasharray="3 3" />
                <circle cx={p0.x} cy={p0.y} r={4} fill={stroke} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
              </g>
            );
          }

          // 13. FLAT TOP / BOTTOM
          if (drawing.type === 'flat_top_bottom' && drawing.points.length >= 2) {
            const p0 = getCoordinates(drawing.points[0]);
            const p1 = getCoordinates(drawing.points[1]);
            if (!p0 || !p1) return null;

            const p2 = drawing.points[2] ? getCoordinates(drawing.points[2]) : { x: p1.x, y: p0.y - 40 };
            if (!p2) return null;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <polygon points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p1.x},${p2.y} ${p0.x},${p2.y}`} fill={stroke} fillOpacity={0.15} />
                {/* Sloped baseline */}
                <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={stroke} strokeWidth={2} />
                {/* Flat horizontal line */}
                <line x1={p0.x} y1={p2.y} x2={p1.x} y2={p2.y} stroke={stroke} strokeWidth={2} />
                <circle cx={p0.x} cy={p0.y} r={4} fill={stroke} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />
              </g>
            );
          }

          // 14. DISJOINT CHANNEL
          if (drawing.type === 'disjoint_channel' && drawing.points.length >= 2) {
            const p0 = getCoordinates(drawing.points[0]);
            const p1 = getCoordinates(drawing.points[1]);
            if (!p0 || !p1) return null;

            const p2 = drawing.points[2] ? getCoordinates(drawing.points[2]) : { x: p1.x, y: p1.y + 60 };
            if (!p2) return null;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <polygon points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={stroke} fillOpacity={0.15} />
                <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={stroke} strokeWidth={2} />
                <line x1={p0.x} y1={p0.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={2} />
                <circle cx={p0.x} cy={p0.y} r={4} fill={stroke} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />
              </g>
            );
          }

          // 15-18. PITCHFORKS (Pitchfork, Schiff, Modified Schiff, Inside)
          if (
            ['pitchfork', 'schiff_pitchfork', 'modified_schiff_pitchfork', 'inside_pitchfork'].includes(
              drawing.type
            ) &&
            drawing.points.length >= 2
          ) {
            const p0 = getCoordinates(drawing.points[0]);
            const p1 = getCoordinates(drawing.points[1]);
            if (!p0 || !p1) return null;

            const p2 = drawing.points[2] ? getCoordinates(drawing.points[2]) : { x: p1.x, y: p1.y + 70 };
            if (!p2) return null;

            const midSwing = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            let origin = p0;

            if (drawing.type === 'schiff_pitchfork') {
              origin = { x: p0.x, y: (p0.y + midSwing.y) / 2 };
            } else if (drawing.type === 'modified_schiff_pitchfork') {
              origin = { x: (p0.x + midSwing.x) / 2, y: (p0.y + midSwing.y) / 2 };
            } else if (drawing.type === 'inside_pitchfork') {
              origin = midSwing;
            }

            const dx = midSwing.x - origin.x;
            const dy = midSwing.y - origin.y;
            const len = Math.hypot(dx, dy) || 1;
            const extLen = 2000;
            const medianEnd = { x: origin.x + (dx / len) * extLen, y: origin.y + (dy / len) * extLen };
            const prong1End = { x: p1.x + (dx / len) * extLen, y: p1.y + (dy / len) * extLen };
            const prong2End = { x: p2.x + (dx / len) * extLen, y: p2.y + (dy / len) * extLen };

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                {/* Prongs & Median */}
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={1} strokeDasharray="3 3" />
                <line x1={origin.x} y1={origin.y} x2={medianEnd.x} y2={medianEnd.y} stroke={stroke} strokeWidth={2} />
                <line x1={p1.x} y1={p1.y} x2={prong1End.x} y2={prong1End.y} stroke={stroke} strokeWidth={1.5} />
                <line x1={p2.x} y1={p2.y} x2={prong2End.x} y2={prong2End.y} stroke={stroke} strokeWidth={1.5} />

                <circle cx={origin.x} cy={origin.y} r={4} fill={stroke} />
                <circle cx={p1.x} cy={p1.y} r={4} fill={stroke} />
                <circle cx={p2.x} cy={p2.y} r={4} fill={stroke} />
              </g>
            );
          }

          // 19. RECTANGLE
          if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);
            const width = Math.abs(p2.x - p1.x);
            const height = Math.abs(p2.y - p1.y);

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={stroke}
                  fillOpacity={0.15}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
              </g>
            );
          }

          // 20. FIBONACCI RETRACEMENT
          if (drawing.type === 'fibonacci' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
            const colors = ['#787b86', '#f23645', '#ff9800', '#089981', '#2962ff', '#9c27b0', '#787b86'];
            const startY = p1.y;
            const endY = p2.y;
            const diffY = endY - startY;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                {levels.map((lvl, idx) => {
                  const y = startY + diffY * lvl;
                  const price = drawing.points[0].price + (drawing.points[1].price - drawing.points[0].price) * lvl;
                  return (
                    <g key={lvl}>
                      <line
                        x1={Math.min(p1.x, p2.x)}
                        y1={y}
                        x2="100%"
                        y2={y}
                        stroke={colors[idx] || stroke}
                        strokeWidth={1}
                        strokeDasharray={lvl === 0.5 ? 'none' : '3 2'}
                      />
                      <text
                        x={Math.min(p1.x, p2.x) + 4}
                        y={y - 3}
                        fill={colors[idx] || stroke}
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {lvl} ({price.toFixed(2)})
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          }

          // 21. MEASURE
          if (drawing.type === 'measure' && drawing.points.length >= 2) {
            const p1 = getCoordinates(drawing.points[0]);
            const p2 = getCoordinates(drawing.points[1]);
            if (!p1 || !p2) return null;

            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);
            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);
            const deltaPrice = drawing.points[1].price - drawing.points[0].price;
            const pct = ((deltaPrice / drawing.points[0].price) * 100).toFixed(2);
            const isUp = deltaPrice >= 0;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={isUp ? '#089981' : '#f23645'}
                  fillOpacity={0.16}
                  stroke={isUp ? '#089981' : '#f23645'}
                  strokeWidth={1.5}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {isUp ? '+' : ''}
                  {deltaPrice.toFixed(2)} ({pct}%)
                </text>
              </g>
            );
          }

          // 22. TEXT
          if (drawing.type === 'text') {
            const p = getCoordinates(drawing.points[0]);
            if (!p) return null;
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawingId(drawing.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(drawing.id);
                  setTextInputVal(drawing.text || '');
                }}
              >
                <rect
                  x={p.x - 4}
                  y={p.y - 18}
                  width={(drawing.text?.length || 4) * 8 + 16}
                  height={24}
                  fill="#1e222d"
                  stroke={isSelected ? '#2962ff' : '#2a2e39'}
                  strokeWidth={1.5}
                  rx={4}
                />
                <text x={p.x + 4} y={p.y - 2} fill="#d1d4dc" fontSize="12" fontWeight="500">
                  {drawing.text || 'Text'}
                </text>
              </g>
            );
          }

            return null;
          };

          const content = renderDrawingContent();
          if (!content) return null;

          return (
            <g
              key={drawing.id}
              className="pointer-events-auto cursor-pointer"
              onClick={(e) => handleDrawingClick(e, drawing)}
              onDoubleClick={(e) => handleDrawingDoubleClick(e, drawing)}
              onContextMenu={(e) => handleDrawingContextMenu(e, drawing)}
            >
              {content}
            </g>
          );
        })}

        {/* ---------------------------------------------------------------- */}
        {/* LIVE PREVIEW WHILE DRAWING IN PROGRESS                           */}
        {/* ---------------------------------------------------------------- */}
        {inProgressPoints.length > 0 && cursorPos && (
          <g>
            {(() => {
              const p0 = getCoordinates(inProgressPoints[0]);
              if (!p0) return null;

              // Line tools: trendline, ray, info_line, extended_line, trend_angle, bendline
              if (
                [
                  'trendline',
                  'ray',
                  'info_line',
                  'extended_line',
                  'trend_angle',
                  'bendline',
                  'regression_trend',
                ].includes(activeTool)
              ) {
                return (
                  <g>
                    <line
                      x1={p0.x}
                      y1={p0.y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke={currentColor}
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                    <circle cx={p0.x} cy={p0.y} r={4} fill={currentColor} />
                    <circle cx={cursorPos.x} cy={cursorPos.y} r={4} fill={currentColor} />
                  </g>
                );
              }

              // 3-point tools in progress
              if (inProgressPoints.length === 1) {
                return (
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={cursorPos.x}
                    y2={cursorPos.y}
                    stroke={currentColor}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                );
              }

              if (inProgressPoints.length === 2) {
                const p1 = getCoordinates(inProgressPoints[1]);
                if (!p1) return null;
                return (
                  <g>
                    <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={currentColor} strokeWidth={2} />
                    <line x1={p1.x} y1={p1.y} x2={cursorPos.x} y2={cursorPos.y} stroke={currentColor} strokeWidth={1.5} strokeDasharray="3 3" />
                  </g>
                );
              }

              // Rectangles / Measure
              if (activeTool === 'rectangle' || activeTool === 'measure') {
                const x = Math.min(p0.x, cursorPos.x);
                const y = Math.min(p0.y, cursorPos.y);
                const w = Math.abs(cursorPos.x - p0.x);
                const h = Math.abs(cursorPos.y - p0.y);
                return (
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={currentColor}
                    fillOpacity={0.15}
                    stroke={currentColor}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                );
              }

              // Fibonacci
              if (activeTool === 'fibonacci') {
                return (
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={cursorPos.x}
                    y2={cursorPos.y}
                    stroke={currentColor}
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                );
              }

              return null;
            })()}
          </g>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MAGNETIC SNAP INDICATOR FOR BENDLINE                             */}
        {/* "Additionally, the user can snap the edge of other lines to ANY point on a bendline if it is close enough" */}
        {/* ---------------------------------------------------------------- */}
        {activeSnap && (
          <g transform={`translate(${activeSnap.x}, ${activeSnap.y})`} className="pointer-events-none">
            {/* Clean snapping indicator without text box */}
            <circle cx="0" cy="0" r="10" fill="none" stroke="#2962ff" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9" />
            <circle cx="0" cy="0" r="4" fill="#2962ff" fillOpacity="0.4" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
          </g>
        )}
      </svg>

      {/* Floating Action Bar when a Drawing is Selected */}
      {selectedDrawingId && !editingTextId && (
        <div
          id="drawing-selected-bar"
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] px-3 py-1.5 rounded-lg shadow-2xl flex items-center gap-3 z-30 pointer-events-auto"
        >
          {(() => {
            const sel = drawings.find((d) => d.id === selectedDrawingId);
            const label = sel ? sel.type.replace('_', ' ').toUpperCase() : 'DRAWING';
            return (
              <span className="text-xs font-semibold text-[#00ffa3] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {label} SELECTED
              </span>
            );
          })()}

          <div className="h-4 w-px bg-[#2a2e39]" />

          {/* Line Style toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setDrawings((prev) =>
                  prev.map((d) =>
                    d.id === selectedDrawingId
                      ? { ...d, lineStyle: d.lineStyle === 'dashed' ? 'solid' : 'dashed' }
                      : d
                  )
                );
              }}
              className="px-2 py-1 text-[11px] bg-[#131722] hover:bg-[#2a2e39] border border-[#2a2e39] rounded text-[#d1d4dc] transition cursor-pointer"
            >
              Style
            </button>
          </div>

          <div className="h-4 w-px bg-[#2a2e39]" />

          {/* Delete selected drawing button */}
          <button
            id="delete-selected-drawing-btn"
            onClick={() => {
              setDrawings((prev) => prev.filter((d) => d.id !== selectedDrawingId));
              setSelectedDrawingId(null);
            }}
            className="flex items-center gap-1 text-xs text-[#f23645] hover:bg-[#f23645]/15 px-2.5 py-1 rounded transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Text Note Edit Modal Input */}
      {editingTextId && (
        <div
          id="text-drawing-modal"
          className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-[#1e222d] border border-[#363c4e] p-3 rounded-lg shadow-2xl z-40 pointer-events-auto flex flex-col gap-2 min-w-[240px]"
        >
          <div className="flex items-center justify-between text-xs text-[#787b86]">
            <span>Edit Note</span>
          </div>
          <input
            id="text-drawing-input"
            type="text"
            value={textInputVal}
            onChange={(e) => setTextInputVal(e.target.value)}
            autoFocus
            className="bg-[#131722] border border-[#2a2e39] px-2 py-1.5 rounded text-sm text-[#d1d4dc] focus:outline-none focus:border-[#2962ff]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDrawings((prev) =>
                  prev.map((d) => (d.id === editingTextId ? { ...d, text: textInputVal } : d))
                );
                setEditingTextId(null);
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setEditingTextId(null)}
              className="px-2 py-1 text-xs text-[#787b86] hover:text-[#d1d4dc] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setDrawings((prev) =>
                  prev.map((d) => (d.id === editingTextId ? { ...d, text: textInputVal } : d))
                );
                setEditingTextId(null);
              }}
              className="px-3 py-1 bg-[#2962ff] text-white text-xs rounded hover:bg-[#2962ff]/90 cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Drawing Context Menu (Right Click on Dependency) */}
      {drawingContextMenu && (
        <div
          style={{ left: `${drawingContextMenu.x}px`, top: `${drawingContextMenu.y}px` }}
          className="fixed z-50 bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl py-1 text-xs text-[#d1d4dc] min-w-[240px] select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-[#2a2e39] font-bold text-[10px] text-[#787b86] uppercase tracking-wider flex items-center justify-between">
            <span>
              {drawingContextMenu.drawing.type.toUpperCase()}{' '}
              {drawingContextMenu.drawing.label ? `(${drawingContextMenu.drawing.label})` : ''}
            </span>
            <span className="text-[9px] text-[#2962ff] font-mono">
              ${(drawingContextMenu.drawing.points[0]?.price || 0).toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => {
              const d = drawingContextMenu.drawing;
              setDrawingContextMenu(null);
              onOpenConditionalOrder?.({
                type: 'drawing',
                drawing: d,
                id: d.id,
                label: `${d.type.toUpperCase()} (${d.label || `#${d.id.slice(0, 4)}`})`,
                price: d.points[0]?.price,
              });
            }}
            className="w-full px-3 py-2 text-left hover:bg-[#2962ff] hover:text-white transition flex items-center gap-2 font-semibold"
          >
            <Zap className="w-3.5 h-3.5 text-[#00ffa3]" />
            <span>Create Conditional Order on Drawing</span>
          </button>

          <button
            onClick={() => {
              setDrawings((prev) => prev.filter((d) => d.id !== drawingContextMenu.drawing.id));
              setDrawingContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-[#f23645] hover:text-white transition flex items-center gap-2 text-[#f23645]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Drawing</span>
          </button>
        </div>
      )}
    </div>
  );
};
