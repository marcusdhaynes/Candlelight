import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCoinbasePrint,parseCoinbaseRestTrade,parseCoinbaseMatch,parseCoinbaseHeartbeat,checkSequence,verifiedRecovery,BoundedQueue} from './protocol.mjs';
const m='BTCUSD|Coinbase|spot';
const ticker=(id,overrides={})=>({type:'ticker',product_id:'BTC-USD',trade_id:id,
  price:'95000.125',last_size:'0.003',time:'2026-11-19T12:00:00.000Z',side:'buy',...overrides});
test('only exact and identified venue prints are executable',()=>{
  for(const x of [ticker(null),ticker(3,{last_size:0}),ticker(3,{price:'NaN'}),
    ticker(3,{price:'-2'}),ticker(3,{time:'bad'}),ticker(3,{product_id:'ETH-USD'}),
    ticker(Number.MAX_SAFE_INTEGER+1)])assert.equal(parseCoinbasePrint(x,m,'BTC-USD'),null);
  const good=parseCoinbasePrint(ticker(3),m,'BTC-USD',1234);
  assert.equal(good.nativeId,'coinbase:3');assert.equal(good.price,'95000.125');
  assert.equal(good.receivedAt,1234);
  assert.equal(parseCoinbasePrint({...ticker(3),type:'snapshot'},m,'BTC-USD'),null);
});
test('checkpoint recovery refuses unprovable gaps',()=>{
 const trade=id=>parseCoinbaseRestTrade({trade_id:id,price:'1.1',size:'2.3',
   time:'2026-11-19T12:00:00Z',side:'sell'},m,1000);
 const a=trade(10),b=trade(11),c=trade(12);
 assert.equal(checkSequence(10,11),'next');
 assert.equal(checkSequence(10,12),'gap');
 assert.equal(checkSequence(10,10),'replay');
 assert.equal(checkSequence(null,5),'baseline');
 assert.deepEqual(verifiedRecovery(10,[c,a,b]).trades.map(x=>x.sequence),[11,12]);
 assert.equal(verifiedRecovery(10,[c,a]).ok,false);
 assert.equal(verifiedRecovery(10,[c,b]).ok,false);
 assert.equal(verifiedRecovery(10,[a,b,{...b,price:'2'}]).ok,false);
});
test('bounded input queue latches overflow',()=>{
 const q=new BoundedQueue(2);
 assert.equal(q.push('a'),true);assert.equal(q.push('b'),true);
 assert.equal(q.push('c'),false);assert.equal(q.overflowed,true);
 assert.deepEqual(q.drain(),['a','b']);
 assert.equal(q.overflowed,true);
});

test('only matches, not batched tickers or last_match snapshots, count as backend prints',()=>{
  const raw={type:'match',product_id:'BTC-USD',trade_id:18,price:'1.25',size:'0.5',
    side:'sell',time:'2026-11-19T12:00:00Z'};
  assert.equal(parseCoinbaseMatch(raw,m,'BTC-USD').nativeId,'coinbase:18');
  assert.equal(parseCoinbaseMatch({...raw,type:'last_match'},m,'BTC-USD'),null);
  assert.equal(parseCoinbaseMatch({...raw,type:'ticker'},m,'BTC-USD'),null);
  assert.equal(parseCoinbaseMatch({...raw,product_id:'ETH-USD'},m,'BTC-USD'),null);
  const beat=parseCoinbaseHeartbeat({type:'heartbeat',product_id:'BTC-USD',last_trade_id:19},'BTC-USD',500);
  assert.deepEqual(beat,{lastTradeId:19,receivedAt:500});
  assert.equal(parseCoinbaseHeartbeat({type:'heartbeat',product_id:'ETH-USD',last_trade_id:19},'BTC-USD'),null);
  assert.equal(parseCoinbaseHeartbeat({type:'heartbeat',product_id:'BTC-USD',last_trade_id:NaN},'BTC-USD'),null);
});
