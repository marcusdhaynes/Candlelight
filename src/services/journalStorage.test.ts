import assert from 'node:assert/strict';
import {JOURNAL_KEY,JOURNAL_BACKUP_KEY,loadJournalTrades,isJournalRecoveryBlocked,
  persistJournalTrades,validJournalData} from './journalStorage';
const map=new Map<string,string>();
(globalThis as any).localStorage={
 getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,String(v)),
 removeItem:(k:string)=>map.delete(k),
};
const trade={id:'t1',symbol:'BTCUSD',side:'LONG',status:'OPEN',openDate:'2026-11-15T15:00:00+00:00',
 entryPrice:100,size:2,cost:200,netReturn:0,netReturnPercent:0,setups:[],mistakes:[],efficiency:0};
assert.equal(validJournalData([trade]),true);
persistJournalTrades([trade] as any);assert.equal(loadJournalTrades().length,1);
const raw=JSON.stringify([trade,{id:'broken',netReturn:'garbage'}]);map.set(JOURNAL_KEY,raw);
assert.equal(isJournalRecoveryBlocked(),true);
assert.deepEqual(loadJournalTrades(),[]);assert.equal(map.get(JOURNAL_BACKUP_KEY),raw);
assert.throws(()=>persistJournalTrades([trade] as any),/Unrecognized/);
assert.equal(map.get(JOURNAL_KEY),raw);
map.delete(JOURNAL_KEY);persistJournalTrades([trade] as any);
assert.equal(isJournalRecoveryBlocked(),false);
const second=JSON.stringify([{id:'new-broken',netReturn:'invalid'}]);
map.set(JOURNAL_KEY,second);
assert.deepEqual(loadJournalTrades(),[]);
assert.equal(map.get(JOURNAL_BACKUP_KEY),second);
assert.ok([...map.keys()].some(k=>k.startsWith(JOURNAL_BACKUP_KEY+'-archive-')));
console.log('Journal atomic validation and current-backup rotation tests passed.');
