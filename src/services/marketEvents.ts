import type {Asset} from '../types';
import {marketIdentity} from './marketIdentity';
export type MarketEventKind='trade'|'ticker'|'snapshot'|'book';
export type MarketPriceOrigin='stream'|'ticker'|'snapshot';
export type MarketEvent={kind:MarketEventKind;marketId:string;provider:string;receivedAt:number;price?:number;size?:number;side?:'buy'|'sell'};
export const eventIsExecutable=(e:MarketEvent):boolean=>e.kind==='trade'&&Number.isFinite(e.price)&&Number(e.price)>0;
export const priceOrigin=(kind:MarketEventKind):MarketPriceOrigin=>kind==='trade'?'stream':kind==='ticker'?'ticker':'snapshot';
export const marketEvent=(a:Asset,kind:MarketEventKind,price?:number,size?:number,side?:'buy'|'sell'):MarketEvent=>
 ({kind,marketId:marketIdentity(a),provider:a.source||a.exchange,receivedAt:Date.now(),price,size,side});
