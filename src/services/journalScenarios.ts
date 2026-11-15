import type {JournalTrade} from '../types';
export type JournalScenarioOptions={eliminateFomo:boolean;useRecordedStop:boolean;capAtOneR:boolean};
export function simulateJournalTrades(trades:JournalTrade[],options:JournalScenarioOptions):JournalTrade[]{
  return trades.filter(t=>!options.eliminateFomo||
    !(t.mistakes?.some(m=>m.toLowerCase()==='fomo')||t.emotion==='FOMO'))
    .map(t=>{
      if(t.status==='OPEN')return t;
      let net=t.netReturn;
      const stop=t.stopLoss,entry=t.entryPrice,size=t.size;
      const protective=Number.isFinite(stop)&&stop!>0&&Number.isFinite(entry)&&entry>0&&
        Number.isFinite(size)&&size>0&&(t.side==='LONG'?stop!<entry:stop!>entry);
      const fees=t.executions?.length?t.executions.reduce((sum,e)=>sum+
        (Number.isFinite(e.fee)?Math.max(0,e.fee!):0),0):t.fees||0;
      const risk=protective?Math.abs(entry-stop!)*size:undefined;
      if(net<0&&risk!==undefined){
        if(options.useRecordedStop&&t.exitPrice!==undefined){
          const beyond=t.side==='LONG'?t.exitPrice<stop!:t.exitPrice>stop!;
          if(beyond)net=Math.max(net,-risk-fees);
        }
        if(options.capAtOneR)net=Math.max(net,-risk-fees);
      }
      return {...t,netReturn:net,status:net>0?'WIN':net<0?'LOSS':'BE'};
    });
}
