import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketIngestStore} from './store.mjs';

/** Verify a denied database role fails before any journal mutation. */
test('worker refuses database owner identity even after successful SET ROLE',async()=>{
 const calls=[];
 const fake={
  connect:async()=>({
   query:async(q)=>{
     calls.push(q);
     if(q.startsWith('SELECT current_user'))return {rows:[{role_name:'app_candlelight_market_ingestor',login_name:'postgres'}]};
     return {rows:[],rowCount:0};
   },
   release:()=>calls.push('release')
  })
 };
 const store=new MarketIngestStore(fake,'BTCUSD|Coinbase|spot');
 await assert.rejects(()=>store.acquire(),/Unsafe database identity/);
 assert.ok(calls.includes('ROLLBACK'));
 assert.ok(calls.includes('release'));
 assert.ok(!calls.some(x=>x.includes('INSERT INTO app_candlelight.market_event_journal')));
});
test('worker rolls back when transaction breaks',async()=>{
 const calls=[];
 const fake={
  connect:async()=>({
   query:async(q)=>{
     calls.push(q);
     if(q.startsWith('SELECT current_user'))return {rows:[{role_name:'app_candlelight_market_ingestor',login_name:'candle_worker'}]};
     if(q==='BOOM')throw Error('db unavailable');
     return {rows:[],rowCount:0};
   },
   release:()=>calls.push('release')
  })
 };
 const store=new MarketIngestStore(fake,'BTCUSD|Coinbase|spot');
 await assert.rejects(()=>store.tx(c=>c.query('BOOM')),/db unavailable/);
 assert.ok(calls.includes('ROLLBACK'));
 assert.ok(!calls.includes('COMMIT'));
});
