import type {ConditionalOrder} from '../types/conditionalOrders';
import {withOrderReservations} from './paperOrders';
import {ruleCanActivate} from './conditionalSafety';
import {
  emptyPaperPortfolio,normalizePaperSettings,validatePaperSettings,
  type PaperPortfolio,type PaperSettings,
} from './paperTrading';

export interface PaperAccountRecord {
  id:string;portfolio:PaperPortfolio;orders:ConditionalOrder[];
}
export interface PaperAccountsState {activeId:string;accounts:PaperAccountRecord[]}
export const PAPER_ACCOUNTS_STORAGE_KEY='candlelight_paper_accounts_v3';
export const PAPER_RECOVERY_BACKUP_KEY='candlelight_paper_accounts_corrupt_backup_v1';
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const positive=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
/** Validate complete ledger atomically. Never discard only the damaged account. */
export function isStoredPaperLedgerValid(raw:unknown):raw is PaperAccountsState{
  if(!object(raw)||!Array.isArray(raw.accounts)||!raw.accounts.length)return false;
  const ids=new Set<string>();
  for(const record of raw.accounts){
    if(!object(record)||typeof record.id!=='string'||!record.id||ids.has(record.id)||
       !object(record.portfolio)||!object(record.portfolio.account)||
       !object(record.portfolio.settings)||!Array.isArray(record.portfolio.positions)||
       !Array.isArray(record.portfolio.fills))return false;
    ids.add(record.id);
    const portfolio=record.portfolio;
    if(typeof portfolio.account.name!=='string'||!finite(portfolio.account.balance)||
       !finite(portfolio.account.realizedPnL))return false;
    try{validatePaperSettings(normalizePaperSettings(portfolio.settings));}
    catch{return false;}
    if(!portfolio.positions.every((position:unknown)=>object(position)&&
       typeof position.id==='string'&&typeof position.symbol==='string'&&
       typeof position.exchange==='string'&&positive(position.qty)&&
       positive(position.entryPrice)&&positive(position.currentPrice)))return false;
    if(!portfolio.fills.every((fill:unknown)=>object(fill)&&
       typeof fill.id==='string'&&typeof fill.positionId==='string'&&
       typeof fill.note==='string'&&typeof fill.exchange==='string'&&
       positive(fill.price)&&positive(fill.quantity)&&finite(fill.fee)&&
       finite(fill.realizedPnL)&&finite(fill.timestamp)))return false;
    if(portfolio.pendingOrders!==undefined&&(!Array.isArray(portfolio.pendingOrders)||
       !portfolio.pendingOrders.every((order:unknown)=>object(order)&&
         typeof order.id==='string'&&typeof order.symbol==='string'&&
         typeof order.exchange==='string'&&positive(order.qty)&&positive(order.price))))return false;
    if(record.orders!==undefined&&(!Array.isArray(record.orders)||
       !record.orders.every((order:unknown)=>object(order)&&
         typeof order.id==='string'&&typeof order.symbol==='string'&&
         Array.isArray(order.conditions)&&order.conditions.every((c:unknown)=>object(c)&&
           typeof c.dependencyType==='string'&&typeof c.operator==='string')&&
         object(order.execution)&&finite(order.execution.size))))return false;
  }
  return typeof raw.activeId==='string'&&ids.has(raw.activeId);
}
function preserveLedger(original:string){
  try{
    const old=localStorage.getItem(PAPER_RECOVERY_BACKUP_KEY);
    if(!old)localStorage.setItem(PAPER_RECOVERY_BACKUP_KEY,original);
    else if(old!==original)localStorage.setItem(PAPER_RECOVERY_BACKUP_KEY+'-'+Date.now(),original);
  }catch(e){console.error('Unable to back up unreadable paper accounts',e);}
}
export function isPaperStorageBlocked():boolean{
  try{
    const value=localStorage.getItem(PAPER_ACCOUNTS_STORAGE_KEY);
    if(!value)return false;
    return !isStoredPaperLedgerValid(JSON.parse(value));
  }catch{return true;}
}

export function createPaperAccountRecord(name='Primary 001',settings?:PaperSettings):PaperAccountRecord{
  const id='paper-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  return {id,portfolio:emptyPaperPortfolio(settings,name),orders:[]};
}
export function initialPaperAccounts():PaperAccountsState{
  const first=createPaperAccountRecord();
  return {activeId:first.id,accounts:[first]};
}
export function loadPaperAccounts():PaperAccountsState{
  try{
    const saved=localStorage.getItem(PAPER_ACCOUNTS_STORAGE_KEY);
    if(saved){
      let raw:unknown;
      try{raw=JSON.parse(saved);}catch{raw=null;}
      if(!isStoredPaperLedgerValid(raw)){
        preserveLedger(saved);
        console.error('Unreadable paper ledger quarantined. No account has been silently removed.');
        return initialPaperAccounts();
      }
      const accounts=raw.accounts.map(entry=>{
        const settings=normalizePaperSettings(entry.portfolio.settings);
        return {...entry,portfolio:withOrderReservations({...entry.portfolio,settings}),
          orders:(entry.orders||[]).map(o=>!ruleCanActivate(o)?{...o,status:'paused' as const}:o)};
      });
      return {accounts,activeId:raw.activeId};
    }
    // Migrate genuine saved v2 trades, but do not inherit its forced 0.04% rate
    // or recreate prior demo positions from the legacy initial-assets constant.
    const old=localStorage.getItem('candlelight_paper_portfolio_v2');
    if(old){
      const p=JSON.parse(old) as PaperPortfolio;
      if(p?.account&&Array.isArray(p.positions)&&Array.isArray(p.fills)){
        const defaultRecord=createPaperAccountRecord(p.account.name||'Primary 001');
        defaultRecord.portfolio=withOrderReservations({
          ...p,settings:normalizePaperSettings({
            startingBalance:10000,currency:'USD',
            // Old positions had individual leverage; preserve their booked margin,
            // while new orders begin unleveraged without explicit margin controls.
          }),
        });
        return {accounts:[defaultRecord],activeId:defaultRecord.id};
      }
    }
  }catch(e){console.warn('Paper account storage unavailable or invalid; starting clean.',e);}
  return initialPaperAccounts();
}
export function savePaperAccounts(state:PaperAccountsState):void{
  if(!isStoredPaperLedgerValid(state))throw new Error('Refusing to save an invalid paper ledger.');
  const previous=localStorage.getItem(PAPER_ACCOUNTS_STORAGE_KEY);
  if(previous){
    let valid=false;
    try{valid=isStoredPaperLedgerValid(JSON.parse(previous));}catch{}
    if(!valid){
      preserveLedger(previous);
      throw new Error('Saved paper ledger is unreadable. Export recovery backup before explicitly starting fresh.');
    }
  }
  localStorage.setItem(PAPER_ACCOUNTS_STORAGE_KEY,JSON.stringify(state));
}
export function updateActivePaperAccount(
  state:PaperAccountsState,transform:(record:PaperAccountRecord)=>PaperAccountRecord
):PaperAccountsState{
  return {...state,accounts:state.accounts.map(r=>r.id===state.activeId?transform(r):r)};
}
