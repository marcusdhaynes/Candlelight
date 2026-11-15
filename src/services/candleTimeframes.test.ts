import assert from 'node:assert/strict';
import type {OHLCV} from '../types';
import {candleBucketStart,resampleVerifiedCandles} from './candleTimeframes';
const time=(year:number,month:number,day:number,hour=0,minute=0)=>
  Date.UTC(year,month,day,hour,minute)/1000;
assert.equal(candleBucketStart(time(2026,10,14),'1W'),time(2026,10,9));
assert.equal(candleBucketStart(time(2026,10,14),'1M'),time(2026,10,1));
assert.equal(candleBucketStart(time(2026,10,14),'3M'),time(2026,9,1));
assert.equal(candleBucketStart(time(2026,10,14),'12M'),time(2026,0,1));
assert.equal(candleBucketStart(time(2026,11,31,23,59),'1W'),time(2026,11,28));
assert.equal(candleBucketStart(time(2027,0,1),'1W'),time(2026,11,28));
const c=(minute:number,close:number,volume:number):OHLCV=>({
 time:time(2026,10,14,0,minute),open:close,high:close+1,low:close-1,close,volume,
});
const grouped=resampleVerifiedCandles([c(2,103,3),c(0,101,1),c(1,102,2),c(3,104,4)],'3m');
assert.equal(grouped.length,2);
assert.deepEqual(grouped[0],{
 time:time(2026,10,14),open:101,high:104,low:100,close:103,volume:6,
});
assert.equal(grouped[1].close,104);
assert.equal(grouped[1].volume,4);
assert.equal(resampleVerifiedCandles([c(0,101,1),c(1,102,2)],'1m').length,2);
console.log('UTC calendar/timeframe aggregation tests passed.');
