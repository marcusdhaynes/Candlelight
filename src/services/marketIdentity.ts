import type {Asset} from '../types';
import type {ChartWindowState} from '../types/layout';
type MarketRef={
  symbol:string;exchange?:string;source?:string;marketType?:Asset['marketType'];
  chainId?:string;pairAddress?:string;
};
/** Preserve three-part legacy CEX keys; include chain and pool for DEX. */
export const marketIdentity=(market:MarketRef):string=>{
  const base=[market.symbol,market.source||market.exchange||'',market.marketType||''].join('|');
  if(!market.chainId&&!market.pairAddress)return base;
  return base+'|'+(market.chainId||'').toLowerCase()+'|'+(market.pairAddress||'').toLowerCase();
};
export const chartIdentity=(a:Asset,tf:string):string=>marketIdentity(a)+'|'+tf;
export const alertMarketIdentity=marketIdentity;
export const matchesExactMarket=(stored:MarketRef,market:Asset):boolean=>{
  if(stored.symbol!==market.symbol||(stored.source||stored.exchange)!==(market.source||market.exchange)||
    stored.marketType!==market.marketType)return false;
  if(market.pairAddress||market.chainId){
    return !!market.pairAddress&&!!market.chainId&&
      stored.pairAddress?.toLowerCase()===market.pairAddress.toLowerCase()&&
      stored.chainId?.toLowerCase()===market.chainId.toLowerCase();
  }
  return !stored.pairAddress&&!stored.chainId;
};
/** An unbound legacy reference must resolve uniquely; never pick a random venue. */
export function resolveWindowAsset(win:ChartWindowState,assets:Asset[],_selected?:Asset):Asset|undefined{
  const matches=assets.filter(asset=>asset.symbol===win.symbol&&
    (!win.source||(asset.source||asset.exchange)===win.source)&&
    (!win.marketType||asset.marketType===win.marketType)&&
    (!win.chainId||asset.chainId?.toLowerCase()===win.chainId.toLowerCase())&&
    (!win.pairAddress||asset.pairAddress?.toLowerCase()===win.pairAddress.toLowerCase()));
  return matches.length===1?matches[0]:undefined;
}
export function resolveWatchlistEntry(entry:string,assets:Asset[]):Asset|undefined{
  const exact=assets.find(asset=>marketIdentity(asset)===entry);
  if(exact)return exact;
  const matches=assets.filter(asset=>asset.symbol===entry||
    [asset.symbol,asset.source||asset.exchange,asset.marketType||''].join('|')===entry);
  return matches.length===1?matches[0]:undefined;
}
