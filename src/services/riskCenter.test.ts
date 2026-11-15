import assert from 'node:assert/strict';
import {DEFAULT_RISK_POLICY,evaluateRiskPolicy,paperRiskOverview,riskSizedQuantity} from './riskCenter';
import {emptyPaperPortfolio} from './paperTrading';
const account=emptyPaperPortfolio(),a={price:100,currency:'USD',category:'crypto',marketType:'spot'} as any;
const policy={...DEFAULT_RISK_POLICY,enabled:true,maxRiskPerTradePct:1};
assert.equal(riskSizedQuantity(10000,1,100,90),10);
assert.equal(riskSizedQuantity(10000,1,100,100),0);
const request={side:'Long' as const,kind:'market' as const,qty:10,sl:90};
assert.equal(evaluateRiskPolicy(account,a,request,policy).allowed,true);
assert.equal(evaluateRiskPolicy(account,a,{...request,qty:20},policy).allowed,false);
assert.equal(evaluateRiskPolicy(account,a,{...request,sl:undefined},policy).allowed,false);
assert.equal(evaluateRiskPolicy(account,a,request,{...policy,enabled:false,killSwitch:true}).allowed,false);
const latest=Date.now();
const withLoss={...account,fills:[{id:'x',positionId:'p',symbol:'BTCUSD',exchange:'Kraken',
 side:'Sell' as const,quantity:1,price:100,fee:0,realizedPnL:-650,timestamp:latest,note:'Close'}]};
assert.equal(paperRiskOverview(withLoss,latest).todayRealized,-650);
assert.match(evaluateRiskPolicy(withLoss,a,request,policy,latest).reason||'',/circuit breaker/);
console.log('Risk sizing, gross exposure and opt-in loss limits passed.');
