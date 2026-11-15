import React,{useState} from 'react';
import type {Asset} from '../types';
import type {PaperPortfolio} from '../services/paperTrading';
import {paperRiskOverview,riskSizedQuantity,type RiskPolicy} from '../services/riskCenter';

type Props={portfolio:PaperPortfolio;asset:Asset;policy:RiskPolicy;onChange:(policy:RiskPolicy)=>void};
const number=(v:number)=>Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:2}):'—';
export const RiskCenterPanel:React.FC<Props>=({portfolio,asset,policy,onChange})=>{
 const [stop,setStop]=useState('');
 const stats=paperRiskOverview(portfolio),equity=portfolio.account.equity;
 const riskQuantity=riskSizedQuantity(equity,policy.maxRiskPerTradePct,asset.price,Number(stop));
 const policyNumber=(key:'maxRiskPerTradePct'|'maxGrossExposurePct'|'maxDailyLossPct',value:string)=>{
   const n=Number(value);
   if(Number.isFinite(n)&&n>0&&n<=1000)onChange({...policy,[key]:n});
 };
 return <div id="candlelight-risk-center" className="p-4 space-y-3 text-[11px] text-[#d5dbe7]">
   <div className="flex justify-between items-center gap-4 flex-wrap">
     <strong className="text-sm">Paper Risk Management Center</strong>
     <label className="flex items-center gap-2"><input type="checkbox" checked={policy.killSwitch}
       onChange={e=>onChange({...policy,killSwitch:e.target.checked})}/> Pause all new paper entries</label>
   </div>
   <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
     {([['Equity',equity],['Gross exposure',stats.grossNotional],
       ['Exposure %',stats.grossExposurePct],['Today realized',stats.todayRealized],
       ['Stop-based open risk',stats.theoreticalStopRisk]] as const).map(([title,value])=>
       <div key={title} className="rounded border border-[#343a47] bg-[#1d2532] p-2">
         <div className="text-[#99a5b9]">{title}</div>
         <strong className="text-sm">{number(value)}{title==='Exposure %'?'%':''}</strong>
       </div>)}
   </div>
   {stats.unprotected>0&&<p className="text-[#ffce8b]">{stats.unprotected} open position(s) lack an explicit protective stop. Stop-based risk is only a scenario, not a guaranteed maximum loss.</p>}
   <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={policy.enabled}
     onChange={e=>onChange({...policy,enabled:e.target.checked})}/> Enforce limits on new paper entries (off by default)</label>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
     {([['Max loss per trade %','maxRiskPerTradePct'],['Max gross exposure %','maxGrossExposurePct'],
       ['Daily realized loss %','maxDailyLossPct']] as const).map(([title,key])=>
       <label key={key} className="space-y-1 block">{title}
         <input type="number" min="0.01" max="1000" step="0.1" value={policy[key]}
           onChange={e=>policyNumber(key,e.target.value)}
           className="w-full rounded border border-[#414d60] bg-[#151b27] px-2 py-1.5 text-white"/>
       </label>)}
   </div>
   <div className="border-t border-[#333c4c] pt-3">
     <strong>Indicative position sizing · {asset.symbol}</strong>
     <div className="flex flex-wrap gap-3 items-end mt-2">
       <label>Reference price <span className="block font-mono text-white">{number(asset.price)} {asset.currency}</span></label>
       <label>Protective stop
         <input type="number" min="0" step="any" placeholder="Enter stop price" value={stop}
           onChange={e=>setStop(e.target.value)}
           className="block w-36 rounded border border-[#414d60] bg-[#151b27] px-2 py-1.5 text-white"/>
       </label>
       <span>Indicative size <strong className="font-mono text-white">{number(riskQuantity)} units</strong></span>
     </div>
     <p className="text-[#9ba7ba] mt-2">No trade is placed by this calculator. Slippage, gaps, conversion costs and market liquidity can produce larger losses.</p>
   </div>
 </div>;
};
