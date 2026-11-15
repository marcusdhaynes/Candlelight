// Candlelight-only private, opt-in cloud document gateway.
// A verified Supabase Auth user ID is bound to a NOLOGIN/NOBYPASSRLS
// PostgreSQL role inside one transaction. No service-role Data API grants.
import postgres from 'npm:postgres@3.4.3';
const dbUrl=Deno.env.get('SUPABASE_DB_URL')||'';
const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
const db=dbUrl?postgres(dbUrl,{prepare:false,max:2,idle_timeout:15}):null;
const keys=new Set(['layouts','watchlists','journal']);
const origins=new Set(['https://marcusdhaynes.github.io',
  'http://localhost:3000','http://127.0.0.1:3000','http://127.0.0.1:4173']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status:number,body:object,origin:string|null)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Vary':'Origin',...(origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),
    'Access-Control-Allow-Headers':'apikey, authorization, content-type',
    'Access-Control-Allow-Methods':'GET, PUT, OPTIONS'}});
const parseKey=(value:unknown)=>typeof value==='string'&&keys.has(value)?value:null;
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 if(origin&&!origins.has(origin))return json(403,{error:'Origin not approved.'},null);
 if(req.method==='OPTIONS')return new Response(null,{status:204,
   headers:{'Vary':'Origin','Access-Control-Allow-Origin':origin||'',
    'Access-Control-Allow-Headers':'apikey, authorization, content-type',
    'Access-Control-Allow-Methods':'GET, PUT, OPTIONS',
    'Access-Control-Max-Age':'600'}});
 if(req.method!=='GET'&&req.method!=='PUT')return json(405,{error:'Method not supported.'},origin);
 if(!db||!supabaseUrl||!anonKey)return json(503,{error:'Private cloud gateway is not configured.'},origin);
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer\s+[-\w.]+$/i.test(bearer))return json(401,{error:'Sign in to sync.'},origin);
 const credential=bearer.replace(/^Bearer\s+/i,'');
 let userId='';
 try{
  const response=await fetch(supabaseUrl+'/auth/v1/user',{
   headers:{'apikey':anonKey,'Authorization':'Bearer '+credential,'Accept':'application/json'},
   signal:AbortSignal.timeout(7000)});
  if(!response.ok)return json(401,{error:'Your login expired; sign in again.'},origin);
  const user=await response.json();
  if(!uuid.test(user.id))return json(401,{error:'Verified user ID missing.'},origin);
  userId=user.id;
 }catch{return json(503,{error:'Authentication verification unavailable.'},origin);}
 const url=new URL(req.url);
 let key=parseKey(url.searchParams.get('key'));
 let expectedRevision:number|undefined,payload:any;
 if(req.method==='PUT'){
  if(Number(req.headers.get('content-length')||0)>280000)
   return json(413,{error:'Cloud document exceeds 256 KB.'},origin);
  let data:any;
  try{data=await req.json();}catch{return json(400,{error:'Invalid JSON document.'},origin);}
  key=parseKey(data?.key);
  expectedRevision=data?.expectedRevision;
  payload=data?.payload;
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
   return json(400,{error:'Cloud revision is required for conflict prevention.'},origin);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     payload.version!==1||!Array.isArray(payload.data))
    return json(400,{error:'Expected versioned data array.'},origin);
  if(new TextEncoder().encode(JSON.stringify(payload)).length>250000)
   return json(413,{error:'Cloud document exceeds 250 KB.'},origin);
 }
 if(!key)return json(400,{error:'Unknown Candlelight cloud document type.'},origin);
 try{
  const result=await db.begin(async tx=>{
   await tx.unsafe('SET LOCAL ROLE app_candlelight_executor');
   await tx`SELECT set_config('candlelight.cloud_user',${userId},true)`;
   if(req.method==='GET'){
    const rows=await tx`SELECT revision,payload,updated_at
      FROM app_candlelight.cloud_sync_documents
      WHERE owner_uid=${userId}::uuid AND document_key=${key}`;
    return rows.length?{status:200,body:{exists:true,key,revision:Number(rows[0].revision),
      payload:rows[0].payload,updatedAt:rows[0].updated_at}}:
      {status:200,body:{exists:false,key,revision:0}};
   }
   const serialized=JSON.stringify(payload);
   if(expectedRevision===0){
    const rows=await tx`INSERT INTO app_candlelight.cloud_sync_documents
      (owner_uid,document_key,payload,revision)
      VALUES (${userId}::uuid,${key},${serialized}::jsonb,1)
      ON CONFLICT DO NOTHING RETURNING revision,updated_at`;
    if(rows.length)return {status:200,body:{saved:true,key,revision:Number(rows[0].revision),
      updatedAt:rows[0].updated_at}};
   }else{
    const rows=await tx`UPDATE app_candlelight.cloud_sync_documents
      SET payload=${serialized}::jsonb,revision=revision+1,updated_at=now()
      WHERE owner_uid=${userId}::uuid AND document_key=${key}
        AND revision=${expectedRevision}
      RETURNING revision,updated_at`;
    if(rows.length)return {status:200,body:{saved:true,key,revision:Number(rows[0].revision),
      updatedAt:rows[0].updated_at}};
   }
   const rows=await tx`SELECT revision FROM app_candlelight.cloud_sync_documents
     WHERE owner_uid=${userId}::uuid AND document_key=${key}`;
   return {status:409,body:{error:'Cloud revision changed. Reload the remote document before saving.',
     key,revision:rows.length?Number(rows[0].revision):0}};
  });
  return json(result.status,result.body,origin);
 }catch(error){
  console.error('Candlelight private cloud transaction failed',
    error instanceof Error?error.name:'DatabaseUnavailable');
  return json(503,{error:'Cloud sync is unavailable; local data was not changed.'},origin);
 }
});