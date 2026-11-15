import assert from 'node:assert/strict';
import {createCoinbaseDepthState,acceptCoinbaseLevel2,coinbaseDepthRows} from './orderDepth';
const book=createCoinbaseDepthState();
assert.equal(acceptCoinbaseLevel2(book,{type:'snapshot',product_id:'OTHER',
  bids:[['100','1']],asks:[['101','2']]},'BTC-USD'),false);
assert.equal(book.ready,false);
assert.equal(acceptCoinbaseLevel2(book,{type:'snapshot',product_id:'BTC-USD',
  bids:[['99','2'],['100','1']],asks:[['102','4'],['101','2']]},'BTC-USD'),true);
let depth=coinbaseDepthRows(book);
assert.deepEqual(depth.bids.map(x=>x.price),[100,99]);
assert.deepEqual(depth.asks.map(x=>x.price),[101,102]);
assert.deepEqual(depth.bids.map(x=>x.total),[1,3]);
assert.equal(acceptCoinbaseLevel2(book,{type:'l2update',product_id:'BTC-USD',
  changes:[['buy','100','0'],['buy','98','3'],['sell','101','5']]},'BTC-USD'),true);
depth=coinbaseDepthRows(book);
assert.equal(depth.bids[0].price,99);
assert.equal(depth.asks[0].size,5);
assert.equal(depth.bids[1].total,5);
assert.equal(acceptCoinbaseLevel2(book,{type:'l2update',product_id:'OTHER',
  changes:[['sell','101','0']]},'BTC-USD'),false);
assert.equal(coinbaseDepthRows(book).asks[0].size,5);
console.log('Coinbase verified L2 snapshots, updates, deletions and venue isolation passed.');
