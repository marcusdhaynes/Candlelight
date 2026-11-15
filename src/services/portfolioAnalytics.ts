import type {PaperAccountRecord} from './paperAccounts';
import {paperRiskOverview} from './riskCenter';
export type AccountPortfolioRow={
 id:string;name:string;currency:string;cash:number;equity:number;available:number;
 realized:number;unrealized:number;grossNotional:number;netNotional:number;
 stopScenarioRisk:number;unprotected:number;positions:number;pending:number;
 settledFees:number;closedFills:number;
};
export type PortfolioCurrencyGroup={
 currency:string;accounts:number;cash:number;equity:number;available:number;
 realized:number;unrealized:number;grossNotional:number;
 stopScenarioRisk:number;unprotected:number;positions:number;pending:number;fees:number;
};
/** Different quote currencies must never be silently added together. */
export function summarizePaperAccounts(records:readonly PaperAccountRecord[]):{
 accounts:AccountPortfolioRow[];byCurrency:PortfolioCurrencyGroup[];
}{
 const accounts=records.map(record=>{
  const p=record.portfolio,a=p.account,overview=paperRiskOverview(p);
  return {id:record.id,name:a.name,currency:p.settings.currency,
   cash:a.balance,equity:a.equity,available:a.availableFunds,
   realized:a.realizedPnL,unrealized:a.unrealizedPnL,
   grossNotional:overview.grossNotional,netNotional:overview.netNotional,
   stopScenarioRisk:overview.theoreticalStopRisk,unprotected:overview.unprotected,
   positions:p.positions.length,pending:p.pendingOrders?.length||0,
   settledFees:p.fills.reduce((sum,f)=>sum+f.fee,0),
   closedFills:p.fills.filter(f=>f.note.toLowerCase().includes('close')).length};
 });
 const groups=new Map<string,PortfolioCurrencyGroup>();
 for(const row of accounts){
  let group=groups.get(row.currency);
  if(!group){
   group={currency:row.currency,accounts:0,cash:0,equity:0,available:0,
    realized:0,unrealized:0,grossNotional:0,stopScenarioRisk:0,
    unprotected:0,positions:0,pending:0,fees:0};
   groups.set(row.currency,group);
  }
  group.accounts++;
  group.cash+=row.cash;group.equity+=row.equity;group.available+=row.available;
  group.realized+=row.realized;group.unrealized+=row.unrealized;
  group.grossNotional+=row.grossNotional;group.stopScenarioRisk+=row.stopScenarioRisk;
  group.unprotected+=row.unprotected;group.positions+=row.positions;
  group.pending+=row.pending;group.fees+=row.settledFees;
 }
 return {accounts,byCurrency:[...groups.values()].sort((a,b)=>a.currency.localeCompare(b.currency))};
}
