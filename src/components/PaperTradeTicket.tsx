import React,{useEffect,useMemo,useState} from 'react';
import {X,ChevronDown,ChevronUp,Plus,ArrowLeftRight,Settings2,Info} from 'lucide-react';
import type {Asset,OrderBookItem} from '../types';
import type {PaperPortfolio} from '../services/paperTrading';
import {accountLeverage,isFreshPaperQuote,paperCommission} from '../services/paperTrading';
import type {PaperOrderKind,PaperOrderRequest,PaperOrderSide,PaperTimeInForce,PaperExitMode} from '../services/paperOrders';
import {estimatePaperQty,exitPriceFromValue,exitValueFromPrice,pendingFor,withOrderReservations} from '../services/paperOrders';

interface Props{
  open:boolean;onClose:()=>void;asset:Asset;portfolio:PaperPortfolio;
  onSubmit:(order:PaperOrderRequest)=>string|null;
  bids:OrderBookItem[];asks:OrderBookItem[];
  error:string;onOpenAccount:()=>void;
}
const controls='w-full rounded-md border border-[#464646] bg-[#1b1b1d] px-2 py-1.5 outline-none focus:border-[#3977ff] text-[#e8eaf0] text-xs';
const pct=(v:number)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:5}):'—';
const options:Record<'tp'|'sl',{mode:PaperExitMode;label:string}[]>={
  tp:[{mode:'price',label:'Price'},{mode:'ticks',label:'Ticks'},{mode:'percent',label:'% price'},
      {mode:'money',label:'Reward (account currency)'},{mode:'balance',label:'Reward % balance'}],
  sl:[{mode:'price',label:'Price'},{mode:'ticks',label:'Ticks'},{mode:'percent',label:'% price'},
      {mode:'money',label:'Risk (account currency)'},{mode:'balance',label:'Risk % balance'}],
};
function ExitField({kind,entry,qty,balance,side,tick,enabled,setEnabled,mode,setMode,value,setValue}:{
  kind:'tp'|'sl';entry:number;qty:number;balance:number;side:PaperOrderSide;tick:number;
  enabled:boolean;setEnabled:(v:boolean)=>void;mode:PaperExitMode;setMode:(v:PaperExitMode)=>void;
  value:string;setValue:(v:string)=>void;
}){
  const [menu,setMenu]=useState(false);
  const target=enabled?exitPriceFromValue(entry,qty,side,kind,mode,Number(value),tick,balance):undefined;
  const money=target&&qty?Math.abs(target-entry)*qty:0;
  const updateMode=(next:PaperExitMode)=>{
    if(target&&target>0)setValue(String(Number(exitValueFromPrice(entry,qty,side,kind,next,target,tick,balance).toPrecision(9))));
    setMode(next);setMenu(false);
  };
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div className="relative">
        <button type="button" onClick={()=>setMenu(v=>!v)} className="flex items-center gap-1 text-[11px] text-[#b2b6c0] hover:text-white">
          {kind==='tp'?'Take profit':'Stop loss'} {options[kind].find(x=>x.mode===mode)?.label}<ChevronDown size={12}/>
        </button>
        {menu&&<div className="absolute z-[80] left-0 top-full mt-1 min-w-[177px] rounded-md bg-[#202123] border border-[#383a3e] p-1 shadow-xl">
          {options[kind].map(o=><button key={o.mode} type="button" onClick={()=>updateMode(o.mode)}
            className={`w-full text-left px-2 py-1.5 text-[11px] rounded hover:bg-[#32363d] ${o.mode===mode?'bg-[#eeeeef] text-[#111]':'text-[#d8dae0]'}`}>{o.label}</button>)}
        </div>}
      </div>
      <button type="button" role="switch" aria-label={kind==='tp'?'Enable take profit':'Enable stop loss'} aria-checked={enabled}
        className={`relative w-9 h-5 rounded-full ${enabled?'bg-[#efefef]':'bg-[#44464b]'}`} onClick={()=>setEnabled(!enabled)}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full shadow ${enabled?'right-0.5 bg-[#1a1c22]':'left-0.5 bg-[#81848b]'}`}/>
      </button>
    </div>
    <div className={`flex items-center gap-1 rounded-md border border-[#414348] h-9 px-2 ${enabled?'bg-[#141516]':'opacity-45 bg-[#252528]'}`}>
      <input type="number" step="any" min="0" disabled={!enabled} value={value} onChange={e=>setValue(e.target.value)}
        aria-label={kind==='tp'?'Take-profit value':'Stop-loss value'}
        className="bg-transparent outline-none flex-1 min-w-0 text-xs text-[#f6f7fa]"/>
      <ArrowLeftRight size={12} className="text-[#7c8190]"/>
      <span className="text-[10px] text-[#adb2bb] truncate max-w-24" title={target?'Price: '+pct(target):''}>{target&&target>0?
        `${pct(money)} ${mode==='money'?'': 'value'}`:'—'}</span>
    </div>
    {enabled&&<div className="text-right text-[10px] text-[#8b96ac]">Target: {target&&target>0?pct(target):'Invalid target'} · {pct(money)} at risk/reward</div>}
  </div>;
}
export const PaperTradeTicket:React.FC<Props>=({open,onClose,asset,portfolio,onSubmit,bids,asks,error,onOpenAccount})=>{
  const [side,setSide]=useState<PaperOrderSide>('Long');
  const [kind,setKind]=useState<PaperOrderKind>('market');
  const [sizeMode,setSizeMode]=useState<'balance'|'units'|'notional'>('balance');
  const [sizeInput,setSizeInput]=useState('99');
  const [priceInput,setPriceInput]=useState('');
  const [tif,setTif]=useState<PaperTimeInForce>('Week');
  const [dom,setDom]=useState(false);
  const [tpEnabled,setTpEnabled]=useState(false);
  const [slEnabled,setSlEnabled]=useState(false);
  const [trailingEnabled,setTrailingEnabled]=useState(false);
  const [trailingPercent,setTrailingPercent]=useState('0.50');
  const [tpMode,setTpMode]=useState<PaperExitMode>('percent');
  const [slMode,setSlMode]=useState<PaperExitMode>('percent');
  const [tpValue,setTpValue]=useState('2.10');
  const [slValue,setSlValue]=useState('0.13');
  const [extraTps,setExtraTps]=useState<Array<{id:number;price:string;share:string}>>([]);
  const [exitsOpen,setExitsOpen]=useState(true);
  const [settingsOpen,setSettingsOpen]=useState(true);
  const [sizeMenu,setSizeMenu]=useState(false);
  const [errorLocal,setErrorLocal]=useState('');
  const venue=asset.source||asset.exchange;
  useEffect(()=>{setPriceInput('');setErrorLocal('');setKind('market');setDom(false);setExtraTps([]);},[asset.symbol,venue]);
  useEffect(()=>{
    if(!open)return;
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[open,onClose]);
  const live=isFreshPaperQuote(asset);
  const mark=Number(asset.price);
  const entry=kind==='market'?mark:Number(priceInput);
  const base=withOrderReservations(portfolio);
  const leverage=accountLeverage(portfolio.settings,asset);
  const tick=10**(-Math.min(Math.max(asset.digits||2,0),10));
  const fraction=Number(sizeInput)||0;
  const qty=useMemo(()=>{
    if(!Number.isFinite(entry)||entry<=0)return 0;
    if(sizeMode==='balance')return estimatePaperQty(base,asset,fraction,entry);
    if(sizeMode==='units')return Number(sizeInput)||0;
    return (Number(sizeInput)||0)/entry;
  },[base.account.availableFunds,portfolio.settings,asset.symbol,mark,entry,fraction,sizeMode]);
  const exposure=qty*entry;
  const margin=exposure/leverage;
  const fee=paperCommission(portfolio.settings,asset,qty,entry);
  const tp=tpEnabled?exitPriceFromValue(entry,qty,side,'tp',tpMode,Number(tpValue),tick,base.account.balance):undefined;
  const sl=slEnabled?exitPriceFromValue(entry,qty,side,'sl',slMode,Number(slValue),tick,base.account.balance):undefined;
  const trailingNumber=Number(trailingPercent);
  const validTrailing=!trailingEnabled||(trailingPercent.trim()!==''&&
    Number.isFinite(trailingNumber)&&trailingNumber>0&&trailingNumber<100);
  const trailingStop=trailingEnabled&&validTrailing&&entry>0?
    entry*(side==='Long'?1-trailingNumber/100:1+trailingNumber/100):undefined;
  // Both protective stops can be enabled; whichever is tighter applies.
  const protectiveStop=sl===undefined?trailingStop:trailingStop===undefined?sl:
    side==='Long'?Math.max(sl,trailingStop):Math.min(sl,trailingStop);
  const allocated=extraTps.reduce((sum,l)=>sum+(Number(l.share)||0),0);
  const levels=tpEnabled&&tp&&extraTps.length?
    [{price:tp,sharePercent:100-allocated},...extraTps.map(l=>({price:Number(l.price),sharePercent:Number(l.share)}))]:undefined;
  const validLevels=!levels||(allocated<100 && extraTps.every(l=>Number(l.price)>0 && Number(l.share)>0) &&
    levels.every(l=>side==='Long'?l.price>entry:l.price<entry));
  const reward=tp&&qty?(levels?
    levels.reduce((sum,l)=>sum+Math.abs(l.price-entry)*qty*l.sharePercent/100,0):
    Math.abs(tp-entry)*qty):0;
  const risk=protectiveStop&&qty?Math.abs(entry-protectiveStop)*qty:0;
  const rr=risk>0?reward/risk:0;
  const cash=portfolio.settings.currency;
  const sizeLabels={balance:'% Balance',units:'Units',notional:'Notional '+cash};
  const chooseSizeMode=(mode:'balance'|'units'|'notional')=>{
    if(mode==='balance')setSizeInput(String(pct(base.account.availableFunds?margin/base.account.availableFunds*100:0)));
    else if(mode==='units')setSizeInput(String(Number(qty.toPrecision(10))||0));
    else setSizeInput(String(Number(exposure.toPrecision(10))||0));
    setSizeMode(mode);setSizeMenu(false);
  };
  const canSubmit=live&&qty>0&&Number.isFinite(qty)&&entry>0&&
    (kind==='market'||Number(priceInput)>0)&&margin+fee<=base.account.availableFunds+1e-7&&
    (!tpEnabled||!!tp)&&(!slEnabled||!!sl)&&validTrailing&&validLevels&&asset.currency===cash;
  const submit=()=>{
    setErrorLocal('');
    const reason=onSubmit({side,kind,qty,price:kind==='market'?undefined:entry,tp,sl,timeInForce:tif,
      trailingStopPercent:trailingEnabled?trailingNumber:undefined,
      takeProfitLevels:levels});
    if(reason)setErrorLocal(reason);
    else onClose();
  };
  if(!open)return null;
  return <aside role="dialog" aria-label="Paper Trading order entry" aria-modal="false"
    className="fixed right-0 top-8 bottom-0 z-[135] w-full sm:w-[310px] bg-[#151515] border-l border-[#35363a] text-[#e9ecf2] shadow-[-14px_0_50px_#000a] flex flex-col font-sans animate-in slide-in-from-right-4 duration-200">
    <div className="flex items-center gap-2 px-3 h-12 shrink-0 border-b border-[#27282b]">
      <div className="bg-[#f3f5fa] text-[#151921] rounded w-6 h-6 grid place-items-center font-bold text-xs">TV</div>
      <div className="flex-1 min-w-0"><div className="truncate font-semibold text-xs">{asset.symbol}</div>
        <div className="truncate text-[10px] text-[#9aa3b5]">{venue} · {portfolio.account.name}</div></div>
      <button type="button" title="Account settings" onClick={onOpenAccount}><Settings2 size={16}/></button>
      <button type="button" title="Close order panel" onClick={onClose}><X size={19}/></button>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-5">
      <div className="flex rounded-lg bg-[#262629] p-1 my-2 text-xs">
        <button onClick={()=>setDom(false)} className={`flex-1 h-7 rounded ${!dom?'bg-[#46464b] text-white':'text-[#a8abb4]'}`}>Order</button>
        <button onClick={()=>setDom(true)} className={`flex-1 h-7 rounded ${dom?'bg-[#46464b] text-white':'text-[#a8abb4]'}`}>DOM</button>
      </div>
      {dom?<div className="space-y-3 text-xs">
        <h3 className="text-[#e2e5ec] font-semibold">Market depth · {asset.symbol}</h3>
        {bids.length&&asks.length?<>
          <div className="grid grid-cols-2 text-[#9fa5ae]"><span>Bid</span><span className="text-right">Ask</span></div>
          {Array.from({length:Math.min(10,Math.max(bids.length,asks.length))},(_,i)=><div key={i} className="grid grid-cols-2 border-b border-[#35363a] py-1 font-mono">
            <span className="text-[#ce6b73]">{bids[i]?pct(Number(bids[i].price)):'—'}</span>
            <span className="text-right text-[#6fa2ff]">{asks[i]?pct(Number(asks[i].price)):'—'}</span>
          </div>)}
        </>:<p className="py-5 leading-relaxed text-[#9da5b5]">This feed does not supply verified Level 2 order-book depth. No simulated DOM is shown. Select Order to place a paper trade from a verified last price.</p>}
      </div>:<>
        <div className="grid grid-cols-2 gap-1 mt-3 rounded-lg bg-[#27272a] p-0.5">
          {(['Short','Long'] as const).map(s=><button key={s} onClick={()=>setSide(s)}
            className={`rounded-md py-1.5 px-2 flex flex-col ${side===s?s==='Long'?'bg-[#1744a3]':'bg-[#702a30]':'hover:bg-[#343539]'}`}>
            <span className="text-[10px]">{s==='Long'?'Buy':'Sell'}</span>
            <span className="text-sm font-mono">{live?pct(mark):'—'}</span>
          </button>)}
        </div>
        <p className="text-right text-[10px] text-[#959aa5] mt-1">Simulated entry at verified last trade, not guaranteed bid/ask</p>
        <div className="grid grid-cols-3 mt-3 border-b-2 border-[#55565a]">
          {(['market','limit','stop'] as const).map(k=><button key={k} onClick={()=>{setKind(k);setPriceInput('');setErrorLocal('');}}
            className={`text-xs py-2 capitalize border-b-2 -mb-[2px] ${k===kind?'border-[#f1f1f2] text-white':'border-transparent text-[#a3a4ac]'}`}>{k}</button>)}
        </div>
        {kind!=='market'&&<label className="block mt-3 text-[11px] text-[#b5bbc5]">Entry trigger price
          <input className={`mt-1 ${controls}`} type="number" min="0" step="any" aria-label="Entry price" value={priceInput}
            onChange={e=>setPriceInput(e.target.value)} placeholder={'Last '+(live?pct(mark):'unavailable')}/>
        </label>}
        <div className="mt-4">
          <div className="relative mb-1">
            <button className="flex items-center gap-1 text-[11px] text-[#b8bfca]" onClick={()=>setSizeMenu(v=>!v)}>
              {sizeLabels[sizeMode]}<ChevronDown size={12}/></button>
            {sizeMenu&&<div className="absolute top-full left-0 z-[90] bg-[#252528] border border-[#44464b] rounded shadow-xl min-w-[144px]">
              {(['balance','units','notional'] as const).map(m=><button type="button" onClick={()=>chooseSizeMode(m)} key={m}
                className="block text-left w-full px-3 py-2 hover:bg-[#3c3e44] text-xs">{sizeLabels[m]}</button>)}</div>}
          </div>
          <div className="flex items-center gap-1 border rounded-md border-[#44464b] bg-[#191a1d] h-9 px-2">
            <input aria-label="Order size" className="bg-transparent flex-1 min-w-0 outline-none text-xs" type="number" min="0" step="any"
              value={sizeInput} onChange={e=>setSizeInput(e.target.value)}/>
            <ArrowLeftRight size={13} className="text-[#9da4b1]"/>
            <span className="text-[11px] text-[#bac2d0]">{pct(exposure)} {cash}</span>
          </div>
          {sizeMode==='balance'&&<>
            <input type="range" aria-label="Percentage of balance" className="w-full mt-2 accent-[#dee2eb]" min="0" max="100" step="1"
              value={Math.min(100,Math.max(0,Number(sizeInput)||0))} onChange={e=>setSizeInput(e.target.value)}/>
            <div className="flex justify-between text-[10px] text-[#7d8491]">
              {[0,25,50,75,99,100].map(x=><button key={x} onClick={()=>setSizeInput(String(x))} className="hover:text-white">{x}%</button>)}
            </div>
          </>}
          <p className="text-[10px] text-[#a1a9b8] mt-2">
            Available {pct(base.account.availableFunds)} {cash} · {leverage}× leverage · Margin {pct(margin)} {cash}
          </p>
        </div>
        <div className="mt-5">
          <button className="w-full flex items-center justify-between text-xs font-semibold mb-3" onClick={()=>setExitsOpen(v=>!v)}>
            Exits {exitsOpen?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
          {exitsOpen&&<div className="space-y-4">
            <ExitField kind="tp" entry={entry} qty={qty} balance={base.account.balance} side={side} tick={tick}
              enabled={tpEnabled} setEnabled={setTpEnabled} mode={tpMode} setMode={setTpMode} value={tpValue} setValue={setTpValue}/>
            <ExitField kind="sl" entry={entry} qty={qty} balance={base.account.balance} side={side} tick={tick}
              enabled={slEnabled} setEnabled={setSlEnabled} mode={slMode} setMode={setSlMode} value={slValue} setValue={setSlValue}/>
            <div className="space-y-1.5 border-t border-[#33363a] pt-3">
              <div className="flex items-center justify-between">
                <label htmlFor="paper-trailing-stop-toggle" className="text-[11px] text-[#b2b6c0] cursor-pointer">
                  Trailing stop loss
                </label>
                <button id="paper-trailing-stop-toggle" type="button" role="switch"
                  aria-checked={trailingEnabled} aria-label="Enable trailing stop loss"
                  className={`relative w-9 h-5 rounded-full ${trailingEnabled?'bg-[#efefef]':'bg-[#44464b]'}`}
                  onClick={()=>setTrailingEnabled(v=>!v)}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full shadow ${trailingEnabled?'right-0.5 bg-[#1a1c22]':'left-0.5 bg-[#81848b]'}`}/>
                </button>
              </div>
              <label className="block text-[11px] text-[#9fa8b9]">
                Trail distance (% of price)
                <div className={`mt-1 flex items-center gap-2 rounded-md border border-[#414348] h-9 px-2 ${trailingEnabled?'bg-[#141516]':'opacity-45 bg-[#252528]'}`}>
                  <input type="number" min="0" max="99.9999" step="any"
                    aria-label="Trailing stop distance percent"
                    disabled={!trailingEnabled} value={trailingPercent}
                    onChange={e=>setTrailingPercent(e.target.value)}
                    className="bg-transparent outline-none flex-1 min-w-0 text-xs text-[#f6f7fa]"/>
                  <span className="text-xs text-[#b4bac6]">%</span>
                </div>
              </label>
              {trailingEnabled&&<>
                {validTrailing?
                  <p className="text-[10px] text-[#8faac5]">
                    Initial trail: {trailingStop?trailingStop.toLocaleString(undefined,{maximumFractionDigits:10}):'—'}
                    {' · '}Follows {side==='Long'?'rising':'falling'} prices only.
                    {slEnabled?' The tighter of fixed and trailing stops applies.':''}
                  </p>:
                  <p role="alert" className="text-[10px] text-[#ff9ba8]">Enter a distance greater than 0% and less than 100%.</p>}
              </>}
            </div>
            {tpEnabled&&<>
              {extraTps.map((l,i)=><div key={l.id} className="flex gap-1 items-end">
                <label className="flex-1 min-w-0 text-[10px] text-[#abb5c5]">TP level {i+2} price
                  <input type="number" step="any" min="0" value={l.price} aria-label={'TP level '+(i+2)+' price'}
                    onChange={e=>setExtraTps(prev=>prev.map(x=>x.id===l.id?{...x,price:e.target.value}:x))}
                    className={controls}/></label>
                <label className="w-20 text-[10px] text-[#abb5c5]">Close %
                  <input type="number" min="0" max="99" step="any" value={l.share}
                    aria-label={'TP level '+(i+2)+' percent'}
                    onChange={e=>setExtraTps(prev=>prev.map(x=>x.id===l.id?{...x,share:e.target.value}:x))}
                    className={controls}/></label>
                <button title="Remove this take profit level" className="h-8 px-1.5 text-[#eb8c98]"
                  onClick={()=>setExtraTps(prev=>prev.filter(x=>x.id!==l.id))}><X size={14}/></button>
              </div>)}
              {extraTps.length>0&&<p className="text-[10px] text-[#99a1b0]">
                Primary target closes {pct(100-allocated)}%; additional levels close {pct(allocated)}%.</p>}
              {!validLevels&&<p className="text-[10px] text-[#ffb3bf]">
                Each TP must be profitable, and extra targets must total less than 100%.</p>}
              {extraTps.length<5&&<button type="button" className="text-[11px] text-[#7ca8ff] flex items-center gap-1"
                onClick={()=>{
                  const price=tp&&entry?tp+(tp-entry)*.5*(extraTps.length+1):entry;
                  setExtraTps(prev=>[...prev,{id:Date.now()+prev.length,price:price>0?String(Number(price.toPrecision(10))):'',share:'25'}]);
                }}><Plus size={13}/> Add level</button>}
            </>}
            {tpEnabled&&(slEnabled||trailingEnabled)&&risk>0&&<p className="flex justify-between text-[11px] text-[#c7cbd5]">
              <span>Risk / Reward</span><strong>{pct(rr)}</strong></p>}
          </div>}
        </div>
        {kind!=='market'&&<div className="mt-5">
          <button className="w-full flex items-center justify-between text-xs font-semibold mb-2" onClick={()=>setSettingsOpen(v=>!v)}>
            Extra settings {settingsOpen?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
          {settingsOpen&&<label className="block text-[11px] text-[#adb4c1]">Time in force
            <select className={`mt-1 ${controls}`} value={tif} onChange={e=>setTif(e.target.value as PaperTimeInForce)}>
              <option value="Day">Day (24 hours)</option><option value="Week">Week (7 days)</option><option value="GTC">Good till cancelled</option>
            </select></label>}
        </div>}
        <div className="mt-3 text-[10px] text-[#949ba9]">
          Est. opening commission: {pct(fee)} {cash}. Market entries use last observed price; live price may change before submission.
        </div>
        {(errorLocal||error)&&<p role="alert" className="mt-2 p-2 bg-[#431e29] rounded text-[11px] text-[#ffbbc5]">{errorLocal||error}</p>}
        {asset.currency!==cash&&<p className="text-[11px] text-[#efb578] mt-2">
          This market is quoted in {asset.currency}; account uses {cash}. Switch to a matching paper account.</p>}
        {!live&&<p className="text-[11px] text-[#e1b06f] mt-2">A current exchange quote is required before submitting this order.</p>}
        <button type="button" onClick={submit} disabled={!canSubmit}
          className={`w-full min-h-14 rounded-lg text-sm font-bold mt-5 px-3 ${side==='Long'?'bg-[#2862fb]':'bg-[#bb394e]'} text-white disabled:bg-[#333437] disabled:text-[#8d939c] disabled:cursor-not-allowed`}>
          {live&&qty>0&&canSubmit?<><div>{side==='Long'?'Buy':'Sell'}</div>
            <div className="font-normal text-[10px] mt-0.5">{pct(qty)} {asset.symbol} · {kind.toUpperCase()}{kind!=='market'?' @ '+pct(entry):''}</div>
          </>: 'Start creating order'}
        </button>
      </>}
    </div>
  </aside>;
};
