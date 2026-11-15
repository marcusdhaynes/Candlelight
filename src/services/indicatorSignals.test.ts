import assert from 'node:assert/strict';
import {closedMinuteRun,appendClosedMinute,completedIndicatorSignal,indicatorConditionMet} from './indicatorSignals';
const base=1800000000; // 1-minute aligned UTC seconds
const bars=Array.from({length:25},(_,i)=>({time:base+i*60,open:100+i,high:101+i,
 low:99+i,close:100+i,volume:5}));
assert.equal(base%60,0);
const now=base+26*60;
const valid=closedMinuteRun(bars,now);
assert.equal(valid.length,25);
const sig=completedIndicatorSignal(valid)!;
assert.ok(sig&&Number.isFinite(sig.current.rsi14));
assert.ok(Math.abs((sig.current.price_minus_sma20||0)-9.5)<1e-8);
assert.equal(indicatorConditionMet('price_minus_sma20','greater_than',0,sig),true);
assert.equal(indicatorConditionMet('rsi14','greater_than',65,sig),true);
assert.equal(indicatorConditionMet('unknown','greater_than',0,sig),false);
assert.equal(indicatorConditionMet('rsi14','crosses_above',65,sig),false);
assert.equal(closedMinuteRun(bars,base+24*60).length,24); // open interval excluded
assert.equal(closedMinuteRun([...bars.slice(0,20),...bars.slice(21)],now).length,4);
assert.equal(completedIndicatorSignal(closedMinuteRun([...bars.slice(0,20),...bars.slice(21)],now)),undefined);
assert.equal(appendClosedMinute(valid,{...bars[24],time:base+27*60},base+29*60).length,1);
console.log('Finalized 1m RSI/SMA signals reject unclosed bars and history gaps.');
