import type {Asset} from '../types';
import {
  type PaperPortfolio,accountLeverage,isFreshPaperQuote,paperCommission,
  placePaperPosition,markPaperPositions,recalculatePaperPortfolio,
} from './paperTrading';

export type PaperOrderSide='Long'|'Short';
export type PaperOrderKind='market'|'limit'|'stop';
export type PaperTimeInForce='GTC'|'Day'|'Week';
export interface PaperEntryOrder {
  id:string;
  symbol:string;exchange:string;
  side:PaperOrderSide;kind:'limit'|'stop';
  qty:number;price:number;currency:string;
  assetCategory:Asset['category'];marketType:Asset['marketType'];
  leverage:number;tp?:number;sl?:number;
  takeProfitLevels?:PaperPartialTarget[];
  createdAt:number;expiresAt?:number;
  status:'pending';
}
export interface PaperPartialTarget {price:number;sharePercent:number}
export interface PaperOrderRequest {
  side:PaperOrderSide;kind:PaperOrderKind;qty:number;
  price?:number;tp?:number;sl?:number;timeInForce?:PaperTimeInForce;
  takeProfitLevels?:PaperPartialTarget[];
}
const finitePositive=(n:number)=>Number.isFinite(n)&&n>0;
export const pendingFor=(p:PaperPortfolio):PaperEntryOrder[]=>p.pendingOrders||[];
export function pendingReserve(p:PaperPortfolio,order:PaperEntryOrder):number{
  const pseudo:Asset={symbol:order.symbol,name:order.symbol,exchange:order.exchange,
    category:order.assetCategory,marketType:order.marketType,
    price:order.price,change24h:0,changePercent24h:0,high24h:0,low24h:0,
    volume24h:'',digits:6,currency:order.currency};
  return order.qty*order.price/order.leverage+paperCommission(p.settings,pseudo,order.qty,order.price);
}
export function withOrderReservations(p:PaperPortfolio):PaperPortfolio{
  const base=recalculatePaperPortfolio(p);
  const reserve=pendingFor(base).reduce((sum,order)=>sum+pendingReserve(base,order),0);
  return {...base,account:{...base.account,ordersMargin:reserve,
    availableFunds:Math.max(0,base.account.availableFunds-reserve)}};
}
export function withOrderValidation(p:PaperPortfolio,a:Asset,request:PaperOrderRequest,now=Date.now()){
  if(!isFreshPaperQuote(a,now))throw new Error('Waiting for a verified live price for this exact exchange.');
  if(a.currency!==p.settings.currency)throw new Error('Paper account currency must match the market quote currency. Conversion is not estimated.');
  if(!finitePositive(request.qty))throw new Error('Order size must be greater than zero.');
  const leverage=accountLeverage(p.settings,a);
  if(request.kind!=='market'&&!finitePositive(request.price??NaN))throw new Error('Enter a valid limit/stop trigger price.');
  const price=request.kind==='market'?a.price:request.price!;
  if(request.kind==='stop'&&(request.side==='Long'?price<=a.price:price>=a.price))
    throw new Error('Stop entry must be above current price to buy or below to sell.');
  if(request.tp!==undefined&&(!finitePositive(request.tp)||(request.side==='Long'?request.tp<=price:request.tp>=price)))
    throw new Error('Take-profit price must be on the profitable side of entry.');
  if(request.sl!==undefined&&(!finitePositive(request.sl)||(request.side==='Long'?request.sl>=price:request.sl<=price)))
    throw new Error('Stop-loss price must be on the protective side of entry.');
  if(request.takeProfitLevels?.length){
    const sum=request.takeProfitLevels.reduce((n,v)=>n+v.sharePercent,0);
    if(Math.abs(sum-100)>0.001)throw new Error('Take-profit levels must allocate exactly 100% of the position.');
    for(const target of request.takeProfitLevels){
      if(!finitePositive(target.sharePercent)||!finitePositive(target.price)||
        (request.side==='Long'?target.price<=price:target.price>=price))
        throw new Error('Every take-profit level needs a positive size and profitable target price.');
    }
  }
  const cash=withOrderReservations(p).account.availableFunds;
  const required=request.qty*price/leverage+paperCommission(p.settings,a,request.qty,price);
  if(required>cash+1e-8)throw new Error('Insufficient free margin after accounting for pending orders and commissions.');
  return {leverage,price};
}
function applyPartialTargets(p:PaperPortfolio,levels:PaperPartialTarget[]|undefined):PaperPortfolio{
  if(!levels?.length||!p.positions.length)return p;
  const newest=p.positions[0];
  return {...p,positions:p.positions.map(pos=>pos.id===newest.id?
    {...pos,tp:undefined,tpLevels:levels.map((level,i)=>({
      id:newest.id+'-tp-'+i,price:level.price,quantity:newest.qty*level.sharePercent/100,
    }))}:pos)};
}
export function submitPaperOrder(p:PaperPortfolio,a:Asset,request:PaperOrderRequest,now=Date.now()):PaperPortfolio{
  const {leverage,price}=withOrderValidation(p,a,request,now);
  const marketableLimit=request.kind==='limit' &&
    (request.side==='Long'?price>=a.price:price<=a.price);
  if(request.kind==='market'||marketableLimit){
    // A marketable limit fills immediately at the observed quote, never at a
    // worse price than the limit. All fills remain explicitly simulated.
    const filled=placePaperPosition(p,a,request.side,request.qty,leverage,request.tp,request.sl,now);
    return withOrderReservations(applyPartialTargets(filled,request.takeProfitLevels));
  }
  const ttl=request.timeInForce==='Day'?86400000:request.timeInForce==='Week'?604800000:undefined;
  const order:PaperEntryOrder={
    id:'pending-'+now+'-'+Math.random().toString(36).slice(2,9),
    symbol:a.symbol,exchange:a.source||a.exchange,side:request.side,kind:request.kind,
    qty:request.qty,price,currency:a.currency,assetCategory:a.category,marketType:a.marketType,
    leverage,tp:request.tp,sl:request.sl,takeProfitLevels:request.takeProfitLevels,createdAt:now,
    expiresAt:ttl?now+ttl:undefined,status:'pending',
  };
  return withOrderReservations({...p,pendingOrders:[...pendingFor(p),order]});
}
export function cancelPaperOrder(p:PaperPortfolio,id:string):PaperPortfolio{
  return withOrderReservations({...p,pendingOrders:pendingFor(p).filter(o=>o.id!==id)});
}
export function evaluatePaperOrders(p:PaperPortfolio,a:Asset,at=Date.now()):PaperPortfolio{
  const old=pendingFor(p);
  const notExpired=old.filter(o=>!o.expiresAt||o.expiresAt>at);
  let next=withOrderReservations({...p,pendingOrders:notExpired});
  if(!isFreshPaperQuote(a,at))return next;
  if(!notExpired.length)return markPaperPositions(next,a,at);
  const venue=a.source||a.exchange;
  for(const order of [...notExpired]){
    if(order.symbol!==a.symbol||order.exchange!==venue)continue;
    const hit=order.kind==='limit'?
      (order.side==='Long'?a.price<=order.price:a.price>=order.price):
      (order.side==='Long'?a.price>=order.price:a.price<=order.price);
    if(!hit)continue;
    // Use observed market price, not the trigger/limit number, for the paper fill.
    // If a limit gaps through, cap the favorable fill at the requested limit.
    const fillPrice=order.kind==='limit'?
      (order.side==='Long'?Math.min(a.price,order.price):Math.max(a.price,order.price)):a.price;
    const without=cancelPaperOrder(next,order.id);
    try{
      const synthetic={...a,price:fillPrice,quoteUpdatedAt:at,quoteStatus:'live' as const};
      // Attached exits must be valid against the actual executable fill.
      next=withOrderReservations(applyPartialTargets(placePaperPosition(without,synthetic,order.side,
        order.qty,order.leverage,order.tp,order.sl,at),order.takeProfitLevels));
    }catch{
      // Keep the pending instruction intact if the wallet cannot support
      // execution at the observed price or the bracket becomes invalid.
      next=next;
    }
  }
  return withOrderReservations(markPaperPositions(next,a,at));
}
export function estimatePaperQty(p:PaperPortfolio,a:Asset,percent:number,price:number):number{
  if(!finitePositive(price))return 0;
  const free=withOrderReservations(p).account.availableFunds;
  const fraction=Math.max(0,Math.min(100,percent))/100;
  const leverage=accountLeverage(p.settings,a);
  let qty=free*fraction*leverage/price;
  // Reduce size to account for any fixed/percent per-fill commission.
  for(let i=0;i<5;i++){
    const fee=paperCommission(p.settings,a,qty,price);
    qty=Math.max(0,(free*fraction-fee)*leverage/price);
  }
  return Number(qty.toPrecision(11));
}
export type PaperExitMode='price'|'ticks'|'percent'|'money'|'balance';
export function exitPriceFromValue(entry:number,qty:number,side:PaperOrderSide,
  exit:'tp'|'sl',mode:PaperExitMode,value:number,tick:number,balance:number):number|undefined{
  if(!finitePositive(entry)||!finitePositive(value))return;
  if(mode==='price')return value;
  const delta=mode==='ticks'?tick*value:
    mode==='percent'?entry*value/100:
    mode==='money'?value/qty:
    balance*value/100/qty;
  if(!Number.isFinite(delta)||delta<=0)return;
  const direction=(side==='Long'?1:-1)*(exit==='tp'?1:-1);
  const price=entry+direction*delta;
  return price>0&&Number.isFinite(price)?price:undefined;
}
export function exitValueFromPrice(entry:number,qty:number,side:PaperOrderSide,
  exit:'tp'|'sl',mode:PaperExitMode,target:number,tick:number,balance:number):number{
  if(mode==='price')return target;
  const delta=Math.abs(target-entry);
  return mode==='ticks'?delta/tick:
    mode==='percent'?delta/entry*100:
    mode==='money'?delta*qty:
    balance?delta*qty/balance*100:0;
}
