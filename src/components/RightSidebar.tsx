import React from 'react';
import {
  Asset,
  Watchlist,
  OrderBookItem,
  TradeItem,
  PriceAlert,
  MarketNews,
  OHLCV,
  DetailedAlert,
  DependencyContext,
} from '../types';
import { WatchlistPanel } from './WatchlistPanel';
import { OrderBookWidget } from './OrderBookWidget';
import { TechnicalSummaryGauge } from './TechnicalSummaryGauge';
import { AlertsPanel } from './AlertsPanel';
import {
  List,
  Clock,
  Newspaper,
  Layers,
  Gauge,
  Bell,
  Calendar,
  Lightbulb,
  MessageSquare,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  BookOpen,
  Camera,
} from 'lucide-react';

export type RightSidebarTab =
  | 'alerts'
  | 'watchlist'
  | 'orderbook'
  | 'technicals'
  | 'news'
  | 'calendar'
  | 'notifications';

interface RightSidebarProps {
  assets: Asset[];
  activeAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
  watchlists: Watchlist[];
  setWatchlists: React.Dispatch<React.SetStateAction<Watchlist[]>>;
  activeWatchlistId: string;
  setActiveWatchlistId: (id: string) => void;
  onOpenAddSymbolModal: () => void;
  priceFlashMap: Record<string, 'up' | 'down'>;
  asks: OrderBookItem[];
  bids: OrderBookItem[];
  trades: TradeItem[];
  detailedAlerts: DetailedAlert[];
  onOpenCreateAlertModal: () => void;
  onToggleAlertStatus: (id: string) => void;
  onDeleteDetailedAlert: (id: string) => void;
  news: MarketNews[];
  candles: OHLCV[];
  isOpen: boolean;
  setIsOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  activeTab: RightSidebarTab;
  setActiveTab: (tab: RightSidebarTab) => void;
  onOpenTradeJournal?: () => void;
  onTakeSnapshot?: () => void;
  onOpenConditionalOrder?: (dep: DependencyContext) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = React.memo(({
  assets,
  activeAsset,
  onSelectAsset,
  watchlists,
  setWatchlists,
  activeWatchlistId,
  setActiveWatchlistId,
  onOpenAddSymbolModal,
  priceFlashMap,
  asks,
  bids,
  trades,
  detailedAlerts,
  onOpenCreateAlertModal,
  onToggleAlertStatus,
  onDeleteDetailedAlert,
  news,
  candles,
  isOpen,
  setIsOpen,
  activeTab,
  setActiveTab,
  onOpenTradeJournal,
  onTakeSnapshot,
  onOpenConditionalOrder,
}) => {
  return (
    <div id="tradingview-right-dock" className="flex h-full shrink-0 select-none z-20">
      {/* Expandable Panel Content */}
      {isOpen && (
        <div
          id="right-sidebar-content-pane"
          className="w-64 md:w-72 h-full bg-[#131722] border-l border-[#2a2e39] flex flex-col overflow-hidden"
        >
          {activeTab === 'alerts' && (
            <AlertsPanel
              alerts={detailedAlerts}
              onOpenCreateModal={onOpenCreateAlertModal}
              onToggleStatus={onToggleAlertStatus}
              onDeleteAlert={onDeleteDetailedAlert}
              onOpenConditionalOrder={onOpenConditionalOrder}
            />
          )}

          {activeTab === 'watchlist' && (
            <WatchlistPanel
              assets={assets}
              activeAsset={activeAsset}
              onSelectAsset={onSelectAsset}
              watchlists={watchlists}
              setWatchlists={setWatchlists}
              activeWatchlistId={activeWatchlistId}
              setActiveWatchlistId={setActiveWatchlistId}
              onOpenAddSymbolModal={onOpenAddSymbolModal}
              priceFlashMap={priceFlashMap}
            />
          )}

          {activeTab === 'orderbook' && (
            <OrderBookWidget
              asks={asks}
              bids={bids}
              trades={trades}
              currentPrice={activeAsset.price}
              digits={activeAsset.digits}
            />
          )}

          {activeTab === 'technicals' && (
            <div className="h-full overflow-y-auto">
              <TechnicalSummaryGauge asset={activeAsset} candles={candles} />
            </div>
          )}

          {activeTab === 'news' && (
            <div className="flex flex-col h-full bg-[#131722] p-2 overflow-y-auto divide-y divide-[#2a2e39]/50">
              <div className="text-[10.5px] font-semibold text-[#787b86] uppercase tracking-wider pb-1.5">
                Market Sentiment & News
              </div>
              {news.map((item) => (
                <div key={item.id} className="py-2 group cursor-pointer">
                  <div className="flex items-center justify-between text-[9px] text-[#787b86] mb-0.5">
                    <span>{item.source}</span>
                    <span>{item.timeAgo}</span>
                  </div>
                  <h4 className="text-[11px] font-medium text-[#d1d4dc] group-hover:text-[#2962ff] leading-snug transition">
                    {item.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-1">
                    <span
                      className={`text-[8.5px] px-1.5 py-0.2 rounded font-medium uppercase ${
                        item.sentiment === 'bullish'
                          ? 'bg-[#089981]/20 text-[#089981]'
                          : item.sentiment === 'bearish'
                          ? 'bg-[#f23645]/20 text-[#f23645]'
                          : 'bg-[#787b86]/20 text-[#787b86]'
                      }`}
                    >
                      {item.sentiment}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="flex flex-col h-full bg-[#131722] p-2.5 overflow-y-auto">
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-semibold text-xs text-[#d1d4dc]">Notifications</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-[#f23645] text-white rounded-full font-bold">
                  99+
                </span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 bg-[#1e222d] rounded border border-[#2a2e39]">
                  <div className="font-medium text-white">TradingView Platform Update</div>
                  <p className="text-[#787b86] text-[10px] mt-0.5">
                    New custom pine scripts and multi-layout charting optimizations are live.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rightmost Vertical Icon Tab Bar */}
      <div
        id="tradingview-right-icon-bar"
        className="w-[32px] bg-[#131722] border-l border-[#2a2e39] py-1 flex flex-col items-center justify-between shrink-0"
      >
        <div className="flex flex-col items-center gap-1 w-full">
          {/* Watchlist with red badge 1 */}
          <button
            id="right-tab-watchlist"
            onClick={() => {
              if (isOpen && activeTab === 'watchlist') setIsOpen(false);
              else {
                setActiveTab('watchlist');
                setIsOpen(true);
              }
            }}
            className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition relative ${
              isOpen && activeTab === 'watchlist'
                ? 'bg-[#2962ff] text-white'
                : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
            }`}
            title="Watchlist and Details"
          >
            <List className="w-3.5 h-3.5" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#f23645] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              1
            </span>
          </button>

          {/* Alerts (active in screenshot) */}
          <button
            id="right-tab-alerts"
            onClick={() => {
              if (isOpen && activeTab === 'alerts') setIsOpen(false);
              else {
                setActiveTab('alerts');
                setIsOpen(true);
              }
            }}
            className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition relative ${
              isOpen && activeTab === 'alerts'
                ? 'bg-[#2a2e39] text-white'
                : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
            }`}
            title="Alerts"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* News */}
          <button
            id="right-tab-news"
            onClick={() => {
              if (isOpen && activeTab === 'news') setIsOpen(false);
              else {
                setActiveTab('news');
                setIsOpen(true);
              }
            }}
            className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition ${
              isOpen && activeTab === 'news'
                ? 'bg-[#2962ff] text-white'
                : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
            }`}
            title="News"
          >
            <Newspaper className="w-3.5 h-3.5" />
          </button>

          {/* Order Book / DOM */}
          <button
            id="right-tab-orderbook"
            onClick={() => {
              if (isOpen && activeTab === 'orderbook') setIsOpen(false);
              else {
                setActiveTab('orderbook');
                setIsOpen(true);
              }
            }}
            className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition ${
              isOpen && activeTab === 'orderbook'
                ? 'bg-[#2962ff] text-white'
                : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
            }`}
            title="Order Book & Depth"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Technical Summary Gauge */}
          <button
            id="right-tab-technicals"
            onClick={() => {
              if (isOpen && activeTab === 'technicals') setIsOpen(false);
              else {
                setActiveTab('technicals');
                setIsOpen(true);
              }
            }}
            className={`w-[24px] h-[24px] rounded-md flex items-center justify-center transition ${
              isOpen && activeTab === 'technicals'
                ? 'bg-[#2962ff] text-white'
                : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]'
            }`}
            title="Technicals"
          >
            <Gauge className="w-3.5 h-3.5" />
          </button>

          {/* Calendar */}
          <button
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition"
            title="Economic Calendar"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>

          {/* Community Ideas */}
          <button
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition"
            title="Community Ideas"
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </button>

          {/* Chats */}
          <button
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition"
            title="Public and Private Chats"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          {/* Notifications with red badge 99+ */}
          <button
            id="right-tab-notifications"
            onClick={() => {
              if (isOpen && activeTab === 'notifications') setIsOpen(false);
              else {
                setActiveTab('notifications');
                setIsOpen(true);
              }
            }}
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition relative"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute -top-0.5 -right-1 px-0.5 py-0 bg-[#f23645] text-white text-[7.5px] font-bold rounded-full flex items-center justify-center">
              99+
            </span>
          </button>
        </div>

        {/* Bottom icons: Journal, Help & Toggle Collapse */}
        <div className="flex flex-col items-center gap-1">
          {/* Trade Journal (TradeZella & TraderSync) */}
          <button
            id="right-tab-trade-journal"
            onClick={onOpenTradeJournal}
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#2962ff] hover:text-white hover:bg-[#2962ff] transition relative group"
            title="Trade Journal (TradeZella & TraderSync)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#00ffa3] rounded-full ring-1 ring-[#131722]" />
          </button>

          {/* Camera / Snapshot button (Moved below Trade Journal) */}
          <button
            id="take-chart-snapshot-btn"
            onClick={onTakeSnapshot}
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition"
            title="Take a Snapshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <button
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition"
            title="Help Center"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            id="toggle-right-sidebar-btn"
            onClick={() => setIsOpen(!isOpen)}
            className="w-[24px] h-[24px] rounded-md flex items-center justify-center text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition"
            title={isOpen ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
});
