import React, { useState } from 'react';
import { OrderBookItem, TradeItem } from '../types';

interface OrderBookWidgetProps {
  asks: OrderBookItem[];
  bids: OrderBookItem[];
  trades: TradeItem[];
  currentPrice: number;
  digits: number;
}

export const OrderBookWidget: React.FC<OrderBookWidgetProps> = React.memo(({
  asks,
  bids,
  trades,
  currentPrice,
  digits,
}) => {
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>(() => {
    const saved = localStorage.getItem('tv_orderbook_tab');
    return saved === 'trades' ? 'trades' : 'book';
  });

  React.useEffect(() => {
    localStorage.setItem('tv_orderbook_tab', activeTab);
  }, [activeTab]);

  // Compute maximum cumulative volume to normalize background depth bars
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 1;
  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 1;
  const maxTotal = Math.max(maxAskTotal, maxBidTotal, 1);

  const bestAsk = asks.length > 0 ? asks[0].price : currentPrice;
  const bestBid = bids.length > 0 ? bids[0].price : currentPrice;
  const spread = Math.max(0, bestAsk - bestBid);
  const spreadPct = bestBid > 0 ? ((spread / bestBid) * 100).toFixed(3) : '0.000';

  return (
    <div id="orderbook-widget" className="flex flex-col h-full bg-[#131722] select-none text-[11px]">
      {/* Tabs */}
      <div className="flex border-b border-[#2a2e39] bg-[#1e222d]/70 px-1.5 pt-0.5 gap-1">
        <button
          id="orderbook-tab-btn"
          onClick={() => setActiveTab('book')}
          className={`px-2 py-1 font-semibold text-[10.5px] border-b-2 transition ${
            activeTab === 'book'
              ? 'border-[#2962ff] text-[#d1d4dc]'
              : 'border-transparent text-[#787b86] hover:text-[#d1d4dc]'
          }`}
        >
          Order Book
        </button>
        <button
          id="trades-tab-btn"
          onClick={() => setActiveTab('trades')}
          className={`px-2 py-1 font-semibold text-[10.5px] border-b-2 transition ${
            activeTab === 'trades'
              ? 'border-[#2962ff] text-[#d1d4dc]'
              : 'border-transparent text-[#787b86] hover:text-[#d1d4dc]'
          }`}
        >
          Recent Trades
        </button>
      </div>

      {activeTab === 'book' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-3 px-2 py-1 text-[9.5px] font-medium text-[#787b86] border-b border-[#2a2e39]/60">
            <span>Price (USD)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks (Sells) - Red, shown reversed (lowest ask at bottom near spread) */}
          <div className="flex-1 flex flex-col justify-end overflow-hidden divide-y divide-[#2a2e39]/20 font-mono text-[10px]">
            {asks
              .slice(0, 7)
              .reverse()
              .map((ask, idx) => {
                const depthPct = Math.min(100, (ask.total / maxTotal) * 100);
                return (
                  <div
                    key={`ask-${idx}`}
                    className="relative grid grid-cols-3 px-2 py-0.5 hover:bg-[#2a2e39]/30 items-center"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#f23645]/15 pointer-events-none"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="text-[#f23645] font-medium relative z-10">
                      {ask.price.toFixed(digits)}
                    </span>
                    <span className="text-right text-[#d1d4dc] relative z-10">{ask.size.toFixed(2)}</span>
                    <span className="text-right text-[#787b86] relative z-10">{ask.total.toFixed(2)}</span>
                  </div>
                );
              })}
          </div>

          {/* Mid Market Spread Bar */}
          <div className="py-1 px-2 bg-[#1e222d] border-y border-[#2a2e39] flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#d1d4dc]">{currentPrice.toFixed(digits)}</span>
              <span className="text-[9px] text-[#787b86]">Mid</span>
            </div>
            <div className="text-[9px] text-[#787b86]">
              Spread: <span className="text-[#d1d4dc]">{spread.toFixed(digits)}</span> ({spreadPct}%)
            </div>
          </div>

          {/* Bids (Buys) - Green, highest bid at top near spread */}
          <div className="flex-1 flex flex-col overflow-hidden divide-y divide-[#2a2e39]/20 font-mono text-[10px]">
            {bids.slice(0, 7).map((bid, idx) => {
              const depthPct = Math.min(100, (bid.total / maxTotal) * 100);
              return (
                <div
                  key={`bid-${idx}`}
                  className="relative grid grid-cols-3 px-2 py-0.5 hover:bg-[#2a2e39]/30 items-center"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-[#089981]/15 pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-[#089981] font-medium relative z-10">
                    {bid.price.toFixed(digits)}
                  </span>
                  <span className="text-right text-[#d1d4dc] relative z-10">{bid.size.toFixed(2)}</span>
                  <span className="text-right text-[#787b86] relative z-10">{bid.total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Recent Trades View */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="grid grid-cols-3 px-2 py-1 text-[9.5px] font-medium text-[#787b86] border-b border-[#2a2e39]/60">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]/20 font-mono text-[10px]">
            {trades.slice(0, 25).map((trade) => {
              const isBuy = trade.side === 'buy';
              const timeStr = new Date(trade.time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={trade.id}
                  className="grid grid-cols-3 px-2 py-0.5 hover:bg-[#2a2e39]/30 items-center transition"
                >
                  <span className={isBuy ? 'text-[#089981] font-medium' : 'text-[#f23645] font-medium'}>
                    {trade.price.toFixed(digits)}
                  </span>
                  <span className="text-right text-[#d1d4dc]">{trade.size.toFixed(2)}</span>
                  <span className="text-right text-[#787b86] text-[9px]">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
