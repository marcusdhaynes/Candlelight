import type { Asset, PaperAccount, PaperPosition } from '../types';

export const PAPER_STARTING_BALANCE = 10000;
export const PAPER_FEE_RATE = 0.0004; // 0.04% per executed side; configurable later.
export interface PaperFill {
  id: string; positionId: string; symbol: string; exchange: string;
  side: 'Buy' | 'Sell'; quantity: number; price: number;
  fee: number; realizedPnL: number; timestamp: number; note: string;
}
export interface PaperPortfolio {
  account: PaperAccount;
  positions: PaperPosition[];
  fills: PaperFill[];
}
export function emptyPaperPortfolio(): PaperPortfolio {
  const account: PaperAccount = {
    name: 'Candlelight Paper USD', balance: PAPER_STARTING_BALANCE,
    equity: PAPER_STARTING_BALANCE, realizedPnL: 0, unrealizedPnL: 0,
    accountMargin: 0, availableFunds: PAPER_STARTING_BALANCE,
    ordersMargin: 0, marginBuffer: 100,
  };
  return { account, positions: [], fills: [] };
}
export const positionPnL = (p: PaperPosition, marketPrice: number) =>
  (p.side === 'Long' ? 1 : -1) * (marketPrice - p.entryPrice) * p.qty;
export function recalculatePaperPortfolio(portfolio: PaperPortfolio): PaperPortfolio {
  const positions = portfolio.positions.map(p => {
    const currentPrice = Number.isFinite(p.currentPrice) && p.currentPrice > 0 ? p.currentPrice : p.entryPrice;
    const unrealizedPnL = positionPnL(p, currentPrice);
    const notional = p.qty * p.entryPrice;
    return {...p, currentPrice, unrealizedPnL,
      unrealizedPnLPct: notional > 0 ? unrealizedPnL / notional * 100 : 0 };
  });
  const unrealizedPnL = positions.reduce((n, p) => n + p.unrealizedPnL, 0);
  const accountMargin = positions.reduce((n, p) => n + p.qty * p.entryPrice / Math.max(1,p.leverage || 1), 0);
  const equity = portfolio.account.balance + unrealizedPnL;
  const availableFunds = Math.max(0, equity - accountMargin);
  return {...portfolio, positions, account: {...portfolio.account,
    unrealizedPnL, accountMargin, equity, availableFunds,
    marginBuffer: accountMargin > 0 ? (equity - accountMargin) / accountMargin * 100 : 100,
  }};
}
export const isFreshPaperQuote = (asset: Asset, now = Date.now()): boolean =>
  asset.quoteStatus === 'live' && Number.isFinite(asset.price) && asset.price > 0 &&
  !!asset.quoteUpdatedAt && now - asset.quoteUpdatedAt < 30_000;
