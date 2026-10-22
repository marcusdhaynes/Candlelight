import assert from 'node:assert/strict';
import type {Asset} from '../types';
import {
  emptyPaperPortfolio,placePaperPosition,closePaperPosition,markPaperPositions,
  recalculatePaperPortfolio,isFreshPaperQuote,paperCommission,enableTrailingPaperStop,disableTrailingPaperStop,updatePaperStops,
  configurePaperPortfolio,accountLeverage,normalizePaperSettings,DEFAULT_PAPER_SETTINGS,
} from './paperTrading';
import {createPaperAccountRecord,initialPaperAccounts,updateActivePaperAccount} from './paperAccounts';

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
assert.equal(empty.settings.commission.enabled,false);
assert.equal(paperCommission(empty.settings,asset,2,100),0);
assert.equal(accountLeverage(empty.settings,asset),1);
const opened=placePaperPosition(empty,asset,'Long',2,1,undefined,undefined,now);
assert.equal(opened.positions.length,1);
closeTo(opened.account.balance,10000);
closeTo(opened.account.accountMargin,200);
closeTo(opened.account.availableFunds,opened.account.equity-200);
const marked=markPaperPositions(opened,{...asset,price:110,quoteUpdatedAt:now+1000},now+1000);
closeTo(marked.positions[0].unrealizedPnL,20);
closeTo(marked.account.equity,marked.account.balance+20);
const partial=closePaperPosition(marked,marked.positions[0].id,110,1,now+1001);
closeTo(partial.positions[0].qty,1);
closeTo(partial.account.realizedPnL,10);
const closed=closePaperPosition(partial,partial.positions[0].id,110,undefined,now+1002);
assert.equal(closed.positions.length,0);
closeTo(closed.account.equity,closed.account.balance);
closeTo(closed.account.accountMargin,0);
closeTo(closed.account.realizedPnL,closed.account.balance-10000);
const short=placePaperPosition(empty,asset,'Short',1,1,undefined,undefined,now);
const shortMarked=markPaperPositions(short,{...asset,price:80,quoteUpdatedAt:now+2000},now+2000);
closeTo(shortMarked.positions[0].unrealizedPnL,20);
const shortClosed=closePaperPosition(shortMarked,shortMarked.positions[0].id,80,undefined,now+2000);
closeTo(shortClosed.account.balance,10020);
const tp=placePaperPosition(empty,asset,'Long',1,1,105,95,now);
assert.equal(markPaperPositions(tp,{...asset,price:105,quoteUpdatedAt:now+2000},now+2000).positions.length,0);
const sl=placePaperPosition(empty,asset,'Short',1,1,90,105,now);
assert.equal(markPaperPositions(sl,{...asset,price:105,quoteUpdatedAt:now+2000},now+2000).positions.length,0);
assert.throws(()=>placePaperPosition(empty,asset,'Long',200,1,undefined,undefined,now),/Insufficient/);
assert.throws(()=>placePaperPosition(empty,{...asset,currency:'USDT'},'Long',1,1,undefined,undefined,now),/USD-quoted|requires a USD-quoted/);
assert.throws(()=>placePaperPosition(empty,{...asset,quoteUpdatedAt:now-60000},'Long',1,1,undefined,undefined,now),/verified/);
assert.equal(isFreshPaperQuote({...asset,price:0},now),false);
assert.equal(recalculatePaperPortfolio(closed).account.availableFunds,closed.account.balance);

const levSettings=normalizePaperSettings({marginControl:true,
  leverages:{...DEFAULT_PAPER_SETTINGS.leverages,crypto:5}});
