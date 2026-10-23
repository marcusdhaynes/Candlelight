import React, { useState } from 'react';
import { DetailedAlert, AlertLogEntry } from '../types';
import { DependencyContext } from '../types/conditionalOrders';
import {
  Plus,
  Search,
  ArrowUpDown,
  MoreHorizontal,
  Clock,
  Pin,
  Zap,
  Activity,
  CheckCircle2,
  Trash2,
  Pause,
  Play,
} from 'lucide-react';

interface AlertsPanelProps {
  alerts: DetailedAlert[];
  alertLog: AlertLogEntry[];
  onOpenCreateModal: () => void;
  onToggleStatus: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onOpenConditionalOrder?: (dep: DependencyContext) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  alertLog,
  onOpenCreateModal,
  onToggleStatus,
  onDeleteAlert,
  onOpenConditionalOrder,
}) => {
  const [subTab, setSubTab] = useState<'alerts' | 'log'>(() => {
    const saved = localStorage.getItem('tv_alerts_subtab');
    return saved === 'log' ? 'log' : 'alerts';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortAscending, setSortAscending] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('tv_alerts_subtab', subTab);
  }, [subTab]);

  const filteredAlerts = alerts.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a,b)=>sortAscending?a.title.localeCompare(b.title):b.title.localeCompare(a.title));

  return (
    <div id="tradingview-alerts-panel" className="flex flex-col h-full bg-[#131722] text-[#d1d4dc] select-none text-[11px]">
      {/* Top Header Row with Alerts / Log 1 pill selector and action buttons */}
      <div className="p-1.5 px-2 border-b border-[#2a2e39] flex items-center justify-between">
        {/* Alerts / Log (1) Toggle Switch */}
        <div className="flex items-center bg-[#1e222d] p-0.5 rounded-md border border-[#2a2e39]">
          <button
            onClick={() => setSubTab('alerts')}
            className={`px-2 py-0.5 text-[10.5px] font-semibold rounded transition ${
              subTab === 'alerts'
                ? 'bg-[#2a2e39] text-white shadow-xs'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            Alerts
          </button>
          <button
            onClick={() => setSubTab('log')}
            className={`px-2 py-0.5 text-[10.5px] font-semibold rounded transition flex items-center gap-1 ${
              subTab === 'log'
                ? 'bg-[#2a2e39] text-white shadow-xs'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            <span>Log</span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#f23645] text-white text-[9px] font-bold flex items-center justify-center">
              {alertLog.length}
            </span>
          </button>
        </div>

        {/* Action icons: + (create), search, sort, ... (more) */}
        <div className="flex items-center gap-0.5 text-[#787b86]">
          <button
            id="create-new-alert-plus-btn"
            onClick={onOpenCreateModal}
            className="p-0.5 hover:text-white hover:bg-[#1e222d] rounded transition"
            title="Create Alert"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-0.5 hover:text-white hover:bg-[#1e222d] rounded transition"
            title="Search Alerts"
          >
            <Search className="w-3 h-3" />
          </button>
          <button
            onClick={() => setSortAscending(v => !v)}
            className="p-0.5 hover:text-white hover:bg-[#1e222d] rounded transition"
            title={sortAscending ? 'Sort alerts Z to A' : 'Sort alerts A to Z'}
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled
            aria-label="More alert options not yet available"
            className="p-0.5 text-[#555960] rounded cursor-not-allowed"
            title="More alert options are not yet available"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Optional Search Bar */}
      {isSearchOpen && (
        <div className="p-1 px-2 border-b border-[#2a2e39] bg-[#1e222d]">
          <input
            type="text"
            placeholder="Filter alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#131722] border border-[#2a2e39] rounded px-1.5 py-0.5 text-[10.5px] text-[#d1d4dc] focus:outline-none focus:border-[#2962ff]"
            autoFocus
          />
        </div>
      )}

      {/* Alerts Content List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]/50">
        {subTab === 'alerts' && (
          <>
            {filteredAlerts.map((item) => (
              <div
                key={item.id}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenConditionalOrder?.({
                    type: 'alert',
                    alert: item,
                    id: item.id,
                    label: `Alert: "${item.title}"`,
                  });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenConditionalOrder?.({
                    type: 'alert',
                    alert: item,
                    id: item.id,
                    label: `Alert: "${item.title}"`,
                  });
                }}
                className="p-1.5 px-2 hover:bg-[#1e222d]/60 transition group relative cursor-pointer"
                title="Right-click or double-click to create Conditional Order on this alert"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-semibold text-[#d1d4dc] truncate leading-tight group-hover:text-[#2962ff] transition">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-[#787b86] truncate mt-0.5">
                      {item.message}
                    </p>

                    {/* Metadata line: ARBUSD, 1m · Active · [pin] · Fri 09/11/20... */}
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-[#787b86]">
                      {/* Token icon */}
                      <div className="w-3 h-3 rounded-full bg-[#2962ff] text-white flex items-center justify-center text-[7px] font-bold">
                        A
                      </div>
                      <span className="font-medium text-[#d1d4dc]">{item.symbol}, {item.timeframe}</span>
                      <span>•</span>
                      <span
                        className={`font-medium ${
                          item.status === 'Active'
                            ? 'text-[#089981]'
                            : item.status === 'Activating'
                            ? 'text-[#ff9800]'
                            : 'text-[#787b86]'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span>•</span>
                      {item.type === 'trendline' ? (
                        <Pin className="w-2.5 h-2.5 text-[#787b86]" />
                      ) : (
                        <Zap className="w-2.5 h-2.5 text-[#ff9800]" />
                      )}
                      <span>•</span>
                      <span className="truncate">{item.dateStr}</span>
                    </div>
                  </div>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenConditionalOrder?.({
                          type: 'alert',
                          alert: item,
                          id: item.id,
                          label: `Alert: "${item.title}"`,
                        });
                      }}
                      className="p-0.5 hover:text-[#00ffa3] rounded hover:bg-[#2a2e39]"
                      title="Create Conditional Order on Alert"
                    >
                      <Zap className="w-2.5 h-2.5 text-[#2962ff] hover:text-[#00ffa3]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStatus(item.id);
                      }}
                      className="p-0.5 hover:text-white rounded hover:bg-[#2a2e39]"
                      title={item.status === 'Active' ? 'Pause Alert' : 'Resume Alert'}
                    >
                      {item.status === 'Active' ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAlert(item.id);
                      }}
                      className="p-0.5 hover:text-[#f23645] rounded hover:bg-[#2a2e39]"
                      title="Delete Alert"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredAlerts.length === 0 && (
              <div className="p-6 text-center text-[10.5px] text-[#787b86]">
                No alerts configured. Click "+" to set breakout or price triggers.
              </div>
            )}
          </>
        )}

        {subTab === 'log' && (
          <div className="p-2 space-y-2">
            {alertLog.map(entry => (
              <div key={entry.id} className="p-2 rounded bg-[#1e222d] border border-[#2a2e39] text-[10.5px]">
                <div className="flex justify-between text-[#787b86] text-[9.5px] mb-1">
                  <span>{entry.symbol} · Observed live price</span>
                  <span>{new Date(entry.at).toLocaleString()}</span>
                </div>
                <div className="text-white font-medium">{entry.message}</div>
              </div>
            ))}
            {alertLog.length===0 && <p className="p-3 text-[#787b86] text-[10.5px]">No price alert has triggered in this browser yet. Alerts cannot run while the browser page is closed.</p>}
          </div>
        )}
      </div>
    </div>
  );
};
