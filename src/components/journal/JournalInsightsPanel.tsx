import React,{useMemo,useState} from 'react';
import type {JournalTrade} from '../../types';
import {summarizeJournalInsights,type JournalInsightGroup} from '../../services/journalInsights';
const views:[JournalInsightGroup,string][]=[
 ['strategy','Strategy / Setup'],['symbol','Market'],['portfolio','Portfolio'],
 ['emotion','Emotional State'],['hour','Local Session (6-hour)']
];
const number=(n:number,places=2)=>n.toLocaleString(undefined,{minimumFractionDigits:places,maximumFractionDigits:places});
export const JournalInsightsPanel:React.FC<{trades:JournalTrade[]}>=({trades})=>{
 const [group,setGroup]=useState<JournalInsightGroup>('strategy');
 const insight=useMemo(()=>summarizeJournalInsights(trades,group),[trades,group]);
 return <section id="candlelight-journal-insights" className="h-full overflow-y-auto p-4 bg-[#0f131c] space-y-3 text-xs text-[#d9dfec]">
   <div className="flex flex-wrap gap-3 items-end">
     <div><strong className="text-base">Trade Performance Insights</strong>
       <p className="text-[#9daac0] mt-1">Closed trades only · {insight.closedTrades} records · realized net results</p>
     </div>
     <label>Analyze By
       <select aria-label="Journal insight dimension" value={group}
         onChange={e=>setGroup(e.target.value as JournalInsightGroup)}
         className="ml-2 px-2 py-1.5 bg-[#171d2b] border border-[#44536a] rounded text-white">
         {views.map(([id,name])=><option key={id} value={id}>{name}</option>)}
       </select>
     </label>
   </div>
   <p className="text-[#acb8ca]">Expectancy is the average recorded net P&L per closed trade. Profit factor is gross recorded wins divided by absolute recorded losses; “—” means no losses were recorded. R-multiples use only trades with explicit realized R. “Known fees” excludes trades without trustworthy fee records.</p>
   {insight.multiTagged&&<p className="text-[#e5c38a]">Trades with multiple strategy tags appear in each relevant group; adding group totals together double-counts those trades.</p>}
   <div className="max-h-[65vh] overflow-auto rounded border border-[#333d51]">
     <table className="min-w-[830px] w-full text-left">
       <thead className="sticky top-0 bg-[#1e2b41] text-[#b1c4de]"><tr>
        {['Group','Closed','Wins','Losses','Breakeven','Win Rate','Net P&L','Expectancy','Profit Factor','Known Fees','Missing Fees','Mean R'].map(x=>
          <th key={x} className="px-2 py-2 whitespace-nowrap">{x}</th>)}
       </tr></thead>
       <tbody>{insight.rows.map(row=><tr key={row.name} className="border-t border-[#303b4d]">
         <td className="px-2 py-2 font-semibold whitespace-nowrap">{row.name}</td>
         <td>{row.trades}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.breakEven}</td>
         <td>{number(row.winRate)}%</td>
         <td className={row.net>=0?'text-[#3cbd96]':'text-[#f27483]'}>{number(row.net)}</td>
         <td>{number(row.expectancy)}</td>
         <td>{row.profitFactor===null?'—':number(row.profitFactor)}</td>
         <td>{number(row.knownFees)}</td>
         <td>{row.missingFeeTrades}</td>
         <td>{row.averageR===null?'—':number(row.averageR)+' ('+row.rObservations+')'}</td>
       </tr>)}</tbody>
     </table>
     {!insight.rows.length&&<p className="p-4 text-[#b1bac9]">No settled journal trades have been recorded. Open trades are not included in win rates or expectancy.</p>}
   </div>
   <p className="text-[#92a1b4]">Session groupings use this browser’s local time. No assumed exchange time zone or exchange-rate conversion is used. Imported broker fills remain distinct from hypothetical paper trades.</p>
 </section>;
};
