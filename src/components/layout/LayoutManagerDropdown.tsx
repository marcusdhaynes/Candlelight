import React, { useState, useRef, useEffect } from 'react';
import { SavedChartLayout, LayoutSyncSettings } from '../../types/layout';
import {
  Cloud,
  ChevronDown,
  Copy,
  Edit2,
  Download,
  Plus,
  Info,
  Check,
  Trash2,
  Share2,
} from 'lucide-react';

interface LayoutManagerDropdownProps {
  currentLayout: SavedChartLayout;
  savedLayouts: SavedChartLayout[];
  onSaveLayout: () => void;
  onAutosaveToggle: (enabled: boolean) => void;
  onShareToggle: (enabled: boolean) => void;
  onMakeCopy: (newName: string) => void;
  onRename: (newName: string) => void;
  onDownloadData: () => void;
  onCreateNewLayout: () => void;
  onSelectLayout: (layout: SavedChartLayout) => void;
  onDeleteLayout: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  activeSymbol: string;
  activeTimeframe: string;
}

export const LayoutManagerDropdown: React.FC<LayoutManagerDropdownProps> = ({
  currentLayout,
  savedLayouts,
  onSaveLayout,
  onAutosaveToggle,
  onShareToggle,
  onMakeCopy,
  onRename,
  onDownloadData,
  onCreateNewLayout,
  onSelectLayout,
  onDeleteLayout,
  isOpen,
  onClose,
  onToggle,
  activeSymbol,
  activeTimeframe,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modalMode, setModalMode] = useState<'rename' | 'copy' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Close popover on click outside
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

  // Global Ctrl + S / Cmd + S listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveLayout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSaveLayout]);

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newShareState = !currentLayout.shareEnabled;
    onShareToggle(newShareState);
    if (newShareState) {
      // Copy share URL to clipboard
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  const submitModal = () => {
    if (!inputValue.trim()) return;
    if (modalMode === 'rename') {
      onRename(inputValue.trim());
    } else if (modalMode === 'copy') {
      onMakeCopy(inputValue.trim());
    }
    setModalMode(null);
    setInputValue('');
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button in Top Navbar (Matching Screenshot 2 "Unnamed v") */}
      <button
        id="layout-manager-trigger-btn"
        onClick={onToggle}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition text-[11px] font-medium ${
          isOpen
            ? 'bg-[#2a2e39] text-white'
            : 'text-[#d1d4dc] hover:text-white hover:bg-[#1e222d]'
        }`}
        title="Chart Layout Manager & Saved Layouts"
      >
        <Cloud className="w-3 h-3 text-[#787b86]" />
        <span className="truncate max-w-[100px]">{currentLayout.name}</span>
        <ChevronDown className="w-2.5 h-2.5 text-[#787b86]" />
      </button>

      {/* Dropdown Menu (Matches TradingView Screenshot 2, condensed) */}
      {isOpen && (
        <div
          id="layout-manager-popover"
          className="absolute top-full left-0 mt-0.5 z-50 w-[230px] bg-[#181b24] border border-[#2a2e39] rounded shadow-2xl py-0.5 font-sans text-[11px] select-none"
        >
          {/* Save layout Ctrl + S */}
          <button
            onClick={() => {
              onSaveLayout();
              onClose();
            }}
            className="w-full px-2.5 py-1 flex items-center justify-between text-[#d1d4dc] hover:text-white hover:bg-[#262b37] transition text-left"
          >
            <span className="font-medium">Save layout</span>
            <span className="text-[10px] font-mono text-[#787b86]">Ctrl + S</span>
          </button>

          {/* Autosave Switch */}
          <div
            className="px-2.5 py-1 flex items-center justify-between hover:bg-[#262b37] cursor-pointer transition text-[#d1d4dc] hover:text-white"
            onClick={() => onAutosaveToggle(!currentLayout.autosave)}
          >
            <span>Autosave</span>
            <button
              type="button"
              role="switch"
              aria-checked={currentLayout.autosave}
              onClick={(e) => {
                e.stopPropagation();
                onAutosaveToggle(!currentLayout.autosave);
              }}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                currentLayout.autosave ? 'bg-white' : 'bg-[#2a2e39]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full transition duration-200 ease-in-out shadow-xs ${
                  currentLayout.autosave
                    ? 'translate-x-3 bg-[#131722]'
                    : 'translate-x-0.5 bg-[#787b86]'
                }`}
              />
            </button>
          </div>

          {/* Share layout Switch */}
          <div
            className="px-2.5 py-1 flex items-center justify-between hover:bg-[#262b37] cursor-pointer transition text-[#d1d4dc] hover:text-white"
            onClick={handleShareClick}
          >
            <div className="flex items-center gap-1.5">
              <span>Share layout</span>
              <Info className="w-2.5 h-2.5 text-[#787b86]" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={currentLayout.shareEnabled}
              onClick={handleShareClick}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                currentLayout.shareEnabled ? 'bg-white' : 'bg-[#2a2e39]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full transition duration-200 ease-in-out shadow-xs ${
                  currentLayout.shareEnabled
                    ? 'translate-x-3 bg-[#131722]'
                    : 'translate-x-0.5 bg-[#787b86]'
                }`}
              />
            </button>
          </div>

          {copiedNotification && (
            <div className="mx-2.5 my-0.5 py-0.5 px-1.5 bg-[#089981]/20 border border-[#089981]/40 rounded text-[9px] text-[#00ffa3] flex items-center gap-1">
              <Check className="w-2.5 h-2.5 shrink-0" />
              <span>Share link copied!</span>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-[#2a2e39] my-0.5" />

          {/* Make a copy... */}
          <button
            onClick={() => {
              setInputValue(`${currentLayout.name} (Copy)`);
              setModalMode('copy');
            }}
            className="w-full px-2.5 py-1 flex items-center gap-2 text-[#d1d4dc] hover:text-white hover:bg-[#262b37] transition text-left"
          >
            <Copy className="w-3 h-3 text-[#848e9c]" />
            <span>Make a copy...</span>
          </button>

          {/* Rename... */}
          <button
            onClick={() => {
              setInputValue(currentLayout.name);
              setModalMode('rename');
            }}
            className="w-full px-2.5 py-1 flex items-center gap-2 text-[#d1d4dc] hover:text-white hover:bg-[#262b37] transition text-left"
          >
            <Edit2 className="w-3 h-3 text-[#848e9c]" />
            <span>Rename...</span>
          </button>

          {/* Download chart data... */}
          <button
            onClick={() => {
              onDownloadData();
              onClose();
            }}
            className="w-full px-2.5 py-1 flex items-center gap-2 text-[#d1d4dc] hover:text-white hover:bg-[#262b37] transition text-left"
          >
            <Download className="w-3 h-3 text-[#848e9c]" />
            <span>Download chart data...</span>
          </button>

          {/* Create new layout... */}
          <button
            onClick={() => {
              onCreateNewLayout();
              onClose();
            }}
            className="w-full px-2.5 py-1 flex items-center gap-2 text-[#d1d4dc] hover:text-white hover:bg-[#262b37] transition text-left"
          >
            <Plus className="w-3 h-3 text-[#848e9c]" />
            <span>Create new layout...</span>
          </button>

          {/* Divider */}
          <div className="h-px bg-[#2a2e39] my-0.5" />

          {/* RECENTLY USED */}
          <div className="px-2.5 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#787b86]">
            Recently Used
          </div>

          <div className="max-h-40 overflow-y-auto px-1.5 py-0.5 space-y-0.5 scrollbar-thin">
            {savedLayouts.map((layout) => {
              const isCurrent = layout.id === currentLayout.id;
              return (
                <div
                  key={layout.id}
                  onClick={() => {
                    onSelectLayout(layout);
                    onClose();
                  }}
                  className={`group px-2 py-1 rounded flex items-center justify-between cursor-pointer transition ${
                    isCurrent
                      ? 'bg-[#2a2e39] text-white'
                      : 'text-[#d1d4dc] hover:bg-[#262b37] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
                    {isCurrent && (
                      <Check className="w-3 h-3 text-[#2962ff] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[11px] leading-tight font-medium">{layout.name}</div>
                      <div className="text-[9px] truncate leading-tight text-[#787b86]">
                        {activeSymbol}, {activeTimeframe}
                      </div>
                    </div>
                  </div>

                  {/* Delete layout button if more than 1 layout exists */}
                  {savedLayouts.length > 1 && !isCurrent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayout(layout.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#f23645] hover:bg-[#363a45]/50 rounded transition text-[#787b86]"
                      title="Delete layout"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline Rename / Copy Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl w-full max-w-sm p-4 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-white">
              {modalMode === 'rename' ? 'Rename Chart Layout' : 'Make a Copy of Layout'}
            </h3>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitModal();
                if (e.key === 'Escape') setModalMode(null);
              }}
              autoFocus
              className="w-full bg-[#131722] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white outline-hidden"
              placeholder="Layout name..."
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModalMode(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#787b86] hover:text-white hover:bg-[#2a2e39] transition"
              >
                Cancel
              </button>
              <button
                onClick={submitModal}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2962ff] hover:bg-[#1e4bd8] text-white transition shadow-sm"
              >
                {modalMode === 'rename' ? 'Rename' : 'Create Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