export function placePaperPosition(
  input: PaperPortfolio, asset: Asset, side: 'Long' | 'Short',
  quantity: number, leverage = 1, tp?: number, sl?: number, at = Date.now()
): PaperPortfolio {
  if (!isFreshPaperQuote(asset, at)) throw new Error('A verified, recent live quote is required to open a position.');
  // Paper cash ledger is USD. Non-USD quote assets need a separately verified
  // exchange rate before they can be settled without inventing conversions.
  if (asset.currency !== 'USD')
    throw new Error('This USD paper account supports USD-quoted markets only until live currency conversion is available.');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be a positive number.');
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 20) throw new Error('Leverage must be 1–20×.');
  if (tp !== undefined && (!Number.isFinite(tp) || tp <= 0 || (side==='Long' ? tp <= asset.price : tp >= asset.price)))
    throw new Error('Take profit must be above entry for a long or below entry for a short.');
  if (sl !== undefined && (!Number.isFinite(sl) || sl <= 0 || (side==='Long' ? sl >= asset.price : sl <= asset.price)))
    throw new Error('Stop loss must be below entry for a long or above entry for a short.');
  const portfolio = recalculatePaperPortfolio(input);
  const notional = quantity * asset.price, margin = notional / leverage, entryFee = notional * PAPER_FEE_RATE;
  // Equity must cover both initial margin and opening fees; ignore untrusted cached prices.
  if (margin + entryFee > portfolio.account.availableFunds + 1e-8)
    throw new Error('Insufficient available funds for margin and opening fee.');
  const id = 'paper-'+at+'-'+Math.random().toString(36).slice(2,8);
  const position: PaperPosition = {
    id, symbol: asset.symbol, exchange: asset.source || asset.exchange,
    side, qty: quantity, leverage, entryPrice: asset.price, currentPrice: asset.price,
    unrealizedPnL: 0, unrealizedPnLPct: 0, tp, sl, openedAt: at, lastMarkedAt: at,
  };
  return recalculatePaperPortfolio({...portfolio,
    account: {...portfolio.account,
      balance: portfolio.account.balance - entryFee,
      realizedPnL: portfolio.account.realizedPnL - entryFee },
    positions: [position,...portfolio.positions],
    fills: [{id:id+'-open',positionId:id, symbol:position.symbol,exchange:position.exchange,
      side: side === 'Long' ? 'Buy' : 'Sell',quantity,price:asset.price,fee:entryFee,
      realizedPnL:-entryFee,timestamp:at,note:'Open (simulated market fill)'},
      ...portfolio.fills],
  });
}
export function closePaperPosition(
  input: PaperPortfolio,id: string,marketPrice?: number,quantity?: number,at=Date.now()
): PaperPortfolio {
  const p = input.positions.find(x=>x.id===id);
  if (!p) return input;
  const price = marketPrice ?? p.currentPrice;
  if (!Number.isFinite(price) || price <= 0) throw new Error('A valid market price is required to close.');
  const qty = quantity === undefined ? p.qty : quantity;
  if (!Number.isFinite(qty) || qty <= 0 || qty > p.qty) throw new Error('Invalid closing quantity.');
  const realized = (p.side === 'Long' ? 1 : -1) * (price-p.entryPrice)*qty;
  const fee = qty * price * PAPER_FEE_RATE;
  const remaining = p.qty - qty;
  return recalculatePaperPortfolio({...input,
    account: {...input.account, balance:input.account.balance+realized-fee,
      realizedPnL:input.account.realizedPnL+realized-fee },
    positions: remaining < 1e-10 ? input.positions.filter(x=>x.id!==id) :
      input.positions.map(x=>x.id===id?{...x,qty:remaining,currentPrice:price}:x),
    fills:[{id:'close-'+at+'-'+Math.random().toString(36).slice(2,8),
      positionId:id,symbol:p.symbol,exchange:p.exchange,
      side:p.side==='Long'?'Sell':'Buy',quantity:qty,price,fee,realizedPnL:realized-fee,
      timestamp:at,note:remaining>1e-10?'Partial close':'Close'},...input.fills],
  });
}
export function updatePaperStops(input: PaperPortfolio,id:string,tp?:number,sl?:number): PaperPortfolio {
  const p=input.positions.find(x=>x.id===id);
  if(!p) return input;
  if(tp!==undefined && (!Number.isFinite(tp)||tp<=0)) throw new Error('Invalid take-profit price.');
  if(sl!==undefined && (!Number.isFinite(sl)||sl<=0)) throw new Error('Invalid stop-loss price.');
  return {...input,positions:input.positions.map(x=>x.id===id?{...x,tp,sl}:x)};
}
export function markPaperPositions(input:PaperPortfolio,asset:Asset,at=Date.now()):PaperPortfolio{
  if(!isFreshPaperQuote(asset,at))return input;
  const venue=asset.source||asset.exchange;
  if(!input.positions.some(p=>p.symbol===asset.symbol && p.exchange===venue))return input;
  let next:PaperPortfolio={...input,positions:input.positions.map(p=>
    p.symbol===asset.symbol&&p.exchange===venue?
      {...p,currentPrice:asset.price,lastMarkedAt:at}:p)};
  next=recalculatePaperPortfolio(next);
  // Execute TP/SL on the real observed tick (not an optimistic assumed fill).
  for(const p of [...next.positions]){
    if(p.symbol!==asset.symbol||p.exchange!==venue)continue;
    const hitTP=p.tp!==undefined&&(p.side==='Long'?asset.price>=p.tp:asset.price<=p.tp);
    const hitSL=p.sl!==undefined&&(p.side==='Long'?asset.price<=p.sl:asset.price>=p.sl);
    if(hitTP||hitSL)next=closePaperPosition(next,p.id,asset.price,undefined,at);
  }
  return next;
}