const lev=emptyPaperPortfolio(levSettings,'Leverage');
const levOpen=placePaperPosition(lev,asset,'Long',2,5,undefined,undefined,now);
closeTo(levOpen.account.accountMargin,40);
assert.throws(()=>placePaperPosition(lev,asset,'Long',1,1,undefined,undefined,now),/Leverage must match/);
const fixed=normalizePaperSettings({commission:{enabled:true,mode:'fixed',amount:3}});
const fixedPortfolio=placePaperPosition(emptyPaperPortfolio(fixed),asset,'Long',2,1,undefined,undefined,now);
closeTo(fixedPortfolio.account.balance,9997);
const fixedClosed=closePaperPosition(fixedPortfolio,fixedPortfolio.positions[0].id,110,undefined,now+1000);
closeTo(fixedClosed.account.balance,10014);
const percent=normalizePaperSettings({commission:{enabled:true,mode:'percent',amount:0.04}});
const percentPortfolio=placePaperPosition(emptyPaperPortfolio(percent),asset,'Long',2,1,undefined,undefined,now);
closeTo(percentPortfolio.fills[0].fee,0.08);
const percentClosed=closePaperPosition(percentPortfolio,percentPortfolio.positions[0].id,110,undefined,now+1000);
closeTo(percentClosed.fills[0].fee,0.088);
const future={...asset,category:'futures' as const,marketType:'futures' as const};
const futureSettings=normalizePaperSettings({futuresOptions:{enabled:true,perContract:1.5}});
closeTo(paperCommission(futureSettings,future,4,100),6);
const futureOpen=placePaperPosition(emptyPaperPortfolio(futureSettings),future,'Long',2,1,undefined,undefined,now);
closeTo(futureOpen.fills[0].fee,3);
assert.equal(configurePaperPortfolio(empty,normalizePaperSettings({startingBalance:12000}),'Second').account.balance,12000);
assert.throws(()=>configurePaperPortfolio(opened,normalizePaperSettings({startingBalance:9000}),'Name'),/Starting balance/);
const usdt=emptyPaperPortfolio(normalizePaperSettings({currency:'USDT'}));
assert.equal(placePaperPosition(usdt,{...asset,currency:'USDT'},'Long',1,1,undefined,undefined,now).positions.length,1);
const multiple=initialPaperAccounts();
const extra=createPaperAccountRecord('Additional');
const accounts={...multiple,accounts:[...multiple.accounts,extra]};
const updated=updateActivePaperAccount(accounts,record=>({...record,portfolio:fixedPortfolio}));
assert.equal(updated.accounts[0].portfolio.fills.length,1);
assert.equal(updated.accounts[1].portfolio.fills.length,0);
const trailingBase=placePaperPosition(empty,asset,'Long',2,1,undefined,undefined,now);
const trail=enableTrailingPaperStop(trailingBase,trailingBase.positions[0].id,5);
closeTo(trail.positions[0].sl!,95);
const advancing=markPaperPositions(trail,{...asset,price:110,quoteUpdatedAt:now+1000},now+1000);
closeTo(advancing.positions[0].sl!,104.5);
const retreating=markPaperPositions(advancing,{...asset,price:106,quoteUpdatedAt:now+2000},now+2000);
closeTo(retreating.positions[0].sl!,104.5);
const trailingClosed=markPaperPositions(retreating,{...asset,price:104,quoteUpdatedAt:now+3000},now+3000);
assert.equal(trailingClosed.positions.length,0);
assert.throws(()=>enableTrailingPaperStop(trailingBase,trailingBase.positions[0].id,0),/Trailing stop/);
const disabledTrail=disableTrailingPaperStop(advancing,advancing.positions[0].id);
assert.equal(disabledTrail.positions[0].trailingPercent,undefined);
closeTo(disabledTrail.positions[0].sl!,104.5); // locked stop remains
const followingDisable=markPaperPositions(disabledTrail,{...asset,price:120,quoteUpdatedAt:now+2000},now+2000);
closeTo(followingDisable.positions[0].sl!,104.5); // no more trailing
const noLoosening=updatePaperStops(advancing,advancing.positions[0].id,undefined,90);
closeTo(noLoosening.positions[0].sl!,104.5);
assert.throws(()=>disableTrailingPaperStop(empty,'fake'),/Position unavailable/);
console.log('Paper accounts: free default, fixed/%/per-contract fees, leverage, P&L, stops, migration model and independent ledgers passed.');
