/** Web Locks are origin-wide and mutual-exclusive across tabs and workers.
 * No localStorage pseudo-lock is used: it cannot prevent two tabs racing. */
export const PAPER_WRITER_LOCK='candlelight-paper-ledger-writer-v1';
export type WriterLocks=Pick<LockManager,'request'>;
export function createPaperWriterLease(
  manager:WriterLocks|undefined,acquired:()=>void,onLost:()=>void=()=>{}
){
  let disposed=false,requesting=false,owned=false;
  let releaseLock:(()=>void)|undefined;
  const attempt=()=>{
    if(disposed||requesting||owned||!manager)return;
    requesting=true;
    void manager.request(PAPER_WRITER_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
      requesting=false;
      if(!lock||disposed)return;
      owned=true;
      try{
        acquired();
        await new Promise<void>(resolve=>{releaseLock=resolve;});
      }finally{
        releaseLock=undefined;owned=false;
        if(!disposed)onLost();
      }
    }).catch(err=>{requesting=false;console.warn('Paper writer lock unavailable',err);});
  };
  return {
    attempt,
    release:()=>{disposed=true;releaseLock?.();},
    get owned(){return owned;},
    supported:!!manager,
  };
}
