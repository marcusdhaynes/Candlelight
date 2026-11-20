/** Source-identified Coinbase prints. Missing identifiers or size are not trade events. */
const decimal=/^(?:0|[1-9]\d{0,21})(?:\.\d{1,16})?$/;
function positiveDecimal(value){
  const text=typeof value==='string'?value:String(value);
  return decimal.test(text)&&Number(text)>0?text:null;
}
function trade(raw,marketId,receivedAt,sizeKey){
  const id=raw?.trade_id,price=positiveDecimal(raw?.price),
    quantity=positiveDecimal(raw?.[sizeKey]),exchangeAt=Date.parse(raw?.time);
  if(!Number.isSafeInteger(id)||id<=0||!price||!quantity||
     !Number.isFinite(exchangeAt)||exchangeAt<=0||!Number.isFinite(receivedAt)||receivedAt<=0)
    return null;
  return {provider:'Coinbase',marketId,scope:'coinbase/ticker',kind:'trade',
    nativeId:'coinbase:'+id,sequence:id,price,quantity,exchangeAt,receivedAt,
    side:raw.side==='sell'?'sell':raw.side==='buy'?'buy':null};
}
export function parseCoinbaseRestTrade(raw,marketId,receivedAt=Date.now()){
  return trade(raw,marketId,receivedAt,'size');
}
/** The match channel is source-identified; last_match is a snapshot, never a new print. */
export function parseCoinbaseMatch(raw,marketId,productId,receivedAt=Date.now()){
  return raw?.type==='match'&&raw.product_id===productId?
    trade(raw,marketId,receivedAt,'size'):null;
}
/** Heartbeat trade ID is a watermark, not an event authorizing a price fill. */
export function parseCoinbaseHeartbeat(raw,productId,receivedAt=Date.now()){
  const id=raw?.last_trade_id;
  if(raw?.type!=='heartbeat'||raw.product_id!==productId||
     !Number.isSafeInteger(id)||id<=0||
     !Number.isFinite(receivedAt)||receivedAt<=0)return null;
  return {lastTradeId:id,receivedAt};
}
export function checkSequence(previous,next){
  if(!Number.isSafeInteger(next)||next<=0)return 'invalid';
  if(previous===null)return 'baseline';
  if(!Number.isSafeInteger(previous)||previous<=0)return 'invalid';
  if(next<=previous)return 'replay';
  return next===previous+1?'next':'gap';
}
/** Conservatively require the prior persisted ID to be present in a bounded REST window. */
export function verifiedRecovery(last,trades,maxRecords=20000){
  if(!Number.isSafeInteger(last)||last<=0||!Array.isArray(trades)||
     !Number.isSafeInteger(maxRecords)||maxRecords<1||trades.length>maxRecords)
    return {ok:false,reason:'Invalid checkpoint or history window'};
  const byId=new Map();
  for(const trade of trades){
    if(!trade||!Number.isSafeInteger(trade.sequence)||trade.sequence<=0)
      return {ok:false,reason:'Malformed history'};
    const prior=byId.get(trade.sequence);
    if(prior&&(prior.nativeId!==trade.nativeId||prior.price!==trade.price||
      prior.quantity!==trade.quantity))return {ok:false,reason:'Conflicting trade'};
    byId.set(trade.sequence,trade);
  }
  if(!byId.has(last))return {ok:false,reason:'Checkpoint not in recent-trades window'};
  const missing=[...byId.values()].filter(t=>t.sequence>last).sort((a,b)=>a.sequence-b.sequence);
  let cursor=last;
  for(const item of missing){
    if(item.sequence!==cursor+1)return {ok:false,reason:'Historical gap'};
    cursor=item.sequence;
  }
  return {ok:true,trades:missing,latest:cursor};
}
export class BoundedQueue{
  constructor(limit=2500){
    if(!Number.isInteger(limit)||limit<1||limit>10000)throw Error('Invalid queue bound');
    this.limit=limit;this.events=[];this.overflowed=false;
  }
  push(value){
    if(this.events.length>=this.limit){this.overflowed=true;return false;}
    this.events.push(value);return true;
  }
  drain(){return this.events.splice(0);}
}
