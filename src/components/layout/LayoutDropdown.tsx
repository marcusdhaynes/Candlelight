import React, { useState, useRef, useEffect } from 'react';
import { LayoutTemplate, LayoutSyncSettings } from '../../types/layout';
import { LAYOUT_TEMPLATES, ROW_CATEGORIES, getLayoutTemplateById } from '../../data/layoutTemplates';
import { Info } from 'lucide-react';

interface LayoutDropdownProps {
  currentTemplateId: string;
  onSelectTemplate: (template: LayoutTemplate) => void;
  syncSettings: LayoutSyncSettings;
  onUpdateSyncSettings: (settings: LayoutSyncSettings) => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const LayoutPreviewIcon: React.FC<{
  template: LayoutTemplate;
  isSelected?: boolean;
  size?: number;
}> = ({ template, isSelected, size = 18 }) => {
  const gap = 1;
  const padding = 1.5;
  const area = 24 - padding * 2;

  if (template.isCustomGrid || template.type === 'custom-grid') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 transition-colors"
      >
        <rect
          x={2}
          y={2}
          width={20}
          height={20}
          rx={2}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeDasharray="2 1.5"
          fill={isSelected ? 'currentColor' : 'none'}
          fillOpacity={isSelected ? 0.2 : 0}
        />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize="13"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="currentColor"
        >
          ?
        </text>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 transition-colors"
    >
      {template.boxes.map((b, idx) => {
        const x = padding + (b.x / 100) * area + (b.x > 0 ? gap / 2 : 0);
        const y = padding + (b.y / 100) * area + (b.y > 0 ? gap / 2 : 0);
        const w = (b.w / 100) * area - (b.x > 0 || b.w < 100 ? gap : 0);
        const h = (b.h / 100) * area - (b.y > 0 || b.h < 100 ? gap : 0);

        return (
          <rect
            key={idx}
            x={Math.max(padding, x)}
            y={Math.max(padding, y)}
            width={Math.max(1.5, w)}
            height={Math.max(1.5, h)}
            rx={1}
            stroke="currentColor"
            strokeWidth={1.2}
            fill={isSelected ? 'currentColor' : 'none'}
            fillOpacity={isSelected ? 0.25 : 0}
          />
        );
      })}
    </svg>
  );
};

