import assert from 'node:assert/strict';
import {parseCsvRows,importBrokerCsv} from './journalCsvImport';
assert.deepEqual(parseCsvRows('a,b\r\n"hello, there","a""b"\r\n'),
 [['a','b'],['hello, there','a"b']]);
const normalized=['timestamp,symbol,side,quantity,price,fee,fee_currency,trade_id',
 '2026-09-01T12:00:00Z,BTCUSD,BUY,2,100,1,USD,a',
 '2026-09-01T12:01:00Z,BTCUSD,SELL,1,110,0.5,USD,b',
 '2026-09-01T12:02:00Z,BTCUSD,SELL,1,120,0.5,USD,c'].join('\n');
const parsed=importBrokerCsv(normalized,'standard');
assert.equal(parsed.fillsRead,3);assert.equal(parsed.trades.length,2);
assert.equal(parsed.trades[0].netReturn,9);
assert.equal(parsed.trades[1].netReturn,19);
assert.equal(parsed.unmatchedLots,0);
assert.deepEqual(importBrokerCsv(normalized,'standard'),parsed);
const kraken=['txid,ordertxid,pair,time,type,price,cost,fee,vol',
 'k1,o1,XBTUSD,2026-09-01 12:00:00,buy,100,200,1,2',
 'k2,o2,XBTUSD,2026-09-01 12:01:00,sell,110,220,1,2'].join('\n');
const k=importBrokerCsv(kraken,'kraken');
assert.equal(k.trades.length,1);assert.equal(k.trades[0].netReturn,18);
assert.equal(k.trades[0].symbol,'XBTUSD');
const binance=['Date(UTC),Pair,Side,Price,Executed,Fee,Fee Coin',
 '2026-09-01 12:00:00,BTCUSD,BUY,100,2BTC,0.5,USD',
 '2026-09-01 12:01:00,BTCUSD,SELL,110,2BTC,0.5,USD'].join('\n');
assert.equal(importBrokerCsv(binance,'binance').trades[0].netReturn,19);
assert.throws(()=>importBrokerCsv(binance.replaceAll('BTCUSD','BTCUSDT'),'binance'),/USD-quoted/);
assert.throws(()=>importBrokerCsv(binance.replaceAll(',USD',',BNB'),'binance'),/not explicitly in USD/);
assert.throws(()=>importBrokerCsv(normalized.replace('2026-09-01T12:00:00Z','2026-09-01T12:00:00'),'standard'),/timezone offset/);
assert.equal(importBrokerCsv(normalized.split('\n').slice(0,2).join('\n'),'standard').trades.length,0);
console.log('Broker CSV import quotes, UTC, FIFO partial closes, fee units and duplicate prevention passed.');
