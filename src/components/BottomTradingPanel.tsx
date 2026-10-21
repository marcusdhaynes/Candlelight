import React, { useState } from 'react';
import { PaperAccount, PaperPosition } from '../types';
import { ConditionalOrder, DependencyContext } from '../types/conditionalOrders';
import { ConditionalOrdersTable } from './orders/ConditionalOrdersTable';
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  X,
  Edit2,
  SlidersHorizontal,
  Download,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  Minus,
  Zap,
} from 'lucide-react';

interface BottomTradingPanelProps {
  account: PaperAccount;
  positions: PaperPosition[];
  onClosePosition: (id: string) => void;
  conditionalOrders: ConditionalOrder[];
  onOpenCreateConditionalOrder: (dep?: DependencyContext | null) => void;
  onEditConditionalOrder: (order: ConditionalOrder) => void;
  onToggleConditionalOrderStatus: (id: string) => void;
  onDeleteConditionalOrder: (id: string) => void;
  onTestTriggerConditionalOrder: (order: ConditionalOrder) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
}

export type TradingTab =
  | 'positions'
  | 'orders'
  | 'orderHistory'
  | 'balanceHistory'
  | 'activityLog'
  | 'tradeHistory'
  | 'analytics';

export const BottomTradingPanel: React.FC<BottomTradingPanelProps> = ({
  account,
  positions,
  onClosePosition,
  conditionalOrders,
  onOpenCreateConditionalOrder,
  onEditConditionalOrder,
  onToggleConditionalOrderStatus,
  onDeleteConditionalOrder,
  onTestTriggerConditionalOrder,
  isOpen,
  setIsOpen,
  isExpanded,
  setIsExpanded,
}) => {
  const [activeTab, setActiveTab] = useState<TradingTab>(() => {
    const saved = localStorage.getItem('tv_bottom_trading_tab');
    return saved ? (saved as TradingTab) : 'positions';
  });

  React.useEffect(() => {
    localStorage.setItem('tv_bottom_trading_tab', activeTab);
  }, [activeTab]);

  if (!isOpen) {
    return (
      <button
        id="reopen-trading-panel-btn"
        onClick={() => setIsOpen(true)}
        className="h-5 bg-[#1e222d] border-t border-[#2a2e39] px-2 flex items-center gap-1.5 text-[10px] text-[#787b86] hover:text-[#d1d4dc] transition select-none"
      >
        <span className="font-bold text-white">Paper Trading</span>
        <span className="text-[9.5px] text-[#089981]">
          PnL: +${account.unrealizedPnL.toFixed(2)}
        </span>
      </button>
    );
  }

  return (
    <div
      id="tradingview-bottom-paper-dock"
      className={`bg-[#131722] border-t border-[#2a2e39] flex flex-col select-none transition-all duration-200 z-20 ${
        isExpanded ? 'h-56' : 'h-36'
      }`}
    >
      {/* Top Header Row of Trading Panel */}
      <div className="h-7 px-2 border-b border-[#2a2e39] flex items-center justify-between text-[11px] bg-[#131722]">
        {/* Left: Paper Trading dropdown & Account Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 cursor-pointer text-[#d1d4dc] hover:text-white font-medium">
            <span className="text-xs font-bold tracking-tight">Paper Trading</span>
            <ChevronDown className="w-3 h-3 text-[#787b86]" />
          </div>

          <div className="h-3 w-px bg-[#2a2e39]" />

          {/* Account Selector Pill */}
          <button
            id="trading-account-selector-btn"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] text-[10px] hover:border-[#787b86] transition"
          >
            <span>{account.name}</span>
            <ChevronDown className="w-2.5 h-2.5 text-[#787b86]" />
          </button>
        </div>

        {/* Center/Right: Account Financial Metrics Bar */}
        <div className="hidden lg:flex items-center gap-3.5 text-[10px] font-mono">
          <div>
            <span className="text-[#787b86] mr-1">Account balance</span>
            <span className="text-[#d1d4dc] font-medium">{account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Equity</span>
            <span className="text-[#d1d4dc] font-medium">{account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Realized PnL</span>
            <span className={account.realizedPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>
              {account.realizedPnL >= 0 ? '+' : ''}{account.realizedPnL.toFixed(2)}
            </span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Unrealized PnL</span>
            <span className={account.unrealizedPnL >= 0 ? 'text-[#089981] font-semibold' : 'text-[#f23645] font-semibold'}>
              {account.unrealizedPnL >= 0 ? '+' : ''}{account.unrealizedPnL.toFixed(2)}
            </span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Account margin</span>
            <span className="text-[#d1d4dc]">{account.accountMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Available funds</span>
            <span className="text-[#d1d4dc]">{account.availableFunds.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Orders margin</span>
            <span className="text-[#d1d4dc]">{account.ordersMargin.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[#787b86] mr-1">Margin buffer</span>
            <span className="text-[#ff9800] font-bold">{account.marginBuffer.toFixed(2)}%</span>
          </div>
        </div>

        {/* Right action icons (minimize, expand, close) */}
        <div className="flex items-center gap-1.5 text-[#787b86]">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
            title={isExpanded ? 'Minimize height' : 'Expand height'}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-0.5 hover:text-[#d1d4dc] hover:bg-[#1e222d] rounded transition"
            title="Hide panel"
          >
            <Minus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Sub-tabs Row (Positions 1, Orders, Order history, Balance history, etc.) */}
      <div className="h-6 px-2 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
        <div className="flex items-center gap-0.5">
          <button
            id="tab-positions-btn"
            onClick={() => setActiveTab('positions')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition flex items-center gap-1 ${
              activeTab === 'positions'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            <span>Positions</span>
            <span className="px-1 py-0.1 bg-[#2a2e39] text-[#d1d4dc] rounded-full text-[9px]">
              {positions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition flex items-center gap-1 ${
              activeTab === 'orders'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            <span>Orders</span>
            <span className="px-1 py-0.1 bg-[#2962ff]/30 text-[#2962ff] rounded-full text-[9px] font-bold">
              {conditionalOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orderHistory')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition ${
              activeTab === 'orderHistory'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            Order history
          </button>

          <button
            onClick={() => setActiveTab('balanceHistory')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition ${
              activeTab === 'balanceHistory'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            Balance history
          </button>

          <button
            onClick={() => setActiveTab('activityLog')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition ${
              activeTab === 'activityLog'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            Activity log
          </button>

          <button
            onClick={() => setActiveTab('tradeHistory')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition ${
              activeTab === 'tradeHistory'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            Trade history
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-2 py-0.5 text-[10.5px] rounded transition ${
              activeTab === 'analytics'
                ? 'bg-[#1e222d] text-[#d1d4dc] font-medium'
                : 'text-[#787b86] hover:text-[#d1d4dc]'
            }`}
          >
            Analytics
          </button>
        </div>

        <button
          className="p-0.5 text-[#787b86] hover:text-[#d1d4dc] rounded transition"
          title="Export Table Data"
        >
          <Download className="w-3 h-3" />
        </button>
      </div>

      {/* Table Content Area */}
      <div className="flex-1 overflow-y-auto font-sans text-xs">
        {activeTab === 'positions' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2a2e39]/60 text-[10px] text-[#787b86]">
                <th className="py-1 px-3 font-normal">Symbol</th>
                <th className="py-1 px-3 font-normal">Side</th>
                <th className="py-1 px-3 font-normal">Unrealized PnL</th>
                <th className="py-1 px-3 font-normal">Unrealized PnL % ↑</th>
                <th className="py-1 px-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const isProfitable = pos.unrealizedPnL >= 0;
                return (
                  <tr
                    key={pos.id}
                    className="hover:bg-[#1e222d]/60 border-b border-[#2a2e39]/30 transition group text-[10.5px]"
                  >
                    {/* Symbol with Kraken Badge */}
                    <td className="py-1 px-3">
                      <div className="flex items-center gap-1.5">
                        {/* Token icon */}
                        <div className="w-4 h-4 rounded-full bg-[#2962ff]/20 flex items-center justify-center text-[9px] font-bold text-[#2962ff]">
                          A
                        </div>
                        <span className="px-1.5 py-0.2 rounded bg-[#2962ff] text-white font-bold text-[9px] tracking-wide">
                          {pos.symbol}
                        </span>
                      </div>
                    </td>

                    {/* Side */}
                    <td className="py-1 px-3">
                      <span className="text-[#2962ff] font-medium">
                        {pos.side}
                      </span>
                    </td>

                    {/* Unrealized PnL */}
                    <td className="py-1 px-3 font-mono">
                      <span className={isProfitable ? 'text-[#089981]' : 'text-[#f23645]'}>
                        {isProfitable ? '+' : ''}
                        {pos.unrealizedPnL.toFixed(2)} USD
                      </span>
                    </td>

                    {/* Unrealized PnL % */}
                    <td className="py-1 px-3 font-mono">
                      <span className={isProfitable ? 'text-[#089981]' : 'text-[#f23645]'}>
                        {isProfitable ? '+' : ''}
                        {pos.unrealizedPnLPct.toFixed(2)}%
                      </span>
                    </td>

                    {/* Action buttons (Conditional Order, Edit, Close) */}
                    <td className="py-1 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-[#787b86]">
                        <button
                          onClick={() =>
                            onOpenCreateConditionalOrder({
                              type: 'position',
                              label: `${pos.symbol} Position (${pos.side})`,
                            })
                          }
                          className="p-0.5 hover:text-[#00ffa3] hover:bg-[#2a2e39] rounded transition"
                          title="Attach Conditional Order (TP / Trailing SL / Scale Out)"
                        >
                          <Zap className="w-3 h-3 text-[#2962ff] hover:text-[#00ffa3]" />
                        </button>
                        <button
                          className="p-0.5 hover:text-[#d1d4dc] hover:bg-[#2a2e39] rounded transition"
                          title="Edit Take Profit / Stop Loss"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="p-0.5 hover:text-[#f23645] hover:bg-[#2a2e39] rounded transition"
                          title="Close Position"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[11px] text-[#787b86]">
                    No open positions. Use the Trade button or Right Drawer to enter positions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'orders' && (
          <ConditionalOrdersTable
            orders={conditionalOrders}
            onOpenCreateModal={() => onOpenCreateConditionalOrder(null)}
            onEditOrder={onEditConditionalOrder}
            onToggleStatus={onToggleConditionalOrderStatus}
            onDeleteOrder={onDeleteConditionalOrder}
            onTestTrigger={onTestTriggerConditionalOrder}
          />
        )}

        {activeTab !== 'positions' && activeTab !== 'orders' && (
          <div className="p-6 text-center text-[11px] text-[#787b86]">
            No records found for {activeTab}. Live simulated trades and orders will be recorded here.
          </div>
        )}
      </div>
    </div>
  );
};
