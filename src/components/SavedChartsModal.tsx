import React,{useEffect,useMemo,useState} from 'react';
import {X,Save,Trash2,Download,RotateCcw,FileText} from 'lucide-react';
import type {Asset,ChartType,Timeframe,Drawing,IndicatorSettings} from '../types';
import {createSavedChartIdea,parseSavedCharts,SAVED_CHARTS_KEY,type SavedChartIdea} from '../services/savedCharts';

interface Props{
  open:boolean;onClose:()=>void;
  asset:Asset;timeframe:Timeframe;chartType:ChartType;
  drawings:Drawing[];indicators:IndicatorSettings;
  onRestore:(idea:SavedChartIdea)=>void;
}
const inputClass='w-full rounded border border-[#363f50] bg-[#101723] px-3 py-2 text-sm text-white outline-none focus:border-[#5e94f9]';
export const SavedChartsModal:React.FC<Props>=({open,onClose,asset,timeframe,chartType,drawings,indicators,onRestore})=>{
  const [saved,setSaved]=useState<SavedChartIdea[]>(()=>parseSavedCharts(localStorage.getItem(SAVED_CHARTS_KEY)));
  const [name,setName]=useState('');
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{if(open){setName(asset.symbol+' · '+timeframe+' · '+new Date().toLocaleDateString());setError('');}},
    [open,asset.symbol,timeframe]);
  useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open,onClose]);
  const sorted=useMemo(()=>saved.slice().sort((a,b)=>b.savedAt-a.savedAt),[saved]);
  const update=(next:SavedChartIdea[])=>{
    try{localStorage.setItem(SAVED_CHARTS_KEY,JSON.stringify(next));setSaved(next);setError('');}
    catch{setError('Could not save to browser storage. Please check available space and permissions.');}
  };
  const save=()=>{
    try{const record=createSavedChartIdea(asset,timeframe,chartType,drawings,indicators,name,note);
      update([...saved,record]);}
    catch(e){setError(e instanceof Error?e.message:'Could not save the chart.');}
  };
  const download=(record:SavedChartIdea)=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='candlelight-'+record.symbol.toLowerCase()+'-chart.json';
    a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if(!open)return null;
  return <div className="fixed inset-0 z-[250] bg-black/70 flex justify-center items-center p-3" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label="Save and restore charts"
      className="w-full max-w-[550px] max-h-[88vh] overflow-y-auto bg-[#1a202b] border border-[#454b59] rounded-xl text-[#e5eaf5] shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-[#1c2532] border-b border-[#343a45] px-5 py-4">
        <Save size={18} className="text-[#79a6ff]"/><strong className="text-base flex-1">Saved charts</strong>
        <button type="button" title="Close" onClick={onClose}><X size={20}/></button>
      </header>
      <div className="p-5 space-y-3">
        <p className="text-sm text-[#aeb8c8]">Save the current chart, indicators and drawings for later. <strong className="text-[#dce6f8]">Private on this browser only.</strong> Nothing is published online or shared.</p>
        <label className="block text-xs text-[#b6c0d0]">Chart name
          <input className={'mt-1 '+inputClass} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="block text-xs text-[#b6c0d0]">Notes (optional)
          <textarea rows={2} maxLength={5000} className={'mt-1 '+inputClass} value={note}
            onChange={e=>setNote(e.target.value)} placeholder="Setup, trade idea, or reason for saving"/>
        </label>
        <div className="flex justify-between items-center gap-3">
          <span className="text-xs text-[#8f9aa9]">{asset.symbol} · {asset.source||asset.exchange} · {timeframe} · {chartType}</span>
          <button onClick={save} className="inline-flex items-center gap-1.5 bg-[#2962ff] hover:bg-[#4a79fa] rounded px-4 py-2 text-sm font-semibold">
            <Save size={15}/> Save locally</button>
        </div>
        {error&&<p role="alert" className="text-[#ff9ea9] text-sm">{error}</p>}
        <div className="border-t border-[#3d4654] pt-3">
          <h3 className="text-sm font-semibold mb-2">Your saved charts ({saved.length})</h3>
          {sorted.length===0?<p className="text-sm text-[#8e99a8] py-6 text-center">No saved charts yet.</p>:
            <div className="space-y-2">{sorted.map(record=><div key={record.id} className="flex gap-3 items-center p-3 rounded bg-[#111923] border border-[#313c4d]">
              <FileText size={17} className="text-[#82a8ee] shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{record.name}</div>
                <div className="text-xs text-[#9eaabd]">{record.symbol} · {record.source} · {record.timeframe} · {new Date(record.savedAt).toLocaleString()}</div>
                {record.note&&<p className="text-xs text-[#a2b0c1] mt-1 line-clamp-2">{record.note}</p>}
              </div>
              <button onClick={()=>{onRestore(record);onClose();}} title="Restore saved chart" className="p-2 rounded hover:bg-[#2f4059] text-[#93bcff]">
                <RotateCcw size={17}/></button>
              <button onClick={()=>download(record)} title="Export chart JSON" className="p-2 rounded hover:bg-[#2f4059]"><Download size={17}/></button>
              <button onClick={()=>update(saved.filter(x=>x.id!==record.id))} title="Delete local saved chart" className="p-2 rounded hover:bg-[#45303a] text-[#f29ba6]"><Trash2 size={17}/></button>
            </div>)}</div>}
        </div>
      </div>
    </section>
  </div>;
};
