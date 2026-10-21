import React from 'react';
import { WaveScoreData } from '../../types';
import { Maximize2, Info, Sparkles } from 'lucide-react';

interface WaveScoreRadarProps {
  data: WaveScoreData;
  onExpand?: () => void;
  roundedCorners?: boolean;
}

export const WaveScoreRadar: React.FC<WaveScoreRadarProps> = ({
  data,
  onExpand,
  roundedCorners = true,
}) => {
  const cornerClass = roundedCorners ? 'rounded-xl' : 'rounded-none';
  const smCornerClass = roundedCorners ? 'rounded' : 'rounded-none';
  // Vertices for 5-axis pentagon: Entry (top), Risk (top-right), Exit (bottom-right), Stability (bottom-left), Tempo (top-left)
  const angles = [
    -Math.PI / 2, // Entry: top
    -Math.PI / 2 + (2 * Math.PI) / 5, // Risk: top-right
    -Math.PI / 2 + (4 * Math.PI) / 5, // Exit: bottom-right
    -Math.PI / 2 + (6 * Math.PI) / 5, // Stability: bottom-left
    -Math.PI / 2 + (8 * Math.PI) / 5, // Tempo: top-left
  ];

  const size = 260;
  const center = size / 2;
  const radius = 80;

  const labels = [
    { name: 'Entry', score: data.entry },
    { name: 'Risk', score: data.risk },
    { name: 'Exit', score: data.exit },
    { name: 'Stability', score: data.stability },
    { name: 'Tempo', score: data.tempo },
  ];

  // Helper to compute (x, y) given normalized value (0 to 1) and angle index
  const getPoint = (valNorm: number, index: number) => {
    const r = radius * Math.max(0.1, Math.min(1, valNorm));
    const angle = angles[index];
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Concentric pentagon rings (at 25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Actual data polygon points
  const polygonPoints = labels
    .map((l, i) => {
      const pt = getPoint(l.score / 100, i);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  return (
    <div
      id="wavescore-radar-card"
      className={`bg-[#171b26] border border-[#232836] ${cornerClass} p-3.5 flex flex-col justify-between relative overflow-hidden group shadow-sm transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-white tracking-tight">WaveScore Radar</span>
          <span className={`text-[10px] uppercase font-bold bg-[#2563eb]/20 text-[#38bdf8] border border-[#2563eb]/30 px-1.5 py-0.2 ${smCornerClass}`}>
            Pro Engine
          </span>
        </div>
        <button
          onClick={onExpand}
          className={`text-[#787b86] hover:text-white p-1 ${smCornerClass} hover:bg-[#232836] transition`}
          title="Fullscreen / Expand Radar"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Pentagon Visual Canvas */}
      <div className="relative flex items-center justify-center my-2">
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Concentric grid rings */}
          {rings.map((ringVal, rIdx) => {
            const ringPts = angles
              .map((angle) => {
                const r = radius * ringVal;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
              })
              .join(' ');
            return (
              <polygon
                key={rIdx}
                points={ringPts}
                fill="none"
                stroke="#232836"
                strokeWidth={rIdx === rings.length - 1 ? '1.5' : '1'}
                strokeDasharray={rIdx < rings.length - 1 ? '2 2' : 'none'}
              />
            );
          })}

          {/* Radial axis lines */}
          {angles.map((angle, i) => (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="#232836"
              strokeWidth="1"
            />
          ))}

          {/* Shaded Data Polygon with glowing cyan edge */}
          <polygon
            points={polygonPoints}
            fill="url(#radarGrad)"
            stroke="#00e5ff"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Data vertex dots */}
          {labels.map((l, i) => {
            const pt = getPoint(l.score / 100, i);
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#00e5ff"
                stroke="#171b26"
                strokeWidth="1.5"
                className="transition-all hover:scale-125 cursor-pointer"
              />
            );
          })}
        </svg>

        {/* Central Overall Score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold font-mono text-white drop-shadow-md">{data.overall}</div>
          <div className="text-[9px] uppercase tracking-wider text-[#848e9c] font-semibold">WaveScore</div>
        </div>

        {/* Outer Text Labels with exact positions */}
        <div className="absolute top-1 text-[11px] font-medium text-[#848e9c]">
          Entry <span className="text-[#00ffa3] font-mono text-[10px] font-bold">({data.entry})</span>
        </div>
        <div className="absolute top-12 right-2 text-[11px] font-medium text-[#848e9c]">
          Risk <span className="text-[#00ffa3] font-mono text-[10px] font-bold">({data.risk})</span>
        </div>
        <div className="absolute bottom-3 right-8 text-[11px] font-medium text-[#848e9c]">
          Exit <span className="text-[#38bdf8] font-mono text-[10px] font-bold">({data.exit})</span>
        </div>
        <div className="absolute bottom-3 left-8 text-[11px] font-medium text-[#848e9c]">
          Stability <span className="text-[#38bdf8] font-mono text-[10px] font-bold">({data.stability})</span>
        </div>
        <div className="absolute top-12 left-2 text-[11px] font-medium text-[#848e9c]">
          Tempo <span className="text-[#00ffa3] font-mono text-[10px] font-bold">({data.tempo})</span>
        </div>
      </div>

      {/* Footer Insight */}
      <div className="mt-1 pt-2 border-t border-[#232836] flex items-center justify-between text-[11px] text-[#848e9c]">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#00ffa3]" />
          <span>Execution edge:</span>
        </div>
        <span className="font-semibold text-[#00ffa3]">High discipline & entry timing</span>
      </div>
    </div>
  );
};
