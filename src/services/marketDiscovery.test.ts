import assert from 'node:assert/strict';
import {fetchBybitInstruments} from './marketDiscovery';
const seen:string[]=[];
const query=async(url:string)=>{
  seen.push(url);
  const category=new URL(url).searchParams.get('category');
  const cursor=new URL(url).searchParams.get('cursor');
  if(category==='spot'&&!cursor)return {retCode:0,result:{list:[{symbol:'AAAUSDT',baseCoin:'AAA',quoteCoin:'USDT',status:'Trading'}],nextPageCursor:'next one'}};
  if(category==='spot'&&cursor==='next one')return {retCode:0,result:{list:[{symbol:'BBBUSDT',baseCoin:'BBB',quoteCoin:'USDT'}]}};
  return {retCode:0,result:{list:[{symbol:'CCCUSDT',baseCoin:'CCC',quoteCoin:'USDT'}]}};
};
const assets=await fetchBybitInstruments(query);
assert.deepEqual(assets.map(a=>a.symbol),['AAAUSDT','BBBUSDT','CCCUSDT']);
assert.equal(seen.length,3);
assert.ok(seen[1].includes('cursor=next%20one'));
await assert.rejects(()=>fetchBybitInstruments(async(url)=>({retCode:0,result:{list:[],nextPageCursor:'loop'}})),/loop/);
console.log('Bybit pagination and repeating cursor protection passed.');
