import React, {useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, Maximize2, Minimize2, Minus, X, Download, Edit2, Zap, Plus, Settings2, Check} from 'lucide-react';
import type {Asset, PaperAccount, PaperPosition} from '../types';
import type {ConditionalOrder,DependencyContext} from '../types/conditionalOrders';
import type {PaperFill} from '../services/paperTrading';
import {accountLeverage,isFreshPaperQuote,marketPaperCategory,type PaperSettings} from '../services/paperTrading';
import type {PaperEntryOrder} from '../services/paperOrders';
import type {PaperAccountRecord} from '../services/paperAccounts';
import {PaperAccountModal} from './PaperAccountModal';
import {ConditionalOrdersTable} from './orders/ConditionalOrdersTable';

export interface BottomTradingPanelProps {
  account:PaperAccount; positions:PaperPosition[]; activeAsset:Asset;
  paperAccounts:PaperAccountRecord[];
  activePaperAccountId:string;
  paperSettings:PaperSettings;
  onSelectPaperAccount:(id:string)=>void;
  onSavePaperAccount:(id:string|null,name:string,settings:PaperSettings)=>void;
  onDeletePaperAccount:(id:string)=>void;
  onClosePosition:(id:string)=>void;
  onOpenTicket:()=>void;
  pendingOrders:PaperEntryOrder[];
  onCancelPendingOrder:(id:string)=>void;
  onEditPosition:(id:string,tp?:number,sl?:number,trailing?:number|null)=>void;
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
  account,positions,activeAsset,onClosePosition,onEditPosition,onResetPaper,paperError,fills,
  onOpenTicket,pendingOrders,onCancelPendingOrder,
  paperAccounts,activePaperAccountId,paperSettings,onSelectPaperAccount,onSavePaperAccount,onDeletePaperAccount,
  conditionalOrders,onOpenCreateConditionalOrder,onEditConditionalOrder,onToggleConditionalOrderStatus,
  onDeleteConditionalOrder,onTestTriggerConditionalOrder,isOpen,setIsOpen,isExpanded,setIsExpanded,
})=>{
  const [tab,setTab]=useState<Tab>('positions');
  const [quantity,setQuantity]=useState('1');
  const [accountListOpen,setAccountListOpen]=useState(false);
  // undefined = dialog closed; null = new account; string = edit existing account
  const [accountDialog,setAccountDialog]=useState<string|null|undefined>(undefined);
  const activeLeverage=accountLeverage(paperSettings,activeAsset);
  const activeCategory=marketPaperCategory(activeAsset);
  const feeDescription=(()=>{
    const derivative=activeAsset.category==='futures'||activeAsset.category==='options'||activeAsset.marketType==='futures';
    if(derivative&&paperSettings.futuresOptions.enabled)
      return paperSettings.futuresOptions.perContract.toString()+' '+paperSettings.currency+' per contract / fill';
    const c=paperSettings.commission;
    return c.enabled?(c.mode==='percent'?c.amount+'% of notional':c.amount+' '+paperSettings.currency+' fixed')+' per fill':'No commissions';
  })();
  const [tp,setTp]=useState('');
  const [sl,setSl]=useState('');
  const [editId,setEditId]=useState<string|null>(null);
  const [editTp,setEditTp]=useState('');
  const [editSl,setEditSl]=useState('');
  const [editTrailingEnabled,setEditTrailingEnabled]=useState(false);
  const [editTrailingPercent,setEditTrailingPercent]=useState('0.50');
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
      <strong>Paper Trading</strong>
      <div className="relative">
        <button type="button" aria-expanded={accountListOpen} aria-label="Select Paper Trading account"
          onClick={()=>setAccountListOpen(v=>!v)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 border border-[#3c414c] hover:bg-[#323844] text-[#e4e6ec]">
          {account.name} <span className="text-[9px] text-[#babdc7]">{paperSettings.currency}</span><ChevronDown size={13}/>
        </button>
        {accountListOpen&&<div className="absolute left-0 bottom-[calc(100%+4px)] w-[280px] max-h-[310px] overflow-y-auto rounded-lg border border-[#383c44] bg-[#1e2024] shadow-[0_12px_35px_#000a] z-[100] py-1">
          <p className="text-[10px] uppercase tracking-widest px-3 py-2 text-[#999da9]">Paper Trading Accounts</p>
          {paperAccounts.map(record=><div key={record.id} className={`group flex items-center gap-1 px-1.5 hover:bg-[#30343d] ${record.id===activePaperAccountId?'bg-[#e5e6e9] text-[#16191f]':'text-[#e7e8ea]'}`}>
            <button type="button" className="flex-1 min-w-0 flex gap-2 items-center px-2 py-2 text-left"
              onClick={()=>{onSelectPaperAccount(record.id);setAccountListOpen(false);}}>
              <span className="truncate">{record.portfolio.account.name}</span>
              <span className="text-[9px] opacity-70">{record.portfolio.settings.currency}</span>
              {record.id===activePaperAccountId&&<Check size={13} className="ml-auto"/>}
            </button>
            <button type="button" title={'Settings for '+record.portfolio.account.name}
              className="p-1.5 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#91949a]/25"
              onClick={e=>{e.stopPropagation();setAccountDialog(record.id);setAccountListOpen(false);}}>
              <Settings2 size={15}/>
            </button>
          </div>)}
          <div className="mt-1 border-t border-[#45484e]">
            <button type="button" className="flex items-center gap-2 w-full px-3 py-3 hover:bg-[#30343d] text-left text-[#e6e8eb]"
              onClick={()=>{setAccountDialog(null);setAccountListOpen(false);}}><Plus size={16}/> Create account…</button>
          </div>
        </div>}
      </div>
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
    <div className="flex items-center gap-2 flex-wrap bg-[#1b202d] border-b border-[#303645] px-3 py-2 text-[11px]">
      <strong>{activeAsset.symbol}</strong>
      <span className={live?'text-[#089981]':'text-[#f4b77c]'}>{live?'Live reference '+amount(activeAsset.price)+' '+activeAsset.currency:'Live price unavailable'}</span>
      <span className="text-[#aeb7ca]">{activeCategory} · {activeLeverage}×</span>
      <span className="text-[#9299aa]">{feeDescription}</span>
      <button type="button" onClick={onOpenTicket} className="rounded bg-[#2862fb] px-3 py-1.5 font-semibold text-white hover:bg-[#477bf9]">Create order</button>
      <button type="button" className="ml-auto px-2 py-1 border border-[#5e5460] rounded hover:bg-[#393342]"
        onClick={()=>{if(window.confirm('Reset '+account.name+' and erase all its positions, pending orders, fills and conditional rules?'))onResetPaper();}}>Reset account</button>
    </div>
    {paperError&&<div role="alert" className="px-3 py-1 text-[11px] text-[#ffc5c5] bg-[#51202b]">{paperError}</div>}
    <nav className="flex flex-wrap items-center gap-1 border-b border-[#2a2e39] px-2 py-1 text-[11px]">
      {tabs.map(([id,name])=><button type="button" key={id} onClick={()=>setTab(id)}
        className={`rounded px-2 py-1 ${tab===id?'bg-[#2a3142] text-white':'text-[#9197a5] hover:bg-[#212633]'}`}>
        {name}{id==='positions'?` (${positions.length})`:id==='orders'?` (${conditionalOrders.length+pendingOrders.length})`:''}
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
          <td>
            {p.tp??'—'} / {p.sl??'—'}
            {p.trailingPercent&&<small className="block text-[#88b2fa]">
              Trailing {p.trailingPercent}% · {p.side==='Long'?'peak':'trough'} {amount(p.trailingAnchor??p.entryPrice)}
            </small>}
          </td><td className="flex items-center gap-2 py-2">
            <button title="Add conditional order" onClick={()=>onOpenCreateConditionalOrder({type:'position',label:p.symbol+' position'})}><Zap size={13}/></button>
            <button title="Edit TP and SL" onClick={()=>{setEditId(editId===p.id?null:p.id);
              setEditTp(p.tp?.toString()||'');setEditSl(p.sl?.toString()||'');
              setEditTrailingEnabled(!!p.trailingPercent);
              setEditTrailingPercent(p.trailingPercent?.toString()||'0.50');}}><Edit2 size={13}/></button>
            <button title="Close at latest verified price" className="text-[#f77f90]" onClick={()=>onClosePosition(p.id)}><X size={13}/></button>
          </td>
        </tr>
        {editId===p.id&&<tr className="bg-[#202a36]"><td colSpan={10} className="p-2">
          <label>Take profit <input type="number" step="any" min="0" value={editTp} onChange={e=>setEditTp(e.target.value)} className="ml-1 w-24 bg-[#0c1320] rounded px-2"/></label>
          <label className="ml-4">Stop loss <input type="number" step="any" min="0" value={editSl} onChange={e=>setEditSl(e.target.value)} className="ml-1 w-24 bg-[#0c1320] rounded px-2"/></label>
          <label className="ml-4 inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" aria-label="Trail stop loss for open position"
              checked={editTrailingEnabled} onChange={e=>setEditTrailingEnabled(e.target.checked)}
              className="accent-[#789ffe]"/>
            Trailing SL
          </label>
          <label className="ml-2 inline-flex items-center gap-1">
            <input type="number" step="any" min="0" max="99.9999"
              aria-label="Existing position trailing stop distance percent"
              disabled={!editTrailingEnabled} value={editTrailingPercent}
              onChange={e=>setEditTrailingPercent(e.target.value)}
              className="w-20 bg-[#0c1320] rounded px-2 disabled:opacity-40"/>%
          </label>
          <button className="ml-3 text-[#7ea7ff]" onClick={()=>{
            onEditPosition(p.id,editTp?Number(editTp):undefined,editSl?Number(editSl):undefined,
              editTrailingEnabled?Number(editTrailingPercent):null);
            setEditId(null);
          }}>Save stops</button>
          <button className="ml-3 text-[#98a1b6]" onClick={()=>setEditId(null)}>Cancel</button>
        </td></tr>}
        </React.Fragment>)}
        {positions.length===0&&<tr><td colSpan={10} className="text-center p-5 text-[#8792a6]">No open paper positions. Enter a quantity, wait for a verified live quote, then buy or short.</td></tr>}
      </tbody></table>}
      {tab==='orders'&&<div className="space-y-2">
        <div className="flex justify-between items-center px-3 pt-2">
          <strong className="text-[#e6e9f0]">Pending limit / stop orders ({pendingOrders.length})</strong>
          <button className="text-[#79aaff]" onClick={onOpenTicket}>+ Create order</button>
        </div>
        {pendingOrders.map(o=><div key={o.id} className="border-b border-[#313641] p-2 flex items-center gap-3 flex-wrap">
          <strong>{o.symbol}</strong><span className={o.side==='Long'?'text-[#2cbd99]':'text-[#f06a7b]'}>{o.side}</span>
          <span>{o.kind.toUpperCase()} @ {amount(o.price)}</span><span>{amount(o.qty)} units · {o.exchange}</span>
          <span className="text-[#adb4c3]">Expires: {o.expiresAt?new Date(o.expiresAt).toLocaleString():'GTC'}</span>
          <button className="ml-auto text-[#f58b95] hover:underline" onClick={()=>onCancelPendingOrder(o.id)}>Cancel</button>
        </div>)}
        {!pendingOrders.length&&<p className="text-[#838b9d] px-3 py-2">No pending entries.</p>}
        <div className="border-t border-[#313641]"><ConditionalOrdersTable orders={conditionalOrders} onOpenCreateModal={()=>onOpenCreateConditionalOrder(null)}
          onEditOrder={onEditConditionalOrder} onToggleStatus={onToggleConditionalOrderStatus}
          onDeleteOrder={onDeleteConditionalOrder} onTestTrigger={onTestTriggerConditionalOrder}/></div>
      </div>}
      {['orderHistory','balanceHistory','activityLog','tradeHistory'].includes(tab)&&<div>
        {fills.length?fills.map(f=><div key={f.id} className="grid grid-cols-6 gap-2 p-2 border-b border-[#313641]">
          <span>{new Date(f.timestamp).toLocaleString()}</span><span>{f.exchange} · {f.symbol}</span>
          <span>{f.note} · {f.side}</span><span>{amount(f.quantity)} @ {amount(f.price)}</span>
          <span>Fee: {cash(f.fee)}</span><span className={f.realizedPnL>=0?'text-[#089981]':'text-[#f23645]'}>Net: {cash(f.realizedPnL)}</span>
        </div>):<p className="p-5 text-[#8792a6]">No paper executions yet.</p>}
      </div>}
      {tab==='analytics'&&<div className="p-4 flex flex-wrap gap-6">
        <span>Starting capital: {paperSettings.startingBalance.toLocaleString()} {paperSettings.currency}</span><span>Completed closes: {fills.filter(f=>f.note.toLowerCase().includes('close')).length}</span>
        <span>Net realized: {cash(account.realizedPnL)} {paperSettings.currency}</span><span>Open P&L: {cash(account.unrealizedPnL)} {paperSettings.currency}</span>
        <span>Equity: {cash(account.equity)} {paperSettings.currency}</span><span>Available: {cash(account.availableFunds)} {paperSettings.currency}</span>
      </div>}
    </div>
    {accountDialog!==undefined&&createPortal(
      <PaperAccountModal existing={paperAccounts.find(a=>a.id===accountDialog)}
        proposedName={`Primary ${String(paperAccounts.length+1).padStart(3,'0')}`}
        onClose={()=>setAccountDialog(undefined)}
        onSave={(name,settings)=>onSavePaperAccount(accountDialog,name,settings)}
        onDelete={accountDialog!==null&&paperAccounts.length>1?
          ()=>onDeletePaperAccount(accountDialog):undefined}/>,document.body)}
  </section>;
};
