import http from 'node:http';
import {parseCoinbaseMatch,parseCoinbaseHeartbeat,BoundedQueue} from './protocol.mjs';
import {loadCoinbaseRecovery} from './recovery.mjs';
import {MarketIngestStore} from './store.mjs';

const product=process.env.CANDLELIGHT_COINBASE_PRODUCT||'BTC-USD';
const market=process.env.CANDLELIGHT_MARKET_ID||'BTCUSD|Coinbase|spot';
if(!/^[-A-Z0-9]{3,30}$/.test(product)||
   !/^[A-Z0-9-]{3,30}\|Coinbase\|spot$/.test(market))
  throw Error('Invalid explicit market identity');
if(!process.env.CANDLELIGHT_DATABASE_URL||
   !/^postgres(ql)?:\/\//.test(process.env.CANDLELIGHT_DATABASE_URL)||
   !/sslmode=verify-full/.test(process.env.CANDLELIGHT_DATABASE_URL))
  throw Error('Private verified-TLS PostgreSQL DATABASE_URL required');
const {default:pg}=await import('pg');
const pool=new pg.Pool({
  connectionString:process.env.CANDLELIGHT_DATABASE_URL,
  max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000
});
const store=new MarketIngestStore(pool,market);
const status={ready:false,state:'starting',reason:'',lastEventAt:null,ingested:0,duplicates:0,restarts:0};
let stopping=false,socket=null,leaseTimer=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const log=(kind,value={})=>console.log(JSON.stringify({kind,at:new Date().toISOString(),...value}));
const health=http.createServer((_req,res)=>{
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  res.statusCode=status.ready?200:503;
  res.end(JSON.stringify(status));
});
health.listen(Number(process.env.CANDLELIGHT_HEALTH_PORT||8787),'127.0.0.1');
async function getRecent(last){
  return loadCoinbaseRecovery({
    checkpoint:last,marketId:market,limit:1000,maxPages:12,
    requestPage:async({after,limit})=>{
      const control=new AbortController(),timer=setTimeout(()=>control.abort(),8000);
      try{
        const url='https://api.exchange.coinbase.com/products/'+encodeURIComponent(product)+
          '/trades?limit='+limit+(after?'&after='+encodeURIComponent(after):'');
        const response=await fetch(url,{
          headers:{Accept:'application/json'},signal:control.signal,cache:'no-store'
        });
        if(!response.ok)throw Error('Coinbase history HTTP '+response.status);
        return {rows:await response.json(),after:response.headers.get('cb-after')};
      }finally{clearTimeout(timer);}
    }
  });
}

