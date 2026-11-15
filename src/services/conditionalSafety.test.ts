import assert from 'node:assert/strict';
import type {Asset} from '../types';
import type {ConditionalOrder} from '../types/conditionalOrders';
import {ruleCanActivate,ruleMatchesMarket,conditionSupported} from './conditionalSafety';
const asset={symbol:'BTCUSD',source:'Kraken',exchange:'Kraken',marketType:'spot'} as Asset;
const rule:ConditionalOrder={id:'r',symbol:'BTCUSD',exchange:'Kraken',marketType:'spot',title:'test',
 conditionLogic:'IF',conditions:[{id:'1',dependencyType:'price',dependencyLabel:'BTC',operator:'crosses_above',thresholdValue:100}],
 action:'enter_long',execution:{orderType:'market',size:1,sizeUnit:'units'},
 status:'active',createdAt:1,triggerCount:0,maxTriggers:1};
assert.equal(ruleCanActivate(rule),true);
assert.equal(ruleMatchesMarket(rule,asset),true);
assert.equal(ruleMatchesMarket({...rule,exchange:'Coinbase'},asset),false);
assert.equal(ruleMatchesMarket({...rule,marketType:'swap'},asset),false);
assert.equal(ruleMatchesMarket({...rule,exchange:undefined},asset),false);
assert.equal(ruleCanActivate({...rule,exchange:undefined}),false);
assert.equal(conditionSupported({...rule.conditions[0],dependencyType:'indicator'}),false);
assert.equal(conditionSupported({...rule.conditions[0],dependencyType:'orderbook'}),false);
assert.equal(ruleCanActivate({...rule,conditions:[{...rule.conditions[0],dependencyType:'volume'}]}),false);
assert.equal(conditionSupported({...rule.conditions[0],thresholdValue:NaN}),false);
console.log('Conditional venue isolation and unsupported dependency tests passed.');
