import assert from 'node:assert/strict';
import type {OHLCV,Asset,IndicatorSettings} from '../types';
import {mergeLiveCandle,combineHistoryWithLive,normalizeChartHistory,validChartCandle} from './chartCandles';
import {parseSavedCharts,createSavedChartIdea} from './savedCharts';
const c=(time:number,close:number):OHLCV=>({time,open:close,high:close,low:close,close,volume:1});
const bars=[c(100,1),c(160,2),c(220,3)];
const priorClose=c(160,2.1);
const result=mergeLiveCandle(bars,priorClose);
assert.deepEqual(result.map(b=>b.time),[100,160,220]);
assert.equal(result[2].close,3);
assert.equal(result[1].close,2.1);
assert.equal(result[0].close,1);
assert.equal(mergeLiveCandle(bars,c(130,90)),bars);
assert.deepEqual(mergeLiveCandle(bars,c(280,4)).map(b=>b.time),[100,160,220,280]);
assert.equal(mergeLiveCandle(bars,{...c(220,5),high:1}),bars);
const delayedHistory=combineHistoryWithLive([c(100,1),c(160,2),c(220,3)],[c(220,3.5),c(280,4)]);
assert.deepEqual(delayedHistory.map(b=>b.time),[100,160,220,280]);
assert.equal(delayedHistory[2].close,3.5);
assert.equal(delayedHistory[3].close,4);
assert.deepEqual(combineHistoryWithLive([], [c(280,4)]),[c(280,4)]);
const a:Asset={symbol:'ARBUSD',name:'Arbitrum',exchange:'Kraken',source:'Kraken',
  category:'crypto',marketType:'spot',price:.19,change24h:0,changePercent24h:0,
  high24h:0,low24h:0,volume24h:'',digits:4,currency:'USD'};
const i:IndicatorSettings={sma20:{enabled:false,period:20,color:'#fff'},sma50:{enabled:false,period:50,color:'#fff'},
  sma200:{enabled:false,period:200,color:'#fff'},ema9:{enabled:false,period:9,color:'#fff'},
  ema21:{enabled:false,period:21,color:'#fff'},bollingerBands:{enabled:false,period:20,stdDev:2,upperColor:'#fff',
    middleColor:'#fff',lowerColor:'#fff',fillColor:'#fff'},vwap:{enabled:false,color:'#fff'},
  supertrend:{enabled:false,period:7,multiplier:3,upColor:'#fff',downColor:'#fff'},
  volume:{enabled:false,upColor:'#fff',downColor:'#fff'},
  rsi:{enabled:false,period:14,overbought:70,oversold:30,color:'#fff'},
  macd:{enabled:false,fastPeriod:12,slowPeriod:26,signalPeriod:9,
    macdColor:'#fff',signalColor:'#fff',histUpColor:'#fff',histDownColor:'#fff'}};
const idea=createSavedChartIdea(a,'1m','candlestick',[],i,'  ARB setup  ','  breakout  ',1234);
assert.equal(idea.name,'ARB setup');
assert.equal(idea.note,'breakout');
assert.equal(idea.symbol,'ARBUSD');
assert.equal(parseSavedCharts(JSON.stringify([idea]))[0].id,idea.id);
assert.deepEqual(parseSavedCharts('not json'),[]);
assert.deepEqual(parseSavedCharts(JSON.stringify([{name:'fake'}])),[]);
assert.throws(()=>createSavedChartIdea(a,'1m','candlestick',[],i,'   ','',1234),/name/);
console.log('Chart history merging and genuine locally saved chart regression tests passed.');


// Round 11 — reject malformed history, timestamp disorder and stale amendments.
const invalid=[
 {...c(400,2),volume:-1},{...c(500,2),high:1},
 {...c(600,2),close:Infinity},{...c(700,2),time:700.5}
];
for(const bad of invalid){
 assert.equal(validChartCandle(bad),false);
 assert.equal(mergeLiveCandle(bars,bad),bars);
}
const sorted=normalizeChartHistory([c(220,4),...invalid,c(100,1),c(220,5),c(160,2)]);
assert.deepEqual(sorted.map(b=>[b.time,b.close]),[[100,1],[160,2],[220,5]]);
assert.deepEqual(combineHistoryWithLive([c(220,3),c(100,1),c(160,2)],
 [c(160,99),c(220,3.5),c(280,4),{...c(300,2),volume:-1}])
 .map(b=>[b.time,b.close]),[[100,1],[160,2],[220,3.5],[280,4]],
 'Older live snapshot cannot replace closed provider history and invalid bars are discarded');
assert.deepEqual(combineHistoryWithLive([c(280,4),c(100,1)],[c(300,5)])
 .map(b=>b.time),[100,280,300],
 'Latest historical timestamp must not depend on provider response order');
assert.deepEqual(combineHistoryWithLive([], [c(600,5),c(500,4),invalid[0]]).map(b=>b.time),[500,600]);
assert.equal(mergeLiveCandle(bars,c(140,1)),bars,'Unmatched historical interval cannot be inserted');
assert.equal(mergeLiveCandle(bars,{...c(220,6),volume:0})[2].volume,1,
 'An incomplete partial update cannot reduce previously observed volume');
