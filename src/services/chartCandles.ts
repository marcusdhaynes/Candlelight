import type {OHLCV} from '../types';

/** Reject structurally impossible price bars instead of repairing or inventing them. */
export function validChartCandle(bar:OHLCV):boolean{
  return !!bar&&Number.isSafeInteger(bar.time)&&bar.time>0&&
    [bar.open,bar.high,bar.low,bar.close,bar.volume].every(Number.isFinite)&&
    bar.open>0&&bar.close>0&&bar.low>0&&bar.volume>=0&&
    bar.high>=Math.max(bar.open,bar.close,bar.low)&&
    bar.low<=Math.min(bar.open,bar.close,bar.high);
}
/** Sort and deduplicate *valid* provider bars; later occurrences win exactly by timestamp. */
export function normalizeChartHistory(input:ReadonlyArray<OHLCV>):OHLCV[]{
  const byTime=new Map<number,OHLCV>();
  for(const bar of input)if(validChartCandle(bar))byTime.set(bar.time,{...bar});
  return [...byTime.values()].sort((a,b)=>a.time-b.time);
}
/** Resolve the exact bar under the crosshair without inventing an OHLCV row. */
export function candleAtTimestamp(sortedBars:ReadonlyArray<OHLCV>,time:number):OHLCV|undefined{
  if(!Number.isSafeInteger(time)||time<=0)return undefined;
  let lo=0,hi=sortedBars.length-1;
  while(lo<=hi){
    const mid=(lo+hi)>>>1;
    const current=sortedBars[mid].time;
    if(current===time)return sortedBars[mid];
    if(current<time)lo=mid+1;else hi=mid-1;
  }
  return undefined;
}

/** Accept only a current-bar update or matching historical timestamp. */
export function mergeLiveCandle(previous:OHLCV[],tick:OHLCV):OHLCV[]{
  if(!validChartCandle(tick))return previous;
  if(!previous.length)return [{...tick}];
  const last=previous[previous.length-1];
  if(tick.time>last.time)return [...previous,{...tick}];
  // Caller supplies ascending bars. Search does not assume neighboring timeframes.
  let lo=0,hi=previous.length-1,index=-1;
  while(lo<=hi){
    const mid=(lo+hi)>>>1,when=previous[mid].time;
    if(when===tick.time){index=mid;break;}
    if(when<tick.time)lo=mid+1;else hi=mid-1;
  }
  if(index<0)return previous;
  const prior=previous[index];
  const out=previous.slice();
  out[index]={...prior,high:Math.max(prior.high,tick.high),
    low:Math.min(prior.low,tick.low),close:tick.close,
    volume:Math.max(prior.volume,tick.volume)};
  return out;
}
/**
 * Historical bars remain authoritative for closed intervals. Live values take
 * priority only on the most recent historical timestamp and on newer intervals.
 * An asynchronous history response cannot erase newer live candles.
 */
export function combineHistoryWithLive(history:OHLCV[],live:OHLCV[]):OHLCV[]{
  const historical=normalizeChartHistory(history);
  const liveClean=normalizeChartHistory(live);
  if(!historical.length)return liveClean;
  const latestHistorical=historical[historical.length-1].time;
  const base=new Map(historical.map(bar=>[bar.time,bar]));
  for(const bar of liveClean){
    if(bar.time<latestHistorical)continue;
    const original=base.get(bar.time);
    if(original){
      base.set(bar.time,{...original,high:Math.max(original.high,bar.high),
        low:Math.min(original.low,bar.low),close:bar.close,
        volume:Math.max(original.volume,bar.volume)});
    }else base.set(bar.time,bar);
  }
  return [...base.values()].sort((a,b)=>a.time-b.time);
}
