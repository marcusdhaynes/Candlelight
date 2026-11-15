import type {ConditionalOrder} from '../types/conditionalOrders';
import {withOrderReservations} from './paperOrders';
import {INITIAL_ASSETS} from '../data/assets';
import type {Asset} from '../types';
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
const nonnegative=(n:unknown)=>finite(n)&&Number(n)>=0;
const maybe=(n:unknown,test:(x:unknown)=>boolean)=>n===undefined||test(n);
const validMarketType=(v:unknown)=>v==='spot'||v==='swap'||v==='futures';
const validSide=(v:unknown)=>v==='Long'||v==='Short';
const validPortfolioPosition=(p:unknown):boolean=>{
  if(!object(p)||typeof p.id!=='string'||!p.id||typeof p.symbol!=='string'||!p.symbol||
    typeof p.exchange!=='string'||!p.exchange||!validMarketType(p.marketType)||
    !validSide(p.side)||!positive(p.qty)||!positive(p.entryPrice)||!positive(p.currentPrice)||
    !maybe(p.leverage,positive)||!maybe(p.openedAt,nonnegative)||!maybe(p.lastMarkedAt,nonnegative)||
    !maybe(p.unrealizedPnL,finite)||!maybe(p.unrealizedPnLPct,finite)||
    !maybe(p.tp,positive)||!maybe(p.sl,positive)||!maybe(p.trailingPercent,n=>positive(n)&&Number(n)<100)||
    !maybe(p.trailingAnchor,positive))return false;
  return p.tpLevels===undefined||(Array.isArray(p.tpLevels)&&p.tpLevels.every(
    (level:unknown)=>object(level)&&typeof level.id==='string'&&positive(level.price)&&positive(level.quantity)));
};
const validPendingOrder=(o:unknown):boolean=>object(o)&&typeof o.id==='string'&&!!o.id&&
  typeof o.symbol==='string'&&!!o.symbol&&typeof o.exchange==='string'&&!!o.exchange&&
  validMarketType(o.marketType)&&validSide(o.side)&&
  ['limit','stop','stop-limit'].includes(o.kind)&&
  positive(o.qty)&&positive(o.price)&&positive(o.leverage)&&
  maybe(o.limitPrice,positive)&&maybe(o.tp,positive)&&maybe(o.sl,positive)&&
  maybe(o.trailingStopPercent,v=>positive(v)&&Number(v)<100)&&
  nonnegative(o.createdAt)&&maybe(o.expiresAt,v=>nonnegative(v)&&Number(v)>Number(o.createdAt))&&
  (o.status==='pending'||o.status==='triggered')&&
  (o.takeProfitLevels===undefined||(Array.isArray(o.takeProfitLevels)&&o.takeProfitLevels.every(
    (target:unknown)=>object(target)&&positive(target.price)&&positive(target.sharePercent)&&target.sharePercent<=100)));
