import type {OHLCV,Timeframe} from '../types';

// All timestamps are provider-supplied UTC seconds. Calendar periods must not
// be approximated by fixed 30/90/360-day lengths.
const seconds:Record<Timeframe,number>={
  '1s':1,'5s':5,'15s':15,'30s':30,'1m':60,'3m':180,'5m':300,
  '15m':900,'30m':1800,'45m':2700,'1h':3600,'2h':7200,
  '3h':10800,'4h':14400,'1D':86400,'1W':604800,
  '1M':0,'3M':0,'12M':0,
};
export function candleBucketStart(timestamp:number,timeframe:Timeframe):number {
  if(!Number.isFinite(timestamp)||timestamp<=0)return 0;
  const d=new Date(Math.floor(timestamp)*1000);
  const y=d.getUTCFullYear(), m=d.getUTCMonth();
  if(timeframe==='12M')return Date.UTC(y,0,1)/1000;
  if(timeframe==='3M')return Date.UTC(y,Math.floor(m/3)*3,1)/1000;
  if(timeframe==='1M')return Date.UTC(y,m,1)/1000;
  if(timeframe==='1W'){
    const daysSinceMonday=(d.getUTCDay()+6)%7;
    return Date.UTC(y,m,d.getUTCDate()-daysSinceMonday)/1000;
  }
  return Math.floor(timestamp/seconds[timeframe])*seconds[timeframe];
}
/** Aggregate genuine lower-resolution bars only, preserving OHLCV and UTC buckets. */
export function resampleVerifiedCandles(bars:OHLCV[],timeframe:Timeframe):OHLCV[] {
  const sorted=[...bars].sort((a,b)=>a.time-b.time);
  const output:OHLCV[]=[];
  const earliest=new Map<number,number>();
  for(const b of sorted){
    if(![b.time,b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||
      b.time<=0||b.open<=0||b.close<=0||b.low<=0||
      b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))continue;
    const time=candleBucketStart(b.time,timeframe);
    const last=output[output.length-1];
    if(last&&last.time===time){
      last.high=Math.max(last.high,b.high);
      last.low=Math.min(last.low,b.low);
      last.close=b.close;
      last.volume+=b.volume;
    }else {earliest.set(time,b.time);output.push({...b,time});}
  }
  // Drop initial aggregate when source history begins midway through a
  // month/quarter/year. Partial history must not masquerade as full OHLC.
  if(['1M','3M','12M'].includes(timeframe) && output.length && earliest.get(output[0].time)!==output[0].time)output.shift();
  return output;
}
