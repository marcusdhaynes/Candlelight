import type {IndicatorSettings,OHLCV} from '../types';

/** Price studies depend on the latest bar and must never be left stale. */
export function hasActiveCalculatedStudy(settings:IndicatorSettings):boolean{
  return Object.entries(settings).some(([name,configuration])=>
    name!=='volume'&&configuration?.enabled===true);
}
const identical=(a:OHLCV,b:OHLCV):boolean=>
  a.time===b.time&&a.open===b.open&&a.high===b.high&&
  a.low===b.low&&a.close===b.close&&a.volume===b.volume;

/**
 * A chart can update only the newest bar when every previously rendered
 * earlier bar is byte-for-byte identical. A handful of sampled values is
 * unsafe: it can miss revisions to arbitrary historical timestamps/volumes.
 * The caller retains a cloned immutable snapshot and updates only its tail.
 */
export function mayUseIncrementalChartUpdate(
  rendered:ReadonlyArray<OHLCV>,incoming:ReadonlyArray<OHLCV>,
  indicators:IndicatorSettings
):boolean{
  if(!rendered.length||!incoming.length||
    incoming.length<rendered.length||incoming.length>rendered.length+1||
    hasActiveCalculatedStudy(indicators))return false;
  const commonLength=incoming.length===rendered.length?rendered.length-1:rendered.length;
  for(let i=0;i<commonLength;i++){
    if(!identical(rendered[i],incoming[i]))return false;
  }
  const prev=rendered[rendered.length-1],last=incoming[incoming.length-1];
  if(!Number.isSafeInteger(last.time)||!Number.isSafeInteger(prev.time))return false;
  return incoming.length===rendered.length?last.time===prev.time:last.time>prev.time;
}
