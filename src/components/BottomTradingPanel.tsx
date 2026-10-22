import React, {useState} from 'react';
import {ChevronDown, Maximize2, Minimize2, Minus, X, Download, Edit2, Zap} from 'lucide-react';
import type {Asset, PaperAccount, PaperPosition} from '../types';
import type {ConditionalOrder,DependencyContext} from '../types/conditionalOrders';
import type {PaperFill} from '../services/paperTrading';
import {PAPER_FEE_RATE,isFreshPaperQuote} from '../services/paperTrading';
import {ConditionalOrdersTable} from './orders/ConditionalOrdersTable';

export interface BottomTradingPanelProps {
  account:PaperAccount; positions:PaperPosition[]; activeAsset:Asset;
  onClosePosition:(id:string)=>void;
  onPlacePosition:(side:'Long'|'Short',qty:number,leverage:number,tp?:number,sl?:number)=>void;
  onEditPosition:(id:string,tp?:number,sl?:number)=>void;
  onResetPaper:()=>void; paperError:string; fills:PaperFill[];
  conditionalOrders:ConditionalOrder[];
  onOpenCreateConditionalOrder:(dep?:DependencyContext|null)=>void;
  onEditConditionalOrder:(order:ConditionalOrder)=>void;
  onToggleConditionalOrderStatus:(id:string)=>void;
  onDeleteConditionalOrder:(id:string)=>void;
  onTestTriggerConditionalOrder:(order:ConditionalOrder)=>void;
  isOpen:boolean;setIsOpen:(open:boolean|((prev:boolean)=>boolean))=>void;
  isExpanded:boolean;setIsExpanded:(open:boolean|((prev:boolean)=>boolean))=>void;
}
type Tab='positions'|'orders'|'orderHistory'|'balanceHistory'|'activityLog'|'tradeHistory'|'analytics';
const tabs:[Tab,string][]=[
  ['positions','Positions'],['orders','Orders'],['orderHistory','Order history'],
  ['balanceHistory','Balance history'],['activityLog','Activity log'],
  ['tradeHistory','Trade history'],['analytics','Analytics'],
];
const cash=(n:number)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const amount=(n:number)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:9}):'—';

