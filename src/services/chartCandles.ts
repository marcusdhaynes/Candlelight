import type {OHLCV} from '../types';

/** Accept public market candles only: do not replace newer bars with delayed ones. */
export function mergeLiveCandle(previous:OHLCV[],tick:OHLCV):OHLCV[]{
  if(!Number.isFinite(tick.time)||tick.time<=0 ||
      ![tick.open,tick.high,tick.low,tick.close,tick.volume].every(Number.isFinite)||
      tick.open<=0||tick.close<=0||tick.low<=0||tick.high<Math.max(tick.open,tick.close)||
      tick.low>Math.min(tick.open,tick.close))return previous;
  if(!previous.length)return [tick];
  const last=previous[previous.length-1];
  if(tick.time>last.time)return [...previous,tick];
  // Incoming WS close can be for the prior interval. Replace only its matching
  // timestamp; never overwrite the current bar or corrupt the chart's ordering.
  const index=previous.findIndex(x=>x.time===tick.time);
  if(index<0)return previous;
  const original=previous[index];
  const next={...original,
    high:Math.max(original.high,tick.high),low:Math.min(original.low,tick.low),
    close:tick.close,volume:Math.max(original.volume,tick.volume)};
  const out=previous.slice();out[index]=next;return out;
}
/** Merge a late historical response without discarding the live current bar. */
export function combineHistoryWithLive(history:OHLCV[],live:OHLCV[]):OHLCV[]{
  const base=new Map<number,OHLCV>();
  for(const bar of history){
    if(!Number.isFinite(bar.time)||!Number.isFinite(bar.close))continue;
    base.set(bar.time,bar);
  }
  if(!history.length)return live;
  const latest=history[history.length-1].time;
  for(const bar of live){
    // Only preserve recent bars from the same market (caller resets on symbol
    // change); historical bars are authoritative except for the active interval.
    if(bar.time>=latest){
      if(bar.time===latest){
        const historic=base.get(bar.time)!;
        base.set(bar.time,{...historic,high:Math.max(historic.high,bar.high),
          low:Math.min(historic.low,bar.low),close:bar.close,
          volume:Math.max(historic.volume,bar.volume)});
      }else base.set(bar.time,bar);
    }
  }
  return [...base.values()].sort((a,b)=>a.time-b.time);
}
