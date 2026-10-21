import React, { useState } from 'react';
import { Asset, PriceAlert } from '../types';
import { Bell, X, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAsset: Asset;
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  activeAsset,
  alerts,
  setAlerts,
}) => {
  const [targetPrice, setTargetPrice] = useState<string>(activeAsset.price.toString());
  const [condition, setCondition] = useState<'cross_above' | 'cross_below'>('cross_above');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const newAlert: PriceAlert = {
      id: 'alert-' + Date.now(),
      symbol: activeAsset.symbol,
      targetPrice: priceNum,
      condition,
      createdAt: Date.now(),
      triggered: false,
      notes: notes.trim() || undefined,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    setNotes('');
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      id="alerts-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="alerts-modal-window"
        className="bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2e39]">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#2962ff]" />
            <h2 className="text-base font-semibold text-[#d1d4dc]">Price Alerts ({activeAsset.symbol})</h2>
          </div>
          <button
            id="close-alerts-modal-btn"
            onClick={onClose}
            className="text-[#787b86] hover:text-[#d1d4dc] p-1 rounded hover:bg-[#2a2e39] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Alert Form */}
        <form onSubmit={handleCreateAlert} className="p-4 border-b border-[#2a2e39] bg-[#131722]/50 space-y-3">
          <div className="text-xs text-[#787b86]">
            Current Price:{' '}
            <span className="text-[#d1d4dc] font-mono font-medium">
              ${activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.digits })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#787b86] mb-1">Condition</label>
              <select
                id="alert-condition-select"
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-[#2962ff]"
              >
                <option value="cross_above">Crossing Up (&gt;)</option>
                <option value="cross_below">Crossing Down (&lt;)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#787b86] mb-1">Target Price</label>
              <input
                id="alert-target-price-input"
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-[#d1d4dc] font-mono focus:outline-none focus:border-[#2962ff]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787b86] mb-1">Optional Note</label>
            <input
              id="alert-notes-input"
              type="text"
              placeholder="e.g. Resistance breakout, take profit, stop loss..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-[#d1d4dc] placeholder-[#787b86] focus:outline-none focus:border-[#2962ff]"
            />
          </div>

          <button
            id="create-alert-submit-btn"
            type="submit"
            className="w-full bg-[#2962ff] hover:bg-[#2962ff]/90 text-white font-medium text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Set Alert
          </button>
        </form>

        {/* Existing Alerts List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-xs font-semibold text-[#787b86] px-1 uppercase tracking-wider">
            Active Alerts ({alerts.length})
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#787b86]">
              No price alerts currently set. Create one above to receive triggers.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                id={`alert-item-${alert.id}`}
                className={`p-3 rounded-lg border flex items-center justify-between transition ${
                  alert.triggered
                    ? 'bg-[#131722] border-[#363c4e]/50 opacity-75'
                    : 'bg-[#131722] border-[#2a2e39] hover:border-[#363c4e]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {alert.triggered ? (
                      <CheckCircle2 className="w-4 h-4 text-[#089981]" />
                    ) : (
                      <Bell className="w-4 h-4 text-[#2962ff]" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#d1d4dc]">
                      <span className="font-semibold">{alert.symbol}</span>{' '}
                      {alert.condition === 'cross_above' ? 'crosses above' : 'crosses below'}{' '}
                      <span className="font-mono text-[#2962ff]">
                        ${alert.targetPrice.toLocaleString()}
                      </span>
                    </div>
                    {alert.notes && <div className="text-[11px] text-[#787b86] mt-0.5">{alert.notes}</div>}
                    <div className="text-[10px] text-[#787b86] mt-1">
                      {alert.triggered ? (
                        <span className="text-[#089981] font-medium">Triggered</span>
                      ) : (
                        'Active'
                      )}{' '}
                      • {new Date(alert.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  className="text-[#787b86] hover:text-[#f23645] p-1.5 rounded hover:bg-[#2a2e39] transition"
                  title="Remove alert"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