export const BottomTradingPanel:React.FC<BottomTradingPanelProps>=({
  account,positions,activeAsset,onClosePosition,onPlacePosition,onEditPosition,onResetPaper,paperError,fills,
  conditionalOrders,onOpenCreateConditionalOrder,onEditConditionalOrder,onToggleConditionalOrderStatus,
  onDeleteConditionalOrder,onTestTriggerConditionalOrder,isOpen,setIsOpen,isExpanded,setIsExpanded,
})=>{
  const [tab,setTab]=useState<Tab>('positions');
  const [quantity,setQuantity]=useState('1');
  const [leverage,setLeverage]=useState(1);
  const [tp,setTp]=useState('');
  const [sl,setSl]=useState('');
  const [editId,setEditId]=useState<string|null>(null);
  const [editTp,setEditTp]=useState('');
  const [editSl,setEditSl]=useState('');
  const live=isFreshPaperQuote(activeAsset);
  const exportCsv=()=>{
    const rows=[['Time','Market','Source','Action','Quantity','Price','Fee','Realized PnL'],...fills.map(f=>
      [new Date(f.timestamp).toISOString(),f.symbol,f.exchange,f.note,String(f.quantity),String(f.price),String(f.fee),String(f.realizedPnL)])];
    const csv=rows.map(row=>row.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    const a=document.createElement('a');a.href=url;a.download='candlelight-paper-fills.csv';a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if(!isOpen)return <button type="button" onClick={()=>setIsOpen(true)}
    className="h-6 bg-[#1e222d] border-t border-[#2a2e39] px-3 flex items-center gap-3 text-[11px] text-[#d1d4dc]">
    <strong>Paper Trading</strong><span>Equity ${cash(account.equity)}</span><span>Open {positions.length}</span>
  </button>;
  return <section className={`border-t border-[#2a2e39] bg-[#131722] flex flex-col text-[#d1d4dc] z-20 ${isExpanded?'h-[450px]':'h-[295px]'}`}>
    <header className="flex items-center gap-3 px-3 py-1.5 border-b border-[#2a2e39] text-[11px] bg-[#171b25] flex-wrap">
      <strong>Paper Trading</strong><span className="text-[#78879a]">{account.name} · Simulation</span>
      <span>Balance <b>{cash(account.balance)}</b></span>
      <span>Equity <b>{cash(account.equity)}</b></span>
      <span>Realized <b className={account.realizedPnL>=0?'text-[#089981]':'text-[#f23645]'}>{cash(account.realizedPnL)}</b></span>
      <span>Unrealized <b className={account.unrealizedPnL>=0?'text-[#089981]':'text-[#f23645]'}>{cash(account.unrealizedPnL)}</b></span>
      <span>Margin <b>{cash(account.accountMargin)}</b></span>
      <span>Available <b>{cash(account.availableFunds)}</b></span>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={()=>setIsExpanded(v=>!v)} title="Resize paper panel">{isExpanded?<Minimize2 size={13}/>:<Maximize2 size={13}/>}</button>
        <button type="button" onClick={()=>setIsOpen(false)} title="Close paper panel"><Minus size={14}/></button>
      </div>
    </header>
    <div className="flex items-center gap-2 flex-wrap bg-[#1b202d] border-b border-[#303645] px-2 py-1.5 text-[11px]">
      <strong className="text-white">{activeAsset.symbol}</strong>
      <span className={live?'text-[#089981]':'text-[#f4b77c]'}>{live?`Live ${amount(activeAsset.price)} ${activeAsset.currency}`:'Waiting for a real-time exchange quote'}</span>
      <label className="flex items-center gap-1">Qty
        <input aria-label="Order quantity" value={quantity} onChange={e=>setQuantity(e.target.value)}
          type="number" step="any" min="0" className="w-[76px] bg-[#101622] border border-[#3c4353] rounded px-1.5 py-1 text-white"/>
      </label>
      <label className="flex items-center gap-1">Leverage
        <select aria-label="Paper leverage" value={leverage} onChange={e=>setLeverage(Number(e.target.value))}
          className="bg-[#101622] border border-[#3c4353] rounded py-1">
          {[1,2,3,5,10,20].map(x=><option value={x} key={x}>{x}×</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">TP
        <input aria-label="Take profit" type="number" min="0" step="any" placeholder="Optional" value={tp}
          onChange={e=>setTp(e.target.value)} className="w-[78px] bg-[#101622] border border-[#3c4353] rounded px-1 py-1 text-white"/>
      </label>
      <label className="flex items-center gap-1">SL
        <input aria-label="Stop loss" type="number" min="0" step="any" placeholder="Optional" value={sl}
          onChange={e=>setSl(e.target.value)} className="w-[78px] bg-[#101622] border border-[#3c4353] rounded px-1 py-1 text-white"/>
      </label>
      <button type="button" disabled={!live||!(Number(quantity)>0)} className="px-2.5 py-1 rounded bg-[#0b866a] font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed"
        onClick={()=>onPlacePosition('Long',Number(quantity),leverage,tp?Number(tp):undefined,sl?Number(sl):undefined)}>Buy / Long</button>
      <button type="button" disabled={!live||!(Number(quantity)>0)} className="px-2.5 py-1 rounded bg-[#b2324b] font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed"
        onClick={()=>onPlacePosition('Short',Number(quantity),leverage,tp?Number(tp):undefined,sl?Number(sl):undefined)}>Sell / Short</button>
      <span className="text-[#9299aa]">{(PAPER_FEE_RATE*100).toFixed(2)}% fee / side</span>
      <button type="button" className="ml-auto px-2 py-1 border border-[#5e5460] rounded hover:bg-[#393342]"
        onClick={()=>{if(window.confirm('Reset paper balance to 10,000 USD and erase all paper trades and orders?'))onResetPaper();}}>Reset account</button>
    </div>
    {paperError&&<div role="alert" className="px-3 py-1 text-[11px] text-[#ffc5c5] bg-[#51202b]">{paperError}</div>}
    <nav className="flex flex-wrap items-center gap-1 border-b border-[#2a2e39] px-2 py-1 text-[11px]">
      {tabs.map(([id,name])=><button type="button" key={id} onClick={()=>setTab(id)}
        className={`rounded px-2 py-1 ${tab===id?'bg-[#2a3142] text-white':'text-[#9197a5] hover:bg-[#212633]'}`}>
        {name}{id==='positions'?` (${positions.length})`:id==='orders'?` (${conditionalOrders.length})`:''}
      </button>)}
      <button type="button" className="ml-auto px-2 text-[#a5aabc]" title="Export trade history as CSV" onClick={exportCsv}><Download size={15}/></button>
    </nav>
    <div className="flex-1 min-h-0 overflow-y-auto text-[11px]">
      {tab==='positions'&&<table className="w-full text-left">
        <thead className="sticky top-0 bg-[#131722] text-[#9aa1b2]"><tr>
          {['Market','Side','Qty','Entry','Last','Leverage','Margin','Unrealized','TP / SL','Actions'].map(x=><th key={x} className="px-2 py-1.5 font-medium">{x}</th>)}
        </tr></thead><tbody>
        {positions.map(p=><React.Fragment key={p.id}><tr className="border-t border-[#303440] hover:bg-[#222735]">
          <td className="px-2 py-1">{p.symbol}<small className="block text-[#8f96a4]">{p.exchange}</small></td>
          <td className={p.side==='Long'?'text-[#18b38a]':'text-[#ed6475]'}>{p.side}</td>
          <td>{amount(p.qty)}</td><td>{amount(p.entryPrice)}</td><td>{amount(p.currentPrice)}<small className="block text-[#818999]">{p.lastMarkedAt&&Date.now()-p.lastMarkedAt>30000?'Stale':'Observed'}</small></td>
          <td>{p.leverage||1}×</td><td>{cash(p.qty*p.entryPrice/(p.leverage||1))}</td>
          <td className={p.unrealizedPnL>=0?'text-[#089981]':'text-[#f23645]'}>{cash(p.unrealizedPnL)} ({p.unrealizedPnLPct.toFixed(2)}%)</td>
          <td>{p.tp??'—'} / {p.sl??'—'}</td><td className="flex items-center gap-2 py-2">
            <button title="Add conditional order" onClick={()=>onOpenCreateConditionalOrder({type:'position',label:p.symbol+' position'})}><Zap size={13}/></button>
            <button title="Edit TP and SL" onClick={()=>{setEditId(editId===p.id?null:p.id);setEditTp(p.tp?.toString()||'');setEditSl(p.sl?.toString()||'');}}><Edit2 size={13}/></button>
            <button title="Close at latest verified price" className="text-[#f77f90]" onClick={()=>onClosePosition(p.id)}><X size={13}/></button>
          </td>
        </tr>
        {editId===p.id&&<tr className="bg-[#202a36]"><td colSpan={10} className="p-2">
          <label>Take profit <input type="number" step="any" min="0" value={editTp} onChange={e=>setEditTp(e.target.value)} className="ml-1 w-24 bg-[#0c1320] rounded px-2"/></label>
          <label className="ml-4">Stop loss <input type="number" step="any" min="0" value={editSl} onChange={e=>setEditSl(e.target.value)} className="ml-1 w-24 bg-[#0c1320] rounded px-2"/></label>
          <button className="ml-3 text-[#7ea7ff]" onClick={()=>{onEditPosition(p.id,editTp?Number(editTp):undefined,editSl?Number(editSl):undefined);setEditId(null);}}>Save stops</button>
          <button className="ml-3 text-[#98a1b6]" onClick={()=>setEditId(null)}>Cancel</button>
        </td></tr>}
        </React.Fragment>)}
        {positions.length===0&&<tr><td colSpan={10} className="text-center p-5 text-[#8792a6]">No open paper positions. Enter a quantity, wait for a verified live quote, then buy or short.</td></tr>}
      </tbody></table>}
      {tab==='orders'&&<ConditionalOrdersTable orders={conditionalOrders} onOpenCreateModal={()=>onOpenCreateConditionalOrder(null)}
        onEditOrder={onEditConditionalOrder} onToggleStatus={onToggleConditionalOrderStatus}
        onDeleteOrder={onDeleteConditionalOrder} onTestTrigger={onTestTriggerConditionalOrder}/>}
      {['orderHistory','balanceHistory','activityLog','tradeHistory'].includes(tab)&&<div>
        {fills.length?fills.map(f=><div key={f.id} className="grid grid-cols-6 gap-2 p-2 border-b border-[#313641]">
          <span>{new Date(f.timestamp).toLocaleString()}</span><span>{f.exchange} · {f.symbol}</span>
          <span>{f.note} · {f.side}</span><span>{amount(f.quantity)} @ {amount(f.price)}</span>
          <span>Fee: {cash(f.fee)}</span><span className={f.realizedPnL>=0?'text-[#089981]':'text-[#f23645]'}>Net: {cash(f.realizedPnL)}</span>
        </div>):<p className="p-5 text-[#8792a6]">No paper executions yet.</p>}
      </div>}
      {tab==='analytics'&&<div className="p-4 flex flex-wrap gap-6">
        <span>Starting capital: 10,000 USD</span><span>Completed closes: {fills.filter(f=>f.note.toLowerCase().includes('close')).length}</span>
        <span>Net realized: {cash(account.realizedPnL)} USD</span><span>Open P&L: {cash(account.unrealizedPnL)} USD</span>
        <span>Equity: {cash(account.equity)} USD</span><span>Available: {cash(account.availableFunds)} USD</span>
      </div>}
    </div>
  </section>;
};
