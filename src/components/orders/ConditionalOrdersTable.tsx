import React, { useState } from 'react';
import { ConditionalOrder } from '../../types/conditionalOrders';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface ConditionalOrdersTableProps {
  orders: ConditionalOrder[];
  onOpenCreateModal: () => void;
  onEditOrder: (order: ConditionalOrder) => void;
  onToggleStatus: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onTestTrigger: (order: ConditionalOrder) => void;
}

export const ConditionalOrdersTable: React.FC<ConditionalOrdersTableProps> = ({
  orders,
  onOpenCreateModal,
  onEditOrder,
  onToggleStatus,
  onDeleteOrder,
  onTestTrigger,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'triggered' | 'paused'>('all');

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  const getLogicBadgeClass = (logic: string) => {
    switch (logic) {
      case 'IF':
        return 'bg-[#2962ff]/20 text-[#2962ff] border-[#2962ff]/40';
      case 'IF (AND)':
        return 'bg-[#9c27b0]/20 text-[#ba68c8] border-[#9c27b0]/40';
      case 'IF (OR)':
        return 'bg-[#ff9800]/20 text-[#ffb74d] border-[#ff9800]/40';
      case 'WHENEVER':
        return 'bg-[#00ffa3]/20 text-[#00ffa3] border-[#00ffa3]/40';
      default:
        return 'bg-[#2a2e39] text-[#d1d4dc] border-[#2a2e39]';
    }
  };

  const getActionBadge = (order: ConditionalOrder) => {
    const act = order.action;
    if (act === 'enter_long') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#089981]/20 text-[#089981] font-bold text-[10px] border border-[#089981]/30">
          Enter Long ({order.execution.size} {order.execution.sizeUnit})
        </span>
      );
    }
    if (act === 'enter_short') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#f23645]/20 text-[#f23645] font-bold text-[10px] border border-[#f23645]/30">
          Enter Short ({order.execution.size} {order.execution.sizeUnit})
        </span>
      );
    }
    if (act === 'sl_trailing') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#ff9800]/20 text-[#ff9800] font-bold text-[10px] border border-[#ff9800]/30">
          Trailing SL ({order.execution.trailingPercent}%)
        </span>
      );
    }
    if (act === 'tp') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#089981]/20 text-[#089981] font-bold text-[10px] border border-[#089981]/30">
          TP (+{order.execution.tpPercent}%)
        </span>
      );
    }
    if (act === 'sl_set') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#f23645]/20 text-[#f23645] font-bold text-[10px] border border-[#f23645]/30">
          SL (-{order.execution.slPercent}%)
        </span>
      );
    }
    if (act === 'reduce_position') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#9c27b0]/20 text-[#ba68c8] font-bold text-[10px] border border-[#9c27b0]/30">
          Reduce ({order.execution.reducePercent}%)
        </span>
      );
    }
    if (act === 'increase_position') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#00bcd4]/20 text-[#4dd0e1] font-bold text-[10px] border border-[#00bcd4]/30">
          Increase ({order.execution.increasePercent}%)
        </span>
      );
    }
    if (act === 'exit_long' || act === 'exit_short') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#2962ff]/20 text-[#2962ff] font-bold text-[10px] border border-[#2962ff]/30">
          Close Position
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded bg-[#787b86]/20 text-[#d1d4dc] font-bold text-[10px]">
        {act.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#131722] text-xs">
      {/* Table Toolbar */}
      <div className="h-8 px-3 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-[#787b86]">
            <Zap className="w-3.5 h-3.5 text-[#2962ff]" />
            <span className="font-semibold text-white">Conditional Orders</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#2a2e39] text-[#d1d4dc] text-[9.5px]">
              {orders.length}
            </span>
          </div>

          <div className="h-3 w-px bg-[#2a2e39]" />

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-[10px]">
            {(['all', 'active', 'triggered', 'paused'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-1.5 py-0.5 rounded transition capitalize ${
                  statusFilter === st
                    ? 'bg-[#1e222d] text-white font-medium border border-[#2a2e39]'
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Create Conditional Order Button */}
        <button
          onClick={onOpenCreateModal}
          className="px-2.5 py-1 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold text-[11px] transition flex items-center gap-1 shadow-xs"
        >
          <Plus className="w-3 h-3" />
          <span>New Conditional Order</span>
        </button>
      </div>

      {/* Orders List Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-[#2a2e39]/60 text-[10px] text-[#787b86] bg-[#181b24]">
              <th className="py-1.5 px-3 font-normal">Symbol</th>
              <th className="py-1.5 px-3 font-normal">Logic</th>
              <th className="py-1.5 px-3 font-normal">Dependency & Conditions</th>
              <th className="py-1.5 px-3 font-normal">THEN Action</th>
              <th className="py-1.5 px-3 font-normal">Status</th>
              <th className="py-1.5 px-3 font-normal">Triggers</th>
              <th className="py-1.5 px-3 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const isActive = order.status === 'active';
              return (
                <tr
                  key={order.id}
                  onDoubleClick={() => onEditOrder(order)}
                  className="hover:bg-[#1e222d]/60 border-b border-[#2a2e39]/30 transition group cursor-pointer"
                  title="Double-click to edit this conditional order"
                >
                  {/* Symbol */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#2962ff] text-white font-bold text-[9.5px]">
                        {order.symbol}
                      </span>
                      <span className="font-medium text-white truncate max-w-[140px]" title={order.title}>
                        {order.title}
                      </span>
                    </div>
                  </td>

                  {/* Logic Badge */}
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded border font-bold text-[10px] tracking-wide ${getLogicBadgeClass(
                        order.conditionLogic
                      )}`}
                    >
                      {order.conditionLogic}
                    </span>
                  </td>

                  {/* Dependency & Conditions */}
                  <td className="py-2 px-3">
                    <div className="flex flex-col gap-0.5">
                      {order.conditions.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-1.5 text-[10.5px]">
                          <span className="text-[#2962ff] font-medium">
                            {c.dependencyType === 'drawing' && '📐'}
                            {c.dependencyType === 'alert' && '🔔'}
                            {c.dependencyType === 'indicator' && '📊'}
                            {c.dependencyType === 'price' && '💲'}
                            {c.dependencyType === 'position' && '💼'}
                            {c.dependencyType === 'volume' && '🌊'}
                          </span>
                          <span className="text-[#d1d4dc]">{c.dependencyLabel}</span>
                          <span className="text-[#787b86]">
                            {c.operator.replace('_', ' ')}
                            {c.thresholdValue != null && ` $${c.thresholdValue}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-2 px-3">{getActionBadge(order)}</td>

                  {/* Status */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#089981] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#089981]" />
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold capitalize ${
                          order.status === 'active'
                            ? 'text-[#089981]'
                            : order.status === 'triggered'
                            ? 'text-[#2962ff]'
                            : 'text-[#787b86]'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </td>

                  {/* Triggers */}
                  <td className="py-2 px-3 font-mono text-[10.5px] text-[#787b86]">
                    {order.conditionLogic === 'WHENEVER'
                      ? `${order.triggerCount} times`
                      : `${order.triggerCount}/${order.maxTriggers}`}
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-[#787b86]">
                      {/* Test simulate */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTestTrigger(order);
                        }}
                        className="p-1 hover:text-[#00ffa3] hover:bg-[#2a2e39] rounded transition"
                        title="Simulate trigger now"
                      >
                        <Play className="w-3 h-3" />
                      </button>

                      {/* Pause / Resume */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStatus(order.id);
                        }}
                        className="p-1 hover:text-white hover:bg-[#2a2e39] rounded transition"
                        title={isActive ? 'Pause Order' : 'Activate Order'}
                      >
                        {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-[#089981]" />}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditOrder(order);
                        }}
                        className="p-1 hover:text-[#d1d4dc] hover:bg-[#2a2e39] rounded transition"
                        title="Edit Conditional Order"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOrder(order.id);
                        }}
                        className="p-1 hover:text-[#f23645] hover:bg-[#2a2e39] rounded transition"
                        title="Delete Conditional Order"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#787b86] space-y-2">
                  <Zap className="w-6 h-6 mx-auto opacity-30 text-[#2962ff]" />
                  <p>No conditional orders found.</p>
                  <p className="text-[10px]">
                    Create an order rule above, or right-click / double-click any drawing or alert on the chart.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