/** Only bind legacy positions to a unique explicit catalog instrument. */
export function migrateLegacyPositionMarkets(state:unknown,markets:Asset[]=INITIAL_ASSETS):PaperAccountsState|null{
  if(!object(state)||!Array.isArray(state.accounts))return null;
  let needed=false;
  const accounts=state.accounts.map((record:unknown)=>{
    if(!object(record)||!object(record.portfolio)||!Array.isArray(record.portfolio.positions))return record;
    const positions=record.portfolio.positions.map((position:unknown)=>{
      if(!object(position)||position.marketType!==undefined)return position;
      const candidates=markets.filter(asset=>asset.symbol===position.symbol&&
        ((asset.source||asset.exchange)===position.exchange||asset.exchange===position.exchange));
      const identities=new Set(candidates.map(asset=>[
        asset.source||asset.exchange,asset.marketType,asset.chainId||'',asset.pairAddress||''
      ].join('|')));
      if(identities.size!==1)return position;
      const candidate=candidates[0];
      needed=true;
      return {...position,marketType:candidate.marketType,exchange:candidate.source||candidate.exchange};
    });
    return {...record,portfolio:{...record.portfolio,positions}};
  });
  return needed?{...state,accounts} as PaperAccountsState:null;
}
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
       !finite(portfolio.account.realizedPnL)||!finite(portfolio.account.equity)||
       !finite(portfolio.account.unrealizedPnL)||!nonnegative(portfolio.account.accountMargin)||
       !nonnegative(portfolio.account.ordersMargin)||!nonnegative(portfolio.account.availableFunds)||
       !finite(portfolio.account.marginBuffer))return false;
    try{validatePaperSettings(normalizePaperSettings(portfolio.settings));}
    catch{return false;}
    if(!portfolio.positions.every(validPortfolioPosition))return false;
    const positionIds=portfolio.positions.map((v:any)=>v.id);
    if(new Set(positionIds).size!==positionIds.length)return false;
    if(!portfolio.fills.every((fill:unknown)=>object(fill)&&
       typeof fill.id==='string'&&typeof fill.positionId==='string'&&
       typeof fill.note==='string'&&typeof fill.exchange==='string'&&
       positive(fill.price)&&positive(fill.quantity)&&nonnegative(fill.fee)&&
       finite(fill.realizedPnL)&&nonnegative(fill.timestamp)))return false;
    const fillIds=portfolio.fills.map((v:any)=>v.id);
    if(new Set(fillIds).size!==fillIds.length)return false;
    if(portfolio.pendingOrders!==undefined&&(!Array.isArray(portfolio.pendingOrders)||
       !portfolio.pendingOrders.every(validPendingOrder)))return false;
    if(portfolio.pendingOrders?.length){
      const pendingIds=portfolio.pendingOrders.map((o:any)=>o.id);
      if(new Set(pendingIds).size!==pendingIds.length)return false;
    }
    if(record.orders!==undefined&&(!Array.isArray(record.orders)||
       !record.orders.every((order:unknown)=>object(order)&&
         typeof order.id==='string'&&typeof order.symbol==='string'&&
         Array.isArray(order.conditions)&&order.conditions.every((c:unknown)=>object(c)&&
           typeof c.dependencyType==='string'&&typeof c.operator==='string')&&
         object(order.execution)&&positive(order.execution.size)&&
         ['active','paused','triggered'].includes(order.status)&&
         nonnegative(order.triggerCount)&&positive(order.maxTriggers)&&
         nonnegative(order.createdAt)&&maybe(order.lastTriggeredAt,nonnegative))))return false;
  }
  return typeof raw.activeId==='string'&&ids.has(raw.activeId);
}
function preserveLedger(original:string):boolean{
  try{
    const old=localStorage.getItem(PAPER_RECOVERY_BACKUP_KEY);
    if(!old)localStorage.setItem(PAPER_RECOVERY_BACKUP_KEY,original);
    else if(old!==original)localStorage.setItem(PAPER_RECOVERY_BACKUP_KEY+'-'+Date.now(),original);
    return localStorage.getItem(PAPER_RECOVERY_BACKUP_KEY)!==null;
  }catch(e){console.error('Unable to back up unreadable paper accounts',e);return false;}
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
export function loadPaperAccounts(markets:Asset[]=INITIAL_ASSETS):PaperAccountsState{
  try{
    const saved=localStorage.getItem(PAPER_ACCOUNTS_STORAGE_KEY);
    if(saved){
      let raw:unknown;
      try{raw=JSON.parse(saved);}catch{raw=null;}
      if(!isStoredPaperLedgerValid(raw)){
        const migrated=migrateLegacyPositionMarkets(raw,markets);
        if(migrated&&isStoredPaperLedgerValid(migrated) && preserveLedger(saved)){
          try{
            localStorage.setItem(PAPER_ACCOUNTS_STORAGE_KEY,JSON.stringify(migrated));
            raw=migrated;
          }catch(error){
            console.error('Legacy account migration could not be saved',error);
            return initialPaperAccounts();
          }
        }else{
          preserveLedger(saved);
          console.error('Unverifiable legacy positions or invalid paper data quarantined without deletion.');
          return initialPaperAccounts();
        }
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
