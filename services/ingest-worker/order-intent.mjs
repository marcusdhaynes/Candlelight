/** Broker-independent planning only: no network, credentials, or order endpoints. */
const terminal=new Set(['filled','cancelled','risk_rejected','failed']);
const active=new Set(['staged','ready','dispatching','uncertain','acknowledged','partially_filled']);
export function dispatchPlan(intent,policy){
 if(!intent||typeof intent.clientCommandId!=='string'||!intent.clientCommandId)
   return {action:'block',reason:'Missing durable idempotency key'};
 if(terminal.has(intent.state))return {action:'none',reason:'Terminal intent'};
 if(!active.has(intent.state))return {action:'block',reason:'Unknown intent state'};
 if(intent.state==='uncertain'||intent.state==='dispatching')
   return policy?.brokerLookupByClientId?
     {action:'reconcile',reason:'Query broker truth; NEVER blindly resubmit'}:
     {action:'block',reason:'Ambiguous order needs broker reconciliation'};
 if(intent.state==='acknowledged'||intent.state==='partially_filled')
   return {action:'reconcile',reason:'Review broker fill/cancel status'};
 if(intent.state==='staged')return {action:'block',reason:'Risk evaluation and authorization required'};
 if(policy?.killSwitch)return {action:'block',reason:'Account kill switch'};
 if(policy?.accountAuthorized!==true)return {action:'block',reason:'Trading permission not verified'};
 if(policy?.riskApproved!==true)return {action:'block',reason:'Risk check not verified'};
 if(policy?.providerFresh!==true)return {action:'block',reason:'Verified market feed unavailable'};
 if(policy?.nativeClientIdSupported!==true)
   return {action:'block',reason:'No broker-native idempotency or documented equivalent'};
 return {action:'dispatch_once',reason:'Send only with persisted fencing and broker acknowledgement tracking'};
}
/** Require authenticated, matched broker evidence to change a non-terminal state. */
export function reconcileBrokerEvidence(intent,event){
 if(!intent||!event||event.verified!==true||!event.eventId||
    event.clientCommandId!==intent.clientCommandId||
    (intent.brokerOrderId&&event.brokerOrderId!==intent.brokerOrderId))
   throw Error('Unverified or mismatched broker evidence');
 if(terminal.has(intent.state))
   return {intent,changed:false,reason:'Terminal intent cannot be silently reopened'};
 if(intent.lastBrokerEventId===event.eventId)
   return {intent,changed:false,reason:'Duplicate broker event'};
 if(!['dispatching','uncertain','acknowledged','partially_filled'].includes(intent.state))
   throw Error('No durable dispatch evidence for this intent');
 const toUnits=value=>{
   const text=String(value);
   if(!/^(?:0|[1-9]\d{0,21})(?:\.\d{1,16})?$/.test(text))
     throw Error('Invalid decimal quantity');
   const [whole,part='']=text.split('.');
   return BigInt(whole)*10000000000000000n+BigInt(part.padEnd(16,'0'));
 };
 const requested=toUnits(intent.quantity),filled=toUnits(event.cumulativeFilled),
   already=toUnits(intent.filledQuantity??'0');
 if(requested<=0n||filled<already||filled>requested)
   throw Error('Invalid or regressing broker fill quantity');
 if(typeof event.brokerOrderId!=='string'||!event.brokerOrderId)
   throw Error('Broker order ID is required for reconciliation');
 const mapping={open:'acknowledged',partial:'partially_filled',filled:'filled',
   cancelled:'cancelled',rejected:'failed'};
 const nextState=mapping[event.status];
 if(!nextState)throw Error('Unknown broker state');
 if(nextState==='filled'&&filled!==requested)throw Error('Claimed full fill without full quantity');
 if(nextState==='partially_filled'&&(filled<=0n||filled>=requested))
   throw Error('Partial fill requires an actual partial quantity');
 if(nextState==='acknowledged'&&filled>0n)
   throw Error('Broker open status cannot erase a recorded partial fill');
 if(nextState==='failed'&&already>0n)
   throw Error('Rejected status after a fill needs broker-specific reconciliation');
 return {changed:true,intent:{...intent,state:nextState,brokerOrderId:event.brokerOrderId,
   lastBrokerEventId:event.eventId,filledQuantity:String(event.cumulativeFilled)},reason:'Matched broker evidence'};
}
