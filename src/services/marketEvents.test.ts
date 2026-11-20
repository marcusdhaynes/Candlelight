import assert from 'node:assert/strict';
import {createTradeReplayGuard,eventIsExecutable,feedFreshness,marketEvent,parseCoinbaseMatchEvent,priceOrigin,updateFeedHealth,validMarketEvent} from './marketEvents';
const a={symbol:'BTCUSDT',exchange:'Binance',source:'Binance',marketType:'spot'} as any;
for(const k of ['ticker','snapshot','book'] as const)
  assert.equal(eventIsExecutable(marketEvent(a,k,100,1)),false);
assert.equal(eventIsExecutable(marketEvent(a,'trade',100,1)),true);
assert.equal(eventIsExecutable(marketEvent(a,'trade',100,0)),false);
assert.equal(eventIsExecutable(marketEvent(a,'trade',0,1)),false);
assert.equal(priceOrigin('trade'),'stream');
assert.equal(priceOrigin('ticker'),'ticker');

const at=Date.now();
const make=(id:string,sequence:number,receivedAt=at,exchangeAt=at-20)=>
  ({...marketEvent(a,'trade',100,1,'buy',{tradeId:id,sequence,sequenceScope:'binance/trade',
    sequenceMode:'contiguous',exchangeAt}),receivedAt});
let health=updateFeedHealth(undefined,make('trade-10',10));
assert.equal(health.tradeCount,1);
assert.equal(health.sequencedTradeCount,1);
assert.equal(health.reportedLatencyMs,20);
assert.equal(feedFreshness(health,at+1000),'fresh');
assert.equal(feedFreshness(health,at+31_000),'stale');
assert.equal(feedFreshness(updateFeedHealth(undefined,marketEvent(a,'ticker',100))),'no-trades');

health=updateFeedHealth(health,make('trade-10',10,at+100));
assert.equal(health.tradeCount,1,'replayed provider print must not increase count');
assert.equal(health.duplicateCount,1);
assert.equal(health.lastTradeAt,at,'duplicate does not refresh last valid print');

health=updateFeedHealth(health,make('trade-13',13,at+150));
assert.equal(health.gapCount,1);
assert.equal(health.missingSequenceCount,2);
assert.equal(health.tradeCount,2);
health=updateFeedHealth(health,make('late-trade-12',12,at+200));
assert.equal(health.outOfOrderCount,1);
assert.equal(health.lastSequences['binance/trade'],13);

const monotonic=updateFeedHealth(health,{...make('coinbase-100',100,at+250),sequenceScope:'coinbase/ticker',sequenceMode:'monotonic'});
const skipped=updateFeedHealth(monotonic,{...make('coinbase-110',110,at+300),sequenceScope:'coinbase/ticker',sequenceMode:'monotonic'});
assert.equal(skipped.gapCount,1,'monotonic provider sequences must not be treated as contiguous');
const wrong=updateFeedHealth(skipped,{...make('invalid',111),price:NaN});
assert.equal(wrong.invalidCount,1);
assert.equal(wrong.tradeCount,skipped.tradeCount);
assert.equal(validMarketEvent({...make('invalid2',112),exchangeAt:-1}),false);
const clock=updateFeedHealth(wrong,make('clock',112,at+350,at+4000));
assert.equal(clock.clockSkewCount,1);
assert.equal(clock.reportedLatencyMs,0);

const accepts=createTradeReplayGuard(2);
assert.equal(accepts('first'),true);
assert.equal(accepts('first'),false);
assert.equal(accepts('second'),true);
assert.equal(accepts('third'),true);
assert.equal(accepts('first'),true,'old IDs must evict to bound memory');
assert.equal(accepts(undefined),true,'unidentified prints are not falsely claimed deduplicated');
const orderGuard=createTradeReplayGuard();
assert.equal(orderGuard('coinbase-100',100,'coinbase/ticker'),true);
assert.equal(orderGuard('coinbase-99',99,'coinbase/ticker'),false,
  'older provider sequence must not authorize a fresh execution');
assert.equal(orderGuard('coinbase-101',101,'coinbase/ticker'),true);
assert.equal(orderGuard('coinbase-101',102,'coinbase/ticker'),false,
  'repeat provider trade ID is refused despite a higher sequence');
assert.equal(orderGuard('binance-1',1,'binance/trade'),true,
  'sequence checks are isolated by stream scope');
assert.equal(orderGuard('invalid',NaN,'binance/trade'),false);
console.log('Market-data diagnostics, replay protection and sequence modes validated.');


const coinbaseRaw={type:'match',product_id:'BTC-USD',trade_id:502,price:'100.25',
  size:'0.03',side:'sell',time:'2026-11-19T12:00:00Z'};
const coinbaseMatch=parseCoinbaseMatchEvent(coinbaseRaw,'BTC-USD');
assert.ok(coinbaseMatch);
assert.equal(coinbaseMatch.side,'buy','Coinbase side is maker side; trade tape uses aggressor');
assert.equal(coinbaseMatch.metadata.tradeId,'coinbase:502');
assert.equal(coinbaseMatch.metadata.sequenceScope,'coinbase/matches');
assert.equal(eventIsExecutable({...marketEvent(a,'trade',coinbaseMatch.price,coinbaseMatch.size),
  ...coinbaseMatch.metadata}),true);
for(const bad of [
 {...coinbaseRaw,type:'ticker'}, {...coinbaseRaw,type:'last_match'},
 {...coinbaseRaw,product_id:'ETH-USD'}, {...coinbaseRaw,trade_id:'502'},
 {...coinbaseRaw,price:'0'}, {...coinbaseRaw,size:'0'},
 {...coinbaseRaw,time:'bad'}, {...coinbaseRaw,side:'none'}
])assert.equal(parseCoinbaseMatchEvent(bad,'BTC-USD'),null);
console.log('Coinbase matches are prints; batched tickers cannot authorize paper fills.');
