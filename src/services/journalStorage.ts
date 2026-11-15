import type {JournalTrade} from '../types';
export const JOURNAL_KEY='tradingview_journal_trades';
export const JOURNAL_BACKUP_KEY='candlelight_journal_recovery_backup_v1';
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validJournalData(value:unknown):value is JournalTrade[]{
  if(!Array.isArray(value))return false;
  const ids=new Set<string>();
  for(const t of value){
    if(!record(t)||typeof t.id!=='string'||!t.id||ids.has(t.id)||
      typeof t.symbol!=='string'||!t.symbol||
      !['LONG','SHORT'].includes(t.side)||!['OPEN','WIN','LOSS','BE'].includes(t.status)||
      typeof t.openDate!=='string'||!Number.isFinite(Date.parse(t.openDate.replace(' ','T')))||
      (t.closeDate!==undefined&&
        (typeof t.closeDate!=='string'||!Number.isFinite(Date.parse(t.closeDate.replace(' ','T')))))||
      !finite(t.netReturn)||!finite(t.netReturnPercent)||!finite(t.size)||t.size<=0||
      !finite(t.entryPrice)||t.entryPrice<=0||!finite(t.cost)||
      (t.exitPrice!==undefined&&(!finite(t.exitPrice)||t.exitPrice<=0))||
      !Array.isArray(t.setups)||!t.setups.every((label:unknown)=>typeof label==='string')||
      !Array.isArray(t.mistakes)||!t.mistakes.every((label:unknown)=>typeof label==='string'))
      return false;
    ids.add(t.id);
  }
  return true;
}
export function isJournalRecoveryBlocked():boolean{
  try{const raw=localStorage.getItem(JOURNAL_KEY);
    return raw!==null&&!validJournalData(JSON.parse(raw));
  }catch{return true;}
}
export function preserveJournalBackup(raw:string):boolean{
  try{
    const existing=localStorage.getItem(JOURNAL_BACKUP_KEY);
    if(existing!==raw){
      if(existing!==null)localStorage.setItem(JOURNAL_BACKUP_KEY+'-archive-'+Date.now()+'-'+Math.random().toString(36).slice(2),existing);
      localStorage.setItem(JOURNAL_BACKUP_KEY,raw);
    }
    return localStorage.getItem(JOURNAL_BACKUP_KEY)===raw;
  }catch{return false;}
}
export function loadJournalTrades():JournalTrade[]{
  try{
    const raw=localStorage.getItem(JOURNAL_KEY);
    if(raw===null)return [];
    const restored=JSON.parse(raw);
    if(validJournalData(restored))return restored;
    preserveJournalBackup(raw);
    return [];
  }catch{
    try{const raw=localStorage.getItem(JOURNAL_KEY);
      if(raw)preserveJournalBackup(raw);
    }catch{}
    return [];
  }
}
export function persistJournalTrades(trades:JournalTrade[]):void{
  if(!validJournalData(trades))throw new Error('Journal entry failed validation.');
  const prior=localStorage.getItem(JOURNAL_KEY);
  if(prior!==null){
    let valid=false;try{valid=validJournalData(JSON.parse(prior));}catch{}
    if(!valid){preserveJournalBackup(prior);
      throw new Error('Unrecognized journal data preserved: export backup before explicitly resetting.');}
  }
  localStorage.setItem(JOURNAL_KEY,JSON.stringify(trades));
}
