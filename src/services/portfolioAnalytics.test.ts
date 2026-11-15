import assert from 'node:assert/strict';
import {initialPaperAccounts,createPaperAccountRecord} from './paperAccounts';
import {summarizePaperAccounts} from './portfolioAnalytics';
import {normalizePaperSettings,emptyPaperPortfolio} from './paperTrading';
const base=initialPaperAccounts(),usd=base.accounts[0];
const usdt={...createPaperAccountRecord('USDT Desk'),portfolio:emptyPaperPortfolio(
 normalizePaperSettings({currency:'USDT',startingBalance:5000}),'USDT Desk')};
const both=summarizePaperAccounts([usd,usdt]);
assert.equal(both.accounts.length,2);
assert.equal(both.byCurrency.length,2);
assert.equal(both.byCurrency.find(g=>g.currency==='USD')!.equity,10000);
assert.equal(both.byCurrency.find(g=>g.currency==='USDT')!.equity,5000);
assert.equal(both.byCurrency.find(g=>g.currency==='USDT')!.accounts,1);
assert.equal(summarizePaperAccounts([usd,usd]).byCurrency[0].equity,20000);
console.log('Portfolio analytics group only matching account quote currencies.');
