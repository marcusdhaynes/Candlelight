import assert from 'node:assert/strict';
import type {IndicatorSettings,OHLCV,Asset} from '../types';
import {mayUseIncrementalChartUpdate,hasActiveCalculatedStudy} from './chartUpdatePolicy';
import {marketIdentity} from './marketIdentity';
const c=(time:number,price:number):OHLCV=>({
 time,open:price,high:price+1,low:price-1,close:price,volume:10
});
const settings:IndicatorSettings={
 sma20:{enabled:false,period:20,color:'#fff'},
 sma50:{enabled:false,period:50,color:'#fff'},
 sma200:{enabled:false,period:200,color:'#fff'},
 ema9:{enabled:false,period:9,color:'#fff'},
 ema21:{enabled:false,period:21,color:'#fff'},
 bollingerBands:{enabled:false,period:20,stdDev:2,upperColor:'#fff',middleColor:'#fff',lowerColor:'#fff',fillColor:'#fff'},
 vwap:{enabled:false,color:'#fff'},
 supertrend:{enabled:false,period:7,multiplier:3,upColor:'#fff',downColor:'#fff'},
 volume:{enabled:true,upColor:'#fff',downColor:'#fff'},
 rsi:{enabled:false,period:14,overbought:70,oversold:30,color:'#fff'},
 macd:{enabled:false,fastPeriod:12,slowPeriod:26,signalPeriod:9,
 macdColor:'#fff',signalColor:'#fff',histUpColor:'#fff',histDownColor:'#fff'}
};
const baseline=[c(100,10),c(200,11),c(300,12),c(400,13),c(500,14)];
assert.equal(hasActiveCalculatedStudy(settings),false);
assert.equal(mayUseIncrementalChartUpdate(baseline,[...baseline.slice(0,4),c(500,15)],settings),true);
assert.equal(mayUseIncrementalChartUpdate(baseline,[...baseline,c(600,15)],settings),true);
const corrected=baseline.map(b=>({...b}));
corrected[1].volume++;
assert.equal(mayUseIncrementalChartUpdate(baseline,corrected,settings),false,
 'Old volume correction must reflow chart, not silently change only newest bar');
const correctedMid=baseline.map(b=>({...b}));
correctedMid[2].high++;
assert.equal(mayUseIncrementalChartUpdate(baseline,correctedMid,settings),false,
 'Arbitrary interior OHLC history correction must rebuild');
assert.equal(mayUseIncrementalChartUpdate(baseline,baseline.slice(0,4),settings),false);
assert.equal(mayUseIncrementalChartUpdate(baseline,[...baseline,c(500,20)],settings),false);
assert.equal(mayUseIncrementalChartUpdate(baseline,[...baseline,c(600,15),c(700,16)],settings),false);
assert.equal(mayUseIncrementalChartUpdate([],baseline,settings),false);
for(const study of ['sma20','sma50','sma200','ema9','ema21','bollingerBands',
  'vwap','supertrend','rsi','macd'] as const){
 const active={...settings,[study]:{...settings[study],enabled:true}} as IndicatorSettings;
 assert.equal(hasActiveCalculatedStudy(active),true,study);
 assert.equal(mayUseIncrementalChartUpdate(baseline,
   [...baseline.slice(0,4),c(500,15)],active),false,
   'Price studies must not silently retain stale values: '+study);
}
const dex=(chainId:string,pairAddress:string):Asset=>({
 symbol:'ABCUSD',name:'ABC',exchange:'DEX',source:'DEX',
 category:'crypto',marketType:'spot',price:1,change24h:0,
 changePercent24h:0,high24h:0,low24h:0,volume24h:'',digits:2,
 currency:'USD',chainId,pairAddress
});
assert.notEqual(marketIdentity(dex('ethereum','0x123')),marketIdentity(dex('base','0x123')));
assert.notEqual(marketIdentity(dex('ethereum','0x123')),marketIdentity(dex('ethereum','0x456')));
console.log('Round 11 chart prefix comparison, indicators and DEX venue identity validated.');
