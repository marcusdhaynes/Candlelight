import type {JournalTrade,JournalSide,JournalExecution} from '../types';
export type CsvProvider='kraken'|'binance'|'standard';
export type CsvImportResult={
  venue:string;format:CsvProvider;fillsRead:number;trades:JournalTrade[];
  unmatchedLots:number;unmatchedUnits:number;warnings:string[];
};
type Fill={id:string;at:string;symbol:string;side:'BUY'|'SELL';qty:number;price:number;fee:number};
type Lot={fill:Fill;remaining:number;feeRemaining:number};
const fail=(row:number,detail:string):never=>{throw Error('CSV row '+row+': '+detail);};
export function parseCsvRows(input:string):string[][]{
 if(input.length>2_000_000)throw Error('CSV exceeds 2 MB safe import limit.');
 const data=input.replace(/^\uFEFF/,'');
 const rows:string[][]=[];let current='',row:string[]=[],quoted=false,endedQuote=false;
 for(let i=0;i<data.length;i++){
  const c=data[i],next=data[i+1];
  if(quoted){
   if(c==='"'&&next==='"'){current+='"';i++;continue;}
   if(c==='"'){quoted=false;endedQuote=true;continue;}
   current+=c;continue;
  }
  if(c==='"'&&current===''&&!endedQuote){quoted=true;continue;}
  if(c===','){row.push(current.trim());current='';endedQuote=false;continue;}
  if(c==='\n'||c==='\r'){
   if(c==='\r'&&next==='\n')i++;
   row.push(current.trim());
   if(row.some(cell=>cell!==''))rows.push(row);
   if(rows.length>10001)throw Error('CSV exceeds 10,000 fill rows.');
   current='';row=[];endedQuote=false;continue;
  }
  if(endedQuote&&c!==' '&&c!=='\t')throw Error('Malformed CSV field after closing quote.');
  if(!endedQuote)current+=c;
 }
 if(quoted)throw Error('Unclosed quoted CSV field.');
 row.push(current.trim());if(row.some(cell=>cell!==''))rows.push(row);
 return rows;
}
const label=(head:string)=>head.toLowerCase().replace(/[^a-z0-9]/g,'');
const numeric=(text:string,row:number,field:string):number=>{
 const cleaned=text.replace(/,/g,'').trim();
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cleaned))fail(row,field+' is not a valid nonnegative amount.');
 const n=Number(cleaned);
 if(!Number.isFinite(n)||n<0)fail(row,field+' must be finite and nonnegative.');
 return n;
};
const amountWithCoin=(value:string,row:number,field:string):{amount:number;coin?:string}=>{
 const match=value.trim().match(/^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([A-Za-z]{2,12})?$/i);
 if(!match)fail(row,field+' has an unsupported amount/coin format.');
 return {amount:numeric(match![1],row,field),coin:match![2]?.toUpperCase()};
};
const whenUtc=(value:string,row:number):string=>{
 let date=value.trim();
 if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(date))
   date=date.replace(' ','T')+'Z';
 else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(date))
   fail(row,'A timezone offset is required for normalized timestamps.');
 const ms=Date.parse(date);
 if(!Number.isFinite(ms))fail(row,'Invalid UTC execution timestamp.');
 return new Date(ms).toISOString();
};
const hash=(text:string):string=>{
 let v=2166136261;
 for(let i=0;i<text.length;i++)v=Math.imul(v^text.charCodeAt(i),16777619)>>>0;
 return v.toString(16).padStart(8,'0');
};
function canonicalUsdMarket(raw:string,row:number):string{
 let symbol=raw.trim().toUpperCase().replace(/[/\-\s]/g,'');
 if(symbol.endsWith('ZUSD'))symbol=symbol.slice(0,-4)+'USD'; // Kraken legacy quote ticker
 if(!symbol.endsWith('USD')||symbol.length<=3||symbol.endsWith('USDT')||symbol.endsWith('USDC'))
   fail(row,'Only explicitly USD-quoted spot markets can enter the USD journal; convert other quote currencies outside the app using verified rates.');
 return symbol;
}
export function importBrokerCsv(text:string,format:CsvProvider):CsvImportResult{
 const rows=parseCsvRows(text);
 if(rows.length<2)throw Error('CSV needs a header and at least one executed fill.');
 const headers=rows[0].map(label);
 const index=(...keys:string[])=>headers.findIndex(h=>keys.includes(h));
 const field=(row:string[],line:number,keys:string[],mandatory=true):string=>{
  const i=index(...keys);
  if(i<0&&mandatory)fail(line,'Missing required column: '+keys.join('/'));
  if(i<0)return '';
  return row[i]?.trim()||'';
 };
 const fills:Fill[]=[];
 const observedIDs=new Set<string>();
 const warnings:string[]=[];
 for(let i=1;i<rows.length;i++){
  const row=rows[i],line=i+1;
  if(row.length!==headers.length)fail(line,'Field count differs from header.');
  const rawSymbol=field(row,line,format==='kraken'?['pair']:
    format==='binance'?['pair','market']:['symbol']);
  const symbol=canonicalUsdMarket(rawSymbol,line);
  const rawSide=field(row,line,format==='kraken'?['type']:format==='binance'?['side','type']:['side']).toUpperCase();
  if(!['BUY','SELL'].includes(rawSide))fail(line,'Only executed BUY/SELL spot fills are supported.');
  const side=rawSide as 'BUY'|'SELL';
  const time=whenUtc(field(row,line,format==='kraken'?['time']:
    format==='binance'?['dateutc']:['timestamp','time']),line);
  const price=numeric(field(row,line,['price']),line,'price');
  if(price===0)fail(line,'Fill price must be positive.');
  const rawQuantity=field(row,line,format==='kraken'?['vol']:
    format==='binance'?['executed','quantity','filledquantity','amount']:['quantity','qty']);
  const parsedQty=amountWithCoin(rawQuantity,line,'quantity');
  const base=symbol.slice(0,-3).replace(/^XXBT$/,'BTC').replace(/^XBT$/,'BTC');
  if(parsedQty.coin&&parsedQty.coin!==base)fail(line,'Executed base-asset unit does not match '+base+'.');
  const qty=parsedQty.amount;
  if(qty<=0)fail(line,'Fill quantity must be positive.');
  const feeField=field(row,line,['fee','fees'],false);
  const feeParsed=feeField?amountWithCoin(feeField,line,'fee'):{amount:0,coin:undefined};
  let feeCoin='';
  if(format==='kraken'){
    // Kraken Trades export reports fee in quote currency equivalents.
    feeCoin='USD';
    if(!warnings.includes('Kraken Trades fees are quote-currency equivalents; fee deductions in other assets require the separate Kraken Ledgers export.'))
      warnings.push('Kraken Trades fees are quote-currency equivalents; fee deductions in other assets require the separate Kraken Ledgers export.');
  }else feeCoin=(field(row,line,['feecoin','feecurrency'],false)||feeParsed.coin||'').toUpperCase();
  if(feeParsed.amount>0&&feeCoin!=='USD')fail(line,'Fee is not explicitly in USD. No base-asset, BNB, USDT or third-asset conversion will be guessed.');
  const rawId=field(row,line,format==='kraken'?['txid']:['tradeid','transactionid','executionid'],false);
  if(!rawId&&!warnings.includes('Some rows have no stable broker execution ID; overlapping CSV exports may require manual duplicate review.'))
    warnings.push('Some rows have no stable broker execution ID; overlapping CSV exports may require manual duplicate review.');
  const id=rawId||hash([format,symbol,time,side,qty,price,feeParsed.amount,i].join('|'));
  const composite=format+'|'+id;
  if(observedIDs.has(composite))fail(line,'Repeated broker execution identifier '+id+'.');
  observedIDs.add(composite);
  fills.push({id,at:time,symbol,side,qty,price,fee:feeParsed.amount});
 }
 fills.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 const venue=format==='kraken'?'Kraken':format==='binance'?'Binance':'Normalized Broker';
 const inventory=new Map<string,Lot[]>();
 const trades:JournalTrade[]=[];
 let closingIndex=0;
 for(const fill of fills){
  const lots=inventory.get(fill.symbol)||[];
  let remainingQty=fill.qty,remainingFee=fill.fee;
  while(remainingQty>1e-12&&lots.length&&lots[0].fill.side!==fill.side){
   const lot=lots[0],take=Math.min(remainingQty,lot.remaining);
   const entryFee=lot.feeRemaining*(take/lot.remaining);
   const exitFee=remainingFee*(take/remainingQty);
   const fees=entryFee+exitFee;
   const side:JournalSide=lot.fill.side==='BUY'?'LONG':'SHORT';
   const gross=(side==='LONG'?fill.price-lot.fill.price:lot.fill.price-fill.price)*take;
   const net=gross-fees,cost=lot.fill.price*take;
   const positionId='csv-'+hash([venue,fill.symbol,lot.fill.id,fill.id,closingIndex++].join('|'));
   const executions:JournalExecution[]=[
     {id:lot.fill.id,time:lot.fill.at,side:lot.fill.side,price:lot.fill.price,qty:take,fee:entryFee},
     {id:fill.id,time:fill.at,side:fill.side,price:fill.price,qty:take,fee:exitFee},
   ];
   trades.push({id:positionId,symbol:fill.symbol,side,
     status:net>1e-9?'WIN':net< -1e-9?'LOSS':'BE',
     openDate:lot.fill.at,closeDate:fill.at,
     entryPrice:lot.fill.price,exitPrice:fill.price,
     size:take,cost,netReturn:Number(net.toFixed(8)),
     netReturnPercent:cost>0?Number((net/cost*100).toFixed(8)):0,
     fees:Number(fees.toFixed(8)),setups:[],mistakes:[],efficiency:0,
     note:'Imported executed spot fills · '+venue+' · USD quote. Unmatched inventory excluded.',
     portfolio:venue+' · USD imports',executions});
   lot.remaining-=take;lot.feeRemaining-=entryFee;
   remainingQty-=take;remainingFee-=exitFee;
   if(lot.remaining<1e-12)lots.shift();
  }
  if(remainingQty>1e-12)lots.push({fill,remaining:remainingQty,feeRemaining:remainingFee});
  inventory.set(fill.symbol,lots);
 }
 const open=[...inventory.values()].flat();
 if(open.length)warnings.push('Unmatched opening inventory was not converted into fictitious closed trades.');
 return {venue,format,fillsRead:fills.length,trades,
   unmatchedLots:open.length,unmatchedUnits:open.reduce((sum,l)=>sum+l.remaining,0),warnings};
}
