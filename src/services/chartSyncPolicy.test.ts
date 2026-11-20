import assert from 'node:assert/strict';
import {normalizeSyncWindow,windowsEquivalent} from './chartSyncPolicy';
assert.deepEqual(normalizeSyncWindow({from:100,to:200}),{from:100,to:200});
assert.deepEqual(normalizeSyncWindow({from:-3.5,to:10.5}),{from:-3.5,to:10.5});
for(const x of [null,{},[],{from:200,to:100},{from:100,to:100},
  {from:NaN,to:10},{from:Infinity,to:20},{from:'100',to:200}]){
 assert.equal(normalizeSyncWindow(x),null);
}
assert.equal(windowsEquivalent({from:100,to:200},{from:100,to:200}),true);
assert.equal(windowsEquivalent({from:100,to:200},{from:100,to:201}),false);
assert.equal(windowsEquivalent(null,null),true);
assert.equal(windowsEquivalent(null,{from:100,to:200}),false);
console.log('Round 11 synchronized viewport range validation passed.');
