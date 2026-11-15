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
/** UTC end of the calendar or fixed-width bucket. */
export function candleBucketEnd(start:number,timeframe:Timeframe):number{
  const d=new Date(start*1000),y=d.getUTCFullYear(),m=d.getUTCMonth();
  if(timeframe==='1M')return Date.UTC(y,m+1,1)/1000;
  if(timeframe==='3M')return Date.UTC(y,m+3,1)/1000;
  if(timeframe==='12M')return Date.UTC(y+1,0,1)/1000;
  return start+seconds[timeframe];
}
/** Reject incomplete historical aggregates when the venue's actual source interval is known.
 * The current forming bucket is allowed only if it begins at its real boundary and has no gaps. */
export function resampleVerifiedCandles(bars:OHLCV[],timeframe:Timeframe,
  sourceInterval:number|'1M'=0, nowSeconds=Date.now()/1000):OHLCV[] {
  const sorted=[...bars].sort((a,b)=>a.time-b.time);
  const output:OHLCV[]=[];
  const earliest=new Map<number,number>();
  const sourceTimes=new Map<number,number[]>();
  for(const b of sorted){
    if(![b.time,b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||
      b.time<=0||b.open<=0||b.close<=0||b.low<=0||
      b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))continue;
    const time=candleBucketStart(b.time,timeframe);
    if(!sourceTimes.has(time))sourceTimes.set(time,[]);
    sourceTimes.get(time)!.push(b.time);
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
  if(!sourceInterval)return output;
  return output.filter(bar=>{
    const source=sourceTimes.get(bar.time)||[];
    const end=candleBucketEnd(bar.time,timeframe);
    if(!source.length || source[0]!==bar.time)return false;
    if(sourceInterval==='1M'){
      let cursor=bar.time;
      for(const timestamp of source){
        if(timestamp!==cursor)return false;
        cursor=candleBucketEnd(cursor,'1M');
      }
      return nowSeconds<end||cursor>=end;
    }
    if(sourceInterval<=0||!Number.isFinite(sourceInterval))return false;
    const total=(end-bar.time)/sourceInterval;
    // Reject calendar buckets that cannot be composed from the venue's native bars.
    if(!Number.isInteger(total)||total<1)return false;
    for(let i=1;i<source.length;i++){
      if(source[i]-source[i-1]!==sourceInterval)return false;
    }
    // A closed historical bucket needs every source bar. Never stitch over gaps.
    if(nowSeconds>=end)return source.length===total && source[source.length-1]===end-sourceInterval;
    return true; // Open/current bucket: visibly forming, not a completed historical bar.
  });
}
