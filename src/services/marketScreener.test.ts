import assert from 'node:assert/strict';
import {screenMarkets} from './marketScreener';
const p={exchange:'Coinbase',source:'Coinbase',marketType:'spot',name:'Bitcoin',
  symbol:'BTCUSD',price:100,changePercent24h:3,volume24h:'12M',quoteStatus:'delayed'} as any;
const fake={...p,symbol:'FAKE',quoteStatus:'unavailable',changePercent24h:200};
const swap={...p,symbol:'ETHUSD',marketType:'swap',changePercent24h:-6};
const defaults={query:'',marketType:'all',minAbsChange:0,sort:'change' as const};
assert.deepEqual(screenMarkets([p,fake,swap],defaults).map(a=>a.symbol),['ETHUSD','BTCUSD']);
assert.deepEqual(screenMarkets([p,fake,swap],{...defaults,marketType:'spot'}).map(a=>a.symbol),['BTCUSD']);
assert.deepEqual(screenMarkets([p,fake,swap],{...defaults,query:'bitcoin'}).map(a=>a.symbol),['ETHUSD','BTCUSD']);
console.log('Screener excludes fabricated/unavailable quotes and filters real markets.');
