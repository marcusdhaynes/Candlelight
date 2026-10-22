import type {Asset,ChartType,Timeframe,Drawing,IndicatorSettings} from '../types';

export interface SavedChartIdea{
  id:string;
  name:string;
  note:string;
  savedAt:number;
  symbol:string;
  source:string;
  timeframe:Timeframe;
  chartType:ChartType;
  drawings:Drawing[];
  indicators:IndicatorSettings;
}
export const SAVED_CHARTS_KEY='candlelight_saved_charts_v1';
const isRecord=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null;
export function parseSavedCharts(text:string|null):SavedChartIdea[]{
  if(!text)return [];
  try{
    const value:unknown=JSON.parse(text);
    if(!Array.isArray(value))return [];
    return value.filter((row):row is SavedChartIdea=>
      isRecord(row)&&typeof row.id==='string'&&typeof row.name==='string'&&
      typeof row.symbol==='string'&&typeof row.source==='string'&&
      typeof row.timeframe==='string'&&typeof row.chartType==='string'&&
      Array.isArray(row.drawings)&&isRecord(row.indicators)&&
      typeof row.savedAt==='number'&&Number.isFinite(row.savedAt) &&
      typeof row.note==='string');
  }catch{return [];}
}
export function createSavedChartIdea(
  asset:Asset,timeframe:Timeframe,chartType:ChartType,
  drawings:Drawing[],indicators:IndicatorSettings,name:string,note:string,
  at=Date.now()
):SavedChartIdea{
  const title=name.trim();
  if(!title)throw new Error('Choose a name for the saved chart.');
  return {id:'chart-'+at+'-'+Math.random().toString(36).slice(2,10),
    name:title.slice(0,120),note:note.trim().slice(0,5000),savedAt:at,
    symbol:asset.symbol,source:asset.source||asset.exchange,timeframe,chartType,
    drawings:structuredClone(drawings),indicators:structuredClone(indicators)};
}
