import type {ConditionalOrder} from '../types/conditionalOrders';
import {
  emptyPaperPortfolio,normalizePaperSettings,validatePaperSettings,
  recalculatePaperPortfolio,type PaperPortfolio,type PaperSettings,
} from './paperTrading';

export interface PaperAccountRecord {
  id:string;portfolio:PaperPortfolio;orders:ConditionalOrder[];
}
export interface PaperAccountsState {activeId:string;accounts:PaperAccountRecord[]}
export const PAPER_ACCOUNTS_STORAGE_KEY='candlelight_paper_accounts_v3';

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
      const raw=JSON.parse(saved) as PaperAccountsState;
      if(Array.isArray(raw.accounts)&&raw.accounts.length){
        const accounts=raw.accounts.filter((entry):entry is PaperAccountRecord =>
          !!entry && typeof entry.id==='string' && !!entry.portfolio?.account &&
          Array.isArray(entry.portfolio.positions)&&Array.isArray(entry.portfolio.fills))
          .map(entry=>{
            const settings=normalizePaperSettings(entry.portfolio.settings);
            validatePaperSettings(settings);
            return {...entry,portfolio:recalculatePaperPortfolio({...entry.portfolio,settings}),
              orders:Array.isArray(entry.orders)?entry.orders:[]};
          });
        if(accounts.length)return {accounts,activeId:accounts.some(a=>a.id===raw.activeId)?
          raw.activeId:accounts[0].id};
      }
    }
    // Migrate genuine saved v2 trades, but do not inherit its forced 0.04% rate
    // or recreate prior demo positions from the legacy initial-assets constant.
    const old=localStorage.getItem('candlelight_paper_portfolio_v2');
    if(old){
      const p=JSON.parse(old) as PaperPortfolio;
      if(p?.account&&Array.isArray(p.positions)&&Array.isArray(p.fills)){
        const defaultRecord=createPaperAccountRecord(p.account.name||'Primary 001');
        defaultRecord.portfolio=recalculatePaperPortfolio({
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
  localStorage.setItem(PAPER_ACCOUNTS_STORAGE_KEY,JSON.stringify(state));
}
export function updateActivePaperAccount(
  state:PaperAccountsState,transform:(record:PaperAccountRecord)=>PaperAccountRecord
):PaperAccountsState{
  return {...state,accounts:state.accounts.map(r=>r.id===state.activeId?transform(r):r)};
}
