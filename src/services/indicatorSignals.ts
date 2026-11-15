import type {OHLCV} from '../types';
import {calculateRSI,calculateSMA} from './indicators';
export type IndicatorMetric='rsi14'|'price_minus_sma20';
export type IndicatorSignal={candleTime:number;current:Partial<Record<IndicatorMetric,number>>;
 previous:Partial<Record<IndicatorMetric,number>>};
const complete=(b:OHLCV,nowSeconds:number)=>
 Number.isInteger(b.time)&&b.time>0&&b.time%60===0&&b.time+60<=nowSeconds&&
 [b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.open>0&&
 b.close>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&
 b.low<=Math.min(b.open,b.close)&&b.volume>=0;
/** Keep only a verified, contiguous trailing run of completed native 1-minute bars.
 * Never interpolate a missing minute or use an in-progress candle. */
export function closedMinuteRun(input:readonly OHLCV[],nowSeconds=Date.now()/1000):OHLCV[]{
 const ordered=[...input].filter(b=>complete(b,nowSeconds)).sort((a,b)=>a.time-b.time);
 let out:OHLCV[]=[];
 for(const bar of ordered){
  const last=out[out.length-1];
  if(last&&bar.time===last.time){out[out.length-1]=bar;continue;}
  if(last&&bar.time!==last.time+60)out=[];
  out.push(bar);
  if(out.length>240)out.shift();
 }
 return out;
}
export const appendClosedMinute=(history:readonly OHLCV[],bar:OHLCV,nowSeconds=Date.now()/1000)=>
 closedMinuteRun([...history,bar],nowSeconds);
/** Need two finalized indicator observations, never price-assign a stale bar. */
export function completedIndicatorSignal(bars:readonly OHLCV[]):IndicatorSignal|undefined{
 if(bars.length<21)return;
 const last=bars[bars.length-1];
 const rsi=calculateRSI([...bars],14),sma=calculateSMA([...bars],20);
 if(rsi.length<2||sma.length<2)return;
 const nowRsi=rsi[rsi.length-1],prevRsi=rsi[rsi.length-2];
 const nowSma=sma[sma.length-1],prevSma=sma[sma.length-2];
 if(nowRsi.time!==last.time||nowSma.time!==last.time ||
  prevRsi.time!==bars[bars.length-2].time||prevSma.time!==bars[bars.length-2].time)return;
 return {candleTime:last.time,current:{rsi14:nowRsi.value,
  price_minus_sma20:last.close-nowSma.value},
  previous:{rsi14:prevRsi.value,price_minus_sma20:bars[bars.length-2].close-prevSma.value}};
}
export function indicatorConditionMet(kind:string,operator:string,threshold:number,signal:IndicatorSignal):boolean{
 if(!['rsi14','price_minus_sma20'].includes(kind)||!Number.isFinite(threshold))return false;
 const key=kind as IndicatorMetric,value=signal.current[key],prior=signal.previous[key];
 if(value===undefined||prior===undefined||!Number.isFinite(value)||!Number.isFinite(prior))return false;
 if(operator==='crosses_above')return prior<threshold&&value>=threshold;
 if(operator==='crosses_below')return prior>threshold&&value<=threshold;
 if(operator==='greater_than')return value>threshold;
 if(operator==='less_than')return value<threshold;
 return false;
}
