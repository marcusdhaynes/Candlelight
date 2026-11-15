import type {OrderBookItem} from '../types';

export interface CoinbaseDepthState {
  bids:Map<number,number>;
  asks:Map<number,number>;
  ready:boolean;
}
export const createCoinbaseDepthState=():CoinbaseDepthState=>({
  bids:new Map(),asks:new Map(),ready:false,
});
const validLevel=(price:number,size:number)=>Number.isFinite(price)&&price>0&&
  Number.isFinite(size)&&size>=0;
function applyLevel(book:Map<number,number>,price:unknown,size:unknown){
  const p=Number(price),qty=Number(size);
  if(!validLevel(p,qty))return;
  if(qty===0)book.delete(p);else book.set(p,qty);
}
/** Coinbase Exchange level2 snapshots and absolute-size updates; never synthesize depth. */
export function acceptCoinbaseLevel2(state:CoinbaseDepthState,
  payload:any,expectedProduct:string):boolean{
  if(!expectedProduct||payload?.product_id!==expectedProduct)return false;
  if(payload.type==='snapshot'&&Array.isArray(payload.bids)&&Array.isArray(payload.asks)){
    if(payload.bids.length>100000||payload.asks.length>100000)return false;
    state.bids.clear();state.asks.clear();
    for(const level of payload.bids)if(Array.isArray(level))applyLevel(state.bids,level[0],level[1]);
    for(const level of payload.asks)if(Array.isArray(level))applyLevel(state.asks,level[0],level[1]);
    state.ready=true;
    return true;
  }
  if(payload.type==='l2update'&&state.ready&&Array.isArray(payload.changes)){
    if(payload.changes.length>100000)return false;
    for(const change of payload.changes){
      if(!Array.isArray(change))continue;
      if(change[0]==='buy')applyLevel(state.bids,change[1],change[2]);
      else if(change[0]==='sell')applyLevel(state.asks,change[1],change[2]);
    }
    return true;
  }
  return false;
}
export function coinbaseDepthRows(state:CoinbaseDepthState,limit=12):
  {bids:OrderBookItem[];asks:OrderBookItem[]}{
  const rows=(book:Map<number,number>,buy:boolean):OrderBookItem[]=>{
    let total=0;
    return [...book.entries()].sort((a,b)=>buy?b[0]-a[0]:a[0]-b[0])
      .slice(0,limit).map(([price,size])=>{
        total+=size;return {price,size,total};
      });
  };
  return {bids:rows(state.bids,true),asks:rows(state.asks,false)};
}
