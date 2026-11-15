/** Produce a local wall-clock ISO timestamp with explicit timezone offset.
 * Existing naive journal times remain interpreted as local wall-clock time. */
export function localJournalTimestamp(date:Date=new Date()):string{
  const offset=-date.getTimezoneOffset();
  const sign=offset>=0?'+':'-';
  const abs=Math.abs(offset);
  const local=new Date(date.getTime()+offset*60000).toISOString().slice(0,19);
  return local+sign+String(Math.floor(abs/60)).padStart(2,'0')+':'+String(abs%60).padStart(2,'0');
}
export function journalTradeDate(value:string):Date{
  // Offset-aware timestamps are unambiguous; historic "YYYY-MM-DD HH:mm:ss"
  // entries retain their original local-time interpretation.
  return new Date(value.replace(' ','T'));
}
