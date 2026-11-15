import assert from 'node:assert/strict';
import type {Asset} from '../types';
import {marketIdentity,resolveWindowAsset,resolveWatchlistEntry,alertMarketIdentity} from './marketIdentity';
const a={symbol:'BTCUSD',source:'Kraken',exchange:'Kraken',marketType:'spot'} as Asset;
const b={...a,source:'Coinbase',exchange:'Coinbase'};
assert.notEqual(marketIdentity(a),marketIdentity(b));
assert.equal(resolveWatchlistEntry(marketIdentity(b),[a,b]),b);
assert.equal(resolveWatchlistEntry('BTCUSD',[a,b]),undefined);
assert.equal(resolveWatchlistEntry('BTCUSD',[a]),a);
assert.equal(resolveWindowAsset({id:'w',symbol:'BTCUSD',timeframe:'1m',source:'Coinbase',marketType:'spot'},[a,b]),b);
assert.equal(resolveWindowAsset({id:'w',symbol:'BTCUSD',timeframe:'1m'},[a,b]),undefined);
assert.notEqual(alertMarketIdentity({...a,pairAddress:'0x12345',chainId:'base'}),
  alertMarketIdentity({...a,pairAddress:'0x99999',chainId:'base'}));
const poolA={...a,pairAddress:'0x12345',chainId:'base'};
const poolB={...a,pairAddress:'0x99999',chainId:'base'};
assert.notEqual(marketIdentity(poolA),marketIdentity(poolB));
assert.equal(resolveWatchlistEntry(marketIdentity(poolA),[poolA,poolB]),poolA);
assert.equal(resolveWatchlistEntry(marketIdentity(a),[poolA,poolB]),undefined);
assert.equal(resolveWindowAsset({id:'dex',symbol:a.symbol,source:'Kraken',marketType:'spot',timeframe:'1m'},[poolA,poolB]),undefined);
assert.equal(resolveWindowAsset({id:'dex',symbol:a.symbol,source:'Kraken',marketType:'spot',timeframe:'1m',chainId:'base',pairAddress:'0x99999'},[poolA,poolB]),poolB);

assert.notEqual(alertMarketIdentity({...a,pairAddress:'0x12345',chainId:'base'}),
  alertMarketIdentity({...a,pairAddress:'0x12345',chainId:'ethereum'}));
console.log('Market identity tests passed, including exact DEX pool scoping.');
