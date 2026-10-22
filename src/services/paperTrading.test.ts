import assert from 'node:assert/strict';
import type {Asset} from '../types';
import {emptyPaperPortfolio, placePaperPosition, closePaperPosition, markPaperPositions,
  recalculatePaperPortfolio, isFreshPaperQuote, PAPER_FEE_RATE} from './paperTrading';

const now=1_700_000_000_000;
const asset:Asset={
  symbol:'BTCUSD',name:'Bitcoin / US Dollar',exchange:'Kraken',source:'Kraken',category:'crypto',marketType:'spot',
  price:100,change24h:0,changePercent24h:0,high24h:100,low24h:100,
  volume24h:'123',digits:2,currency:'USD',quoteStatus:'live',quoteUpdatedAt:now,
};
const closeTo=(actual:number,expected:number) =>
  assert.ok(Math.abs(actual-expected)<1e-7,`Expected ${actual} to equal ${expected}`);
const empty=emptyPaperPortfolio();
assert.equal(empty.positions.length,0);
assert.equal(empty.account.equity,10000);
assert.equal(empty.account.availableFunds,10000);
const opened=placePaperPosition(empty,asset,'Long',2,2,undefined,undefined,now);
assert.equal(opened.positions.length,1);
closeTo(opened.account.balance,10000-200*PAPER_FEE_RATE);
closeTo(opened.account.accountMargin,100);
closeTo(opened.account.availableFunds, opened.account.equity - 100);
const marked=markPaperPositions(opened,{...asset,price:110,quoteUpdatedAt:now+1000},now+1000);
closeTo(marked.positions[0].unrealizedPnL,20);
closeTo(marked.account.equity,marked.account.balance+20);
const partial=closePaperPosition(marked,marked.positions[0].id,110,1,now+1001);
closeTo(partial.positions[0].qty,1);
closeTo(partial.account.realizedPnL, -200*PAPER_FEE_RATE+10-110*PAPER_FEE_RATE);
const closed=closePaperPosition(partial,partial.positions[0].id,110,undefined,now+1002);
assert.equal(closed.positions.length,0);
closeTo(closed.account.equity,closed.account.balance);
closeTo(closed.account.accountMargin,0);
closeTo(closed.account.realizedPnL, closed.account.balance-10000);
const short=placePaperPosition(empty,asset,'Short',1,1,undefined,undefined,now);
const shortMarked=markPaperPositions(short,{...asset,price:80,quoteUpdatedAt:now+2000},now+2000);
closeTo(shortMarked.positions[0].unrealizedPnL,20);
const shortClosed=closePaperPosition(shortMarked,shortMarked.positions[0].id,80,undefined,now+2000);
closeTo(shortClosed.account.balance,10000+20-100*PAPER_FEE_RATE-80*PAPER_FEE_RATE);
const tp=placePaperPosition(empty,asset,'Long',1,1,105,95,now);
assert.equal(markPaperPositions(tp,{...asset,price:105,quoteUpdatedAt:now+2000},now+2000).positions.length,0);
const sl=placePaperPosition(empty,asset,'Short',1,1,90,105,now);
assert.equal(markPaperPositions(sl,{...asset,price:105,quoteUpdatedAt:now+2000},now+2000).positions.length,0);
assert.throws(()=>placePaperPosition(empty,asset,'Long',200,1,undefined,undefined,now),/Insufficient/);
assert.throws(()=>placePaperPosition(empty,{...asset,currency:'USDT'},'Long',1,1,undefined,undefined,now),/USD-quoted/);
assert.throws(()=>placePaperPosition(empty,{...asset,quoteUpdatedAt:now-60000},'Long',1,1,undefined,undefined,now),/verified/);
assert.equal(isFreshPaperQuote({...asset,price:0},now),false);
assert.equal(recalculatePaperPortfolio(closed).account.availableFunds, closed.account.balance);
console.log('Paper accounting, long/short, margin, fees, partial/complete close, TP/SL and rejection tests passed.');
