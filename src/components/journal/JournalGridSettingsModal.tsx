import React from 'react';
import {
  X,
  Settings,
  Grid,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Layers,
  Square,
  Maximize2,
  Minimize2,
  PlusCircle,
} from 'lucide-react';

export type GridSpacingMode = 'compact' | 'normal' | 'spacious';

export interface GridSectionMeta {
  id: string;
  name: string;
  category: 'top-metrics' | 'main-table' | 'right-column';
  description: string;
}

export const ALL_GRID_SECTIONS: GridSectionMeta[] = [
  {
    id: 'accumulative-return',
    name: 'Accumulative Return Net $',
    category: 'top-metrics',
    description: 'Total cumulative net return metric with real-time glowing area sparkline',
  },
  {
    id: 'profit-loss-ratio',
    name: 'Profit / Loss Ratio',
    category: 'top-metrics',
    description: 'Win-to-loss ratio metric with smooth trendline curve',
  },
  {
    id: 'win-rate',
    name: 'Win % Arc Meter',
    category: 'top-metrics',
    description: 'Win percentage gauge with circular arc progress ring',
  },
  {
    id: 'trade-log',
    name: 'Master Trades Table',
    category: 'main-table',
    description: 'Execution ledger with status pills, side, symbol, prices, returns, and setups',
  },
  {
    id: 'account-performance',
    name: 'Account Performance Card',
    category: 'right-column',
    description: 'Average return, win %, and dotted-matrix profit curve chart',
  },
  {
    id: 'setups-card',
    name: 'Setups Breakdown Card',
    category: 'right-column',
    description: 'P&L ranked setups list with horizontal profit meters and pagination',
  },
  {
    id: 'mistakes-card',
    name: 'Mistakes Leaks Card',
    category: 'right-column',
    description: 'Account leak breakdown with loss progress bars and pagination',
  },
];

export interface JournalLayoutSettings {
  roundedCorners: boolean;
  spacing: GridSpacingMode;
  horizontalSplitRatio: number; // 0.70 = 70% table, 30% right column
  topRowOrder: string[];
  rightColumnOrder: string[];
  enabledSections: Record<string, boolean>;
}

export const DEFAULT_LAYOUT_SETTINGS: JournalLayoutSettings = {
  roundedCorners: true,
  spacing: 'compact', // Barely touching by default to match screenshot
  horizontalSplitRatio: 0.71,
  topRowOrder: ['accumulative-return', 'profit-loss-ratio', 'win-rate'],
  rightColumnOrder: ['account-performance', 'setups-card', 'mistakes-card'],
  enabledSections: {
    'accumulative-return': true,
    'profit-loss-ratio': true,
    'win-rate': true,
    'trade-log': true,
    'account-performance': true,
    'setups-card': true,
    'mistakes-card': true,
  },
};

interface JournalGridSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: JournalLayoutSettings;
  onUpdateSettings: (newSettings: JournalLayoutSettings) => void;
  onResetSettings: () => void;
}

