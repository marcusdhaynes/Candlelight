import type {Watchlist} from '../types';
export const WATCHLIST_LEGACY_KEY='tv_watchlists';
export const WATCHLIST_KEY='tv_watchlists_v4';
export const WATCHLIST_BACKUP_KEY='candlelight_watchlists_recovery_backup_v1';
export function validWatchlists(value:unknown):value is Watchlist[]{
  if(!Array.isArray(value)||value.length===0)return false;
  const ids=new Set<string>();
  for(const row of value){
    if(!row||typeof row!=='object'||Array.isArray(row))return false;
    const w=row as Watchlist;
    if(typeof w.id!=='string'||!w.id||ids.has(w.id)||typeof w.name!=='string'||
      !Array.isArray(w.symbols)||!w.symbols.every(sym=>typeof sym==='string'&&!!sym))return false;
    ids.add(w.id);
  }
  return true;
}
export function savedWatchlistRaw():string|null{
  return localStorage.getItem(WATCHLIST_LEGACY_KEY)??localStorage.getItem(WATCHLIST_KEY);
}
export function isWatchlistStorageBlocked():boolean{
  try{const raw=savedWatchlistRaw();
    return raw!==null&&!validWatchlists(JSON.parse(raw));
  }catch{return true;}
}
export function saveWatchlistBackup(raw:string):boolean{
  try{
    const existing=localStorage.getItem(WATCHLIST_BACKUP_KEY);
    if(existing!==raw){
      if(existing!==null)localStorage.setItem(WATCHLIST_BACKUP_KEY+'-archive-'+Date.now()+'-'+Math.random().toString(36).slice(2),existing);
      localStorage.setItem(WATCHLIST_BACKUP_KEY,raw);
    }
    return localStorage.getItem(WATCHLIST_BACKUP_KEY)===raw;
  }catch{return false;}
}
export function loadWatchlists(fallback:Watchlist[]):Watchlist[]{
  try{
    const raw=savedWatchlistRaw();
    if(raw===null)return fallback;
    const value=JSON.parse(raw);
    if(validWatchlists(value))return value;
    saveWatchlistBackup(raw);
  }catch{try{const raw=savedWatchlistRaw();if(raw)saveWatchlistBackup(raw);}catch{}}
  return fallback;
}
export function persistWatchlists(rows:Watchlist[]):void{
  if(!validWatchlists(rows))throw Error('Invalid watchlist collection.');
  if(isWatchlistStorageBlocked()){
    const raw=savedWatchlistRaw();
    if(raw)saveWatchlistBackup(raw);
    throw Error('Watchlists are quarantined. Export recovery backup and explicitly reset before changing them.');
  }
  localStorage.setItem(WATCHLIST_KEY,JSON.stringify(rows));
  localStorage.removeItem(WATCHLIST_LEGACY_KEY);
}
