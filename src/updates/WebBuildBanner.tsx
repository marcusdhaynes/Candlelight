/// <reference types="vite/client" />
import React,{useEffect,useState} from 'react';

// Checks a manifest deployed together with the verified Pages artifact,
// not the tip of main (which may still be building).
const currentBuild=import.meta.env.VITE_BUILD_SHA || '';
export default function WebBuildBanner(){
  const [ready,setReady]=useState<string|null>(null);
  const [dismissed,setDismissed]=useState<string|null>(null);
  useEffect(()=>{
    if(!currentBuild)return;
    let disposed=false;
    const check=async()=>{
      try{
        const url=new URL(import.meta.env.BASE_URL+'version.json',window.location.origin);
        url.searchParams.set('check',String(Date.now()));
        const response=await fetch(url.toString(),{cache:'no-store'});
        if(!response.ok)return;
        const data=await response.json() as {sha?:string};
        if(!disposed && typeof data.sha==='string' &&
          /^[a-f0-9]{40}$/.test(data.sha) && data.sha!==currentBuild)
          setReady(data.sha);
      }catch{/* Network errors leave the current workspace untouched. */}
    };
    void check();
    const timer=window.setInterval(()=>{void check();},300000);
    return ()=>{disposed=true;window.clearInterval(timer);};
  },[]);
  if(!ready||ready===dismissed)return null;
  const reload=()=>{
    const target=new URL(window.location.href);
    target.searchParams.set('build',ready.slice(0,12));
    window.location.assign(target.toString());
  };
  return <div role="status" className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-full border border-[#566079] bg-[#242b3b] px-3 py-1.5 text-xs text-white shadow-xl">
    <span>Verified Candlelight update available</span>
    <button type="button" onClick={reload} className="underline font-semibold">Reload</button>
    <button type="button" onClick={()=>setDismissed(ready)} aria-label="Dismiss update notice" className="px-1">×</button>
  </div>;
}
