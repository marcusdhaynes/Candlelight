import type {OHLCV} from '../types';
import {validateHistoricalBacktestBars} from './historicalBacktest';
import {calculateRSI,calculateSMA} from './indicators';
export type TechnicalScreen={
 at:number;close:number;rsi14:number;sma20:number;sma50:number|null;
 volumeRatio:number|null;trend:'Above rising SMA20'|'Below falling SMA20'|'Mixed';
};
export function analyzeVenueTechnicalHistory(source:readonly OHLCV[],now=Date.now()/1000):
 {data?:TechnicalScreen;error?:string}{
 const checked=validateHistoricalBacktestBars(source,'1h',now);
 if(checked.error)return {error:checked.error};
 const bars=checked.bars;
 const rsi=calculateRSI(bars,14).at(-1);
 const sma20=calculateSMA(bars,20);
 const sma50=bars.length>=50?calculateSMA(bars,50).at(-1):undefined;
 const lastSma=sma20.at(-1),prevSma=sma20.at(-2),last=bars.at(-1);
 if(!last||!lastSma||!prevSma||!rsi)return {error:'Not enough verified, completed one-hour candles.'};
 const avgVol=bars.slice(-21,-1).reduce((sum,b)=>sum+b.volume,0)/20;
 const volumeRatio=avgVol>0?last.volume/avgVol:null;
 const trend=last.close>lastSma.value&&lastSma.value>prevSma.value?
   'Above rising SMA20':last.close<lastSma.value&&lastSma.value<prevSma.value?
   'Below falling SMA20':'Mixed';
 return {data:{at:last.time,close:last.close,rsi14:rsi.value,sma20:lastSma.value,
  sma50:sma50?.value??null,volumeRatio,trend}};
}
