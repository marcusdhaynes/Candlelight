import assert from 'node:assert/strict';
import {localJournalTimestamp,journalTradeDate} from './journalTimes';
const timestamp=localJournalTimestamp(new Date('2026-11-15T00:30:00.000Z'));
assert.match(timestamp,/^2026-11-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
assert.equal(journalTradeDate(timestamp).getTime(),new Date('2026-11-15T00:30:00.000Z').getTime());
assert.equal(Number.isNaN(journalTradeDate('2026-11-15T09:15:00').getTime()),false);
console.log('Journal timestamps preserve local day with explicit offset.');
