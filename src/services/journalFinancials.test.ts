import assert from 'node:assert/strict';
import {calculateManualTradePnL} from './journalFinancials';
assert.deepEqual(calculateManualTradePnL(100,110,2,'LONG',5),
 {netReturn:15,netReturnPercent:7.5,status:'WIN'});
assert.deepEqual(calculateManualTradePnL(100,90,2,'SHORT',25),
 {netReturn:-5,netReturnPercent:-2.5,status:'LOSS'});
assert.equal(calculateManualTradePnL(100,undefined,2,'LONG',0).status,'OPEN');
assert.throws(()=>calculateManualTradePnL(100,101,2,'LONG',-5));
console.log('Journal manual gross-vs-net fee accounting passed.');
