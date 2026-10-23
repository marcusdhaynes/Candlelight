import React, { useState, useEffect } from 'react';
import { IChartApi } from 'lightweight-charts';
import { Calendar, RotateCcw, Settings, Maximize2 } from 'lucide-react';

interface BottomToolbarProps {
  chart: IChartApi | null;
  onSelectRange: (days: number) => void;
  onFitContent: () => void;
  isLogScale: boolean;
  setIsLogScale: (val: boolean | ((prev: boolean) => boolean)) => void;
  isPercentScale: boolean;
  setIsPercentScale: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  chart,
  onSelectRange,
  onFitContent,
  isLogScale,
  setIsLogScale,
  isPercentScale,
  setIsPercentScale,
}) => {
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as 01:08:13 AM UTC-4
      const hours = now.getHours();
      const h = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const offset = -now.getTimezoneOffset();
      const zone = `UTC${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')}:${String(Math.abs(offset)%60).padStart(2,'0')}`;
      setCurrentTimeStr(`${String(h).padStart(2, '0')}:${m}:${s} ${ampm} ${zone}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const ranges: { label: string; days: number }[] = [
    { label: '1D', days: 1 },
    { label: '5D', days: 5 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: 'YTD', days: -1 },
    { label: '1Y', days: 365 },
    { label: 'ALL', days: 0 },
  ];

  return (
    <div
      id="tradingview-bottom-bar"
      className="h-[22px] bg-[#131722] border-t border-[#2a2e39] px-2 flex items-center justify-between text-[11px] select-none shrink-0 z-20"
    >
      {/* Time Range Quick Selectors */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
        {ranges.map((r) => (
          <button
            key={r.label}
            id={`range-btn-${r.label}`}
            onClick={() => onSelectRange(r.days)}
            className="px-1 py-0.2 text-[10px] font-medium text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          >
            {r.label}
          </button>
        ))}

        <button
          className="p-0.5 text-[#787b86] hover:text-[#d1d4dc] rounded hover:bg-[#1e222d] transition ml-0.5"
          title="Go to date..."
        >
          <Calendar className="w-3 h-3" />
        </button>
      </div>

      {/* Right side: Time & Timezone, Fit, % / log / auto */}
      <div className="flex items-center gap-1.5 text-[#787b86] font-mono text-[10px]">
        {/* Live Ticking Time (01:08:13 AM UTC-4) */}
        <span className="text-[#787b86] text-[9.5px] select-all cursor-pointer hover:text-[#d1d4dc]">
          {currentTimeStr || '—'}
        </span>

        {/* % Percentage scale toggle */}
        <button
          id="percent-scale-toggle"
          onClick={() => setIsPercentScale((prev) => !prev)}
          className={`px-0.5 py-0.2 rounded text-[9px] font-bold transition ${
            isPercentScale ? 'bg-[#2962ff] text-white' : 'hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title="Percentage Scale"
        >
          %
        </button>

        {/* Log scale toggle */}
        <button
          id="log-scale-toggle"
          onClick={() => setIsLogScale((prev) => !prev)}
          className={`px-0.5 py-0.2 rounded text-[9px] font-bold transition ${
            isLogScale ? 'bg-[#2962ff] text-white' : 'hover:text-[#d1d4dc] hover:bg-[#1e222d]'
          }`}
          title="Logarithmic Scale"
        >
          log
        </button>

        {/* Auto scale indicator */}
        <span className="text-[#089981] text-[9px] font-bold px-0.5 rounded bg-[#089981]/10 cursor-pointer">
          auto
        </span>

        {/* Reset / Fit Content */}
        <button
          id="fit-chart-content-btn"
          onClick={onFitContent}
          className="p-0.5 hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          title="Auto Fit Chart to Screen"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>

        {/* Bottom scale settings gear */}
        <button
          className="p-0.5 hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
          title="Time Scale Settings"
        >
          <Settings className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
