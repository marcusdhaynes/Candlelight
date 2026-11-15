import React,{useMemo,useState} from 'react';
import type {Asset} from '../types';
import {screenMarkets,type MarketScreen} from '../services/marketScreener';
type Props={assets:Asset[];onSelect:(asset:Asset)=>void;onAdd:(asset:Asset)=>void};
const defaultScreen:MarketScreen={query:'',marketType:'all',minAbsChange:0,sort:'change'};
export const MarketScreenerPanel:React.FC<Props>=({assets,onSelect,onAdd})=>{
 const [screen,setScreen]=useState(defaultScreen);
 const result=useMemo(()=>screenMarkets(assets,screen,150),[assets,screen]);
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
 </div>;
};
