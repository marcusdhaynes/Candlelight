import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Asset, OHLCV, Timeframe, ChartType } from '../types';
import { X, GripVertical, Minimize2, ExternalLink } from 'lucide-react';

export interface ChartPictureInPictureRef {
  togglePip: () => Promise<void>;
  isPipActive: boolean;
}

interface ChartPictureInPictureProps {
  activeAsset: Asset;
  candles: OHLCV[];
  activeTimeframe: Timeframe;
  chartType?: ChartType;
  onChangeTimeframe?: (tf: Timeframe) => void;
  onPipStateChange?: (isActive: boolean) => void;
  onError?: (msg: string) => void;
}

export const ChartPictureInPicture = forwardRef<
  ChartPictureInPictureRef,
  ChartPictureInPictureProps
>(({ activeAsset, candles, activeTimeframe, chartType = 'candlestick', onChangeTimeframe, onPipStateChange, onError }, ref) => {
  const [isPipActive, setIsPipActive] = useState(false);
  const isPipActiveRef = useRef(false);

  // References to OS PiP window / elements
  const docPipWindowRef = useRef<Window | null>(null);
  const docPipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoPipElementRef = useRef<HTMLVideoElement | null>(null);
  const videoPipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoPipStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Chart settings inside PiP
  const isLineType = chartType === 'line' || chartType === 'step-line' || chartType === 'area' || chartType === 'baseline';
  const [chartMode, setChartMode] = useState<'candles' | 'line'>(() => isLineType ? 'line' : 'candles');
  const chartModeRef = useRef<'candles' | 'line'>('candles');
  chartModeRef.current = chartMode;

  useEffect(() => {
    const isLine = chartType === 'line' || chartType === 'step-line' || chartType === 'area' || chartType === 'baseline';
    setChartMode(isLine ? 'line' : 'candles');
  }, [chartType]);

  // Track latest asset and candles via refs for draw loop
  const assetRef = useRef(activeAsset);
  assetRef.current = activeAsset;
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const timeframeRef = useRef(activeTimeframe);
  timeframeRef.current = activeTimeframe;

  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [overlayPos, setOverlayPos] = useState({ x: 30, y: 70 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const inAppCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync isPipActive state with parent
  const updatePipActive = (active: boolean) => {
    setIsPipActive(active);
    isPipActiveRef.current = active;
    if (!active) {
      setIsOverlayActive(false);
    }
    onPipStateChange?.(active);
  };

  // High-performance canvas chart drawing routine for Picture-in-Picture
  const drawChart = (canvas: HTMLCanvasElement, width: number, height: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1.5;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    const asset = assetRef.current;
    const curCandles = candlesRef.current;
    const curTf = timeframeRef.current;

    // Background
    ctx.fillStyle = '#131722';
    ctx.fillRect(0, 0, width, height);

    // Header Bar background
    ctx.fillStyle = '#1e222d';
    ctx.fillRect(0, 0, width, 38);

    // Asset Symbol & Details
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(asset.symbol, 12, 24);

    const symbolW = ctx.measureText(asset.symbol).width;
    ctx.fillStyle = '#787b86';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(`• ${curTf} • ${asset.exchange || 'CRYPTO'}`, 12 + symbolW + 6, 23);

    // Live Price and 24h Change
    const isUp = asset.change24h >= 0;
    const accentColor = isUp ? '#089981' : '#f23645';
    const priceText = `$${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const changeText = `${isUp ? '+' : ''}${asset.changePercent24h.toFixed(2)}%`;

    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'right';
    ctx.fillText(priceText, width - 90, 24);

    ctx.font = '10.5px system-ui, -apple-system, sans-serif';
    ctx.fillText(changeText, width - 24, 23);

    // Pulsing Live Indicator
    ctx.fillStyle = '#089981';
    ctx.beginPath();
    ctx.arc(width - 12, 12, 3, 0, Math.PI * 2);
    ctx.fill();

    // Chart dimensions
    const topMargin = 46;
    const bottomMargin = 24;
    const rightMargin = 60;
    const leftMargin = 12;
    const chartW = width - leftMargin - rightMargin;
    const chartH = height - topMargin - bottomMargin;

    if (chartW <= 0 || chartH <= 0) return;

    // Slice last 50 candles for high-clarity mini display
    const slice = curCandles.slice(-50);
    if (slice.length === 0) {
      ctx.fillStyle = '#787b86';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Streaming market feed...', width / 2, height / 2);
      return;
    }

    // Min / Max calculation
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    slice.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    if (minPrice === maxPrice) {
      minPrice -= 1;
      maxPrice += 1;
    }
    const padding = (maxPrice - minPrice) * 0.08;
    minPrice -= padding;
    maxPrice += padding;
    const priceRange = maxPrice - minPrice;

    const getY = (p: number) => topMargin + chartH - ((p - minPrice) / priceRange) * chartH;

    // Horizontal Gridlines & Price Scale
    ctx.strokeStyle = '#1e222d';
    ctx.lineWidth = 1;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const p = minPrice + (priceRange / steps) * i;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(leftMargin + chartW, y);
      ctx.stroke();

      ctx.fillStyle = '#787b86';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(asset.digits > 2 ? 2 : asset.digits), leftMargin + chartW + 6, y + 3);
    }

    const candleWidth = Math.max(3, chartW / slice.length);
    const bodyWidth = Math.max(2, candleWidth * 0.7);

    if (chartModeRef.current === 'line') {
      // Area gradient
      const grad = ctx.createLinearGradient(0, topMargin, 0, topMargin + chartH);
      grad.addColorStop(0, isUp ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)');
      grad.addColorStop(1, 'rgba(19, 23, 34, 0)');

      ctx.beginPath();
      slice.forEach((c, i) => {
        const x = leftMargin + i * candleWidth + candleWidth / 2;
        const y = getY(c.close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(leftMargin + (slice.length - 1) * candleWidth + candleWidth / 2, topMargin + chartH);
      ctx.lineTo(leftMargin + candleWidth / 2, topMargin + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      slice.forEach((c, i) => {
        const x = leftMargin + i * candleWidth + candleWidth / 2;
        const y = getY(c.close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      // Candlesticks
      slice.forEach((c, i) => {
        const x = leftMargin + i * candleWidth + candleWidth / 2;
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#089981' : '#f23645';

        // Wick
        const yHigh = getY(c.high);
        const yLow = getY(c.low);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Body
        const yOpen = getY(c.open);
        const yClose = getY(c.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.5, Math.abs(yOpen - yClose));

        ctx.fillStyle = color;
        ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyH);
      });
    }

    // Dashed line for current live price
    const curY = getY(asset.price);
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, curY);
    ctx.lineTo(leftMargin + chartW, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Right-hand price tag badge
    ctx.fillStyle = accentColor;
    const tagW = 54;
    const tagH = 14;
    const tagX = leftMargin + chartW + 2;
    const tagY = curY - tagH / 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagW, tagH, 2);
      ctx.fill();
    } else {
      ctx.fillRect(tagX, tagY, tagW, tagH);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      asset.price.toFixed(asset.digits > 2 ? 2 : asset.digits),
      tagX + tagW / 2,
      tagY + 10.5
    );

    // Live Clock at Bottom Left
    const timeStr = new Date().toLocaleTimeString();
    ctx.fillStyle = '#787b86';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`PICTURE-IN-PICTURE • ${timeStr}`, leftMargin, height - 8);
  };

  // Continuous animation loop for any active PiP instance
  useEffect(() => {
    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;

      if (docPipCanvasRef.current && docPipWindowRef.current) {
        drawChart(
          docPipCanvasRef.current,
          docPipWindowRef.current.innerWidth || 520,
          docPipWindowRef.current.innerHeight || 340
        );
      }

      if (videoPipCanvasRef.current && isPipActiveRef.current) {
        drawChart(videoPipCanvasRef.current, 540, 360);
      }

      if (inAppCanvasRef.current && isOverlayActive) {
        drawChart(inAppCanvasRef.current, 500, 310);
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    if (isPipActive) {
      loop();
    }

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPipActive]);

  // Clean up PiP if component unmounts
  useEffect(() => {
    return () => {
      if (docPipWindowRef.current) {
        try {
          docPipWindowRef.current.close();
        } catch {}
      }
      if (document.pictureInPictureElement) {
        try {
          document.exitPictureInPicture().catch(() => {});
        } catch {}
      }
    };
  }, []);

  // Main PiP toggle method
  const togglePip = async () => {
    // 1. If PiP is currently active, exit it
    if (isPipActiveRef.current) {
      if (docPipWindowRef.current) {
        try {
          docPipWindowRef.current.close();
        } catch {}
        docPipWindowRef.current = null;
      }
      if (document.pictureInPictureElement) {
        try {
          await document.exitPictureInPicture();
        } catch {}
      }
      updatePipActive(false);
      return;
    }

    // 2. Try Document Picture-in-Picture API (Chrome/Edge 116+)
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 520,
          height: 340,
        });

        docPipWindowRef.current = pipWindow;
        pipWindow.document.title = `${assetRef.current.symbol} - TradingView PiP`;
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.backgroundColor = '#131722';
        pipWindow.document.body.style.overflow = 'hidden';

        // Copy styles
        [...document.styleSheets].forEach((sheet) => {
          try {
            const css = [...sheet.cssRules].map((r) => r.cssText).join('');
            const style = pipWindow.document.createElement('style');
            style.textContent = css;
            pipWindow.document.head.appendChild(style);
          } catch {
            const link = pipWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.type = sheet.type;
            link.media = sheet.media;
            link.href = sheet.href;
            pipWindow.document.head.appendChild(link);
          }
        });

        // Top timeframe / control bar inside PiP window
        const toolbar = pipWindow.document.createElement('div');
        toolbar.style.display = 'flex';
        toolbar.style.alignItems = 'center';
        toolbar.style.justifyContent = 'space-between';
        toolbar.style.padding = '4px 10px';
        toolbar.style.backgroundColor = '#1e222d';
        toolbar.style.borderBottom = '1px solid #2a2e39';
        toolbar.style.color = '#d1d4dc';
        toolbar.style.fontSize = '11px';
        toolbar.style.fontFamily = 'system-ui, sans-serif';
        toolbar.style.userSelect = 'none';

        // Timeframe selector buttons
        const tfContainer = pipWindow.document.createElement('div');
        tfContainer.style.display = 'flex';
        tfContainer.style.gap = '4px';

        const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '1D'];
        timeframes.forEach((tf) => {
          const btn = pipWindow.document.createElement('button');
          btn.textContent = tf;
          btn.style.padding = '2px 6px';
          btn.style.fontSize = '10px';
          btn.style.borderRadius = '3px';
          btn.style.border = 'none';
          btn.style.cursor = 'pointer';
          btn.style.backgroundColor = tf === timeframeRef.current ? '#2962ff' : '#131722';
          btn.style.color = '#ffffff';
          btn.onclick = () => {
            onChangeTimeframe?.(tf);
            Array.from(tfContainer.children).forEach((c: any) => {
              c.style.backgroundColor = '#131722';
            });
            btn.style.backgroundColor = '#2962ff';
          };
          tfContainer.appendChild(btn);
        });

        // Toggle Candlestick vs Line
        const modeBtn = pipWindow.document.createElement('button');
        modeBtn.textContent = 'Toggle Line/Candle';
        modeBtn.style.padding = '2px 8px';
        modeBtn.style.fontSize = '10px';
        modeBtn.style.borderRadius = '3px';
        modeBtn.style.border = '1px solid #2a2e39';
        modeBtn.style.cursor = 'pointer';
        modeBtn.style.backgroundColor = '#131722';
        modeBtn.style.color = '#d1d4dc';
        modeBtn.onclick = () => {
          setChartMode((prev) => (prev === 'candles' ? 'line' : 'candles'));
        };

        toolbar.appendChild(tfContainer);
        toolbar.appendChild(modeBtn);
        pipWindow.document.body.appendChild(toolbar);

        // Chart Canvas inside PiP
        const canvas = pipWindow.document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = 'calc(100% - 30px)';
        canvas.style.display = 'block';
        pipWindow.document.body.appendChild(canvas);
        docPipCanvasRef.current = canvas;

        pipWindow.addEventListener('pagehide', () => {
          docPipWindowRef.current = null;
          docPipCanvasRef.current = null;
          updatePipActive(false);
        });

        pipWindow.addEventListener('resize', () => {
          if (docPipCanvasRef.current) {
            drawChart(
              docPipCanvasRef.current,
              pipWindow.innerWidth || 520,
              pipWindow.innerHeight - 30 || 310
            );
          }
        });

        updatePipActive(true);
        return;
      } catch (err: any) {
        console.warn('Document Picture-in-Picture request failed, falling back to Video PiP:', err);
      }
    }

    // 3. Fallback to HTML5 Video Picture-in-Picture (Canvas Stream)
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        updatePipActive(false);
        return;
      }

      let canvas = videoPipCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 540;
        canvas.height = 360;
        videoPipCanvasRef.current = canvas;
      }

      // Initial draw
      drawChart(canvas, 540, 360);

      // Create stream
      const stream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).mozCaptureStream?.(30);
      if (!stream) {
        throw new Error('Canvas captureStream not supported in this browser.');
      }
      videoPipStreamRef.current = stream;

      let video = videoPipElementRef.current;
      if (!video) {
        video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.style.position = 'fixed';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        document.body.appendChild(video);
        videoPipElementRef.current = video;

        video.addEventListener('leavepictureinpicture', () => {
          updatePipActive(false);
        });
      }

      video.srcObject = stream;
      await video.play();
      await video.requestPictureInPicture();
      updatePipActive(true);
    } catch (err: any) {
      // Seamless fallback: If native OS Picture-in-Picture cannot be requested
      // (e.g. inside sandboxed iframe without allow="picture-in-picture"),
      // seamlessly open the in-page Floating Picture-in-Picture window!
      setIsOverlayActive(true);
      updatePipActive(true);
    }
  };

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      dragOffsetRef.current = {
        x: e.clientX - overlayPos.x,
        y: e.clientY - overlayPos.y,
      };
      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const newX = Math.max(10, Math.min(window.innerWidth - 530, moveEvent.clientX - dragOffsetRef.current.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 340, moveEvent.clientY - dragOffsetRef.current.y));
        setOverlayPos({ x: newX, y: newY });
      };
      const onMouseUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [overlayPos]
  );

  useImperativeHandle(ref, () => ({
    togglePip,
    isPipActive,
  }));

  if (!isOverlayActive) return null;

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '1D'];

  return (
    <div
      id="floating-pip-chart-window"
      style={{ left: `${overlayPos.x}px`, top: `${overlayPos.y}px` }}
      className="fixed z-50 w-[500px] h-[350px] bg-[#131722] border border-[#2a2e39] rounded-xl shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleDragStart}
        className="h-9 px-3 bg-[#1e222d] border-b border-[#2a2e39] flex items-center justify-between cursor-move"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-[#787b86]" />
          <span className="font-bold text-xs text-white">{activeAsset.symbol}</span>
          <span className="text-[10px] text-[#787b86]">Picture-in-Picture</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#2962ff]/20 text-[#2962ff] font-medium border border-[#2962ff]/40">
            Always on Top
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setChartMode((prev) => (prev === 'candles' ? 'line' : 'candles'))}
            className="px-2 py-0.5 rounded text-[10px] bg-[#131722] border border-[#2a2e39] text-[#d1d4dc] hover:text-white transition"
            title="Toggle Line / Candles"
          >
            {chartMode === 'candles' ? 'Line' : 'Candles'}
          </button>
          <button
            onClick={() => updatePipActive(false)}
            className="p-1 rounded text-[#787b86] hover:text-white hover:bg-[#2a2e39] transition"
            title="Close Picture-in-Picture"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeframes Bar */}
      <div className="h-6 px-3 bg-[#181b24] border-b border-[#2a2e39]/60 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe?.(tf)}
              className={`px-1.5 py-0.5 rounded transition ${
                tf === activeTimeframe
                  ? 'bg-[#2962ff] text-white font-medium'
                  : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-mono text-[#787b86]">
          {activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
          <span className={activeAsset.change24h >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>
            {activeAsset.change24h >= 0 ? '+' : ''}
            {activeAsset.changePercent24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* High-res Chart Canvas */}
      <div className="flex-1 bg-[#131722] relative">
        <canvas
          ref={inAppCanvasRef}
          width={500}
          height={310}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
});
