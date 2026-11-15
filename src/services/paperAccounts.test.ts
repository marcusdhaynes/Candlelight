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
const sample={symbol:'ABCUSD',exchange:'Example',source:'Example',marketType:'spot',
 category:'crypto',currency:'USD',price:100} as any;
const legacyPosition={id:'p1',symbol:'ABCUSD',exchange:'Example',side:'Long',
 qty:1,entryPrice:100,currentPrice:100,leverage:1,unrealizedPnL:0,unrealizedPnLPct:0};
const legacyLedger={...valid,accounts:valid.accounts.map(record=>({...record,portfolio:{
 ...record.portfolio,positions:[legacyPosition]}}))};
assert.equal(isStoredPaperLedgerValid(legacyLedger),false);
store.set(PAPER_ACCOUNTS_STORAGE_KEY,JSON.stringify(legacyLedger));
const repaired=loadPaperAccounts([sample]);
assert.equal(repaired.accounts[0].portfolio.positions[0].marketType,'spot');
assert.equal(isPaperStorageBlocked(),false);
const conflicting=[sample,{...sample,marketType:'swap'}];
store.set(PAPER_ACCOUNTS_STORAGE_KEY,JSON.stringify(legacyLedger));
loadPaperAccounts(conflicting);
assert.equal(isPaperStorageBlocked(),true);
assert.equal(store.get(PAPER_ACCOUNTS_STORAGE_KEY),JSON.stringify(legacyLedger));
store.delete(PAPER_ACCOUNTS_STORAGE_KEY);

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
const badlyLeveled={...valid,accounts:valid.accounts.map(record=>({...record,portfolio:{
 ...record.portfolio,positions:[{...legacyPosition,marketType:'spot',leverage:Infinity}]}}))};
assert.equal(isStoredPaperLedgerValid(badlyLeveled),false);
const badPending={...valid,accounts:valid.accounts.map(record=>({...record,portfolio:{
 ...record.portfolio,pendingOrders:[{id:'p2',symbol:'ABCUSD',exchange:'Example',
 marketType:'spot',side:'Long',kind:'limit',qty:1,price:90,leverage:-3,createdAt:1,status:'pending'}]}}))};
assert.equal(isStoredPaperLedgerValid(badPending),false);
console.log('Paper ledger quarantine and overwrite prevention tests passed.');
