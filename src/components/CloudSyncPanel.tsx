import React,{useState} from 'react';
import {CLOUD_DOCUMENTS,cloudGet,cloudPut,cloudSignIn,cloudSignUp,
 readLocalCloudDocument,restoreCloudDocument,type CloudSession,
 type CloudKey,type RemoteCloudDocument} from '../services/cloudSync';
const descriptions:Record<CloudKey,string>={
 layouts:'Chart workspaces and pane arrangements',
 watchlists:'Saved watchlists and exact-market identities',
 journal:'Manually recorded journal trades and imported executions',
};
export const CloudSyncPanel:React.FC=()=>{
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [session,setSession]=useState<CloudSession|null>(null);
 const [remote,setRemote]=useState<Partial<Record<CloudKey,RemoteCloudDocument>>>({});
 const [working,setWorking]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const signedIn=!!session&&Date.now()<session.expiresAt-5000;
 const action=async(fn:()=>Promise<void>)=>{
  setWorking(true);setError('');setNotice('');
  try{await fn();}catch(e){setError(e instanceof Error?e.message:'Cloud sync unavailable');}
  finally{setWorking(false);}
 };
 const refresh=async(token:string)=>{
  const docs=await Promise.all(CLOUD_DOCUMENTS.map(async key=>[key,await cloudGet(token,key)] as const));
  setRemote(Object.fromEntries(docs) as Partial<Record<CloudKey,RemoteCloudDocument>>);
 };
 const login=()=>void action(async()=>{
  const auth=await cloudSignIn(email,password);
  setPassword('');setSession(auth);
  await refresh(auth.accessToken);
  setNotice('Signed in. Cloud snapshots are read only until you explicitly upload or restore.');
 });
 const signup=()=>void action(async()=>{
  await cloudSignUp(email,password);setPassword('');
  setNotice('Registration requested. Confirm your email if required, then sign in.');
 });
 const upload=(key:CloudKey)=>void action(async()=>{
  if(!signedIn||!session)throw Error('Sign in again before syncing.');
  const known=remote[key];
  if(!known)throw Error('Check cloud revisions before uploading.');
  const local=readLocalCloudDocument(key);
  if(!window.confirm('Upload your validated local '+key+' snapshot to your private cloud? The remote version will be replaced only if its revision has not changed. Local data will stay untouched.'))return;
  const revision=await cloudPut(session.accessToken,key,known.revision,local);
  await refresh(session.accessToken);
  setNotice('Uploaded '+key+' as cloud revision '+revision+'. Local data was not changed.');
 });
 const restore=(key:CloudKey)=>void action(async()=>{
  if(!signedIn||!session)throw Error('Sign in again before restoring.');
  const fresh=await cloudGet(session.accessToken,key);
  if(!fresh.exists||!fresh.payload)throw Error('No saved remote '+key+' version exists.');
  if(!window.confirm('Restore cloud '+key+' revision '+fresh.revision+' to this browser? The existing local data will be backed up first, and this page will reload. Continue?'))return;
  const backup=restoreCloudDocument(key,fresh.payload);
  setNotice('Local backup saved under '+backup+'. Reloading to show your restored data.');
  window.location.reload();
 });
 return <section id="candlelight-cloud-sync" className="p-4 space-y-3 text-xs text-[#d6e0ee]">
  <strong className="text-sm">Optional Private Cloud Sync · Supabase</strong>
  <p className="text-[#a7b7c9]">Manual transfer only: layouts, watchlists and journal. No paper accounts, broker credentials, open positions or order execution are synchronized. Cloud sync never runs automatically or merges trades without review.</p>
  {!signedIn?<div className="flex flex-wrap items-end gap-3">
    <label>Email <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
      autoComplete="username" className="block bg-[#161d29] border border-[#44546a] p-2 rounded w-56"/></label>
    <label>Password <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
      autoComplete="current-password" className="block bg-[#161d29] border border-[#44546a] p-2 rounded w-48"/></label>
    <button type="button" disabled={working} onClick={login}
      className="bg-[#2862fb] px-3 py-2 rounded disabled:opacity-40">Sign In</button>
    <button type="button" disabled={working} onClick={signup}
      className="border border-[#4b5b75] px-3 py-2 rounded disabled:opacity-40">Register / Send Confirmation</button>
  </div>:<div className="flex gap-3 flex-wrap items-center">
    <span className="font-semibold text-[#b6d0ff]">Signed in: {session!.email}</span>
    <span className="text-[#b1bfce]">Session kept in memory only · expires {new Date(session!.expiresAt).toLocaleTimeString()}</span>
    <button type="button" disabled={working} onClick={()=>void action(()=>refresh(session!.accessToken))}
      className="border border-[#536784] p-2 rounded">Check Cloud</button>
    <button type="button" onClick={()=>{setSession(null);setRemote({});setNotice('Signed out from this tab.');}}
      className="border border-[#536784] p-2 rounded">Sign Out</button>
  </div>}
  {error&&<p role="alert" className="text-[#ffb4b4]">{error}</p>}
  {notice&&<p role="status" className="text-[#a9ddb9]">{notice}</p>}
  {signedIn&&<div className="overflow-x-auto"><table className="w-full text-left min-w-[560px]">
    <thead><tr className="text-[#b9c7dc]">
      <th>Record Collection</th><th>Private Cloud</th><th>Actions</th></tr></thead>
    <tbody>{CLOUD_DOCUMENTS.map(key=><tr key={key} className="border-t border-[#3b475b]">
      <td className="py-2"><strong className="capitalize">{key}</strong>
        <small className="block text-[#9eacbf]">{descriptions[key]}</small></td>
      <td>{remote[key]?(remote[key]!.exists?
        'Revision '+remote[key]!.revision+' · '+new Date(remote[key]!.updatedAt||0).toLocaleString():
        'No cloud version'):'Not checked'}</td>
      <td className="space-x-2 whitespace-nowrap">
        <button type="button" disabled={working||!remote[key]} onClick={()=>upload(key)}
          className="bg-[#284885] disabled:opacity-40 px-2 py-1.5 rounded">Upload Local</button>
        <button type="button" disabled={working||!remote[key]?.exists} onClick={()=>restore(key)}
          className="border border-[#526786] disabled:opacity-40 px-2 py-1.5 rounded">Restore Cloud</button>
      </td>
    </tr>)}</tbody>
  </table></div>}
  <p className="text-[#91a4bd]">Every upload checks the expected remote revision. Every restore validates the cloud document and stores an exact backup of current local bytes first. This sign-in is shared Supabase Auth, but documents are isolated to Candlelight's private owner-scoped schema.</p>
 </section>;
};
