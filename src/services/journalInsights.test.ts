import assert from 'node:assert/strict';
import type {JournalTrade} from '../types';
import {summarizeJournalInsights} from './journalInsights';
const base={id:'1',symbol:'BTCUSD',side:'LONG',status:'WIN',
 openDate:'2026-11-15T10:00:00Z',closeDate:'2026-11-15T11:00:00Z',
 entryPrice:100,exitPrice:110,size:1,cost:100,netReturn:9.5,
 netReturnPercent:9.5,fees:0.5,setups:['Breakout','Momentum'],
 mistakes:[],efficiency:50,realizedRR:2,portfolio:'Manual'} as JournalTrade;
const data=[base,{...base,id:'2',status:'LOSS' as const,netReturn:-4,
 setups:['Breakout'],realizedRR:-1,fees:undefined},
 {...base,id:'3',status:'OPEN' as const,netReturn:0,closeDate:undefined}];
const result=summarizeJournalInsights(data,'strategy');
assert.equal(result.closedTrades,2);
assert.equal(result.multiTagged,true);
const breakout=result.rows.find(x=>x.name==='Breakout')!;
assert.equal(breakout.trades,2);
assert.equal(breakout.net,5.5);
assert.equal(breakout.expectancy,2.75);
assert.equal(breakout.winRate,50);
assert.equal(breakout.knownFees,0.5);
assert.equal(breakout.missingFeeTrades,1);
assert.equal(breakout.averageR,0.5);
assert.ok(Math.abs(breakout.profitFactor!-2.375)<1e-10);
const symbol=summarizeJournalInsights(data,'symbol');
assert.equal(symbol.rows[0].trades,2);
const noEmotion=summarizeJournalInsights([{...base,emotion:undefined}],'emotion');
assert.equal(noEmotion.rows[0].name,'Unspecified emotion');
console.log('Journal insights exclude opens, preserve missing fees and disclose overlapping strategies.');
