import React,{useState} from 'react';
import type {JournalTrade} from '../../types';
import {importBrokerCsv,type CsvProvider,type CsvImportResult} from '../../services/journalCsvImport';
type Props={onClose:()=>void;onCommit:(trades:JournalTrade[])=>number};
export const JournalCsvImportPanel:React.FC<Props>=({onClose,onCommit})=>{
 const [format,setFormat]=useState<CsvProvider>('kraken');
 const [report,setReport]=useState<CsvImportResult|null>(null);
 const [error,setError]=useState('');
 const [sourceName,setSourceName]=useState('');
 const [working,setWorking]=useState(false);
 const change=(source:CsvProvider)=>{setFormat(source);setReport(null);setError('');setSourceName('');};
 const readFile=async(file?:File)=>{
  setReport(null);setError('');setSourceName('');
  if(!file)return;
  setWorking(true);
  try{
   const parsed=importBrokerCsv(await file.text(),format);
   setReport(parsed);setSourceName(file.name);
  }catch(err){setError(err instanceof Error?err.message:'CSV format is unsupported or ambiguous.');}
  finally{setWorking(false);}
 };
 const commit=()=>{
  if(!report?.trades.length)return;
  try{
   const inserted=onCommit(report.trades);
   if(inserted<=0)throw Error('No new completed trades were added. These fills may already be imported.');
   onClose();
  }catch(e){setError(e instanceof Error?e.message:'Journal import could not be saved.');}
 };
 const money=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});
 return <div role="dialog" aria-modal="true" aria-label="Import Broker CSV" className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-3">
   <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#344054] bg-[#171d28] p-4 text-xs text-[#d9e1ee] space-y-3">
     <div className="flex justify-between items-center"><strong className="text-base">Import Executed Broker CSV · Preview First</strong>
       <button type="button" aria-label="Close CSV importer" onClick={onClose} className="text-lg px-2">×</button>
     </div>
     <p className="text-[#abb9c9]">No file is uploaded. Imports are local journal entries, never broker orders. Only explicitly USD-quoted spot fills can be imported without an exchange-rate assumption. USDT, USDC and third-asset fees are rejected.</p>
     <label className="block space-y-1">Source format
       <select value={format} onChange={e=>change(e.target.value as CsvProvider)}
         className="block bg-[#111824] border border-[#47536a] rounded px-3 py-2">
         <option value="kraken">Kraken Trades History (txid, pair, time, vol, fee)</option>
         <option value="binance">Binance Spot Trade History (Date(UTC), Pair, Executed, Fee Coin)</option>
         <option value="standard">Normalized Broker Executions (timestamp, symbol, side, quantity, price, fee, fee_currency, trade_id)</option>
       </select>
     </label>
     <label className="block space-y-1">Trade execution CSV file (maximum 2 MB, 10,000 rows)
       <input type="file" accept=".csv,text/csv" key={format} disabled={working}
         onChange={e=>void readFile(e.target.files?.[0])}
         className="block w-full text-xs file:mr-3 file:rounded file:bg-[#2862fb] file:p-2 file:text-white"/>
     </label>
     {format==='kraken'&&<p className="text-[#e2be83]">Kraken Trades reports fees as quote-currency equivalents even if the ledger deducted another asset. This is a trade-level estimate, not a reconciliation of your Kraken Ledger export.</p>}
     {format==='binance'&&<p className="text-[#e2be83]">Binance fee assets other than USD cannot be converted without real FX history. Review and normalize those fills before import; none will be silently skipped.</p>}
     {error&&<p role="alert" className="text-[#ffadad]">{error}</p>}
     {report&&<section className="space-y-2 border-t border-[#384659] pt-3">
       <strong>Import preview · {sourceName}</strong>
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
         {([['Executed fills',String(report.fillsRead)],['Completed trades',String(report.trades.length)],
           ['Unmatched open lots',String(report.unmatchedLots)],['Net closed P&L (USD)',
           money(report.trades.reduce((sum,t)=>sum+t.netReturn,0))]] as const).map(([name,value])=>
             <div key={name} className="p-2 border border-[#405067] rounded"><span className="block text-[#a7b8cd]">{name}</span><strong>{value}</strong></div>)}
       </div>
       {report.warnings.map(w=><p key={w} className="text-[#edc484]">{w}</p>)}
       <div className="overflow-auto max-h-48"><table className="w-full text-left">
         <thead><tr>{['Market','Side','Entry UTC','Exit UTC','Units','Net USD','Fees USD'].map(h=><th key={h}>{h}</th>)}</tr></thead>
         <tbody>{report.trades.slice(0,100).map(t=><tr key={t.id} className="border-t border-[#344256]">
           <td>{t.symbol}</td><td>{t.side}</td><td>{t.openDate}</td><td>{t.closeDate}</td>
           <td>{t.size}</td><td>{money(t.netReturn)}</td><td>{money(t.fees||0)}</td>
         </tr>)}</tbody>
       </table></div>
       <p className="text-[#a7b8cd]">Matches fills FIFO, allocates partial fees proportionately, preserves per-fill executions, and creates no fictitious close for remaining open lots. Review fills before approval.</p>
       <div className="flex items-center gap-3 justify-end">
         <button type="button" className="border border-[#596b85] rounded px-4 py-2" onClick={onClose}>Cancel</button>
         <button type="button" disabled={!report.trades.length} onClick={commit}
           className="bg-[#2862fb] disabled:opacity-40 rounded px-4 py-2 font-semibold">Import {report.trades.length} Completed Trades</button>
       </div>
     </section>}
   </div>
 </div>;
};
