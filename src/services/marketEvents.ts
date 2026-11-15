import type {Asset} from '../types';
import {marketIdentity} from './marketIdentity';
export type MarketEventKind='trade'|'ticker'|'snapshot'|'book';
export type MarketPriceOrigin='stream'|'ticker'|'snapshot';
export type MarketEvent={kind:MarketEventKind;marketId:string;provider:string;receivedAt:number;price?:number;size?:number;side?:'buy'|'sell'};
export type FeedHealth={provider:string;lastReceivedAt:number;lastTradeAt?:number;tradeCount:number;tickerCount:number;snapshotCount:number;bookCount:number};
export function updateFeedHealth(before:FeedHealth|undefined,event:MarketEvent):FeedHealth{
 const old=before||{provider:event.provider,lastReceivedAt:0,tradeCount:0,tickerCount:0,snapshotCount:0,bookCount:0};
 return {...old,provider:event.provider,lastReceivedAt:event.receivedAt,
   lastTradeAt:event.kind==='trade'?event.receivedAt:old.lastTradeAt,
   tradeCount:old.tradeCount+(event.kind==='trade'?1:0),
   tickerCount:old.tickerCount+(event.kind==='ticker'?1:0),
   snapshotCount:old.snapshotCount+(event.kind==='snapshot'?1:0),
   bookCount:old.bookCount+(event.kind==='book'?1:0)};
}
export const eventIsExecutable=(e:MarketEvent):boolean=>e.kind==='trade'&&Number.isFinite(e.price)&&Number(e.price)>0;
export const priceOrigin=(kind:MarketEventKind):MarketPriceOrigin=>kind==='trade'?'stream':kind==='ticker'?'ticker':'snapshot';
export const marketEvent=(a:Asset,kind:MarketEventKind,price?:number,size?:number,side?:'buy'|'sell'):MarketEvent=>
 ({kind,marketId:marketIdentity(a),provider:a.source||a.exchange,receivedAt:Date.now(),price,size,side});
