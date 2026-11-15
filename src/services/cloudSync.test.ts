import assert from 'node:assert/strict';
import {validCloudRows,readLocalCloudDocument,restoreCloudDocument} from './cloudSync';
const store=new Map<string,string>();
(globalThis as any).localStorage={
 getItem:(key:string)=>store.get(key)??null,
 setItem:(key:string,value:string)=>{store.set(key,String(value));},
 removeItem:(key:string)=>{store.delete(key);}
};
const data=[{id:'t1',symbol:'BTCUSD',side:'LONG',status:'OPEN',
 openDate:'2026-11-15T15:00:00+00:00',entryPrice:100,
 size:2,cost:200,netReturn:0,netReturnPercent:0,setups:[],mistakes:[],efficiency:0}];
store.set('tradingview_journal_trades',JSON.stringify(data));
const p=readLocalCloudDocument('journal');
assert.equal(p.version,1);
assert.deepEqual(p.data,data);
assert.equal(validCloudRows('journal',[{id:'broken'}]),false);
assert.throws(()=>restoreCloudDocument('journal',{version:1,data:[{id:'broken'}],exportedAt:''}),/valid/);
const restored=[{...data[0],id:'t2'}];
const backup=restoreCloudDocument('journal',{version:1,data:restored,exportedAt:''});
assert.deepEqual(JSON.parse(store.get('tradingview_journal_trades')!),restored);
assert.deepEqual(JSON.parse(store.get(backup)!).original.current,JSON.stringify(data));
const wl=[{id:'w',name:'Main',symbols:['BTCUSD|Kraken|spot']}];
store.set('tv_watchlists',JSON.stringify(wl));
assert.equal(validCloudRows('watchlists',wl),true);
const wp=readLocalCloudDocument('watchlists');
assert.deepEqual(wp.data,wl);
const wb=restoreCloudDocument('watchlists',{version:1,data:wl,exportedAt:''});
assert.equal(store.has('tv_watchlists'),false);
assert.ok(store.has(wb));
console.log('Opt-in cloud export/restore validates financial records and backs up original local bytes.');
