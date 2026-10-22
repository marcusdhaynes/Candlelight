import React,{useEffect,useState} from 'react';
import {X,Info} from 'lucide-react';
import type {PaperAccountRecord} from '../services/paperAccounts';
import {DEFAULT_PAPER_SETTINGS,normalizePaperSettings,type PaperSettings} from '../services/paperTrading';

interface Props{
  existing?:PaperAccountRecord|null;
  proposedName:string;
  onClose:()=>void;
  onSave:(name:string,settings:PaperSettings)=>void;
  onDelete?:()=>void;
}
const currencyOptions=['USD','USDT','USDC','EUR','GBP','JPY','BTC'];
const cls='w-full h-9 rounded-md bg-[#202124] border border-[#4b4d51] text-[#f1f3f5] px-2 outline-none focus:border-[#91ade7]';
const label='block text-[11px] text-[#b8bbbf] mb-1';
const groupNames: {id:keyof PaperSettings['leverages'];title:string}[]=[
  {id:'stocks',title:'Stocks / Funds'},
  {id:'futures',title:'Futures / Options'},
  {id:'forex',title:'Forex'},
  {id:'crypto',title:'Crypto'},
  {id:'others',title:'Others'},
];
export function PaperAccountModal({existing,proposedName,onClose,onSave,onDelete}:Props){
  const [name,setName]=useState(existing?.portfolio.account.name||proposedName);
  const [settings,setSettings]=useState<PaperSettings>(()=>normalizePaperSettings(existing?.portfolio.settings||DEFAULT_PAPER_SETTINGS));
  const [error,setError]=useState('');
  const locked=!!existing&&(existing.portfolio.positions.length>0||existing.portfolio.fills.length>0);
  useEffect(()=>{
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);
  },[onClose]);
  const save=()=>{
    try{onSave(name,settings);onClose();}
    catch(e){setError(e instanceof Error?e.message:'Unable to save account');}
  };
  const change=(patch:Partial<PaperSettings>)=>setSettings(s=>({...s,...patch}));
  return <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4" role="presentation"
    onPointerDown={e=>{if(e.currentTarget===e.target)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label={existing?'Paper Trading account settings':'Create Paper Trading account'}
      className="w-full max-w-[390px] max-h-[92vh] overflow-y-auto rounded-xl border border-[#414347] bg-[#1d1f21] text-white shadow-[0_16px_60px_#000c]">
      <header className="flex items-center justify-between px-5 h-14 border-b border-[#323438] sticky top-0 bg-[#1d1f21] z-10">
        <h2 className="font-semibold text-base">{existing?'Account settings':'Create account'}</h2>
        <button type="button" title="Close account dialog" onClick={onClose} className="text-[#9fa2a8] hover:text-white"><X size={20}/></button>
      </header>
      <div className="px-5 py-4 space-y-4">
        <label className="block"><span className={label}>Account name</span>
          <input autoFocus className={cls} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className={label}>Starting balance</span>
            <input type="number" min="0" step="any" className={cls} disabled={locked}
              value={settings.startingBalance} onChange={e=>change({startingBalance:Number(e.target.value)})}/></label>
          <label><span className={label}>Currency</span>
            <select className={cls} disabled={locked} value={settings.currency}
              onChange={e=>change({currency:e.target.value})}>
              {currencyOptions.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
        </div>
        {locked&&<p className="text-[11px] text-[#aab0bb]">Balance and currency are locked after the first trade. Other settings can still be edited.</p>}
        <div className="border-t border-[#33363a] pt-3">
          <div className="uppercase tracking-wider text-[10px] text-[#bab9b7] mb-3">Leverage</div>
          <label className="flex items-center gap-2 text-[12px] cursor-pointer mb-3">
            <input type="checkbox" checked={settings.marginControl} onChange={e=>change({marginControl:e.target.checked})}
              className="accent-[#91aadc] h-4 w-4"/> Margin control
            <span title="If disabled, every new trade uses 1× leverage"><Info size={13} color="#8c9198"/></span>
          </label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {groupNames.map(({id,title})=><label key={id}><span className={label}>{title}</span>
              <select className={cls} disabled={!settings.marginControl} value={settings.leverages[id]}
                onChange={e=>change({leverages:{...settings.leverages,[id]:Number(e.target.value)}})}>
                {[1,2,3,5,10,20,25,50,75,100,125,200,500,1000].map(value=><option value={value} key={value}>{value}×</option>)}
              </select>
            </label>)}
          </div>
        </div>
        <div className="border-t border-[#33363a] pt-3">
          <div className="uppercase tracking-wider text-[10px] text-[#bab9b7] mb-3">Commission — optional</div>
          <label className="flex gap-2 items-center text-[12px] cursor-pointer">
            <input type="checkbox" className="accent-[#91aadc] h-4 w-4" checked={settings.futuresOptions.enabled}
              onChange={e=>change({futuresOptions:{...settings.futuresOptions,enabled:e.target.checked}})}/>
            Futures and options — per contract
          </label>
          <label className="block mt-3">
            <span className={label}>Commission per contract (account currency)</span>
            <input type="number" min="0" step="any" className={cls} disabled={!settings.futuresOptions.enabled}
              value={settings.futuresOptions.perContract}
              onChange={e=>change({futuresOptions:{...settings.futuresOptions,perContract:Number(e.target.value)}})}/>
          </label>
          <label className="flex gap-2 items-center text-[12px] mt-4 cursor-pointer">
            <input type="checkbox" className="accent-[#91aadc] h-4 w-4" checked={settings.commission.enabled}
              onChange={e=>change({commission:{...settings.commission,enabled:e.target.checked}})}/>
            Other trades — commission
          </label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label><span className={label}>Commission</span>
              <input type="number" min="0" step="any" className={cls} disabled={!settings.commission.enabled}
                value={settings.commission.amount}
                onChange={e=>change({commission:{...settings.commission,amount:Number(e.target.value)}})}/></label>
            <label><span className={label}>Commission type</span>
              <select className={cls} disabled={!settings.commission.enabled}
                value={settings.commission.mode}
                onChange={e=>change({commission:{...settings.commission,mode:e.target.value as 'fixed'|'percent'}})}>
                <option value="fixed">Fixed per execution</option><option value="percent">Percent of notional</option>
              </select></label>
          </div>
          <p className="text-[11px] text-[#a9adb7] mt-2">
            Fees are zero unless enabled. A fixed fee applies once per fill; a percent fee uses notional (enter 0.04 for 0.04%). Each opening, closing or partial-fill execution is calculated independently.
          </p>
        </div>
        {error&&<p role="alert" className="text-[12px] text-[#ffa7aa]">{error}</p>}
      </div>
      <footer className="border-t border-[#36383b] px-5 py-3 flex items-center justify-end gap-2 sticky bottom-0 bg-[#1d1f21]">
        {existing&&onDelete&&<button type="button" className="mr-auto px-3 py-2 text-xs text-[#ff9ca5] hover:text-white"
          onClick={()=>{if(window.confirm('Permanently delete this simulated account and its trade history?')){onDelete();onClose();}}}>Delete</button>}
        <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-[#62676f] text-xs hover:bg-[#33363a]">Cancel</button>
        <button type="button" onClick={save} className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#f0f1f4] text-[#191b1f] hover:bg-white">
          {existing?'Save changes':'Create'}
        </button>
      </footer>
    </section>
  </div>;
}
