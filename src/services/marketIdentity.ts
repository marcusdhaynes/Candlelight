import type {Asset} from '../types';
import type {ChartWindowState} from '../types/layout';
export const marketIdentity=(a:Pick<Asset,'symbol'|'exchange'|'source'|'marketType'>):string=>
 [a.symbol,a.source||a.exchange,a.marketType||''].join('|');
export const chartIdentity=(a:Asset,tf:string):string=>marketIdentity(a)+'|'+tf;
export function resolveWindowAsset(win:ChartWindowState,assets:Asset[],selected?:Asset):Asset|undefined {
 if(!win.source&&selected?.symbol===win.symbol)return selected;
 const matches=assets.filter(a=>a.symbol===win.symbol);
 if(win.source)return matches.find(a=>(a.source||a.exchange)===win.source &&
   (win.marketType||'')===(a.marketType||''));
 return matches.length===1?matches[0]:undefined;
}
export function resolveWatchlistEntry(entry:string,assets:Asset[]):Asset|undefined {
 const exact=assets.find(a=>marketIdentity(a)===entry);
 if(exact)return exact;
 const matches=assets.filter(a=>a.symbol===entry);
 return matches.length===1?matches[0]:undefined;
}
