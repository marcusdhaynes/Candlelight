import assert from 'node:assert/strict';
import {WATCHLIST_KEY,WATCHLIST_LEGACY_KEY,WATCHLIST_BACKUP_KEY,
 validWatchlists,loadWatchlists,persistWatchlists,isWatchlistStorageBlocked} from './watchlistStorage';
const store=new Map<string,string>();
(globalThis as any).localStorage={
 getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,String(v)),
 removeItem:(k:string)=>store.delete(k)};
const original=[{id:'w1',name:'Main',symbols:['BTCUSD|Kraken|spot']}];
assert.equal(validWatchlists(original),true);
persistWatchlists(original as any);
assert.equal(loadWatchlists([] as any).length,1);
const corrupt=JSON.stringify([original[0],{id:44}]);
store.set(WATCHLIST_LEGACY_KEY,corrupt);
assert.equal(isWatchlistStorageBlocked(),true);
assert.deepEqual(loadWatchlists(original as any),original);
assert.equal(store.get(WATCHLIST_BACKUP_KEY),corrupt);
assert.throws(()=>persistWatchlists(original as any),/quarantined/);
assert.equal(store.get(WATCHLIST_LEGACY_KEY),corrupt);
store.delete(WATCHLIST_LEGACY_KEY);
assert.equal(isWatchlistStorageBlocked(),false);
persistWatchlists(original as any);
assert.equal(store.get(WATCHLIST_KEY),JSON.stringify(original));
console.log('Watchlist atomic recovery and no silent partial deletion passed.');