function connect(){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket('wss://ws-feed.exchange.coinbase.com');
    const q=new BoundedQueue(3000);
    const source={ws,q,lastHeartbeatAt:0,lastHeartbeatTradeId:null,unreconciledSince:0};
    let settled=false;
    const timeout=setTimeout(()=>{
      ws.close();
      if(!settled){settled=true;reject(Error('WebSocket subscription timeout'));}
    },10000);
    ws.addEventListener('open',()=>{
      if(settled)return;
      ws.send(JSON.stringify({type:'subscribe',product_ids:[product],channels:['matches','heartbeat']}));
      clearTimeout(timeout);settled=true;resolve(source);
    },{once:true});
    ws.addEventListener('error',()=>{
      if(!settled){clearTimeout(timeout);settled=true;reject(Error('WebSocket connection error'));}
    });
    ws.addEventListener('message',message=>{
      let raw;try{raw=JSON.parse(message.data);}catch{return;}
      const heartbeat=parseCoinbaseHeartbeat(raw,product);
      if(heartbeat){
        source.lastHeartbeatAt=heartbeat.receivedAt;
        source.lastHeartbeatTradeId=heartbeat.lastTradeId;
        return;
      }
      const print=parseCoinbaseMatch(raw,market,product);
      if(print&&!q.push(print)){
        status.ready=false;status.reason='Input queue overflow';
        ws.close();
      }
    });
    ws.addEventListener('close',()=>clearTimeout(timeout));
  });
}
async function run(){
  let last=await store.acquire();
  leaseTimer=setInterval(()=>{
    void store.renew().catch(error=>{
      stopping=true;status.ready=false;status.reason='Lease lost: '+error.message;
      socket?.close();log('lease_lost',{message:error.message});
    });
  },12000);
  for(let attempt=0;!stopping;attempt++){
    status.ready=false;status.state='recovering';status.restarts=attempt;
    let connection;
    try{
      connection=await connect();socket=connection.ws;
      // Subscribe first, then fetch REST; incoming prints are buffered during recovery.
      const recent=await getRecent(last);
      if(last!==null){
        for(const item of recent.trades){
          const result=await store.append(item);
          if(result.status==='gap')throw Error('Historical recovery gap');
          if(result.status==='inserted'){last=item.sequence;status.ingested++;}
        }
      }else{
        // Initial baseline is unverified and is not treated as full market history.
        const newest=recent.trades.reduce((top,item)=>
          !top||item.sequence>top.sequence?item:top,null);
        const result=await store.append(newest,'unverified');
        if(result.status!=='inserted'&&result.status!=='duplicate')
          throw Error('Initial baseline could not be committed');
        last=newest.sequence;
      }
      await store.state('running');
      status.ready=false;status.state='running';status.reason='';
      const connectedAt=Date.now();
      while(!stopping&&connection.ws.readyState===WebSocket.OPEN&&!connection.q.overflowed){
        const batch=connection.q.drain().sort((a,b)=>a.sequence-b.sequence);
        for(const item of batch){
          const result=await store.append(item,'accepted',true);
          if(result.status==='gap')throw Error('Missing trade ID; verified recovery required');
          if(result.status==='inserted'){last=item.sequence;status.lastEventAt=item.receivedAt;status.ingested++;}
          else status.duplicates++;
        }
        const now=Date.now();
        const heartbeatAge=now-(connection.lastHeartbeatAt||connectedAt);
        if(heartbeatAge>15000)throw Error('Coinbase heartbeat missing or stale');
        if(connection.lastHeartbeatTradeId!==null&&connection.lastHeartbeatTradeId>last){
          if(!connection.unreconciledSince)connection.unreconciledSince=now;
          if(now-connection.unreconciledSince>3000)
            throw Error('Coinbase heartbeat detects missing trade IDs; recovery required');
        }else connection.unreconciledSince=0;
        status.ready=connection.lastHeartbeatAt>0&&heartbeatAge<15000;
        await sleep(50);
      }
      if(connection.q.overflowed)throw Error('Data queue overflow; recovery required');
      if(!stopping)throw Error('WebSocket ended; recovery required');
    }catch(error){
      status.ready=false;status.state='recovering';status.reason=error.message;
      log('ingest_interruption',{message:error.message});
      try{
        const gap=/gap|overflow|missing trade/i.test(error.message);
        await store.markInterrupted(error.message,gap);
      }catch(fatal){
        stopping=true;status.state='failed';
        status.reason='Cannot maintain durable checkpoint: '+fatal.message;
        log('fatal',{message:status.reason});
      }
    }finally{
      socket?.close();socket=null;
    }
    if(!stopping)await sleep(Math.min(30000,1500*2**Math.min(attempt,5)));
  }
}
for(const signal of ['SIGINT','SIGTERM']){
  process.once(signal,()=>{stopping=true;status.ready=false;socket?.close();});
}
try{await run();}
catch(error){
  status.ready=false;status.state='failed';status.reason=error.message;
  process.exitCode=1;log('fatal',{message:error.message});
}finally{
  if(leaseTimer)clearInterval(leaseTimer);
  await store.release(status.reason||'shutdown');
  await pool.end();health.close();
}
