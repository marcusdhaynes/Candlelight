import type {Asset} from '../types';
import {marketIdentity} from './marketIdentity';

export type MarketEventKind='trade'|'ticker'|'snapshot'|'book';
export type MarketPriceOrigin='stream'|'ticker'|'snapshot';
export type MarketEventMetadata={
  /** Provider-native trade identifier; do not generate an ID from receipt time. */
  tradeId?:string;
  /** Provider-reported timestamp in milliseconds; distinct from local receipt time. */
  exchangeAt?:number;
  /** Provider-native sequence, only comparable within a declared sequenceScope. */
  sequence?:number;
  sequenceScope?:string;
  /** Only set when the provider guarantees every consecutive sequence is delivered. */
  sequenceMode?:'monotonic'|'contiguous';
};
export type MarketEvent=MarketEventMetadata&{
  kind:MarketEventKind;marketId:string;provider:string;receivedAt:number;
  price?:number;size?:number;side?:'buy'|'sell';
};
export type FeedHealth={
  provider:string;lastReceivedAt:number;lastTradeAt?:number;
  tradeCount:number;tickerCount:number;snapshotCount:number;bookCount:number;
  invalidCount:number;duplicateCount:number;outOfOrderCount:number;gapCount:number;missingSequenceCount:number;
  unsequencedTradeCount:number;sequencedTradeCount:number;
  lastExchangeAt?:number;reportedLatencyMs?:number;clockSkewCount:number;
  /** Bounded per-market diagnostic state, not a durable exchange ledger. */
  recentTradeIds:string[];
  lastSequences:Record<string,number>;
};
const RECENT_ID_LIMIT=256;
const SEQUENCE_SCOPE_LIMIT=16;

export function validMarketEvent(e:MarketEvent):boolean {
  return !!e&&['trade','ticker','snapshot','book'].includes(e.kind)&&
    typeof e.marketId==='string'&&!!e.marketId&&
    typeof e.provider==='string'&&!!e.provider&&
    Number.isFinite(e.receivedAt)&&e.receivedAt>0&&
    (e.price===undefined||(Number.isFinite(e.price)&&e.price>0))&&
    (e.size===undefined||(Number.isFinite(e.size)&&e.size>=0))&&
    (e.tradeId===undefined||(typeof e.tradeId==='string'&&e.tradeId.length>0&&e.tradeId.length<=200))&&
    (e.exchangeAt===undefined||(Number.isFinite(e.exchangeAt)&&e.exchangeAt>0))&&
    (e.sequence===undefined||(Number.isSafeInteger(e.sequence)&&e.sequence>=0))&&
    (e.sequenceScope===undefined||(typeof e.sequenceScope==='string'&&e.sequenceScope.length>0&&e.sequenceScope.length<=128))&&
    (e.sequenceMode===undefined||e.sequenceMode==='monotonic'||e.sequenceMode==='contiguous');
}
const emptyHealth=(provider:string):FeedHealth=>({
  provider,lastReceivedAt:0,tradeCount:0,tickerCount:0,snapshotCount:0,bookCount:0,
  invalidCount:0,duplicateCount:0,outOfOrderCount:0,gapCount:0,missingSequenceCount:0,
  unsequencedTradeCount:0,sequencedTradeCount:0,clockSkewCount:0,
  recentTradeIds:[],lastSequences:{}
});
export function updateFeedHealth(before:FeedHealth|undefined,event:MarketEvent):FeedHealth{
  const old=before||emptyHealth(event?.provider||'unknown');
  if(!validMarketEvent(event))return {...old,invalidCount:old.invalidCount+1};
  const isPrint=event.kind==='trade'&&eventIsExecutable(event);
  if(event.kind==='trade'&&!isPrint)return {...old,invalidCount:old.invalidCount+1};
  const recentTradeIds=old.recentTradeIds||[];
  if(isPrint&&event.tradeId&&recentTradeIds.includes(event.tradeId))
    return {...old,duplicateCount:old.duplicateCount+1};
  const next:FeedHealth={...old,provider:event.provider,
    lastReceivedAt:Math.max(old.lastReceivedAt,event.receivedAt),
    lastTradeAt:isPrint?Math.max(old.lastTradeAt||0,event.receivedAt):old.lastTradeAt,
    tradeCount:old.tradeCount+(isPrint?1:0),
    tickerCount:old.tickerCount+(event.kind==='ticker'?1:0),
    snapshotCount:old.snapshotCount+(event.kind==='snapshot'?1:0),
    bookCount:old.bookCount+(event.kind==='book'?1:0),
    unsequencedTradeCount:old.unsequencedTradeCount+(isPrint&&event.sequence===undefined?1:0),
    sequencedTradeCount:old.sequencedTradeCount+(isPrint&&event.sequence!==undefined?1:0),
    recentTradeIds:isPrint&&event.tradeId?[...recentTradeIds.slice(-(RECENT_ID_LIMIT-1)),event.tradeId]:recentTradeIds,
    lastSequences:old.lastSequences||{}
  };
  if(event.exchangeAt!==undefined){
    next.lastExchangeAt=event.exchangeAt;
    next.reportedLatencyMs=Math.max(0,event.receivedAt-event.exchangeAt);
    if(event.exchangeAt>event.receivedAt+2000)next.clockSkewCount++;
  }
  if(event.sequence!==undefined){
    const scope=event.sequenceScope||event.kind;
    const previous=next.lastSequences[scope];
    if(previous!==undefined&&event.sequence<=previous){
      next.outOfOrderCount++;
    }else{
      if(previous!==undefined&&event.sequenceMode==='contiguous'&&event.sequence>previous+1){
        next.gapCount++;
        next.missingSequenceCount+=event.sequence-previous-1;
      }
      const scopes={...next.lastSequences};
      if(!(scope in scopes)&&Object.keys(scopes).length>=SEQUENCE_SCOPE_LIMIT)
        delete scopes[Object.keys(scopes)[0]];
      scopes[scope]=event.sequence;
      next.lastSequences=scopes;
    }
  }
  return next;
}
export type FeedFreshness='no-trades'|'fresh'|'stale';
export function feedFreshness(health:FeedHealth,now=Date.now(),maxAgeMs=30_000):FeedFreshness{
  if(!health.lastTradeAt)return 'no-trades';
  return now>=health.lastTradeAt&&now-health.lastTradeAt<maxAgeMs?'fresh':'stale';
}
/**
 * Prevents repeat execution of provider-identified trade messages in one subscription.
 * Unidentified messages remain allowed but explicitly unverified by this guard.
 * This is NOT a cross-process or durable broker idempotency guarantee.
 */
