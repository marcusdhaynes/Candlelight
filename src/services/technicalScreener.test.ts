import assert from 'node:assert/strict';
import {analyzeVenueTechnicalHistory} from './technicalScreener';
const current=Math.floor(Date.now()/3600_000)*3600-70*3600;
const bars=Array.from({length:61},(_,i)=>{
 const open=100+i*0.5;
 return {time:current+i*3600,open,close:open+0.2,high:open+0.5,
  low:open-0.1,volume:10+i};
});
const analyzed=analyzeVenueTechnicalHistory(bars);
assert.ok(analyzed.data&&!analyzed.error);
assert.equal(analyzed.data!.trend,'Above rising SMA20');
assert.ok(analyzed.data!.rsi14>90);
assert.ok(analyzed.data!.volumeRatio!>1);
assert.equal(analyzed.data!.sma50!==null,true);
const broken=analyzeVenueTechnicalHistory([...bars.slice(0,30),...bars.slice(31)]);
assert.equal(broken.data,undefined);
assert.match(broken.error||'',/Missing|repeated/);
const insufficient=analyzeVenueTechnicalHistory(bars.slice(0,20));
assert.equal(insufficient.data,undefined);
console.log('Advanced screen indicators use contiguous completed venue candles only.');
