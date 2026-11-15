import assert from 'node:assert/strict';
import {PAPER_ACCOUNTS_STORAGE_KEY,PAPER_RECOVERY_BACKUP_KEY,initialPaperAccounts,
 isStoredPaperLedgerValid,loadPaperAccounts,savePaperAccounts,isPaperStorageBlocked} from './paperAccounts';
const store=new Map<string,string>();
(globalThis as any).localStorage={
 getItem:(key:string)=>store.get(key)??null,
 setItem:(key:string,value:string)=>{store.set(key,String(value));},
 removeItem:(key:string)=>{store.delete(key);},
};
const valid=initialPaperAccounts();
assert.equal(isStoredPaperLedgerValid(valid),true);
savePaperAccounts(valid);
assert.equal(loadPaperAccounts().accounts.length,1);
const corrupt={...valid,accounts:valid.accounts.map(r=>({...r,portfolio:{
 ...r.portfolio,settings:{...r.portfolio.settings,startingBalance:-200}}}))};
const bad=JSON.stringify(corrupt);
store.set(PAPER_ACCOUNTS_STORAGE_KEY,bad);
assert.equal(isPaperStorageBlocked(),true);
assert.equal(loadPaperAccounts().accounts.length,1);
assert.equal(store.get(PAPER_RECOVERY_BACKUP_KEY),bad);
assert.throws(()=>savePaperAccounts(valid),/unreadable/);
assert.equal(store.get(PAPER_ACCOUNTS_STORAGE_KEY),bad);
store.set(PAPER_ACCOUNTS_STORAGE_KEY,'{not json');
assert.equal(isPaperStorageBlocked(),true);
assert.doesNotThrow(()=>loadPaperAccounts());
assert.throws(()=>savePaperAccounts(valid),/unreadable/);
store.delete(PAPER_ACCOUNTS_STORAGE_KEY);
savePaperAccounts(valid);
assert.equal(isPaperStorageBlocked(),false);
console.log('Paper ledger quarantine and overwrite prevention tests passed.');
