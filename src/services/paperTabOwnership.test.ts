import assert from 'node:assert/strict';
import {createPaperWriterLease} from './paperTabOwnership';
let held=false;
const manager={request:async(_name:string,_options:unknown,fn:(lock:unknown)=>Promise<void>)=>{
 if(held)return fn(null);
 held=true;
 try{await fn({name:'candlelight-paper-ledger-writer-v1'});}
 finally{held=false;}
}} as unknown as Pick<LockManager,'request'>;
let first=0,second=0;
const a=createPaperWriterLease(manager,()=>{first++;});
const b=createPaperWriterLease(manager,()=>{second++;});
a.attempt();
await new Promise(r=>setTimeout(r,0));
assert.equal(first,1);
b.attempt();
await new Promise(r=>setTimeout(r,0));
assert.equal(second,0);
a.release();
await new Promise(r=>setTimeout(r,0));
b.attempt();
await new Promise(r=>setTimeout(r,0));
assert.equal(second,1);
b.release();
await new Promise(r=>setTimeout(r,0));
assert.equal(held,false);
console.log('Exclusive paper-tab writer ownership and release passed.');
