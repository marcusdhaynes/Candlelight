import type {Asset} from '../types';
export type MarketScreen={query:string;marketType:string;minAbsChange:number;sort:'change'|'symbol'|'volume'};
const volumeNumber=(volume:string):number=>{
  const normalized=volume.replace(/,/g,'').trim();
  const match=normalized.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/i);
  if(!match)return 0;
  return Number(match[1])*({K:1e3,M:1e6,B:1e9}[match[2]?.toUpperCase() as 'K'|'M'|'B']||1);
};
export function screenMarkets(assets:Asset[],screen:MarketScreen,limit=100):Asset[]{
 const query=screen.query.trim().toLowerCase();
 const eligible=assets.filter(a=>
   (a.quoteStatus==='live'||a.quoteStatus==='delayed')&&
   Number.isFinite(a.price)&&a.price>0&&
   Number.isFinite(a.changePercent24h)&&
   (!query||[a.symbol,a.name,a.source||a.exchange].some(v=>v.toLowerCase().includes(query)))&&
   (screen.marketType==='all'||a.marketType===screen.marketType)&&
   Math.abs(a.changePercent24h)>=screen.minAbsChange);
 eligible.sort((a,b)=>screen.sort==='symbol'?a.symbol.localeCompare(b.symbol):
   screen.sort==='volume'?volumeNumber(b.volume24h)-volumeNumber(a.volume24h):
   Math.abs(b.changePercent24h)-Math.abs(a.changePercent24h));
 return eligible.slice(0,Math.max(1,Math.min(500,limit)));
}
