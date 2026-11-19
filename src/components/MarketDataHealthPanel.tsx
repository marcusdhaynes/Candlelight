import React from 'react';
import {feedFreshness,type FeedHealth} from '../services/marketEvents';
type Props={health:Record<string,FeedHealth>;status:{connected:boolean;provider:string;latencyMs:number}};
export const MarketDataHealthPanel:React.FC<Props>=({health,status})=>{
 const rows=(Object.entries(health) as Array<[string,FeedHealth]>)
  .sort((a,b)=>b[1].lastReceivedAt-a[1].lastReceivedAt).slice(0,50);
 const now=Date.now();
 const ago=(ms?:number)=>ms?Math.max(0,Math.round((now-ms)/1000))+'s ago':'Never';
 return <div id="candlelight-data-health" className="p-4 text-[11px] text-[#d4d9e5] space-y-3">
   <strong className="text-sm">Market Data Health Center</strong>
   <p>Selected feed: {status.provider} · {status.connected?'Connected':'Unavailable'}</p>
   <p className="text-[#a4afbf]">Only observed trade prints authorize paper executions. Tickers and REST snapshots do not.
     Native IDs are checked for replay where supplied. Missing IDs cannot be deduplicated. Provider timestamps are unverified and reported lag is an estimate, not exchange execution latency.</p>
   <div className="max-h-[32vh] overflow-auto"><table className="w-full text-left whitespace-nowrap">
     <thead><tr><th>Exact market</th><th>Provider</th><th>Print state</th><th>Prints</th><th>Without ID/sequence</th>
       <th>Duplicates</th><th>Out of order</th><th>Gaps</th><th>Invalid</th><th>Reported lag</th>
       <th>Tickers</th><th>Snapshots</th><th>Last print</th><th>Last received</th></tr></thead>
     <tbody>{rows.map(([id,s])=><tr key={id} className="border-t border-[#323d4c]">
       <td className="py-1 pr-2">{id}</td><td className="pr-2">{s.provider}</td>
       <td className="pr-2">{feedFreshness(s,now)==='fresh'?'Fresh observed print':
          feedFreshness(s,now)==='stale'?'Stale prints':'No observed prints'}</td>
       <td>{s.tradeCount}</td><td>{s.unsequencedTradeCount}</td><td>{s.duplicateCount}</td>
       <td>{s.outOfOrderCount}</td><td>{s.gapCount}</td><td>{s.invalidCount}</td>
       <td>{s.reportedLatencyMs===undefined?'Unknown':Math.round(s.reportedLatencyMs)+'ms'}</td>
       <td>{s.tickerCount}</td><td>{s.snapshotCount}</td><td>{ago(s.lastTradeAt)}</td>
       <td>{ago(s.lastReceivedAt)}</td></tr>)}</tbody>
   </table>{rows.length===0&&<p>No provider messages observed in this session.</p>}</div>
 </div>;
};
