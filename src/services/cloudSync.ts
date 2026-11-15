import type {JournalTrade} from '../types';
import {validJournalData} from './journalStorage';
import {validWatchlists,WATCHLIST_KEY,WATCHLIST_LEGACY_KEY} from './watchlistStorage';
import {TIMEFRAME_SECONDS} from './dataFeed';

// Public Supabase publishable key: intentionally browser-safe. Never place
// secret/service_role credentials in this application.
export const CLOUD_PROJECT_URL='https://tbrqqjrzknhdnwcpkqro.supabase.co';
export const CLOUD_PUBLISHABLE_KEY="sb_publishable_BlALANbrrBPf_0IHiuL7HQ_55P6XiTS";
export const CLOUD_ENDPOINT=CLOUD_PROJECT_URL+'/functions/v1/candlelight-sync';
export type CloudKey='layouts'|'watchlists'|'journal';
export const CLOUD_DOCUMENTS:readonly CloudKey[]=['layouts','watchlists','journal'];
export type CloudPayload={version:1;data:unknown[];exportedAt:string};
export type RemoteCloudDocument={
 exists:boolean;key:CloudKey;revision:number;payload?:CloudPayload;updatedAt?:string;
};
export type CloudSession={accessToken:string;email:string;expiresAt:number};
const localKeys:Record<CloudKey,string>={
 layouts:'tv_saved_chart_layouts',watchlists:WATCHLIST_KEY,
 journal:'tradingview_journal_trades'
};
const cloudHeaders=(token?:string):HeadersInit=>({
 apikey:CLOUD_PUBLISHABLE_KEY,'Content-Type':'application/json',
 ...(token?{Authorization:'Bearer '+token}:{})
});
export function validCloudRows(key:CloudKey,data:unknown):data is unknown[]{
 if(key==='journal')return validJournalData(data);
 if(key==='watchlists')return validWatchlists(data);
 if(key==='layouts'){
  return Array.isArray(data)&&data.length>0&&data.every((l:any)=>l&&
   typeof l.id==='string'&&typeof l.name==='string'&&typeof l.templateId==='string'&&
   Array.isArray(l.windows)&&l.windows.every((w:any)=>w&&typeof w.symbol==='string'&&
     Object.prototype.hasOwnProperty.call(TIMEFRAME_SECONDS,w.timeframe))&&
   l.syncSettings&&typeof l.syncSettings==='object'&&typeof l.autosave==='boolean');
 }
 return false;
}
export function readLocalCloudDocument(key:CloudKey):CloudPayload{
 let raw:string|null;
 if(key==='watchlists'){
   const legacy=localStorage.getItem(WATCHLIST_LEGACY_KEY);
   raw=legacy??localStorage.getItem(WATCHLIST_KEY);
 }else raw=localStorage.getItem(localKeys[key]);
 if(raw===null)throw Error('No saved local '+key+' data. Nothing has been uploaded.');
 let data:unknown;
 try{data=JSON.parse(raw);}catch{throw Error('Saved '+key+' data is unreadable; recover it locally before uploading.');}
 if(!validCloudRows(key,data))throw Error('Saved '+key+' data failed validation. Cloud upload blocked.');
 return {version:1,data,exportedAt:new Date().toISOString()};
}
export function restoreCloudDocument(key:CloudKey,payload:CloudPayload):string{
 if(!payload||payload.version!==1||!validCloudRows(key,payload.data))
   throw Error('Remote '+key+' does not match a valid Candlelight record.');
 // Back up the exact original local bytes before any replacement.
 const original=key==='watchlists'?{
  current:localStorage.getItem(WATCHLIST_KEY),
  legacy:localStorage.getItem(WATCHLIST_LEGACY_KEY)
 }:{current:localStorage.getItem(localKeys[key])};
 const backup='candlelight_cloud_pre_restore_'+key+'_'+Date.now();
 const backupData=JSON.stringify({key,savedAt:new Date().toISOString(),original});
 localStorage.setItem(backup,backupData);
 if(localStorage.getItem(backup)!==backupData)throw Error('Local backup was not written; cloud restore refused.');
 localStorage.setItem(localKeys[key],JSON.stringify(payload.data));
 if(key==='watchlists')localStorage.removeItem(WATCHLIST_LEGACY_KEY);
 return backup;
}
const responseJson=async(r:Response):Promise<any>=>{
 const data=await r.json().catch(()=>({error:'Invalid server response'}));
 if(!r.ok)throw Error(typeof data.error==='string'?data.error:'Cloud service returned HTTP '+r.status);
 return data;
};
export async function cloudSignIn(email:string,password:string):Promise<CloudSession>{
 if(!email.includes('@')||password.length<6)throw Error('Enter a valid email and account password.');
 const r=await fetch(CLOUD_PROJECT_URL+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:cloudHeaders(),body:JSON.stringify({email,password}),
  credentials:'omit',cache:'no-store'});
 const data=await responseJson(r);
 if(typeof data.access_token!=='string'||!Number.isFinite(data.expires_in))
  throw Error('Supabase did not return a verified sign-in session.');
 return {accessToken:data.access_token,email:String(data.user?.email||email),
  expiresAt:Date.now()+data.expires_in*1000};
}
export async function cloudSignUp(email:string,password:string):Promise<void>{
 if(!email.includes('@')||password.length<6)throw Error('Use a valid email and password of at least six characters.');
 const r=await fetch(CLOUD_PROJECT_URL+'/auth/v1/signup',{
  method:'POST',headers:cloudHeaders(),body:JSON.stringify({email,password}),
  credentials:'omit',cache:'no-store'});
 await responseJson(r);
}
export async function cloudGet(token:string,key:CloudKey):Promise<RemoteCloudDocument>{
 const r=await fetch(CLOUD_ENDPOINT+'?key='+encodeURIComponent(key),{
  method:'GET',headers:cloudHeaders(token),credentials:'omit',cache:'no-store'});
 const data=await responseJson(r);
 if(!Number.isSafeInteger(data.revision)||data.revision<0||data.key!==key||
    typeof data.exists!=='boolean')throw Error('Invalid cloud revision response.');
 if(data.exists&&!validCloudRows(key,data.payload?.data))
   throw Error('Remote cloud document failed integrity checks.');
 return data as RemoteCloudDocument;
}
export async function cloudPut(token:string,key:CloudKey,expectedRevision:number,
 payload:CloudPayload):Promise<number>{
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
  !validCloudRows(key,payload.data))throw Error('Invalid cloud upload request.');
 const r=await fetch(CLOUD_ENDPOINT,{
  method:'PUT',headers:cloudHeaders(token),credentials:'omit',cache:'no-store',
  body:JSON.stringify({key,expectedRevision,payload})});
 const result=await responseJson(r);
 if(!result.saved||!Number.isSafeInteger(result.revision)||result.revision<=expectedRevision)
  throw Error('Server did not confirm a valid newer cloud revision.');
 return result.revision;
}
