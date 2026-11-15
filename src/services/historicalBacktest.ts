import type {OHLCV,Timeframe} from '../types';
import {candleBucketStart,candleBucketEnd} from './candleTimeframes';
import {calculateRSI,calculateSMA} from './indicators';
export type BacktestStrategy='sma10_30'|'rsi14_recovery';
export interface BacktestConfig{
  strategy:BacktestStrategy;startingBalance:number;allocationPct:number;
  feeBps:number;spreadBps:number;slippageBps:number;
  stopLossPct:number;takeProfitPct:number;
}
export const DEFAULT_BACKTEST:BacktestConfig={
  strategy:'sma10_30',startingBalance:10000,allocationPct:100,
  feeBps:4,spreadBps:5,slippageBps:3,stopLossPct:4,takeProfitPct:8
};
export type BacktestTrade={
  entryAt:number;exitAt:number;entryPrice:number;exitPrice:number;
  quantity:number;entryFee:number;exitFee:number;netPnL:number;
  exitReason:'strategy'|'stop'|'target'|'last close';
};
export type BacktestPoint={time:number;equity:number};
export type BacktestResult={
  config:BacktestConfig;historyKey:string;barsUsed:number;firstBar:number;lastBar:number;
  finalBalance:number;totalReturnPct:number;benchmarkReturnPct:number;
  maxDrawdownPct:number;winRatePct:number;profitFactor:number|null;
  trades:BacktestTrade[];equity:BacktestPoint[];
};
const supported:Timeframe[]=['1m','5m','15m','1h','1D'];
const valid=(b:OHLCV)=>Number.isInteger(b.time)&&b.time>0&&
  [b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&
  b.open>0&&b.high>0&&b.low>0&&b.close>0&&b.volume>=0&&
  b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close);
