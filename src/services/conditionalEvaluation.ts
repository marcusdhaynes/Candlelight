import type {Asset} from '../types';
import type {PaperPortfolio} from './paperTrading';
import type {ConditionalOrder,SingleCondition} from '../types/conditionalOrders';
import {ruleCanActivate,ruleMatchesMarket} from './conditionalSafety';
import {matchesExactMarket} from './marketIdentity';

export function ruleConditionMet(cond:SingleCondition,market:Asset,previous:number|undefined,
  portfolio:PaperPortfolio,alertEvents:ReadonlySet<string>):boolean{
  const threshold=cond.thresholdValue;
  if(cond.dependencyType==='alert')
    return !!cond.dependencyId&&alertEvents.has(cond.dependencyId)&&cond.operator==='triggered';
  if(cond.dependencyType==='position'){
    const position=portfolio.positions.find(p=>matchesExactMarket(p,market));
    if(!position||!Number.isFinite(threshold))return false;
    if(cond.operator==='pnl_above_percent')return position.unrealizedPnLPct>=Math.abs(threshold!);
    if(cond.operator==='pnl_below_percent')return position.unrealizedPnLPct<=-Math.abs(threshold!);
    return false;
  }
  if(!['price','drawing'].includes(cond.dependencyType) ||
    !Number.isFinite(threshold)||!Number.isFinite(market.price)||threshold!<=0)return false;
  if(cond.operator==='crosses_above')return previous!==undefined&&previous<threshold!&&market.price>=threshold!;
  if(cond.operator==='crosses_below')return previous!==undefined&&previous>threshold!&&market.price<=threshold!;
  if(cond.operator==='greater_than')return market.price>threshold!;
  if(cond.operator==='less_than')return market.price<threshold!;
  if(cond.operator==='touches')return Math.abs(market.price-threshold!)/threshold!<=0.003;
  return false;
}
export function ruleConditionsMet(order:ConditionalOrder,market:Asset,previous:number|undefined,
  portfolio:PaperPortfolio,alertEvents:ReadonlySet<string>):boolean{
  if(!ruleCanActivate(order)||!ruleMatchesMarket(order,market))return false;
  const values=order.conditions.map(c=>ruleConditionMet(c,market,previous,portfolio,alertEvents));
  if(!values.length)return false;
  if(order.conditionLogic==='IF (AND)')return values.every(Boolean);
  if(order.conditionLogic==='IF (OR)')return values.some(Boolean);
  return values[0]===true;
}
export function ruleEligibleOnTick(order:ConditionalOrder,met:boolean,at:number):boolean{
  if(order.status!=='active'||!met||order.triggerCount>=order.maxTriggers)return false;
  if(order.conditionLogic==='WHENEVER'&&order.lastConditionSatisfied)return false;
  return at-(order.lastTriggeredAt||0)>20000;
}
