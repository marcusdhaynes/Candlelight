import type { Asset, PaperAccount, PaperPosition } from '../types';

export const PAPER_STARTING_BALANCE = 10000;
export type PaperCommission = { enabled:boolean; mode:'fixed'|'percent'; amount:number };
export interface PaperSettings {
  currency:string;
  startingBalance:number;
  marginControl:boolean;
  leverages:{stocks:number;futures:number;forex:number;crypto:number;others:number};
  commission:PaperCommission;
  futuresOptions:{enabled:boolean;perContract:number};
}
export const DEFAULT_PAPER_SETTINGS:PaperSettings = {
  currency:'USD',startingBalance:PAPER_STARTING_BALANCE,marginControl:false,
  leverages:{stocks:1,futures:20,forex:50,crypto:10,others:50},
  commission:{enabled:false,mode:'fixed',amount:0},
  futuresOptions:{enabled:false,perContract:0},
};
export function normalizePaperSettings(raw?:Partial<PaperSettings>):PaperSettings{
  return {...DEFAULT_PAPER_SETTINGS,...raw,
    leverages:{...DEFAULT_PAPER_SETTINGS.leverages,...raw?.leverages},
    commission:{...DEFAULT_PAPER_SETTINGS.commission,...raw?.commission},
    futuresOptions:{...DEFAULT_PAPER_SETTINGS.futuresOptions,...raw?.futuresOptions}};
}
export function marketPaperCategory(asset:Asset):keyof PaperSettings['leverages']{
  if (asset.category==='stocks'||asset.category==='funds')return 'stocks';
  if (asset.category==='futures'||asset.marketType==='futures'||asset.marketType==='swap'||asset.category==='options')return 'futures';
  if (asset.category==='forex')return 'forex';
  if (asset.category==='crypto')return 'crypto';
  return 'others';
}
export function accountLeverage(settings:PaperSettings,asset:Asset):number{
  return settings.marginControl?settings.leverages[marketPaperCategory(asset)]:1;
}
export function paperCommission(settings:PaperSettings,asset:Pick<Asset,'category'|'marketType'>,quantity:number,price:number):number{
  if (asset.category==='futures'||asset.category==='options'||asset.marketType==='futures') {
    if(settings.futuresOptions.enabled)return settings.futuresOptions.perContract*quantity;
  }
  const c=settings.commission;
  return !c.enabled?0:c.mode==='fixed'?c.amount:quantity*price*c.amount/100;
}
export function validatePaperSettings(settings:PaperSettings){
  if(!settings.currency||!['USD','USDT','USDC','EUR','GBP','JPY','BTC'].includes(settings.currency))throw new Error('Choose a valid currency.');
  if(!Number.isFinite(settings.startingBalance)||settings.startingBalance<0)throw new Error('Balance must be zero or greater.');
  for(const n of Object.values(settings.leverages))if(!Number.isFinite(n)||n<1||n>1000)throw new Error('Leverage must be between 1× and 1000×.');
  if(!Number.isFinite(settings.commission.amount)||settings.commission.amount<0)throw new Error('Commission cannot be negative.');
  if(settings.commission.mode==='percent'&&settings.commission.amount>100)throw new Error('Commission percent cannot exceed 100.');
  if(!Number.isFinite(settings.futuresOptions.perContract)||settings.futuresOptions.perContract<0)throw new Error('Per-contract commission cannot be negative.');
}
export interface PaperFill {
  id: string; positionId: string; symbol: string; exchange: string;
  side: 'Buy' | 'Sell'; quantity: number; price: number;
  fee: number; realizedPnL: number; timestamp: number; note: string;
}
export interface PaperPortfolio {
  account: PaperAccount;
  settings: PaperSettings;
  positions: PaperPosition[];
  fills: PaperFill[];
}
export function emptyPaperPortfolio(settings:PaperSettings=DEFAULT_PAPER_SETTINGS,name='Primary 001'): PaperPortfolio {
  const safe=normalizePaperSettings(settings);
  validatePaperSettings(safe);
  const account: PaperAccount = {
    name, balance: safe.startingBalance,
    equity: safe.startingBalance, realizedPnL: 0, unrealizedPnL: 0,
    accountMargin: 0, availableFunds: safe.startingBalance,
    ordersMargin: 0, marginBuffer: 100,
  };
  return { account, settings:safe, positions: [], fills: [] };
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
  if (asset.currency !== input.settings.currency)
    throw new Error('This '+input.settings.currency+' account requires a '+input.settings.currency+'-quoted market. No unverified FX conversions.');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be a positive number.');
  const permitted=accountLeverage(input.settings,asset);
  // Leverage is defined by the account, not by the individual order ticket.
  if (leverage!==permitted)throw new Error('Leverage must match this paper account’s '+permitted+'× '+marketPaperCategory(asset)+' setting.');
  if (tp !== undefined && (!Number.isFinite(tp) || tp <= 0 || (side==='Long' ? tp <= asset.price : tp >= asset.price)))
    throw new Error('Take profit must be above entry for a long or below entry for a short.');
  if (sl !== undefined && (!Number.isFinite(sl) || sl <= 0 || (side==='Long' ? sl >= asset.price : sl <= asset.price)))
    throw new Error('Stop loss must be below entry for a long or above entry for a short.');
  const portfolio = recalculatePaperPortfolio(input);
  const notional = quantity * asset.price, margin = notional / leverage, entryFee = paperCommission(portfolio.settings,asset,quantity,asset.price);
  // Equity must cover both initial margin and opening fees; ignore untrusted cached prices.
  if (margin + entryFee > portfolio.account.availableFunds + 1e-8)
    throw new Error('Insufficient available funds for margin and opening fee.');
  const id = 'paper-'+at+'-'+Math.random().toString(36).slice(2,8);
  const position: PaperPosition = {
    id, symbol: asset.symbol, exchange: asset.source || asset.exchange,
    side, qty: quantity, leverage, category:asset.category, marketType:asset.marketType, entryPrice: asset.price, currentPrice: asset.price,
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
  const fee = paperCommission(input.settings,{category:p.category || 'crypto',marketType:p.marketType || 'spot'},qty,price);
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

/** Account edits can change future fees and leverage, but cannot rewrite already settled fills. */
export function configurePaperPortfolio(input:PaperPortfolio,raw:PaperSettings,name:string):PaperPortfolio{
  const settings=normalizePaperSettings(raw);
  validatePaperSettings(settings);
  if(!name.trim())throw new Error('Account name is required.');
  if(input.positions.length||input.fills.length){
    if(settings.currency!==input.settings.currency)throw new Error('Currency cannot change after trading has begun.');
    if(settings.startingBalance!==input.settings.startingBalance)throw new Error('Starting balance cannot change after trading has begun; reset the account instead.');
  }
  const result={...input,settings,account:{...input.account,name:name.trim(),
    balance:input.fills.length||input.positions.length?input.account.balance:settings.startingBalance}};
  return recalculatePaperPortfolio(result);
}