export const JournalGridSettingsModal: React.FC<JournalGridSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  if (!isOpen) return null;

  const toggleSection = (id: string) => {
    const isCurrentlyEnabled = settings.enabledSections[id] !== false;
    onUpdateSettings({
      ...settings,
      enabledSections: {
        ...settings.enabledSections,
        [id]: !isCurrentlyEnabled,
      },
    });
  };

  const enableSection = (id: string) => {
    onUpdateSettings({
      ...settings,
      enabledSections: {
        ...settings.enabledSections,
        [id]: true,
      },
    });
  };

  // Find disabled sections
  const disabledSections = ALL_GRID_SECTIONS.filter(
    (sec) => settings.enabledSections[sec.id] === false
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#181b24] border border-[#2a2e39] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#131722] border-b border-[#2a2e39] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2962ff]/20 text-[#2962ff] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Journal Grid & Layout Settings</h3>
              <p className="text-[11px] text-[#787b86]">
                Configure box spacing, corner radii, and enable/disable sections
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#787b86] hover:text-white rounded-lg hover:bg-[#2a2e39] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-5 text-xs text-[#d1d4dc]">
          {/* Section 1: Box Corner Radii */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#787b86] uppercase tracking-wider block">
              Corner Style (Roundness)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, roundedCorners: true })}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                  settings.roundedCorners
                    ? 'bg-[#2962ff]/20 border-[#2962ff] text-white font-bold ring-1 ring-[#2962ff]/40 shadow-sm'
                    : 'bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-white hover:border-[#3b4253]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-lg border-2 border-current flex items-center justify-center">
                    <div className="w-2 h-2 rounded-xs bg-current opacity-60" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Rounded Corners</div>
                    <div className="text-[10px] text-[#787b86]">Standard modern (12px)</div>
                  </div>
                </div>
                {settings.roundedCorners && <Check className="w-4 h-4 text-[#2962ff]" />}
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, roundedCorners: false })}
                className={`p-3 rounded-none border flex items-center justify-between transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                  !settings.roundedCorners
                    ? 'bg-[#2962ff]/20 border-[#2962ff] text-white font-bold ring-1 ring-[#2962ff]/40 shadow-sm'
                    : 'bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-white hover:border-[#3b4253]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-none border-2 border-current flex items-center justify-center">
                    <div className="w-2 h-2 rounded-none bg-current opacity-60" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Square / Sharp</div>
                    <div className="text-[10px] text-[#787b86]">Terminal style (0px)</div>
                  </div>
                </div>
                {!settings.roundedCorners && <Check className="w-4 h-4 text-[#2962ff]" />}
              </button>
            </div>
          </div>

          {/* Section 2: Box Spacing */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#787b86] uppercase tracking-wider block">
              Grid Spacing (Uniform Margins Between Boxes)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, spacing: 'compact' })}
                className={`p-2.5 rounded-xl border text-center transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                  settings.spacing === 'compact'
                    ? 'bg-[#2962ff]/20 border-[#2962ff] text-white font-bold ring-1 ring-[#2962ff]/40 shadow-sm'
                    : 'bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-white hover:border-[#3b4253]'
                }`}
              >
                <div className="font-semibold text-xs">Compact</div>
                <div className="text-[10px] text-[#787b86] mt-0.5">Snug Margins (4px)</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, spacing: 'normal' })}
                className={`p-2.5 rounded-xl border text-center transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                  settings.spacing === 'normal'
                    ? 'bg-[#2962ff]/20 border-[#2962ff] text-white font-bold ring-1 ring-[#2962ff]/40 shadow-sm'
                    : 'bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-white hover:border-[#3b4253]'
                }`}
              >
                <div className="font-semibold text-xs">Uniform Normal</div>
                <div className="text-[10px] text-[#787b86] mt-0.5">Standard Gap (10px)</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, spacing: 'spacious' })}
                className={`p-2.5 rounded-xl border text-center transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                  settings.spacing === 'spacious'
                    ? 'bg-[#2962ff]/20 border-[#2962ff] text-white font-bold ring-1 ring-[#2962ff]/40 shadow-sm'
                    : 'bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-white hover:border-[#3b4253]'
                }`}
              >
                <div className="font-semibold text-xs">Spacious</div>
                <div className="text-[10px] text-[#787b86] mt-0.5">Wide Gap (16px)</div>
              </button>
            </div>
          </div>

          {/* Section 3: Hidden / Disabled Sections Tray */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#787b86] uppercase tracking-wider block">
                Hidden / Disabled Sections
              </label>
              <span className="text-[10px] text-[#2962ff] font-medium">
                {disabledSections.length} hidden
              </span>
            </div>

            {disabledSections.length === 0 ? (
              <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-3 text-center text-[#787b86] text-[11px]">
                All grid sections are currently active and visible.
              </div>
            ) : (
              <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-[#787b86] mb-2">
                  Click any hidden section below to immediately restore and re-add it back into the grid:
                </p>
                <div className="flex flex-wrap gap-2">
                  {disabledSections.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => enableSection(sec.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2962ff]/20 hover:bg-[#2962ff]/30 text-[#2962ff] border border-[#2962ff]/40 rounded-lg text-xs font-semibold transition group shadow-sm"
                      title="Click to re-add this section to the grid"
                    >
                      <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>{sec.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: All Section Toggles */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#787b86] uppercase tracking-wider block">
              Manage Active Grid Sections
            </label>
            <div className="space-y-1.5 bg-[#131722] p-2 rounded-xl border border-[#2a2e39]">
              {ALL_GRID_SECTIONS.map((sec) => {
                const isEnabled = settings.enabledSections[sec.id] !== false;
                return (
                  <div
                    key={sec.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1e222d] transition"
                  >
                    <div>
                      <div className="font-semibold text-white text-xs">{sec.name}</div>
                      <div className="text-[10px] text-[#787b86]">{sec.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSection(sec.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                        isEnabled
                          ? 'bg-[#089981]/20 border-[#089981] text-[#089981]'
                          : 'bg-[#2a2e39]/40 border-[#2a2e39] text-[#787b86]'
                      }`}
                    >
                      {isEnabled ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#131722] border-t border-[#2a2e39] flex items-center justify-between">
          <button
            type="button"
            onClick={onResetSettings}
            className="flex items-center gap-1.5 text-xs text-[#787b86] hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-[#2a2e39] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-[#2962ff] hover:bg-[#1e4bd8] text-white px-5 py-1.5 rounded-lg font-bold text-xs transition shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
