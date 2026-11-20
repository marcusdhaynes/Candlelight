import {randomUUID} from 'node:crypto';
import {checkSequence} from './protocol.mjs';

const SCHEMA='app_candlelight';
const LEASE_SECONDS=45;
export class MarketIngestStore {
  constructor(pool,marketId){
    this.pool=pool;this.marketId=marketId;
    this.provider='Coinbase';this.scope='coinbase/ticker';
    this.token=randomUUID();this.session=randomUUID();
  }
  async tx(fn){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_candlelight_market_ingestor');
      const identity=await client.query('SELECT current_user AS role_name, session_user AS login_name');
      const row=identity.rows[0];
      if(row?.role_name!=='app_candlelight_market_ingestor' ||
        ['app_candlelight_market_ingestor','postgres','service_role','supabase_admin'].includes(row?.login_name))
        throw Error('Unsafe database identity: dedicated non-privileged login required');
      await client.query("SET LOCAL statement_timeout = '5000ms'");
      const result=await fn(client);
      await client.query('COMMIT');
      return result;
    }catch(error){
      try{await client.query('ROLLBACK');}catch{}
      throw error;
    }finally{client.release();}
  }
  key(){return [this.provider,this.marketId,this.scope,this.token];}
  async acquire(){
    return this.tx(async c=>{
      await c.query("INSERT INTO "+SCHEMA+".market_ingest_checkpoints(provider,market_id,stream_scope) "+
        "VALUES($1,$2,$3) ON CONFLICT DO NOTHING",this.key().slice(0,3));
      const r=await c.query("UPDATE "+SCHEMA+".market_ingest_checkpoints "+
        "SET lease_token=$4::uuid,lease_expires_at=clock_timestamp()+interval '45 seconds', "+
        "revision=revision+1,updated_at=clock_timestamp() "+
        "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 "+
        "AND (lease_token IS NULL OR lease_expires_at<clock_timestamp() OR lease_token=$4::uuid) "+
        "RETURNING last_sequence::text AS last_sequence",this.key());
      if(!r.rowCount)throw Error('Lease held by another market-data worker');
      await c.query("INSERT INTO "+SCHEMA+".market_ingest_sessions"+
        "(session_id,provider,market_id,stream_scope,state) VALUES($1::uuid,$2,$3,$4,'recovering')",
        [this.session,this.provider,this.marketId,this.scope]);
      const raw=r.rows[0].last_sequence;
      const last=raw===null?null:Number(raw);
      if(last!==null&&(!Number.isSafeInteger(last)||last<=0))
        throw Error('Checkpoint sequence exceeds safe integer range');
      return last;
    });
  }
  async renew(){
    return this.tx(async c=>{
      const r=await c.query("UPDATE "+SCHEMA+".market_ingest_checkpoints "+
        "SET lease_expires_at=clock_timestamp()+interval '45 seconds',updated_at=clock_timestamp() "+
        "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 AND lease_token=$4::uuid "+
        "AND lease_expires_at>clock_timestamp() RETURNING lease_token",this.key());
      if(!r.rowCount)throw Error('Exclusive writer lease lost');
    });
  }
  async state(name,reason=''){
    if(!['running','recovering','stopped','failed'].includes(name))throw Error('Invalid session state');
    await this.tx(c=>c.query("UPDATE "+SCHEMA+".market_ingest_sessions "+
      "SET state=$2,stop_reason=NULLIF($3,''),"+
      "ended_at=CASE WHEN $2 IN ('stopped','failed') THEN clock_timestamp() ELSE NULL END "+
      "WHERE session_id=$1::uuid AND state NOT IN ('stopped','failed')",
      [this.session,name,String(reason).slice(0,500)]));
  }
  async markInterrupted(reason,gap=false){
    await this.tx(async c=>{
      const r=await c.query("UPDATE "+SCHEMA+".market_ingest_checkpoints "+
        "SET gap_count=gap_count+$5,updated_at=clock_timestamp() "+
        "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 AND lease_token=$4::uuid "+
        "AND lease_expires_at>clock_timestamp() RETURNING lease_token",
        [...this.key(),gap?1:0]);
      if(!r.rowCount)throw Error('Lease lost while marking interruption');
      await c.query("UPDATE "+SCHEMA+".market_ingest_sessions "+
        "SET state='recovering',stop_reason=$2 WHERE session_id=$1::uuid",
        [this.session,String(reason).slice(0,500)]);
    });
  }
  async append(trade,integrity='accepted',evaluateAlerts=false){
    if(trade.provider!==this.provider||trade.marketId!==this.marketId||
      trade.scope!==this.scope||!Number.isSafeInteger(trade.sequence)||
      trade.sequence<=0||typeof trade.nativeId!=='string'||
      !['accepted','unverified'].includes(integrity))throw Error('Invalid trade source');
    return this.tx(async c=>{
      const current=await c.query("SELECT last_sequence::text AS last_sequence "+
        "FROM "+SCHEMA+".market_ingest_checkpoints "+
        "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 "+
        "AND lease_token=$4::uuid AND lease_expires_at>clock_timestamp() FOR UPDATE",this.key());
      if(!current.rowCount)throw Error('Writer lease unavailable during journal append');
      const raw=current.rows[0].last_sequence,previous=raw===null?null:Number(raw);
      const verdict=checkSequence(previous,trade.sequence);
      if(verdict==='replay')return {status:'replay'};
      if(verdict==='gap'||verdict==='invalid')return {status:'gap'};
      const r=await c.query("INSERT INTO "+SCHEMA+".market_event_journal "+
        "(session_id,provider,market_id,stream_scope,kind,native_event_id,native_sequence,"+
        "sequence_mode,provider_reported_at,source_received_at,price,quantity,side,integrity_state) "+
        "VALUES($1::uuid,$2,$3,$4,'trade',$5,$6::numeric,'contiguous',"+
        "to_timestamp($7::double precision/1000),to_timestamp($8::double precision/1000),"+
        "$9::numeric,$10::numeric,$11,$12) ON CONFLICT DO NOTHING RETURNING event_id",
        [this.session,this.provider,this.marketId,this.scope,trade.nativeId,String(trade.sequence),
          trade.exchangeAt,trade.receivedAt,trade.price,trade.quantity,trade.side,integrity]);
      if(!r.rowCount)return {status:'duplicate'};
      // Price rules run against the same committed trade and checkpoint.
      // Recovery/baseline events intentionally never generate notifications.
      if(integrity==='accepted'&&evaluateAlerts){
        const rules=await c.query(
          "SELECT rule_id,owner_id,trigger_count,max_triggers, "+
          "CASE WHEN last_price IS NULL THEN false "+
          "WHEN condition='crosses_above' THEN last_price<threshold AND $4::numeric>=threshold "+
          "WHEN condition='crosses_below' THEN last_price>threshold AND $4::numeric<=threshold "+
          "WHEN condition='greater_than' THEN last_price<=threshold AND $4::numeric>threshold "+
          "WHEN condition='less_than' THEN last_price>=threshold AND $4::numeric<threshold "+
          "ELSE false END AS fired "+
          "FROM app_candlelight.market_alert_rules "+
          "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 AND status='active' "+
          "ORDER BY rule_id LIMIT 2001 FOR UPDATE",
          [this.provider,this.marketId,this.scope,trade.price]);
        if(rules.rows.length>2000)throw Error('Too many active alert rules; cannot evaluate atomically');
        for(const rule of rules.rows){
          const fired=rule.fired&&rule.trigger_count<rule.max_triggers;
          const increment=fired?1:0;
          await c.query(
            "UPDATE app_candlelight.market_alert_rules SET last_price=$2::numeric,"+
            "last_event_id=$3::uuid,trigger_count=trigger_count+$4,"+
            "status=CASE WHEN trigger_count+$4>=max_triggers THEN 'paused' ELSE status END,"+
            "updated_at=clock_timestamp() WHERE rule_id=$1::uuid",
            [rule.rule_id,trade.price,r.rows[0].event_id,increment]);
          if(fired){
            await c.query(
              "INSERT INTO app_candlelight.market_alert_outbox "+
              "(rule_id,owner_id,market_event_id,triggered_price) "+
              "VALUES($1::uuid,$2::uuid,$3::uuid,$4::numeric) ON CONFLICT DO NOTHING",
              [rule.rule_id,rule.owner_id,r.rows[0].event_id,trade.price]);
          }
        }
      }
      const advanced=await c.query("UPDATE "+SCHEMA+".market_ingest_checkpoints "+
        "SET last_native_event_id=$5,last_sequence=$6::numeric,"+
        "last_provider_at=to_timestamp($7::double precision/1000),"+
        "last_received_at=to_timestamp($8::double precision/1000),"+
        "revision=revision+1,updated_at=clock_timestamp() "+
        "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 AND lease_token=$4::uuid "+
        "AND lease_expires_at>clock_timestamp() RETURNING revision",
        [...this.key(),trade.nativeId,String(trade.sequence),trade.exchangeAt,trade.receivedAt]);
      if(!advanced.rowCount)throw Error('Lease lost before checkpoint commit');
      return {status:'inserted',eventId:r.rows[0].event_id};
    });
  }
  async release(reason='shutdown'){
    try{
      await this.state('stopped',reason);
      await this.tx(c=>c.query("UPDATE "+SCHEMA+".market_ingest_checkpoints "+
        "SET lease_token=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() "+
        "WHERE provider=$1 AND market_id=$2 AND stream_scope=$3 AND lease_token=$4::uuid",this.key()));
    }catch(error){console.error('Unable to release lease: '+error.message);}
  }
}