export function validateHistoricalBacktestBars(
  source:readonly OHLCV[],timeframe:Timeframe,nowSeconds=Date.now()/1000
):{bars:OHLCV[];error?:string;excludedForming:number}{
  if(!supported.includes(timeframe))return {bars:[],error:'Backtest currently supports 1m, 5m, 15m, 1h and 1D only.',excludedForming:0};
  if(!Array.isArray(source)||!source.length)return {bars:[],error:'No verified venue history is available.',excludedForming:0};
  const sorted=[...source].sort((a,b)=>a.time-b.time),bars:OHLCV[]=[];
  let excludedForming=0;
  for(let i=0;i<sorted.length;i++){
    const b=sorted[i];
    if(!valid(b)||candleBucketStart(b.time,timeframe)!==b.time)
      return {bars:[],error:'Malformed or misaligned historical candle; backtest refused.',excludedForming};
    if(candleBucketEnd(b.time,timeframe)>nowSeconds){
      if(i!==sorted.length-1)return {bars:[],error:'An unclosed bar occurs inside the historical series.',excludedForming};
      excludedForming++;continue;
    }
    if(bars.length&&candleBucketEnd(bars[bars.length-1].time,timeframe)!==b.time)
      return {bars:[],error:'Missing or repeated historical candle intervals; no interpolation permitted.',excludedForming};
    bars.push(b);
  }
  if(bars.length<40)return {bars:[],error:'At least 40 consecutive completed native venue candles are required.',excludedForming};
  return {bars,error:undefined,excludedForming};
}
/** Non-cryptographic reproducibility marker for locally fetched candle inputs. */
export function backtestHistoryKey(bars:readonly OHLCV[],timeframe:Timeframe):string{
 let h=2166136261;
 const input=timeframe+'|'+bars.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume].join(',')).join(';');
 for(let i=0;i<input.length;i++)h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;
 return h.toString(16).padStart(8,'0');
}
function validConfig(c:BacktestConfig):boolean{
 return ['sma10_30','rsi14_recovery'].includes(c.strategy)&&
   [c.startingBalance,c.allocationPct,c.feeBps,c.spreadBps,c.slippageBps,c.stopLossPct,c.takeProfitPct].every(Number.isFinite)&&
   c.startingBalance>0&&c.allocationPct>0&&c.allocationPct<=100&&
   [c.feeBps,c.spreadBps,c.slippageBps].every(n=>n>=0&&n<=1000)&&
   c.stopLossPct>0&&c.stopLossPct<=100&&c.takeProfitPct>0&&c.takeProfitPct<=1000;
}
export function runHistoricalBacktest(
  input:readonly OHLCV[],timeframe:Timeframe,config:BacktestConfig,
  nowSeconds=Date.now()/1000
):{result?:BacktestResult;error?:string}{
 if(!validConfig(config))return {error:'Invalid capital, allocation, fee or execution assumptions.'};
 const verification=validateHistoricalBacktestBars(input,timeframe,nowSeconds);
 if(verification.error)return {error:verification.error};
 const bars=verification.bars;
 const sma10=new Map(calculateSMA(bars,10).map(p=>[p.time,p.value]));
 const sma30=new Map(calculateSMA(bars,30).map(p=>[p.time,p.value]));
 const rsi=new Map(calculateRSI(bars,14).map(p=>[p.time,p.value]));
 const feeRate=config.feeBps/10000;
 const adverse=(config.spreadBps/2+config.slippageBps)/10000;
 let cash=config.startingBalance;
 let position:{entryAt:number;entryPrice:number;quantity:number;entryFee:number;stop:number;target:number}|null=null;
 const trades:BacktestTrade[]=[],equity:BacktestPoint[]=[];
 let peak=config.startingBalance,maxDrawdownPct=0;
 const close=(at:number,reference:number,reason:BacktestTrade['exitReason'])=>{
  if(!position)return;
  const execution=reference*(1-adverse),proceeds=position.quantity*execution;
  const exitFee=proceeds*feeRate;
  cash+=proceeds-exitFee;
  trades.push({entryAt:position.entryAt,exitAt:at,entryPrice:position.entryPrice,
    exitPrice:execution,quantity:position.quantity,entryFee:position.entryFee,
    exitFee,netPnL:proceeds-position.quantity*position.entryPrice-position.entryFee-exitFee,
    exitReason:reason});
  position=null;
 };
 const signalAt=(index:number):'buy'|'sell'|null=>{
  if(index<1)return null;
  const current=bars[index],prior=bars[index-1];
  if(config.strategy==='sma10_30'){
   const fast=sma10.get(current.time),slow=sma30.get(current.time),
     priorFast=sma10.get(prior.time),priorSlow=sma30.get(prior.time);
   if([fast,slow,priorFast,priorSlow].some(n=>n===undefined))return null;
   if(priorFast!<=priorSlow!&&fast!>slow!)return 'buy';
   if(priorFast!>=priorSlow!&&fast!<slow!)return 'sell';
  }else{
   const currentRsi=rsi.get(current.time),priorRsi=rsi.get(prior.time);
   if(currentRsi===undefined||priorRsi===undefined)return null;
   if(priorRsi<=30&&currentRsi>30)return 'buy';
   if(priorRsi<70&&currentRsi>=70)return 'sell';
  }
  return null;
 };
 for(let i=0;i<bars.length;i++){
  const bar=bars[i],order=signalAt(i-1);
  if(position&&order==='sell')close(bar.time,bar.open,'strategy');
  if(!position&&order==='buy'){
    const entryPrice=bar.open*(1+adverse);
    const budget=cash*config.allocationPct/100;
    const quantity=budget/(entryPrice*(1+feeRate));
    const entryFee=quantity*entryPrice*feeRate;
    if(Number.isFinite(quantity)&&quantity>0&&entryPrice*quantity+entryFee<=cash+1e-7){
      cash-=entryPrice*quantity+entryFee;
      position={entryAt:bar.time,entryPrice,quantity,entryFee,
        stop:entryPrice*(1-config.stopLossPct/100),
        target:entryPrice*(1+config.takeProfitPct/100)};
    }
  }
  if(position){
    // The open gap is evaluated first. If both boundaries are touched,
    // conservative stop-first priority prevents favorable lookahead.
    if(bar.open<=position.stop)close(bar.time,bar.open,'stop');
    else if(bar.low<=position.stop)close(bar.time,position.stop,'stop');
    else if(bar.high>=position.target)close(bar.time,position.target,'target');
  }
  if(position&&i===bars.length-1)close(bar.time,bar.close,'last close');
  const value=cash+(position?position.quantity*bar.close:0);
  peak=Math.max(peak,value);
  maxDrawdownPct=Math.max(maxDrawdownPct,peak>0?(peak-value)/peak*100:0);
  equity.push({time:bar.time,equity:value});
 }
 const wins=trades.filter(t=>t.netPnL>0),losses=trades.filter(t=>t.netPnL<0);
 const gains=wins.reduce((s,t)=>s+t.netPnL,0),lost=losses.reduce((s,t)=>s-t.netPnL,0);
 return {result:{
  config:{...config},historyKey:backtestHistoryKey(bars,timeframe),
  barsUsed:bars.length,firstBar:bars[0].time,lastBar:bars[bars.length-1].time,
  finalBalance:cash,totalReturnPct:(cash/config.startingBalance-1)*100,
  benchmarkReturnPct:(bars[bars.length-1].close/bars[0].open-1)*100,
  maxDrawdownPct,winRatePct:trades.length?wins.length/trades.length*100:0,
  profitFactor:lost>0?gains/lost:null,trades,equity
 }};
}
export function replayStep(cursor:number,length:number,amount=1):number{
 if(!Number.isFinite(cursor)||!Number.isFinite(length)||length<=0)return 0;
 return Math.min(Math.floor(length)-1,Math.max(0,Math.floor(cursor)+Math.floor(amount)));
}
