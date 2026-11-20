/**
 * Chart synchronization must use observed, finite ranges only.
 * Time-range synchronization works in source UTC seconds; logical sync works
 * in the number of rendered bars. No synthetic candles are ever inserted.
 */
export interface SyncWindow{from:number;to:number}
export function normalizeSyncWindow(input:unknown):SyncWindow|null{
  if(!input||typeof input!=='object')return null;
  const range=input as Record<string,unknown>;
  if(typeof range.from!=='number'||typeof range.to!=='number'||
    !Number.isFinite(range.from)||!Number.isFinite(range.to)||
    range.from>=range.to)return null;
  return {from:range.from,to:range.to};
}
export function windowsEquivalent(a:SyncWindow|null,b:SyncWindow|null):boolean{
  return a===null&&b===null || a!==null&&b!==null&&
    Math.abs(a.from-b.from)<1e-8&&Math.abs(a.to-b.to)<1e-8;
}
