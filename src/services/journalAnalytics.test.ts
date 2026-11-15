import assert from 'node:assert/strict';
import type {JournalTrade} from '../types';
import {calculateJournalStats,calculateWaveScore,getCalendarMonthData} from './journalAnalytics';
const t=(id:string,status:JournalTrade['status'],netReturn:number,openDate:string,closeDate?:string):JournalTrade=>({
 id,symbol:'#BTCUSD',side:'LONG',status,openDate,closeDate,
 entryPrice:100,exitPrice:closeDate?100+netReturn:undefined,size:1,
 cost:100,netReturn,netReturnPercent:netReturn,setups:[],mistakes:[],efficiency:0,
});
const data=[
 t('profit','WIN',100,'2026-11-01 09:00:00','2026-11-10 10:00:00'),
 t('open','OPEN',500,'2026-11-02 09:00:00'),
 t('loss','LOSS',-50,'2026-11-03 09:00:00','2026-11-12 10:00:00'),
];
const stats=calculateJournalStats(data,1000);
assert.equal(stats.openTrades,1);
assert.equal(stats.closedTrades,2);
assert.equal(stats.totalNetReturn,50);
assert.equal(stats.startingBalance,1000);
assert.equal(stats.currentBalance,1050);
assert.equal(stats.maxDrawdown,4.55);
assert.equal(stats.equityCurve.length,3);
assert.equal(stats.equityCurve[1].date,'11-10');
assert.equal(stats.equityCurve[2].date,'11-12');
assert.equal(stats.dayStreak.maxWin,1);
assert.equal(stats.dayStreak.maxLoss,1);
assert.equal(calculateWaveScore([]).overall,0);
assert.equal(calculateWaveScore(data).tempo,0);
const cal=getCalendarMonthData(data,2026,11);
assert.equal(cal.totalMonthReturn,50);
assert.equal(cal.totalMonthWins,1);
assert.equal(cal.totalMonthTrades,3);
assert.equal(cal.monthWinRate,50);
assert.equal(calculateJournalStats([t('legacy','LOSS',10,'2026-11-04','2026-11-05')],1000).winTrades,1);
console.log('Realized journal chronology, drawdown, streak and calendar tests passed.');
