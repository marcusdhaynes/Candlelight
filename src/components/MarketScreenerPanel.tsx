import React,{useMemo,useRef,useState,useEffect} from 'react';
import {fetchHistoricalData} from '../services/dataFeed';
import {marketIdentity} from '../services/marketIdentity';
import {analyzeVenueTechnicalHistory,type TechnicalScreen} from '../services/technicalScreener';
import type {Asset} from '../types';
import {screenMarkets,type MarketScreen} from '../services/marketScreener';
type Props={assets:Asset[];onSelect:(asset:Asset)=>void;onAdd:(asset:Asset)=>void};
const defaultScreen:MarketScreen={query:'',marketType:'all',minAbsChange:0,sort:'change'};
export const MarketScreenerPanel:React.FC<Props>=({assets,onSelect,onAdd})=>{
 const [screen,setScreen]=useState(defaultScreen);
 const result=useMemo(()=>screenMarkets(assets,screen,150),[assets,screen]);
 const [technical,setTechnical]=useState<Array<{id:string;name:string;venue:string;data?:TechnicalScreen;error?:string}>>([]);
 const [scanProgress,setScanProgress]=useState({done:0,total:0});
 const [scanActive,setScanActive]=useState(false);
 const [rsiBounds,setRsiBounds]=useState({min:0,max:100});
 const scanEpoch=useRef(0);
 useEffect(()=>()=>{scanEpoch.current++;},[]);
 const runTechnicalScan=async()=>{
   if(scanActive||!result.length)return;
   const epoch=++scanEpoch.current;
   const candidates=result.slice(0,12);
   setTechnical([]);setScanProgress({done:0,total:candidates.length});setScanActive(true);
   for(let i=0;i<candidates.length;i++){
     if(scanEpoch.current!==epoch)return;
     const asset=candidates[i],id=marketIdentity(asset);
     try{
       const candles=await fetchHistoricalData(asset,'1h');
       if(scanEpoch.current!==epoch)return;
       const insight=analyzeVenueTechnicalHistory(candles);
       setTechnical(prev=>[...prev,{id,name:asset.symbol,venue:asset.source||asset.exchange,...insight}]);
     }catch(e){
       if(scanEpoch.current!==epoch)return;
       setTechnical(prev=>[...prev,{id,name:asset.symbol,venue:asset.source||asset.exchange,
         error:e instanceof Error?e.message:'Verified history unavailable'}]);
     }
     setScanProgress({done:i+1,total:candidates.length});
   }
   if(scanEpoch.current===epoch)setScanActive(false);
 };
 const filteredTechnical=technical.filter(row=>!row.data||
   (row.data.rsi14>=rsiBounds.min&&row.data.rsi14<=rsiBounds.max));
 return <div id="candlelight-screener" className="text-[11px] p-3 space-y-2 text-[#d4daeb]">
  <div className="flex gap-3 flex-wrap items-end">
   <strong className="text-sm">Live/Observed Market Screener</strong>
   <input aria-label="Search markets" value={screen.query}
      onChange={e=>setScreen(prev=>({...prev,query:e.target.value}))}
      placeholder="Symbol, market or exchange"
      className="px-2 py-1.5 bg-[#171d2a] border border-[#374052] rounded w-44"/>
   <label>Type <select value={screen.marketType} onChange={e=>setScreen(prev=>({...prev,marketType:e.target.value}))}
      className="ml-1 bg-[#171d2a] border border-[#374052] rounded px-2 py-1.5">
     <option value="all">All</option><option value="spot">Spot</option>
     <option value="swap">Perpetual</option><option value="futures">Futures</option>
   </select></label>
   <label>Min absolute 24h change
     <input type="number" min="0" max="1000" step=".5" value={screen.minAbsChange}
       onChange={e=>setScreen(prev=>({...prev,minAbsChange:Math.max(0,Number(e.target.value)||0)}))}
       className="ml-2 w-16 px-2 py-1.5 bg-[#171d2a] border border-[#374052] rounded"/>%
   </label>
   <label>Order <select value={screen.sort} onChange={e=>setScreen(prev=>({...prev,sort:e.target.value as MarketScreen['sort']}))}
      className="ml-1 bg-[#171d2a] border border-[#374052] rounded px-2 py-1.5">
      <option value="change">Biggest movement</option><option value="volume">Reported 24h volume</option>
      <option value="symbol">Symbol</option>
   </select></label>
  </div>
  <p className="text-[#9aa8bd]">Only venue-sourced live or delayed quotes are included. Results are not investment recommendations; missing feeds are excluded. Showing up to 150 instruments.</p>
  <div className="max-h-[32vh] overflow-y-auto">
   <table className="w-full text-left"><thead><tr className="text-[#a9b4c6]">
    <th>Market</th><th>Venue</th><th>Observed price</th><th>24h change</th><th>Data</th><th>Actions</th></tr></thead>
    <tbody>{result.map(m=><tr key={[m.symbol,m.source,m.marketType,m.chainId,m.pairAddress].join('|')} className="border-t border-[#353d4b]">
      <td className="py-1.5 font-semibold">{m.symbol}<small className="block text-[#9aa8bd]">{m.marketType||'unknown'}</small></td>
      <td>{m.source||m.exchange}</td><td className="font-mono">{m.price.toLocaleString(undefined,{maximumFractionDigits:8})} {m.currency}</td>
      <td className={m.changePercent24h>=0?'text-[#21b28d]':'text-[#ed7984]'}>{m.changePercent24h.toFixed(2)}%</td>
      <td>{m.quoteStatus==='live'?'Trade stream':'Snapshot'}</td>
      <td className="space-x-2 whitespace-nowrap"><button type="button" className="underline text-[#94baff]" onClick={()=>onSelect(m)}>Chart</button>
       <button type="button" className="underline text-[#94baff]" onClick={()=>onAdd(m)}>Watchlist</button></td>
     </tr>)}</tbody>
   </table>
   {!result.length&&<p className="p-3 text-[#aab3c3]">No eligible observed market quotes match these filters.</p>}
  </div>
  <div className="border-t border-[#384354] pt-3 space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      <strong className="text-sm">Verified Historical Technical Scan</strong>
      <button type="button" disabled={scanActive||!result.length} onClick={()=>void runTechnicalScan()}
        className="rounded bg-[#2862fb] px-2 py-1.5 disabled:opacity-40">
        {scanActive?'Scanning…':'Scan First 12 Markets'}</button>
      <span className="text-[#91a5bb]">{scanProgress.done} / {scanProgress.total}</span>
      <label>RSI Min <input type="number" min="0" max="100" value={rsiBounds.min}
        onChange={e=>setRsiBounds(prev=>({...prev,min:Math.max(0,Math.min(100,Number(e.target.value)||0))}))}
        className="ml-1 w-14 bg-[#171d2a] border rounded px-1 py-1"/></label>
      <label>Max <input type="number" min="0" max="100" value={rsiBounds.max}
        onChange={e=>setRsiBounds(prev=>({...prev,max:Math.max(0,Math.min(100,Number(e.target.value)||0))}))}
        className="ml-1 w-14 bg-[#171d2a] border rounded px-1 py-1"/></label>
    </div>
    <p className="text-[#93a7bf]">On-demand scan checks up to 12 markets sequentially, using only 40+ contiguous, completed 1-hour venue candles. RSI(14), SMA20/50 and volume ratios are never estimated from snapshot prices. Unavailable data remains unavailable.</p>
    {technical.length>0&&<div className="max-h-40 overflow-y-auto">
      <table className="w-full text-left"><thead><tr>
        {['Instrument','RSI(14)','SMA20','SMA50','Volume / 20h','Trend','Status'].map(x=>
          <th key={x} className="p-1.5 text-[#b5c4d6]">{x}</th>)}
      </tr></thead><tbody>{filteredTechnical.map(x=><tr key={x.id} className="border-t border-[#333e50]">
        <td className="p-1.5">{x.name} <small className="block">{x.venue}</small></td>
        <td>{x.data?.rsi14.toFixed(2)||'—'}</td>
        <td>{x.data?.sma20.toFixed(5)||'—'}</td>
        <td>{x.data?.sma50?.toFixed(5)||'—'}</td>
        <td>{x.data?.volumeRatio?.toFixed(2)||'—'}</td>
        <td>{x.data?.trend||'—'}</td>
        <td className={x.error?'text-[#e5ba82]':'text-[#69c9a3]'}>{x.error||'Verified'}</td>
      </tr>)}</tbody></table>
    </div>}
  </div>
 </div>;
};