export function createTradeReplayGuard(limit=1024):
  (tradeId?:string,sequence?:number,scope?:string)=>boolean{
  const seen=new Set<string>(),queue:string[]=[];
  const lastSequence=new Map<string,number>();
  const maximum=Math.max(1,Math.min(16384,Math.floor(limit)||1024));
  return (tradeId?:string,sequence?:number,scope='trade')=>{
    if(tradeId&&seen.has(tradeId))return false;
    // Fail closed for invalid or regressing native sequences, even if an ID is new.
    if(sequence!==undefined){
      if(!Number.isSafeInteger(sequence)||sequence<0)return false;
      const prior=lastSequence.get(scope);
      if(prior!==undefined&&sequence<=prior)return false;
    }
    if(tradeId){
      seen.add(tradeId);queue.push(tradeId);
      if(queue.length>maximum)seen.delete(queue.shift()!);
    }
    if(sequence!==undefined){
      if(!lastSequence.has(scope)&&lastSequence.size>=SEQUENCE_SCOPE_LIMIT)
        lastSequence.delete(lastSequence.keys().next().value!);
      lastSequence.set(scope,sequence);
    }
    return true;
  };
}
export const eventIsExecutable=(e:MarketEvent):boolean=>
  e.kind==='trade'&&Number.isFinite(e.price)&&Number(e.price)>0&&
  Number.isFinite(e.size)&&Number(e.size)>0;
export const priceOrigin=(kind:MarketEventKind):MarketPriceOrigin=>
  kind==='trade'?'stream':kind==='ticker'?'ticker':'snapshot';
export const marketEvent=(a:Asset,kind:MarketEventKind,price?:number,size?:number,
  side?:'buy'|'sell',metadata:MarketEventMetadata={}):MarketEvent=>
  ({kind,marketId:marketIdentity(a),provider:a.source||a.exchange,
    receivedAt:Date.now(),price,size,side,...metadata});
