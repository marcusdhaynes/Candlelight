import assert from 'node:assert/strict';
import type {JournalTrade} from '../types';
import {simulateJournalTrades} from './journalScenarios';
const trade={id:'a',symbol:'BTCUSD',side:'LONG',status:'LOSS',openDate:'2026-11-01',
 entryPrice:100,exitPrice:65,stopLoss:90,size:2,cost:200,netReturn:-70,
 netReturnPercent:-35,executions:[{id:'x',time:'2026-11-01',side:'SELL',price:65,qty:2,fee:2}],
 setups:[],mistakes:[],efficiency:0} as JournalTrade;
const opts={eliminateFomo:false,useRecordedStop:true,capAtOneR:true};
assert.equal(simulateJournalTrades([trade],opts)[0].netReturn,-22);
assert.equal(simulateJournalTrades([{...trade,stopLoss:undefined}],opts)[0].netReturn,-70);
assert.equal(simulateJournalTrades([{...trade,status:'OPEN'}],opts)[0].status,'OPEN');
assert.equal(simulateJournalTrades([{...trade,emotion:'FOMO'}],{...opts,eliminateFomo:true}).length,0);
assert.equal(simulateJournalTrades([trade],{...opts,useRecordedStop:false,capAtOneR:false})[0].netReturn,-70);
console.log('Journal counterfactuals use recorded stops, quantities and known fees.');
