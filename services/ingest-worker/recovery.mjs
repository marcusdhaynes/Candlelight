import {parseCoinbaseRestTrade,verifiedRecovery} from './protocol.mjs';

/**
 * Coinbase Exchange cursor pagination moves older with CB-AFTER.
 * This only returns a recovery range AFTER the durable checkpoint is present
 * in source data. Never infer or fabricate missing trade IDs.
 */
export async function loadCoinbaseRecovery({
  checkpoint,marketId,requestPage,limit=1000,maxPages=12
}){
  if(checkpoint!==null&&(!Number.isSafeInteger(checkpoint)||checkpoint<=0))
    throw Error('Invalid durable trade checkpoint');
  if(typeof requestPage!=='function'||!Number.isInteger(limit)||limit<1||limit>1000||
     !Number.isInteger(maxPages)||maxPages<1||maxPages>25)
    throw Error('Invalid source recovery pagination bounds');
  let after=null;
  const seenCursors=new Set(),all=[];
  for(let i=0;i<maxPages;i++){
    const page=await requestPage({after,limit});
    if(!page||!Array.isArray(page.rows)||!page.rows.length||page.rows.length>limit)
      throw Error('Unexpected or empty Coinbase REST history page');
    const trades=page.rows.map(row=>parseCoinbaseRestTrade(row,marketId));
    if(trades.some(x=>!x))throw Error('Malformed Coinbase REST source trade');
    all.push(...trades);
    if(checkpoint===null)return {trades:all,pages:i+1,baseline:true};
    if(trades.some(x=>x.sequence===checkpoint)){
      const verified=verifiedRecovery(checkpoint,all,maxPages*limit);
      if(!verified.ok)throw Error('Cannot verify provider recovery: '+verified.reason);
      return {trades:verified.trades,pages:i+1,baseline:false};
    }
    const cursor=page.after;
    if(typeof cursor!=='string'||!cursor||seenCursors.has(cursor))
      throw Error('Provider history cursor missing or repeated before checkpoint');
    seenCursors.add(cursor);
    after=cursor;
  }
  throw Error('Provider checkpoint older than bounded recovery history');
}
