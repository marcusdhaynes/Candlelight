import type {Asset} from '../types';
import type {ConditionalOrder,SingleCondition} from '../types/conditionalOrders';
/** Never execute an unbound legacy order on an identically named market. */
export const ruleMatchesMarket=(o:ConditionalOrder,a:Asset):boolean=>
  !!o.exchange && !!o.marketType && o.symbol===a.symbol &&
  o.exchange===(a.source||a.exchange) && o.marketType===a.marketType;
export function conditionSupported(c:SingleCondition):boolean {
  if(c.dependencyType==='alert')return c.operator==='triggered'&&!!c.dependencyId;
  if(c.dependencyType==='position')return ['pnl_above_percent','pnl_below_percent'].includes(c.operator)
    &&Number.isFinite(c.thresholdValue);
  if(c.dependencyType==='price'||c.dependencyType==='drawing')
    return ['crosses_above','crosses_below','touches','greater_than','less_than'].includes(c.operator)
      &&Number.isFinite(c.thresholdValue)&&Number(c.thresholdValue)>0;
  return false;
}
export const ruleCanActivate=(o:ConditionalOrder):boolean=>
  !!o.exchange&&!!o.marketType&&Array.isArray(o.conditions)&&o.conditions.length>0&&
  o.conditions.every(conditionSupported) &&
  Number.isFinite(o.execution?.size)&&o.execution.size>0;
