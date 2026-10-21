import React, { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  BaselineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineStyle,
  LineType,
} from 'lightweight-charts';
import {
  Asset,
  ChartType,
  Drawing,
  DrawingToolType,
  IndicatorSettings,
  OHLCV,
  Timeframe,
  PaperPosition,
  DependencyContext,
} from '../types';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateVWAP,
  convertToHeikinAshi,
} from '../services/indicators';
import { DrawingOverlay } from './DrawingOverlay';
import {
  Eye,
  Settings,
  X,
  MoreHorizontal,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';

export interface MainChartRef {
  fitContent: () => void;
  selectRange: (days: number) => void;
  takeSnapshot: () => void;
  getChart: () => IChartApi | null;
}

interface MainChartProps {
  asset: Asset;
  timeframe: Timeframe;
  chartType: ChartType;
  candles: OHLCV[];
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
  onOpenConditionalOrder?: (dep: DependencyContext) => void;
}

function formatHollowCandles(candles: OHLCV[]) {
  return candles.map((c, i) => {
    const prevClose = i > 0 ? candles[i - 1].close : c.open;
    const isPriceUp = c.close >= prevClose;
    const isBodyUp = c.close >= c.open;
    const stroke = isPriceUp ? '#089981' : '#f23645';
    // Hollow body if close >= open, solid body if close < open
    const fill = isBodyUp ? '#131722' : stroke;
    return {
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      color: fill,
      borderColor: stroke,
      wickColor: stroke,
    };
  });
}

export const MainChart = React.memo(
  forwardRef<MainChartRef, MainChartProps>(
    (
      {
      asset,
      timeframe,
      chartType,
      candles,
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
      onOpenConditionalOrder,
    },
    ref
  ) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartApiRef = useRef<IChartApi | null>(null);
    const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
    const activeSeriesRef = useRef<ISeriesApi<any>[]>([]);
    const seriesBundleRef = useRef<{
      symbol: string;
      timeframe: string;
      chartType: ChartType;
      indicatorsKey: string;
      mainSeries: ISeriesApi<any>;
      volumeSeries?: ISeriesApi<any>;
      candleCount: number;
      firstCandleTime: number;
    } | null>(null);

    const indicatorsKey = useMemo(() => JSON.stringify(indicators), [indicators]);

    // Track crosshair hovered candle for Legend display
    const [hoveredCandle, setHoveredCandle] = useState<OHLCV | null>(null);

    // Latest candle to show when not hovering
    const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    const displayCandle = hoveredCandle || latestCandle;

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      fitContent: () => {
        chartApiRef.current?.timeScale().fitContent();
      },
      selectRange: (days: number) => {
        if (!chartApiRef.current || candles.length === 0) return;
        const lastTime = candles[candles.length - 1].time;
        const fromTime = lastTime - days * 86400;
        chartApiRef.current.timeScale().setVisibleRange({
          from: fromTime as any,
          to: lastTime as any,
        });
      },
      takeSnapshot: () => {
        if (!chartContainerRef.current) return;
        const canvas = chartContainerRef.current.querySelector('canvas');
        if (!canvas) return;
        try {
          const imgUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = imgUrl;
          a.download = `${asset.symbol}_${timeframe}_chart.png`;
          a.click();
        } catch (err) {
          console.error('Failed to take snapshot:', err);
        }
      },
      getChart: () => chartApiRef.current,
    }));

    // Initialize Chart
    useEffect(() => {
      if (!chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#131722' },
          textColor: '#787b86',
          fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 9,
        },
        grid: {
          vertLines: { color: '#1e222d', style: LineStyle.Solid },
          horzLines: { color: '#1e222d', style: LineStyle.Solid },
        },
        crosshair: {
          mode: isMagnetMode ? CrosshairMode.Magnet : CrosshairMode.Normal,
          vertLine: {
            color: '#787b86',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#2a2e39',
          },
          horzLine: {
            color: '#787b86',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#2a2e39',
          },
        },
        rightPriceScale: {
          borderColor: '#363a45',
          mode: isLogScale
            ? PriceScaleMode.Logarithmic
            : isPercentScale
            ? PriceScaleMode.Percentage
            : PriceScaleMode.Normal,
          autoScale: true,
          alignLabels: true,
        },
        timeScale: {
          borderColor: '#2a2e39',
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
      });

      chartApiRef.current = chart;

      // Handle ResizeObserver
      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      });
      resizeObserver.observe(chartContainerRef.current);

      // Subscribe to Crosshair hover
      const handleCrosshairMove = (param: any) => {
        if (!param || !param.time || !mainSeriesRef.current) {
          setHoveredCandle(null);
          return;
        }

        const barData = param.seriesData.get(mainSeriesRef.current);
        if (barData) {
          if ('open' in barData && 'close' in barData) {
            setHoveredCandle({
              time: Number(barData.time),
              open: barData.open,
              high: barData.high,
              low: barData.low,
              close: barData.close,
              volume: (barData as any).volume || 0,
            });
          } else if ('value' in barData) {
            setHoveredCandle({
              time: Number(barData.time),
              open: barData.value,
              high: barData.value,
              low: barData.value,
              close: barData.value,
              volume: 0,
            });
          }
        } else {
          setHoveredCandle(null);
        }
      };

      chart.subscribeCrosshairMove(handleCrosshairMove);

      return () => {
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
        resizeObserver.disconnect();
        activeSeriesRef.current.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch {
            // Ignore
          }
        });
        activeSeriesRef.current = [];
        chart.remove();
        chartApiRef.current = null;
        mainSeriesRef.current = null;
        seriesBundleRef.current = null;
      };
    }, []);

    // Update Price Scale Modes
    useEffect(() => {
      if (!chartApiRef.current) return;
      chartApiRef.current.priceScale('right').applyOptions({
        mode: isLogScale
          ? PriceScaleMode.Logarithmic
          : isPercentScale
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal,
      });
    }, [isLogScale, isPercentScale]);

    // Update Magnet Crosshair
    useEffect(() => {
      if (!chartApiRef.current) return;
      chartApiRef.current.applyOptions({
        crosshair: {
          mode: isMagnetMode ? CrosshairMode.Magnet : CrosshairMode.Normal,
        },
      });
    }, [isMagnetMode]);

    // Populate Series & Indicators or Incremental Real-time Update
    useEffect(() => {
      const chart = chartApiRef.current;
      if (!chart || candles.length === 0) return;

      const chartCandles =
        chartType === 'heikin-ashi' ? convertToHeikinAshi(candles) : candles;
      const lastCandle = chartCandles[chartCandles.length - 1];
      const firstCandle = chartCandles[0];

      const bundle = seriesBundleRef.current;
      const isSameConfig =
        bundle !== null &&
        bundle.symbol === asset.symbol &&
        bundle.timeframe === timeframe &&
        bundle.chartType === chartType &&
        bundle.indicatorsKey === indicatorsKey &&
        bundle.firstCandleTime === firstCandle?.time &&
        Math.abs(candles.length - bundle.candleCount) <= 2;

      // FAST PATH: Real-time incremental tick update (O(1) execution, instant)
      if (isSameConfig && bundle && lastCandle) {
        if (
          chartType === 'line' ||
          chartType === 'step-line' ||
          chartType === 'area' ||
          chartType === 'baseline'
        ) {
          bundle.mainSeries.update({
            time: lastCandle.time as any,
            value: lastCandle.close,
          });
        } else if (chartType === 'column') {
          bundle.mainSeries.update({
            time: lastCandle.time as any,
            value: lastCandle.close,
            color:
              lastCandle.close >= lastCandle.open
                ? 'rgba(8, 153, 129, 0.85)'
                : 'rgba(242, 54, 69, 0.85)',
          });
        } else if (chartType === 'hollow') {
          const prevCandle =
            chartCandles.length > 1
              ? chartCandles[chartCandles.length - 2]
              : null;
          const prevClose = prevCandle ? prevCandle.close : lastCandle.open;
          const isPriceUp = lastCandle.close >= prevClose;
          const isBodyUp = lastCandle.close >= lastCandle.open;
          const stroke = isPriceUp ? '#089981' : '#f23645';
          const fill = isBodyUp ? '#131722' : stroke;
          bundle.mainSeries.update({
            time: lastCandle.time as any,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
            color: fill,
            borderColor: stroke,
            wickColor: stroke,
          });
        } else if (chartType === 'high-low') {
          const prevCandle =
            chartCandles.length > 1
              ? chartCandles[chartCandles.length - 2]
              : null;
          const prevClose = prevCandle ? prevCandle.close : lastCandle.open;
          const isUp = lastCandle.close >= prevClose;
          bundle.mainSeries.update({
            time: lastCandle.time as any,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
            color: isUp ? '#089981' : '#f23645',
          });
        } else {
          // candlestick, heikin-ashi, bar
          bundle.mainSeries.update({
            time: lastCandle.time as any,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          });
        }

        if (bundle.volumeSeries) {
          bundle.volumeSeries.update({
            time: lastCandle.time as any,
            value: lastCandle.volume,
            color:
              lastCandle.close >= lastCandle.open
                ? 'rgba(8, 153, 129, 0.35)'
                : 'rgba(242, 54, 69, 0.35)',
          });
        }

        bundle.candleCount = candles.length;
        return;
      }

      // FULL REBUILD PATH: Only executed on symbol/timeframe/type/indicator change or initial load
      // Clean up previous series reliably
      if (activeSeriesRef.current.length > 0) {
        activeSeriesRef.current.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch {
            // Ignore
          }
        });
        activeSeriesRef.current = [];
      }

      const trackSeries = <T extends ISeriesApi<any>>(series: T): T => {
        activeSeriesRef.current.push(series);
        return series;
      };

      // 1. Add Main Price Series (Pane 0)
      let mainSeries: ISeriesApi<any>;

      if (chartType === 'line') {
        mainSeries = trackSeries(
          chart.addSeries(
            LineSeries,
            {
              color: '#2962ff',
              lineWidth: 2,
              lineType: LineType.Simple,
              priceLineVisible: true,
              priceLineColor: '#2962ff',
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            value: c.close,
          }))
        );
      } else if (chartType === 'step-line') {
        mainSeries = trackSeries(
          chart.addSeries(
            LineSeries,
            {
              color: '#2962ff',
              lineWidth: 2,
              lineType: LineType.WithSteps,
              priceLineVisible: true,
              priceLineColor: '#2962ff',
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            value: c.close,
          }))
        );
      } else if (chartType === 'area') {
        mainSeries = trackSeries(
          chart.addSeries(
            AreaSeries,
            {
              lineColor: '#2962ff',
              topColor: 'rgba(41, 98, 255, 0.32)',
              bottomColor: 'rgba(41, 98, 255, 0.01)',
              lineWidth: 2,
              priceLineVisible: true,
              priceLineColor: '#2962ff',
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            value: c.close,
          }))
        );
      } else if (chartType === 'baseline') {
        const basePrice = chartCandles[0]?.open ?? chartCandles[0]?.close ?? asset.price;
        mainSeries = trackSeries(
          chart.addSeries(
            BaselineSeries,
            {
              baseValue: { type: 'price', price: basePrice },
              topLineColor: '#089981',
              topFillColor1: 'rgba(8, 153, 129, 0.28)',
              topFillColor2: 'rgba(8, 153, 129, 0.04)',
              bottomLineColor: '#f23645',
              bottomFillColor1: 'rgba(242, 54, 69, 0.04)',
              bottomFillColor2: 'rgba(242, 54, 69, 0.28)',
              lineWidth: 2,
              priceLineVisible: true,
              priceLineColor: '#2962ff',
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            value: c.close,
          }))
        );
      } else if (chartType === 'column') {
        mainSeries = trackSeries(
          chart.addSeries(
            HistogramSeries,
            {
              priceFormat: { type: 'price' },
              priceLineVisible: true,
              priceLineColor: '#2962ff',
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            value: c.close,
            color: c.close >= c.open ? 'rgba(8, 153, 129, 0.85)' : 'rgba(242, 54, 69, 0.85)',
          }))
        );
      } else if (chartType === 'hollow') {
        mainSeries = trackSeries(
          chart.addSeries(
            CandlestickSeries,
            {
              borderVisible: true,
              wickVisible: true,
              upColor: '#131722',
              downColor: '#f23645',
              borderUpColor: '#089981',
              borderDownColor: '#f23645',
              wickUpColor: '#089981',
              wickDownColor: '#f23645',
              priceLineVisible: true,
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(formatHollowCandles(chartCandles));
      } else if (chartType === 'heikin-ashi') {
        mainSeries = trackSeries(
          chart.addSeries(
            CandlestickSeries,
            {
              upColor: '#089981',
              downColor: '#f23645',
              borderVisible: true,
              borderUpColor: '#089981',
              borderDownColor: '#f23645',
              wickVisible: true,
              wickUpColor: '#089981',
              wickDownColor: '#f23645',
              priceLineVisible: true,
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      } else if (chartType === 'high-low') {
        mainSeries = trackSeries(
          chart.addSeries(
            BarSeries,
            {
              upColor: '#089981',
              downColor: '#f23645',
              openVisible: false,
              thinBars: false,
              priceLineVisible: true,
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c, i) => {
            const prevClose = i > 0 ? chartCandles[i - 1].close : c.open;
            const isUp = c.close >= prevClose;
            return {
              time: c.time as any,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              color: isUp ? '#089981' : '#f23645',
            };
          })
        );
      } else if (chartType === 'bar') {
        mainSeries = trackSeries(
          chart.addSeries(
            BarSeries,
            {
              upColor: '#089981',
              downColor: '#f23645',
              openVisible: true,
              thinBars: false,
              priceLineVisible: true,
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      } else {
        // 'candlestick' (Standard Candles)
        mainSeries = trackSeries(
          chart.addSeries(
            CandlestickSeries,
            {
              upColor: '#089981',
              downColor: '#f23645',
              borderVisible: true,
              borderUpColor: '#089981',
              borderDownColor: '#f23645',
              wickVisible: true,
              wickUpColor: '#089981',
              wickDownColor: '#f23645',
              priceLineVisible: true,
              priceLineStyle: LineStyle.Dashed,
            },
            0
          )
        );
        mainSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      }

      mainSeriesRef.current = mainSeries;

      // 2. Add Volume Series (Pane 0)
      let volumeSeries: ISeriesApi<any> | undefined;
      if (indicators.volume.enabled) {
        volumeSeries = trackSeries(
          chart.addSeries(
            HistogramSeries,
            {
              priceFormat: { type: 'volume' },
              priceScaleId: 'volume',
            },
            0
          )
        );

        chart.priceScale('volume', 0).applyOptions({
          scaleMargins: {
            top: 0.82,
            bottom: 0,
          },
        });

        volumeSeries.setData(
          chartCandles.map((c) => ({
            time: c.time as any,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)',
          }))
        );
      }

      // 3. Main Pane Moving Averages & Overlays
      if (indicators.sma20.enabled) {
        const smaData = calculateSMA(chartCandles, indicators.sma20.period);
        const smaSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.sma20.color, lineWidth: 1 }, 0));
        smaSeries.setData(smaData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      if (indicators.sma50.enabled) {
        const smaData = calculateSMA(chartCandles, indicators.sma50.period);
        const smaSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.sma50.color, lineWidth: 1 }, 0));
        smaSeries.setData(smaData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      if (indicators.sma200.enabled) {
        const smaData = calculateSMA(chartCandles, indicators.sma200.period);
        const smaSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.sma200.color, lineWidth: 2 }, 0));
        smaSeries.setData(smaData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      if (indicators.ema9.enabled) {
        const emaData = calculateEMA(chartCandles, indicators.ema9.period);
        const emaSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.ema9.color, lineWidth: 1 }, 0));
        emaSeries.setData(emaData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      if (indicators.ema21.enabled) {
        const emaData = calculateEMA(chartCandles, indicators.ema21.period);
        const emaSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.ema21.color, lineWidth: 1 }, 0));
        emaSeries.setData(emaData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      if (indicators.vwap.enabled) {
        const vwapData = calculateVWAP(chartCandles);
        const vwapSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.vwap.color, lineWidth: 1 }, 0));
        vwapSeries.setData(vwapData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      if (indicators.bollingerBands.enabled) {
        const bbData = calculateBollingerBands(
          chartCandles,
          indicators.bollingerBands.period,
          indicators.bollingerBands.stdDev
        );

        const bbUpper = trackSeries(chart.addSeries(LineSeries, { color: indicators.bollingerBands.upperColor, lineWidth: 1 }, 0));
        bbUpper.setData(bbData.map((d) => ({ time: d.time as any, value: d.upper })));

        const bbMiddle = trackSeries(
          chart.addSeries(
            LineSeries,
            { color: indicators.bollingerBands.middleColor, lineWidth: 1, lineStyle: LineStyle.Dashed },
            0
          )
        );
        bbMiddle.setData(bbData.map((d) => ({ time: d.time as any, value: d.middle })));

        const bbLower = trackSeries(chart.addSeries(LineSeries, { color: indicators.bollingerBands.lowerColor, lineWidth: 1 }, 0));
        bbLower.setData(bbData.map((d) => ({ time: d.time as any, value: d.lower })));
      }

      // 4. Sub-Pane Oscillators (RSI, MACD)
      let nextPaneIndex = 1;

      if (indicators.rsi.enabled) {
        const rsiData = calculateRSI(chartCandles, indicators.rsi.period);
        const rsiPaneIndex = nextPaneIndex++;

        const rsiSeries = trackSeries(chart.addSeries(LineSeries, { color: indicators.rsi.color, lineWidth: 2 }, rsiPaneIndex));
        rsiSeries.setData(rsiData.map((d) => ({ time: d.time as any, value: d.value })));

        const rsiOverbought = trackSeries(
          chart.addSeries(
            LineSeries,
            { color: 'rgba(242, 54, 69, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed },
            rsiPaneIndex
          )
        );
        rsiOverbought.setData(rsiData.map((d) => ({ time: d.time as any, value: indicators.rsi.overbought })));

        const rsiOversold = trackSeries(
          chart.addSeries(
            LineSeries,
            { color: 'rgba(8, 153, 129, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed },
            rsiPaneIndex
          )
        );
        rsiOversold.setData(rsiData.map((d) => ({ time: d.time as any, value: indicators.rsi.oversold })));
      }

      if (indicators.macd.enabled) {
        const macdData = calculateMACD(
          chartCandles,
          indicators.macd.fastPeriod,
          indicators.macd.slowPeriod,
          indicators.macd.signalPeriod
        );
        const macdPaneIndex = nextPaneIndex++;

        const histSeries = trackSeries(chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, macdPaneIndex));
        histSeries.setData(
          macdData.map((d) => ({
            time: d.time as any,
            value: d.histogram,
            color: d.histogram >= 0 ? indicators.macd.histUpColor : indicators.macd.histDownColor,
          }))
        );

        const macdLineSeries = trackSeries(
          chart.addSeries(
            LineSeries,
            { color: indicators.macd.macdColor, lineWidth: 1.5 },
            macdPaneIndex
          )
        );
        macdLineSeries.setData(macdData.map((d) => ({ time: d.time as any, value: d.macd })));

        const signalLineSeries = trackSeries(
          chart.addSeries(
            LineSeries,
            { color: indicators.macd.signalColor, lineWidth: 1.5 },
            macdPaneIndex
          )
        );
        signalLineSeries.setData(macdData.map((d) => ({ time: d.time as any, value: d.signal })));
      }

      if (!bundle || bundle.symbol !== asset.symbol || bundle.timeframe !== timeframe || (bundle.candleCount < 10 && candles.length > 10)) {
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 180), to: candles.length + 4 });
      }
      seriesBundleRef.current = {
        symbol: asset.symbol,
        timeframe,
        chartType,
        indicatorsKey,
        mainSeries,
        volumeSeries,
        candleCount: candles.length,
        firstCandleTime: firstCandle?.time || 0,
      };
    }, [asset.symbol, timeframe, chartType, candles, indicatorsKey]);

    // Calculate dynamic Y pixel position for open position line overlay
    const [positionY, setPositionY] = useState<number | null>(null);
    const [currentPriceY, setCurrentPriceY] = useState<number | null>(null);

    useEffect(() => {
      const chart = chartApiRef.current;
      if (!chart) return;

      let rafId: number | null = null;
      const updateLinePositions = () => {
        if (!mainSeriesRef.current) return;
        try {
          if (openPosition) {
            const y = mainSeriesRef.current.priceToCoordinate(openPosition.entryPrice);
            if (y !== null) {
              setPositionY((prev) => (prev === null || Math.abs(prev - y) >= 1 ? Math.round(y) : prev));
            }
          } else {
            setPositionY(null);
          }

          const currY = mainSeriesRef.current.priceToCoordinate(asset.price);
          if (currY !== null) {
            setCurrentPriceY((prev) => (prev === null || Math.abs(prev - currY) >= 1 ? Math.round(currY) : prev));
          }
        } catch {
          // Ignore
        }
      };

      const scheduledUpdate = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateLinePositions();
        });
      };

      scheduledUpdate();

      // Subscribe to time scale change (scrolling, zooming)
      chart.timeScale().subscribeVisibleLogicalRangeChange(scheduledUpdate);

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduledUpdate);
      };
    }, [openPosition?.entryPrice, asset.price, asset.symbol]);

    return (
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-[#131722] select-none">
        {/* TradingView Legend Header in top left (matching screenshot) */}
        <div
          id="chart-top-legend-header"
          className="absolute top-1.5 left-2.5 z-20 flex flex-col gap-0.5 pointer-events-auto"
        >
          {/* Row 1: Symbol & Exchange with eye, settings, delete, more icons */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#d1d4dc] group cursor-pointer">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2962ff] flex items-center justify-center text-white text-[8px] font-bold shadow-xs">
              A
            </div>
            <span>
              {asset.symbol} · {asset.name} · {timeframe} · {asset.exchange}
            </span>

            {displayCandle && (
              <div className="hidden md:flex items-center gap-2 font-mono text-[10px] pl-2 text-[#787b86]">
                <span>
                  O <span className={displayCandle.close >= displayCandle.open ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle.open.toFixed(asset.digits ?? 2)}</span>
                </span>
                <span>
                  H <span className={displayCandle.close >= displayCandle.open ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle.high.toFixed(asset.digits ?? 2)}</span>
                </span>
                <span>
                  L <span className={displayCandle.close >= displayCandle.open ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle.low.toFixed(asset.digits ?? 2)}</span>
                </span>
                <span>
                  C <span className={displayCandle.close >= displayCandle.open ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle.close.toFixed(asset.digits ?? 2)}</span>
                </span>
                <span className={`font-semibold ${displayCandle.close >= displayCandle.open ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                  {displayCandle.close >= displayCandle.open ? '+' : ''}{(displayCandle.close - displayCandle.open).toFixed(asset.digits ?? 2)} ({displayCandle.close >= displayCandle.open ? '+' : ''}{displayCandle.open > 0 ? (((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2) : '0.00'}%)
                </span>
              </div>
            )}

            <div className="flex items-center gap-0.5 text-[#787b86] ml-1">
              <button className="p-0.5 hover:text-white rounded transition" title="Hide series">
                <Eye className="w-3 h-3" />
              </button>
              <button className="p-0.5 hover:text-white rounded transition" title="Series Settings">
                <Settings className="w-3 h-3" />
              </button>
              <button className="p-0.5 hover:text-[#f23645] rounded transition" title="Remove Symbol">
                <X className="w-3 h-3" />
              </button>
              <button className="p-0.5 hover:text-white rounded transition" title="More options">
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Row 2: Indicator 14 line with controls */}
          <div className="flex items-center gap-1 text-[10px] text-[#787b86] pl-5">
            <ChevronDown className="w-2.5 h-2.5 text-[#787b86]" />
            <span className="font-mono text-[#d1d4dc]">14</span>
            <div className="flex items-center gap-0.5 text-[#787b86]">
              <button className="p-0.5 hover:text-white rounded transition" title="Toggle Indicator">
                <Eye className="w-2.5 h-2.5" />
              </button>
              <button className="p-0.5 hover:text-white rounded transition" title="Indicator Settings">
                <Settings className="w-2.5 h-2.5" />
              </button>
              <button className="p-0.5 hover:text-[#f23645] rounded transition" title="Remove Indicator">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Currency Label at Top Right of Price Scale */}
        <div className="absolute top-2 right-2 z-20 pointer-events-none text-[10px] font-mono font-bold text-[#787b86] bg-[#131722] px-1 rounded">
          USD ▾
        </div>

        {/* Lightweight Charts Canvas Container */}
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Interactive Open Position Line & Badge (Matching Screenshot!) */}
        {openPosition && positionY !== null && positionY > 30 && (
          <>
            {/* Horizontal Blue Dashed Execution Line */}
            <div
              className="absolute left-0 right-14 border-b border-[#2962ff] border-dashed pointer-events-none z-20"
              style={{ top: `${positionY}px` }}
            />

            {/* Position Controls Marker Pill */}
            <div
              className="absolute right-16 -translate-y-1/2 z-30 flex items-center bg-[#131722] border border-[#2962ff] rounded-md text-[11px] font-mono shadow-xl overflow-hidden"
              style={{ top: `${positionY}px` }}
            >
              <div className="px-1.5 py-0.5 bg-[#2962ff] text-white font-bold text-[10px]">
                1L
              </div>
              <div className="px-1.5 py-0.5 border-r border-[#2962ff]/40 text-[#787b86] hover:text-white cursor-pointer transition">
                TP
              </div>
              <div className="px-1.5 py-0.5 border-r border-[#2962ff]/40 text-[#787b86] hover:text-white cursor-pointer transition">
                SL
              </div>
              <div className="px-2 py-0.5 border-r border-[#2962ff]/40 text-[#2962ff] font-semibold">
                {openPosition.qty.toLocaleString()}
              </div>
              <div className="px-2 py-0.5 border-r border-[#2962ff]/40 text-[#089981] font-semibold">
                +{openPosition.unrealizedPnL.toFixed(2)} USD
              </div>
              <button
                onClick={() => onClosePosition?.(openPosition.id)}
                className="px-1.5 py-0.5 text-[#787b86] hover:text-[#f23645] transition cursor-pointer"
                title="Close Position"
              >
                ✕
              </button>
            </div>

            {/* Blue Price Scale Badge on Right */}
            <div
              className="absolute right-0 -translate-y-1/2 bg-[#2962ff] text-white font-mono text-[10px] font-bold px-1 py-0.5 rounded-l shadow-md z-30 pointer-events-none"
              style={{ top: `${positionY}px` }}
            >
              {openPosition.entryPrice.toFixed(asset.digits)}
            </div>
          </>
        )}

        {/* Active Price Scale Badge on Right (Purple tag as in screenshot!) */}
        {currentPriceY !== null && (
          <div
            className="absolute right-0 -translate-y-1/2 bg-[#b388ff] text-[#131722] font-mono text-[10px] font-bold px-1 py-0.5 rounded-l shadow-md z-30 pointer-events-none"
            style={{ top: `${currentPriceY}px` }}
          >
            {asset.price.toFixed(asset.digits)}
          </div>
        )}

        {/* Drawings Overlay with Trends & Fibonacci */}
        <DrawingOverlay
          chart={chartApiRef.current}
          series={mainSeriesRef.current}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          drawings={drawings}
          setDrawings={setDrawings}
          isMagnetMode={isMagnetMode}
          areDrawingsHidden={areDrawingsHidden}
          currentColor={currentColor}
          candles={candles}
          onOpenConditionalOrder={onOpenConditionalOrder}
        />
      </div>
    );
  }
)
);
MainChart.displayName = 'MainChart';
