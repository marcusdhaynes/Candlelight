import type {Drawing} from '../types';
/** Unrecognized drawings or times are non-executable, not approximated. */
export function drawingPriceAt(d:Drawing,time:number,operator:string):number|undefined{
  const points=d.points;
  if(!points.length||!Number.isFinite(time))return;
  if(['horizontal','horizontal_ray','crossline'].includes(d.type)){
    if(d.type==='horizontal_ray'&&time<points[0].time)return;
    return Number.isFinite(points[0].price)?points[0].price:undefined;
  }
  if(d.type==='rectangle'){
    if(points.length<2)return;
    const [a,b]=points;
    if(time<Math.min(a.time,b.time)||time>Math.max(a.time,b.time))return;
    return operator==='crosses_below'||operator==='less_than'?
      Math.min(a.price,b.price):Math.max(a.price,b.price);
  }
  if(!['trendline','ray','extended_line','info_line'].includes(d.type)||points.length<2)return;
  const [start,end]=points;
  if(![start.time,start.price,end.time,end.price].every(Number.isFinite)||start.time===end.time)return;
  const low=Math.min(start.time,end.time),high=Math.max(start.time,end.time);
  if(d.type==='trendline'&&(time<low||time>high))return;
  if(d.type==='ray'&&time<low)return;
  return start.price+(time-start.time)*(end.price-start.price)/(end.time-start.time);
}
export function drawingConditionMet(d:Drawing,operator:string,price:number,
  previous:number|undefined,time:number,previousTime:number|undefined):boolean{
  if(!Number.isFinite(price)||price<=0)return false;
  if(d.type==='rectangle'&&d.points.length>=2&&operator==='touches'){
    const [a,b]=d.points;
    return time>=Math.min(a.time,b.time)&&time<=Math.max(a.time,b.time)&&
      price>=Math.min(a.price,b.price)&&price<=Math.max(a.price,b.price);
  }
  const target=drawingPriceAt(d,time,operator);
  if(target===undefined||!Number.isFinite(target)||target<=0)return false;
  const priorTarget=previousTime===undefined?undefined:drawingPriceAt(d,previousTime,operator);
  if(operator==='crosses_above')return previous!==undefined&&priorTarget!==undefined&&previous<priorTarget&&price>=target;
  if(operator==='crosses_below')return previous!==undefined&&priorTarget!==undefined&&previous>priorTarget&&price<=target;
  if(operator==='greater_than')return price>target;
  if(operator==='less_than')return price<target;
  if(operator==='touches')return Math.abs(price-target)/target<=0.003;
  return false;
}
