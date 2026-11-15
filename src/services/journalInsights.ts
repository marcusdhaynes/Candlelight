import type {JournalTrade} from '../types';
import {journalTradeDate} from './journalTimes';
export type JournalInsightGroup='strategy'|'symbol'|'portfolio'|'emotion'|'hour';
export type JournalInsightRow={
 name:string;trades:number;wins:number;losses:number;breakEven:number;
 net:number;expectancy:number;winRate:number;knownFees:number;missingFeeTrades:number;
 averageR:number|null;rObservations:number;profitFactor:number|null;
};
const closed=(t:JournalTrade)=>t.status!=='OPEN'&&Number.isFinite(t.netReturn);
const groupKeys=(t:JournalTrade,kind:JournalInsightGroup):string[]=>{
 if(kind==='strategy')return t.setups?.length?[...new Set(t.setups)]:['Unspecified strategy'];
 if(kind==='symbol')return [t.symbol||'Unspecified market'];
 if(kind==='portfolio')return [t.portfolio||'Unspecified portfolio'];
 if(kind==='emotion')return [t.emotion||'Unspecified emotion'];
 const date=journalTradeDate(t.closeDate||t.openDate);
 if(!Number.isFinite(date.getTime()))return ['Invalid session timestamp'];
 const hour=date.getHours(),start=Math.floor(hour/6)*6;
 return [String(start).padStart(2,'0')+':00–'+String(start+6).padStart(2,'0')+':00 local'];
};
export function summarizeJournalInsights(trades:readonly JournalTrade[],
 kind:JournalInsightGroup):{closedTrades:number;rows:JournalInsightRow[];multiTagged:boolean}{
 const candidates=trades.filter(closed),groups=new Map<string,JournalTrade[]>();
 for(const trade of candidates){
  for(const key of groupKeys(trade,kind)){
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key)!.push(trade);
  }
 }
 const rows=[...groups.entries()].map(([name,items])=>{
  const wins=items.filter(t=>t.netReturn>1e-8),losses=items.filter(t=>t.netReturn< -1e-8);
  const net=items.reduce((s,t)=>s+t.netReturn,0);
  const gains=wins.reduce((s,t)=>s+t.netReturn,0);
  const lossesAbs=-losses.reduce((s,t)=>s+t.netReturn,0);
  let knownFees=0,missingFeeTrades=0;
  for(const t of items){
    if(Number.isFinite(t.fees))knownFees+=t.fees!;
    else if(t.executions?.length&&t.executions.every(e=>Number.isFinite(e.fee))){
      knownFees+=t.executions.reduce((sum,e)=>sum+e.fee!,0);
    }else missingFeeTrades++;
  }
  const rValues=items.map(t=>t.realizedRR).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
  return {name,trades:items.length,wins:wins.length,losses:losses.length,
   breakEven:items.length-wins.length-losses.length,net,expectancy:net/items.length,
   winRate:wins.length/items.length*100,knownFees,missingFeeTrades,
   averageR:rValues.length?rValues.reduce((s,r)=>s+r,0)/rValues.length:null,
   rObservations:rValues.length,profitFactor:lossesAbs>0?gains/lossesAbs:null};
 }).sort((a,b)=>b.trades-a.trades||b.net-a.net||a.name.localeCompare(b.name));
 return {closedTrades:candidates.length,rows,
  multiTagged:kind==='strategy'&&candidates.some(t=>t.setups?.length>1)};
}
