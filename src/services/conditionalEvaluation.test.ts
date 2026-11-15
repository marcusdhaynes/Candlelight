import assert from 'node:assert/strict';
import type {Asset} from '../types';
import type {ConditionalOrder} from '../types/conditionalOrders';
import {emptyPaperPortfolio,placePaperPosition,markPaperPositions} from './paperTrading';
import {ruleConditionsMet,ruleEligibleOnTick} from './conditionalEvaluation';
const now=1_700_000_000_000;
const a={symbol:'BTCUSD',source:'Kraken',exchange:'Kraken',marketType:'spot',
 category:'crypto',currency:'USD',price:101,quoteStatus:'live',quoteUpdatedAt:now} as Asset;
const rule:ConditionalOrder={id:'r',symbol:'BTCUSD',exchange:'Kraken',marketType:'spot',
 title:'test',conditions:[{id:'c',dependencyType:'price',dependencyLabel:'level',
 operator:'crosses_above',thresholdValue:100}],conditionLogic:'IF',action:'enter_long',
 execution:{orderType:'market',size:1,sizeUnit:'units'},
 status:'active',createdAt:now-100000,triggerCount:0,maxTriggers:1};
const p=emptyPaperPortfolio();
assert.equal(ruleConditionsMet(rule,a,99,p,new Set()),true);
assert.equal(ruleConditionsMet(rule,a,101,p,new Set()),false);
assert.equal(ruleConditionsMet(rule,{...a,marketType:'swap'},99,p,new Set()),false);
assert.equal(ruleConditionsMet(rule,{...a,source:'Coinbase'},99,p,new Set()),false);
const alert={...rule,conditionLogic:'WHENEVER' as const,conditions:[{id:'event',
 dependencyType:'alert' as const,dependencyId:'alert-1',dependencyLabel:'alert',
 operator:'triggered' as const}]};
assert.equal(ruleConditionsMet(alert,a,99,p,new Set()),false);
assert.equal(ruleConditionsMet(alert,a,99,p,new Set(['alert-1'])),true);
assert.equal(ruleEligibleOnTick(alert,true,now),true);
assert.equal(ruleEligibleOnTick({...alert,lastConditionSatisfied:true},true,now+20001),false);
assert.equal(ruleEligibleOnTick({...alert,triggerCount:1,maxTriggers:1},true,now),false);
const marketBefore={...a,price:100};
const placed=placePaperPosition(p,marketBefore,'Long',1,1,undefined,undefined,now);
const marked=markPaperPositions(placed,{...a,price:94,quoteUpdatedAt:now+100},now+100);
const loss={...rule,conditions:[{...rule.conditions[0],dependencyType:'position' as const,
 operator:'pnl_below_percent' as const,thresholdValue:-5}]};
assert.equal(ruleConditionsMet(loss,{...a,price:94},100,marked,new Set()),true);
assert.equal(ruleConditionsMet({...loss,conditions:[{...loss.conditions[0],thresholdValue:5}]},{...a,price:94},100,marked,new Set()),true);
const indicatorRule={...rule,conditions:[{...rule.conditions[0],dependencyType:'indicator' as const,
 dependencyId:'rsi14',operator:'crosses_above' as const,thresholdValue:70}]};
const sample={candleTime:120,current:{rsi14:72},previous:{rsi14:68}};
assert.equal(ruleConditionsMet(indicatorRule,a,99,p,new Set()),false);
assert.equal(ruleConditionsMet(indicatorRule,a,99,p,new Set(),[],undefined,sample),true);
assert.equal(ruleConditionsMet(indicatorRule,a,99,p,new Set(),[],undefined,
 {candleTime:180,current:{rsi14:75},previous:{rsi14:72}}),false);
console.log('Market-bound conditional triggers, one-shot alerts, and finalized RSI conditions passed.');