export const LayoutDropdown: React.FC<LayoutDropdownProps> = ({
  currentTemplateId,
  onSelectTemplate,
  syncSettings,
  onUpdateSyncSettings,
  isOpen,
  onClose,
  onToggle,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  const activeTemplate = getLayoutTemplateById(currentTemplateId);

  const toggleSync = (key: keyof LayoutSyncSettings) => {
    onUpdateSyncSettings({
      ...syncSettings,
      [key]: !syncSettings[key],
    });
  };

  const syncItems: {
    key: keyof LayoutSyncSettings;
    label: string;
    desc: string;
  }[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      desc: 'Sync the active financial asset/symbol across all chart windows in the layout',
    },
    {
      key: 'interval',
      label: 'Interval',
      desc: 'Sync the timeframe interval (e.g. 1m, 1h, 1D) across all chart windows',
    },
    {
      key: 'crosshair',
      label: 'Crosshair',
      desc: 'Sync mouse cursor crosshair position and hover time across all charts',
    },
    {
      key: 'time',
      label: 'Time',
      desc: 'Sync horizontal time panning and zooming across all chart windows',
    },
    {
      key: 'dateRange',
      label: 'Date range',
      desc: 'Sync the visible historical date range across all chart windows',
    },
  ];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Layout Trigger Button in Navbar (to the left of Unnamed) */}
      <button
        id="layout-picker-trigger-btn"
        onClick={onToggle}
        className={`p-1 rounded transition flex items-center justify-center ${
          isOpen
            ? 'bg-[#1e222d] text-[#d1d4dc]'
            : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
        }`}
        title={`Select Window Layout (${activeTemplate.name})`}
      >
        <LayoutPreviewIcon template={activeTemplate} isSelected={false} size={12} />
      </button>

      {/* Layout Picker Popover (Matches TradingView Screenshot exactly, condensed) */}
      {isOpen && (
        <div
          id="layout-picker-popover"
          className="absolute top-full left-0 mt-0.5 z-50 w-[268px] bg-[#181b24] border border-[#2a2e39] rounded shadow-2xl overflow-hidden font-sans text-xs select-none"
        >
          {/* Layout Templates Area - all display options visible at once without scrolling */}
          <div className="divide-y divide-[#2a2e39]/40 p-1.5">
            {ROW_CATEGORIES.map((catNum) => {
              const templatesInRow = LAYOUT_TEMPLATES.filter((t) => t.rowCategory === catNum);
              if (templatesInRow.length === 0) return null;

              return (
                <div key={catNum} className="py-0.5 flex items-center gap-1.5 first:pt-0 last:pb-0">
                  {/* Row Number */}
                  <span className="w-3 text-right font-mono text-[10px] text-[#787b86] shrink-0 font-medium">
                    {catNum}
                  </span>

                  {/* Template Buttons in this category */}
                  <div className="flex flex-wrap items-center gap-0.5 flex-1">
                    {templatesInRow.map((tpl) => {
                      const isSelected = tpl.id === currentTemplateId;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            onSelectTemplate(tpl);
                            onClose();
                          }}
                          className={`w-5.5 h-5.5 rounded flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-white/10 text-white border border-white/80 shadow-xs'
                              : 'text-[#848e9c] hover:text-white hover:bg-[#262b37] border border-transparent'
                          }`}
                          title={`${tpl.name} (${tpl.count} window${tpl.count > 1 ? 's' : ''})`}
                        >
                          <LayoutPreviewIcon template={tpl} isSelected={isSelected} size={13} />
                        </button>
                      );
                    })}

                    {/* Custom Freeform Grid Resizing Option (box with '?' inside) */}
                    {(() => {
                      const isCustomSelected = currentTemplateId === `custom-${catNum}`;
                      return (
                        <button
                          key={`custom-${catNum}`}
                          onClick={() => {
                            const customTpl = getLayoutTemplateById(`custom-${catNum}`);
                            onSelectTemplate(customTpl);
                            onClose();
                          }}
                          className={`w-5.5 h-5.5 rounded flex items-center justify-center transition-all ${
                            isCustomSelected
                              ? 'bg-white/10 text-white border border-white/80 shadow-xs'
                              : 'text-[#848e9c] hover:text-white hover:bg-[#262b37] border border-transparent'
                          }`}
                          title={`Custom ${catNum}-Window Grid: Displays the first layout of this row and lets you resize in any direction with real-time grid snapping`}
                        >
                          <span className="font-bold text-[11px] leading-none font-mono">?</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* SYNC IN LAYOUT SECTION (Image 1) - 2 columns to conserve vertical space */}
          <div className="bg-[#141720] border-t border-[#2a2e39] px-2.5 py-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[#787b86] mb-1">
              Sync in layout
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {syncItems.map((item) => {
                const isChecked = syncSettings[item.key];
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between group cursor-pointer py-0.5 min-w-0"
                    onClick={() => toggleSync(item.key)}
                  >
                    <div className="flex items-center gap-1 min-w-0 pr-1">
                      <span className="text-[11px] text-[#d1d4dc] group-hover:text-white transition truncate">
                        {item.label}
                      </span>
                      <div
                        className="relative shrink-0"
                        onMouseEnter={() => setTooltip(item.desc)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="w-2.5 h-2.5 text-[#787b86] hover:text-[#d1d4dc] cursor-help" />
                      </div>
                    </div>

                    {/* iOS/TradingView Style Compact Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSync(item.key);
                      }}
                      className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isChecked ? 'bg-white' : 'bg-[#2a2e39]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full transition duration-200 ease-in-out shadow-xs ${
                          isChecked
                            ? 'translate-x-3 bg-[#131722]'
                            : 'translate-x-0.5 bg-[#787b86]'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Info Tooltip Footer */}
            {tooltip && (
              <div className="mt-1 pt-1 border-t border-[#2a2e39] text-[10px] text-[#9ca3af] leading-tight">
                {tooltip}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
