import type {Asset} from '../types';
import type {PaperOrderRequest} from './paperOrders';
import type {PaperPortfolio} from './paperTrading';
import {paperCommission,paperExecutionPrice} from './paperTrading';
export type RiskPolicy={
 enabled:boolean;killSwitch:boolean;
 maxRiskPerTradePct:number;maxGrossExposurePct:number;maxDailyLossPct:number;
};
export const RISK_POLICY_KEY='candlelight_risk_policy_v1';
export const DEFAULT_RISK_POLICY:RiskPolicy={
 enabled:false,killSwitch:false,maxRiskPerTradePct:1,
 maxGrossExposurePct:300,maxDailyLossPct:5
};
export const validRiskPolicy=(v:any):v is RiskPolicy=>
 !!v&&typeof v==='object'&&typeof v.enabled==='boolean'&&
 typeof v.killSwitch==='boolean'&&
 ['maxRiskPerTradePct','maxGrossExposurePct','maxDailyLossPct'].every(k=>
   typeof v[k]==='number'&&Number.isFinite(v[k])&&v[k]>0&&v[k]<=1000);
export function loadRiskPolicy():RiskPolicy{
 try{
   const raw=localStorage.getItem(RISK_POLICY_KEY);
   if(!raw)return {...DEFAULT_RISK_POLICY};
   const parsed:unknown=JSON.parse(raw);
   return validRiskPolicy(parsed)?parsed:{...DEFAULT_RISK_POLICY};
 }catch{return {...DEFAULT_RISK_POLICY};}
}
export function saveRiskPolicy(p:RiskPolicy){
 if(!validRiskPolicy(p))throw Error('Invalid risk policy');
 localStorage.setItem(RISK_POLICY_KEY,JSON.stringify(p));
}
export function paperRiskOverview(p:PaperPortfolio,now=Date.now()){
 const beginning=new Date(now);beginning.setHours(0,0,0,0);
 const todayRealized=p.fills.filter(f=>f.timestamp>=beginning.getTime()&&f.timestamp<=now)
   .reduce((sum,f)=>sum+f.realizedPnL,0);
 const gross=p.positions.reduce((sum,pos)=>sum+pos.qty*pos.currentPrice,0)+
   (p.pendingOrders||[]).reduce((sum,o)=>sum+o.qty*o.price,0);
 const net=p.positions.reduce((sum,pos)=>sum+
   (pos.side==='Long'?1:-1)*pos.qty*pos.currentPrice,0);
 const unprotected=p.positions.filter(pos=>pos.sl===undefined).length;
 const stoppedLoss=p.positions.filter(pos=>pos.sl!==undefined).reduce((sum,pos)=>
   sum+Math.max(0,(pos.side==='Long'?pos.entryPrice-pos.sl!:pos.sl!-pos.entryPrice)*pos.qty),0);
 return {grossNotional:gross,netNotional:net,unprotected,
   theoreticalStopRisk:stoppedLoss,todayRealized,
   grossExposurePct:p.account.equity>0?gross/p.account.equity*100:Infinity};
}
export function riskSizedQuantity(equity:number,riskPct:number,entry:number,stop:number):number{
 if(![equity,riskPct,entry,stop].every(Number.isFinite)||equity<=0||riskPct<=0||
   riskPct>100||entry<=0||stop<=0||entry===stop)return 0;
 return Number(((equity*riskPct/100)/Math.abs(entry-stop)).toPrecision(10));
}
export function evaluateRiskPolicy(p:PaperPortfolio,a:Asset,order:PaperOrderRequest,
 policy:RiskPolicy,now=Date.now()):{allowed:boolean;reason?:string;estimatedLoss?:number}{
 if(policy.killSwitch)return {allowed:false,reason:'Paper order entry is paused by the Risk Center kill switch.'};
 if(!policy.enabled)return {allowed:true};
 if(!validRiskPolicy(policy))return {allowed:false,reason:'Invalid active risk policy.'};
 const overview=paperRiskOverview(p,now),equity=p.account.equity;
 if(!Number.isFinite(equity)||equity<=0)return {allowed:false,reason:'Positive equity is required for risk-limited trading.'};
 const dailyBudget=equity*policy.maxDailyLossPct/100;
 if(overview.todayRealized<=-dailyBudget)
   return {allowed:false,reason:'Daily realized-loss circuit breaker is active.'};
 const grossOrderPrice=order.kind==='stop-limit'?order.limitPrice:
   order.kind==='market'?a.price:order.price;
 if(!Number.isFinite(grossOrderPrice)||!grossOrderPrice||grossOrderPrice<=0)
   return {allowed:false,reason:'Order has no valid reference price.'};
 const executionPrice=paperExecutionPrice(p.settings,grossOrderPrice,order.side,'entry');
 if(!Number.isFinite(order.sl)||!order.sl||order.sl<=0)
   return {allowed:false,reason:'An explicit protective stop is required while risk limits are enabled.'};
 if(order.side==='Long'?order.sl>=executionPrice:order.sl<=executionPrice)
   return {allowed:false,reason:'Stop must be protective relative to the modeled entry.'};
 const entryFee=paperCommission(p.settings,a,order.qty,executionPrice);
 const exitFee=paperCommission(p.settings,a,order.qty,order.sl);
 const estimatedLoss=Math.abs(executionPrice-order.sl)*order.qty+entryFee+exitFee;
 if(estimatedLoss>equity*policy.maxRiskPerTradePct/100)
   return {allowed:false,reason:'Planned loss and fees exceed per-trade risk limit.',estimatedLoss};
 if((overview.grossNotional+executionPrice*order.qty)>equity*policy.maxGrossExposurePct/100)
   return {allowed:false,reason:'Order would exceed the gross-exposure limit.',estimatedLoss};
 return {allowed:true,estimatedLoss};
}
