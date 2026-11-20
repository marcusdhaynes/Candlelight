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
     if(q.startsWith('SELECT current_user'))return {rows:[{role_name:'app_candlelight_market_ingestor',login_name:'postgres',unprivileged:false}]};
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
     if(q.startsWith('SELECT current_user'))return {rows:[{role_name:'app_candlelight_market_ingestor',login_name:'candle_worker',unprivileged:true}]};
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

test('journal write and alert evaluation roll back together on delivery-outbox failure',async()=>{
 const calls=[];
 const fake={connect:async()=>({
   query:async(q)=>{
     calls.push(q);
     if(q.startsWith('SELECT current_user'))return {rows:[{role_name:'app_candlelight_market_ingestor',login_name:'candle_worker',unprivileged:true}]};
     if(q.includes('SELECT last_sequence::text'))return {rowCount:1,rows:[{last_sequence:'100'}]};
     if(q.includes('INSERT INTO app_candlelight.market_event_journal'))
       return {rowCount:1,rows:[{event_id:'00000000-0000-4000-8000-000000000001'}]};
     if(q.includes('SELECT rule_id,owner_id'))
       return {rowCount:1,rows:[{rule_id:'00000000-0000-4000-8000-000000000002',
         owner_id:'00000000-0000-4000-8000-000000000003',trigger_count:0,max_triggers:1,fired:true}]};
     if(q.includes('INSERT INTO app_candlelight.market_alert_outbox'))
       throw Error('injected outbox failure');
     return {rowCount:1,rows:[{}]};
   },release:()=>calls.push('release')
 })};
 const store=new MarketIngestStore(fake,'BTCUSD|Coinbase|spot');
 const trade={provider:'Coinbase',marketId:'BTCUSD|Coinbase|spot',scope:'coinbase/ticker',
   nativeId:'coinbase:101',sequence:101,price:'100.25',quantity:'0.5',
   exchangeAt:100000,receivedAt:100010,side:'buy'};
 await assert.rejects(()=>store.append(trade,'accepted',true),/injected outbox failure/);
 assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));
 assert.ok(calls.some(q=>q.includes('INSERT INTO app_candlelight.market_event_journal')));
 assert.ok(calls.some(q=>q.includes('INSERT INTO app_candlelight.market_alert_outbox')));
});
test('recovery advances alert baseline without firing historical notifications',async()=>{
 const calls=[];
 const fake={connect:async()=>({
   query:async(q)=>{
     calls.push(q);
     if(q.startsWith('SELECT current_user'))return {rows:[{role_name:'app_candlelight_market_ingestor',login_name:'candle_worker',unprivileged:true}]};
     if(q.includes('SELECT last_sequence::text'))return {rowCount:1,rows:[{last_sequence:'100'}]};
     if(q.includes('INSERT INTO app_candlelight.market_event_journal'))
       return {rowCount:1,rows:[{event_id:'00000000-0000-4000-8000-000000000001'}]};
     return {rowCount:1,rows:[{}]};
   },release:()=>calls.push('release')
 })};
 const store=new MarketIngestStore(fake,'BTCUSD|Coinbase|spot');
 const trade={provider:'Coinbase',marketId:'BTCUSD|Coinbase|spot',scope:'coinbase/ticker',
   nativeId:'coinbase:101',sequence:101,price:'100.25',quantity:'0.5',
   exchangeAt:100000,receivedAt:100010,side:'buy'};
 assert.equal((await store.append(trade,'accepted',false)).status,'inserted');
 assert.ok(calls.some(q=>q.includes('UPDATE app_candlelight.market_alert_rules SET last_price')));
 assert.ok(!calls.some(q=>q.includes('INSERT INTO app_candlelight.market_alert_outbox')));
 assert.ok(calls.includes('COMMIT'));
});
test('untrusted trade IDs or malformed decimals cannot reach the database',async()=>{
 const store=new MarketIngestStore({connect:()=>{throw Error('must not connect');}},'BTCUSD|Coinbase|spot');
 const trade={provider:'Coinbase',marketId:'BTCUSD|Coinbase|spot',scope:'coinbase/ticker',
   nativeId:'coinbase:999',sequence:101,price:'1e400',quantity:'1',
   exchangeAt:100000,receivedAt:100010,side:'buy'};
 await assert.rejects(()=>store.append(trade),/Invalid trade source/);
});
