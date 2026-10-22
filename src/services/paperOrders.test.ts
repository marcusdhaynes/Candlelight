import assert from 'node:assert/strict';
import type {Asset} from '../types';
import {emptyPaperPortfolio} from './paperTrading';
import {
  submitPaperOrder,cancelPaperOrder,evaluatePaperOrders,pendingFor,withOrderReservations,
  estimatePaperQty,exitPriceFromValue,exitValueFromPrice,
} from './paperOrders';
const now=1_700_000_000_000;
const asset:Asset={symbol:'BTCUSD',name:'BTC / USD',exchange:'Kraken',source:'Kraken',
  category:'crypto',marketType:'spot',price:100,change24h:0,changePercent24h:0,high24h:100,
  low24h:100,volume24h:'',currency:'USD',digits:2,quoteStatus:'live',quoteUpdatedAt:now};
const fresh=(price:number,at:number):Asset=>({...asset,price,quoteUpdatedAt:at});
const approx=(v:number,x:number)=>assert.ok(Math.abs(v-x)<1e-7,`Expected ${v} to match ${x}`);
const empty=emptyPaperPortfolio();
const limit=submitPaperOrder(empty,asset,{side:'Long',kind:'limit',qty:2,price:95,tp:110,sl:90,timeInForce:'Week'},now);
assert.equal(limit.positions.length,0);assert.equal(pendingFor(limit).length,1);
approx(limit.account.ordersMargin,190);approx(limit.account.availableFunds,9810);
const untouched=evaluatePaperOrders(limit,fresh(98,now+1000),now+1000);
assert.equal(untouched.positions.length,0);
const filled=evaluatePaperOrders(untouched,fresh(93,now+2000),now+2000);
assert.equal(pendingFor(filled).length,0);assert.equal(filled.positions.length,1);
approx(filled.positions[0].entryPrice,93);approx(filled.account.ordersMargin,0);
const trigger=submitPaperOrder(empty,asset,{side:'Long',kind:'stop',qty:1,price:105},now);
const stopFill=evaluatePaperOrders(trigger,fresh(107,now+2000),now+2000);
assert.equal(stopFill.positions.length,1);approx(stopFill.positions[0].entryPrice,107);
const short=submitPaperOrder(empty,asset,{side:'Short',kind:'limit',qty:1,price:110},now);
assert.equal(evaluatePaperOrders(short,fresh(111,now+1000),now+1000).positions[0].side,'Short');
const cancelled=cancelPaperOrder(limit,pendingFor(limit)[0].id);
assert.equal(pendingFor(cancelled).length,0);approx(cancelled.account.ordersMargin,0);
const day=submitPaperOrder(empty,asset,{side:'Long',kind:'limit',qty:1,price:95,timeInForce:'Day'},now);
assert.equal(evaluatePaperOrders(day,fresh(100,now+86400001),now+86400001).pendingOrders?.length,0);
const m=submitPaperOrder(empty,asset,{side:'Short',kind:'market',qty:1},now);
assert.equal(m.positions.length,1);assert.equal(m.positions[0].side,'Short');
assert.throws(()=>submitPaperOrder(empty,asset,{side:'Long',kind:'limit',qty:1,price:101},now),/Limit entry/);
assert.throws(()=>submitPaperOrder(empty,asset,{side:'Short',kind:'stop',qty:1,price:101},now),/Stop entry/);
assert.throws(()=>submitPaperOrder(empty,asset,{side:'Long',kind:'market',qty:1000},now),/Insufficient/);
const holds=submitPaperOrder(empty,asset,{side:'Long',kind:'limit',qty:99,price:95},now);
assert.throws(()=>submitPaperOrder(holds,asset,{side:'Long',kind:'market',qty:10},now),/Insufficient/);
assert.equal(pendingFor(withOrderReservations(holds)).length,1);
assert.ok(estimatePaperQty(empty,asset,99,100)>98);
const take=exitPriceFromValue(100,10,'Long','tp','percent',2.1,0.01,10000);
const stop=exitPriceFromValue(100,10,'Long','sl','percent',0.13,0.01,10000);
approx(take!,102.1);approx(stop!,99.87);
approx(exitValueFromPrice(100,10,'Long','tp','money',105,0.01,10000),50);
approx(exitPriceFromValue(100,10,'Short','sl','money',12,0.01,10000)!,101.2);
approx(exitPriceFromValue(100,10,'Long','tp','ticks',25,0.01,10000)!,100.25);
approx(exitPriceFromValue(100,10,'Long','tp','balance',1,0.01,10000)!,110);
assert.equal(exitPriceFromValue(100,0,'Long','tp','money',10,.01,10000),undefined);
console.log('Paper order tests passed: market/limit/stop, margin reservations, fills, expiry, cancellation, both sides and exit conversions.');
