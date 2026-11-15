import type {JournalSide,JournalStatus} from '../types';
/** Manual journal results are net of explicitly supplied total trade fees. */
export function calculateManualTradePnL(entry:number,exit:number|undefined,quantity:number,
  side:JournalSide,totalFees=0):{netReturn:number;netReturnPercent:number;status:JournalStatus}{
  if(!Number.isFinite(entry)||entry<=0||!Number.isFinite(quantity)||quantity<=0||
    (exit!==undefined&&(!Number.isFinite(exit)||exit<=0))||
    !Number.isFinite(totalFees)||totalFees<0)throw Error('Invalid journal execution amounts');
  if(exit===undefined)return {netReturn:0,netReturnPercent:0,status:'OPEN'};
  const gross=(side==='LONG'?exit-entry:entry-exit)*quantity;
  const net=gross-totalFees;
  const netReturn=Number(net.toFixed(2));
  const netReturnPercent=Number((net/(entry*quantity)*100).toFixed(2));
  return {netReturn,netReturnPercent,status:netReturn>0?'WIN':netReturn<0?'LOSS':'BE'};
}
