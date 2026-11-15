import type {PaperAccountsState} from './paperAccounts';
/** Prices/mark-to-market are frequently refreshed; settled cash, protection,
 * orders and rule executions must be made durable immediately. */
export function paperLedgerCriticalChanged(before:PaperAccountsState|null,after:PaperAccountsState):boolean{
  if(!before||before.activeId!==after.activeId||before.accounts.length!==after.accounts.length)return true;
  for(const current of after.accounts){
    const old=before.accounts.find(a=>a.id===current.id);
    if(!old)return true;
    const a=current.portfolio,b=old.portfolio;
    if(a.account.balance!==b.account.balance||a.account.realizedPnL!==b.account.realizedPnL||
      JSON.stringify(a.settings)!==JSON.stringify(b.settings)||
      a.fills.length!==b.fills.length||a.pendingOrders?.length!==b.pendingOrders?.length||
      a.orderEvents?.length!==b.orderEvents?.length||current.orders.length!==old.orders.length||
      a.positions.length!==b.positions.length)return true;
    for(let i=0;i<a.positions.length;i++){
      const p=a.positions[i],q=b.positions[i];
      if(!q||p.id!==q.id||p.qty!==q.qty||p.sl!==q.sl||p.tp!==q.tp||
        p.trailingPercent!==q.trailingPercent||p.trailingAnchor!==q.trailingAnchor||
        JSON.stringify(p.tpLevels)!==JSON.stringify(q.tpLevels))return true;
    }
    for(let i=0;i<current.orders.length;i++){
      const rule=current.orders[i],oldRule=old.orders[i];
      if(!oldRule||rule.id!==oldRule.id||rule.status!==oldRule.status||
        rule.triggerCount!==oldRule.triggerCount||rule.lastConditionSatisfied!==oldRule.lastConditionSatisfied||
        rule.lastTriggeredAt!==oldRule.lastTriggeredAt||
        JSON.stringify(rule.conditions)!==JSON.stringify(oldRule.conditions)||
        JSON.stringify(rule.execution)!==JSON.stringify(oldRule.execution))return true;
    }
    for(let i=0;i<(a.pendingOrders||[]).length;i++){
      const order=a.pendingOrders![i],previous=b.pendingOrders?.[i];
      if(!previous||order.id!==previous.id||order.status!==previous.status)return true;
    }
  }
  return false;
}
