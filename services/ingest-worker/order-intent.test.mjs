import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchPlan,reconcileBrokerEvidence} from './order-intent.mjs';
const intent={clientCommandId:'account-1:request-100',state:'ready',
  quantity:10,filledQuantity:0};
const policy={brokerLookupByClientId:true,killSwitch:false,accountAuthorized:true,
  riskApproved:true,providerFresh:true,nativeClientIdSupported:true};
test('only authorized, risk-checked ready orders may be sent once',()=>{
 assert.equal(dispatchPlan(intent,policy).action,'dispatch_once');
 for(const key of ['accountAuthorized','riskApproved','providerFresh','nativeClientIdSupported']){
   assert.equal(dispatchPlan(intent,{...policy,[key]:false}).action,'block',key);
 }
 assert.equal(dispatchPlan(intent,{...policy,killSwitch:true}).action,'block');
 assert.equal(dispatchPlan({...intent,state:'staged'},policy).action,'block');
});
test('timeout, uncertainty and partial fills never trigger blind resubmission',()=>{
 for(const state of ['uncertain','dispatching','acknowledged','partially_filled'])
   assert.equal(dispatchPlan({...intent,state},policy).action,'reconcile');
 assert.equal(dispatchPlan({...intent,state:'uncertain'},{...policy,brokerLookupByClientId:false}).action,'block');
 for(const state of ['filled','cancelled','failed','risk_rejected'])
   assert.equal(dispatchPlan({...intent,state},policy).action,'none');
});
test('only matched broker evidence advances cumulative fills',()=>{
 const pending={...intent,state:'uncertain',brokerOrderId:null};
 const first={verified:true,eventId:'evt-1',clientCommandId:intent.clientCommandId,
   brokerOrderId:'broker-1',cumulativeFilled:3,status:'partial'};
 const a=reconcileBrokerEvidence(pending,first);
 assert.equal(a.intent.state,'partially_filled');
 assert.equal(a.intent.filledQuantity,'3');
 assert.equal(reconcileBrokerEvidence(a.intent,first).changed,false);
 const filled={...first,eventId:'evt-2',cumulativeFilled:'10',status:'filled'};
 const b=reconcileBrokerEvidence(a.intent,filled);
 assert.equal(b.intent.state,'filled');
 assert.equal(reconcileBrokerEvidence(b.intent,{...filled,eventId:'evt-3'}).changed,false);
 for(const bad of [
   {...first,eventId:'evt-x',clientCommandId:'another-user:request'},
   {...first,eventId:'evt-x',verified:false},
   {...first,eventId:'evt-x',cumulativeFilled:11},
   {...first,eventId:'evt-x',cumulativeFilled:-1},
   {...first,eventId:'evt-x',cumulativeFilled:1},
   {...first,eventId:'evt-x',status:'filled',cumulativeFilled:3},
   {...first,eventId:'evt-x',brokerOrderId:''},
   {...first,eventId:'evt-x',status:'open',cumulativeFilled:3}
 ])assert.throws(()=>reconcileBrokerEvidence(a.intent,bad));
});

test('large and fractional quantities are compared exactly, never by IEEE floating point',()=>{
 const pending={...intent,state:'uncertain',quantity:'9007199254740992.0000000000000001',
   filledQuantity:'0',brokerOrderId:null};
 const event={verified:true,eventId:'evt-big-1',clientCommandId:intent.clientCommandId,
   brokerOrderId:'broker-big',cumulativeFilled:'0.0000000000000001',status:'partial'};
 const a=reconcileBrokerEvidence(pending,event);
 assert.equal(a.intent.filledQuantity,'0.0000000000000001');
 assert.throws(()=>reconcileBrokerEvidence(a.intent,{...event,eventId:'evt-big-2',
   cumulativeFilled:'0.0000000000000000'}),/regressing/);
});
