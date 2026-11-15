import assert from 'node:assert/strict';
import {eventIsExecutable,marketEvent,priceOrigin} from './marketEvents';
const a={symbol:'BTCUSDT',exchange:'Binance',source:'Binance',marketType:'spot'} as any;
for(const k of ['ticker','snapshot','book'] as const)assert.equal(eventIsExecutable(marketEvent(a,k,100)),false);
assert.equal(eventIsExecutable(marketEvent(a,'trade',100,1)),true);
assert.equal(eventIsExecutable(marketEvent(a,'trade',0,1)),false);
assert.equal(priceOrigin('trade'),'stream');assert.equal(priceOrigin('ticker'),'ticker');
console.log('Provider price events never mistake ticker snapshots for prints.');
