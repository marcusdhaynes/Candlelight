import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCoinbaseRecovery} from './recovery.mjs';
const market='BTCUSD|Coinbase|spot';
const mk=id=>({trade_id:id,price:'90000.00',size:'0.125',
  side:'buy',time:'2026-11-19T12:00:00Z'});
test('paginates Coinbase CB-AFTER in the older direction and validates the overlap',async()=>{
 const queried=[];
 const result=await loadCoinbaseRecovery({
  checkpoint:100,marketId:market,limit:3,maxPages:3,
  requestPage:async({after})=>{
    queried.push(after);
    return !after?{rows:[mk(105),mk(104),mk(103)],after:'older-1'}:
      {rows:[mk(102),mk(101),mk(100)],after:'older-2'};
  }
 });
 assert.deepEqual(queried,[null,'older-1']);
 assert.deepEqual(result.trades.map(x=>x.sequence),[101,102,103,104,105]);
 assert.equal(result.pages,2);
});
test('never accepts a missing checkpoint, conflicting ID or repeated cursor',async()=>{
 const badPage=async({after})=>({rows:[mk(after?101:103),mk(after?100:102)],after:'same'});
 await assert.rejects(()=>loadCoinbaseRecovery({
  checkpoint:99,marketId:market,limit:2,maxPages:4,requestPage:badPage
 }),/cursor/);
 const missing=await loadCoinbaseRecovery({
  checkpoint:100,marketId:market,limit:3,maxPages:3,
  requestPage:async({after})=>!after?
    {rows:[mk(104),mk(103),mk(102)],after:'older'}:
    {rows:[mk(101),mk(100)],after:'last'}
 }).catch(e=>e);
 assert.match(missing.message,/Historical gap/);
});
test('bounded recovery fails closed without generating synthetic records',async()=>{
 await assert.rejects(()=>loadCoinbaseRecovery({
  checkpoint:1,marketId:market,limit:1,maxPages:2,
  requestPage:async({after})=>({rows:[mk(after?4:5)],after:after?'older':'next'})
 }),/older than bounded/);
 await assert.rejects(()=>loadCoinbaseRecovery({
  checkpoint:100,marketId:market,requestPage:async()=>({rows:[]})
 }),/empty Coinbase REST history/);
 const baseline=await loadCoinbaseRecovery({
  checkpoint:null,marketId:market,limit:2,
  requestPage:async()=>({rows:[mk(150),mk(149)],after:'older'})
 });
 assert.equal(baseline.baseline,true);
 assert.equal(baseline.pages,1);
});
