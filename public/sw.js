/* Only immutable app-shell assets; never store or synthesize market quotes,
 * broker sessions, user records, trading events, API responses or credentials. */
const CACHE='candlelight-app-shell-v2';
const PREFIX='candlelight-app-shell-';
const scope=self.registration.scope;
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   // Vite emits content-hashed JS/CSS. Cache ONLY the actual current shell
   // referenced in the deployed HTML; offline reload otherwise shows a blank page.
   const entry=await fetch(scope,{cache:'no-store'});
   if(!entry.ok)throw Error('Cannot cache application shell');
   const html=await entry.text();
   const assets=[...html.matchAll(/(?:src|href)="([^"]+\\.(?:js|css))"/g)]
     .map(match=>new URL(match[1],scope).href)
     .filter(url=>{
       const resource=new URL(url),origin=new URL(scope);
       return resource.origin===origin.origin&&resource.pathname.startsWith(origin.pathname);
     });
   await cache.put(scope,new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
   await cache.addAll([...new Set([...assets,
     scope+'manifest.webmanifest',scope+'pwa-icon.svg',scope+'logo.png'])]);
   await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>
  key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url),here=new URL(scope);
 if(url.origin!==here.origin||!url.pathname.startsWith(here.pathname))return;
 if(/(?:^|\/)api\//i.test(url.pathname)||/auth|token|callback/i.test(url.pathname))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){
      const copy=response.clone();
      void caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
    }
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    return (await cache.match(req))||(await cache.match(scope))||
      new Response('Candlelight offline app shell unavailable.',{status:503});
  }));return;
 }
 if(!/\.(?:js|css|png|jpe?g|svg|woff2?|webmanifest)$/i.test(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(req);
  if(cached)return cached;
  const response=await fetch(req);
  if(response.ok&&response.type!=='opaque'){
    const copy=response.clone();void cache.put(req,copy).catch(()=>{});
  }
  return response;
 }).catch(()=>fetch(req)));
});
