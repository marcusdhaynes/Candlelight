import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {Asset,OHLCV,Timeframe} from '../types';
import {fetchHistoricalData} from '../services/dataFeed';
import {DEFAULT_BACKTEST,runHistoricalBacktest,validateHistoricalBacktestBars,
 replayStep,type BacktestConfig,type BacktestResult} from '../services/historicalBacktest';
import {marketIdentity} from '../services/marketIdentity';
type Props={asset:Asset;timeframe:Timeframe};
const show=(n:number)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:2}):'—';
const sparkPoints=(values:readonly number[],width:number,height:number)=>{
 if(values.length<2)return '';
 const low=Math.min(...values),high=Math.max(...values),span=high-low||1;
 return values.map((v,i)=>((i/(values.length-1))*width).toFixed(1)+','+
   ((1-(v-low)/span)*(height-8)+4).toFixed(1)).join(' ');
};
export const ReplayBacktestPanel:React.FC<Props>=({asset,timeframe})=>{
 const [history,setHistory]=useState<OHLCV[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [cursor,setCursor]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [speed,setSpeed]=useState(400);
 const [config,setConfig]=useState<BacktestConfig>({...DEFAULT_BACKTEST});
 const [result,setResult]=useState<BacktestResult|null>(null);
 const key=marketIdentity(asset)+'|'+timeframe;
 const requestId=useRef(0);
 useEffect(()=>{
   requestId.current++;
   setHistory([]);setError('');setPlaying(false);setCursor(0);setResult(null);
 },[key]);
 useEffect(()=>{
   if(!playing||history.length===0)return;
   const handle=window.setInterval(()=>setCursor(prev=>{
     if(prev>=history.length-1){setPlaying(false);return prev;}
     return replayStep(prev,history.length,1);
   }),speed);
   return ()=>window.clearInterval(handle);
 },[playing,speed,history.length]);
 const load=async()=>{
   const id=++requestId.current;
   setLoading(true);setPlaying(false);setResult(null);setError('');
   try{
     const raw=await fetchHistoricalData(asset,timeframe);
     if(requestId.current!==id)return;
     const verified=validateHistoricalBacktestBars(raw,timeframe);
     if(verified.error){setHistory([]);setError(verified.error);return;}
     setHistory(verified.bars);
     setCursor(Math.min(39,verified.bars.length-1));
     if(verified.excludedForming)setError('Current forming candle excluded from replay and backtesting.');
   }catch(e){if(requestId.current===id){setHistory([]);setError(e instanceof Error?e.message:'Venue history unavailable');}}
   finally{if(requestId.current===id)setLoading(false);}
 };
 const execute=()=>{
   if(!history.length)return;
   const output=runHistoricalBacktest(history,timeframe,config);
   setResult(output.result||null);setError(output.error||'');
 };
 const visible=useMemo(()=>history.slice(Math.max(0,cursor-59),cursor+1),[history,cursor]);
 const candleGraphic=useMemo(()=>{
   if(!visible.length)return [];
   const prices=visible.flatMap(x=>[x.high,x.low]);
   const low=Math.min(...prices),high=Math.max(...prices),range=high-low||1;
   return visible.map((b,i)=>{
     const x=10+i*(730/Math.max(1,visible.length)),scale=(p:number)=>12+(1-(p-low)/range)*148;
     return {x,top:scale(b.high),bottom:scale(b.low),open:scale(b.open),close:scale(b.close),
       rising:b.close>=b.open};
   });
 },[visible]);
 const field=(key:keyof BacktestConfig,label:string,min:number,max:number)=><label className="text-[10px]">
   {label}<input type="number" step="any" min={min} max={max} value={config[key]}
      onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value)&&value>=min&&value<=max)
       setConfig(prev=>({...prev,[key]:value}));}}
      className="block w-full bg-[#121925] border border-[#374251] rounded px-2 py-1 text-white"/>
 </label>;
 return <div id="candlelight-historical-lab" className="space-y-3 p-3 text-[11px] text-[#d3dbea]">
   <div className="flex gap-2 items-center flex-wrap">
     <strong className="text-sm">Historical Replay & Backtest · {asset.symbol} ({asset.source||asset.exchange})</strong>
     <span>{timeframe}</span>
     <button type="button" onClick={load} disabled={loading}
       className="rounded bg-[#2862fb] px-3 py-1.5 disabled:opacity-40">
       {loading?'Loading verified venue candles…':'Load Verified History'}</button>
     <span className="text-[#a5b3c5]">{history.length} completed candles</span>
   </div>
   <p className="text-[#9baac0]">Only contiguous, completed, native venue candles qualify. Historical replay is isolated from the live paper account. No invented bars, no future candles shown during replay, and no actual broker orders.</p>
   {error&&<p role="alert" className="text-[#ffc48d]">{error}</p>}
   {!!history.length&&<div className="border border-[#364253] rounded bg-[#141b27] p-2 space-y-2">
     <svg viewBox="0 0 755 176" role="img" aria-label="Replay chart showing only revealed historical candles"
       preserveAspectRatio="none" className="w-full h-40">
       {candleGraphic.map((b,i)=><g key={visible[i].time} stroke={b.rising?'#22b794':'#e66378'}>
         <line x1={b.x+3} y1={b.top} x2={b.x+3} y2={b.bottom} strokeWidth="1"/>
         <rect x={b.x} y={Math.min(b.open,b.close)} width={6}
           height={Math.max(1,Math.abs(b.open-b.close))} fill={b.rising?'#22b794':'#e66378'}/>
       </g>)}
     </svg>
     <div className="flex flex-wrap items-center gap-2">
       <button type="button" onClick={()=>setPlaying(p=>!p)} className="rounded border px-2 py-1">{playing?'Pause':'Play'}</button>
       <button type="button" onClick={()=>{setPlaying(false);setCursor(c=>replayStep(c,history.length,-1));}} className="rounded border px-2 py-1">−1 Candle</button>
       <button type="button" onClick={()=>{setPlaying(false);setCursor(c=>replayStep(c,history.length,1));}} className="rounded border px-2 py-1">+1 Candle</button>
       <input aria-label="Historical replay cursor" type="range" min="0" max={history.length-1} value={cursor}
         onChange={e=>{setPlaying(false);setCursor(Number(e.target.value));}} className="min-w-32 flex-1"/>
       <label>Speed <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}
         className="bg-[#141b27] border rounded">
         <option value={800}>0.5×</option><option value={400}>1×</option>
         <option value={200}>2×</option><option value={100}>4×</option>
       </select></label>
       <span className="font-mono">{new Date(history[cursor].time*1000).toLocaleString()} · Close {show(history[cursor].close)}</span>
     </div>
   </div>}
   <div className="border-t border-[#313c4a] pt-3 space-y-2">
     <div className="flex items-center gap-3 flex-wrap">
       <strong>Deterministic Long-Only Strategy Backtest</strong>
       <label>Strategy <select value={config.strategy}
         onChange={e=>setConfig(prev=>({...prev,strategy:e.target.value as BacktestConfig['strategy']}))}
         className="bg-[#121925] border border-[#374251] rounded px-2 py-1">
         <option value="sma10_30">SMA 10/30 crossover</option>
         <option value="rsi14_recovery">RSI(14) rebound from 30 / exit at 70</option>
       </select></label>
       <button type="button" onClick={execute} disabled={!history.length}
         className="rounded bg-[#2862fb] px-3 py-1.5 disabled:opacity-40">Run Backtest</button>
     </div>
     <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
       {field('startingBalance','Starting capital',1,1e10)}
       {field('allocationPct','Capital used %',1,100)}
       {field('feeBps','Fees (bps / side)',0,1000)}
       {field('spreadBps','Full spread (bps)',0,1000)}
       {field('slippageBps','Slippage (bps / side)',0,1000)}
       {field('stopLossPct','Protective stop %',0.01,100)}
       {field('takeProfitPct','Target %',0.01,1000)}
     </div>
     <p className="text-[#9baac0]">Signals use a completed bar and execute at the following bar open; spread, fees and slippage are adverse modeled assumptions. Stop and target orders use conservative stop-first priority when both touch. Liquidity and queue position are not simulated.</p>
     {result&&<div className="space-y-2">
       <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
         {([['Final cash',show(result.finalBalance)],['Strategy return',show(result.totalReturnPct)+'%'],
           ['Uncosted buy & hold',show(result.benchmarkReturnPct)+'%'],
           ['Worst drawdown',show(result.maxDrawdownPct)+'%'],['Win rate',show(result.winRatePct)+'%'],
           ['Trades',String(result.trades.length)]] as const).map(([label,value])=>
           <div key={label} className="rounded border border-[#354252] p-2"><span className="block text-[#a9b6c7]">{label}</span><strong>{value}</strong></div>)}
       </div>
       <svg viewBox="0 0 720 75" aria-label="Deterministic strategy equity curve" className="w-full h-20 border border-[#343d4d] rounded">
         <polyline fill="none" stroke="#84abff" strokeWidth="2" points={sparkPoints(result.equity.map(p=>p.equity),718,73)}/>
       </svg>
       <p className="text-[#a9b6c7]">Reproduction key: {result.historyKey} · {result.barsUsed} completed candles · {new Date(result.firstBar*1000).toISOString()} to {new Date(result.lastBar*1000).toISOString()}. No randomized fills.</p>
       <div className="max-h-36 overflow-auto"><table className="w-full text-left"><thead>
         <tr><th>Entry</th><th>Exit</th><th>Modeled buy</th><th>Modeled sell</th><th>Net P&L</th><th>Reason</th></tr></thead>
         <tbody>{result.trades.map((t,i)=><tr key={i} className="border-t border-[#384355]">
           <td>{new Date(t.entryAt*1000).toLocaleString()}</td>
           <td>{new Date(t.exitAt*1000).toLocaleString()}</td>
           <td>{show(t.entryPrice)}</td><td>{show(t.exitPrice)}</td>
           <td className={t.netPnL>=0?'text-[#27bf93]':'text-[#f17884]'}>{show(t.netPnL)}</td>
           <td>{t.exitReason}</td>
         </tr>)}</tbody></table></div>
     </div>}
   </div>
 </div>;
};
