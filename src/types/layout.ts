import { ChartType, Timeframe } from '../types';

export interface LayoutBox {
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
  w: number; // 0 to 100 percentage
  h: number; // 0 to 100 percentage
}

export interface LayoutTemplate {
  id: string;
  name: string;
  count: number;
  rowCategory: number; // 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16
  type: 'single' | 'cols' | 'rows' | 'grid' | 'left-right' | 'top-bottom' | 'custom-grid';
  cols?: number;
  rows?: number;
  leftCount?: number;
  rightCount?: number;
  topCount?: number;
  bottomCount?: number;
  boxes: LayoutBox[];
  isCustomGrid?: boolean;
}

export interface LayoutSyncSettings {
  symbol: boolean;
  interval: boolean;
  crosshair: boolean;
  time: boolean;
  dateRange: boolean;
}

export interface ChartWindowState {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  chartType?: ChartType;
  indicators?: any;
}

export interface SavedChartLayout {
  id: string;
  name: string;
  lastModified: number;
  templateId: string;
  syncSettings: LayoutSyncSettings;
  autosave: boolean;
  shareEnabled: boolean;
  splitSizes?: number[]; // primary split ratio in percentages, e.g. [50, 50]
  secondarySplitSizes?: number[]; // inner split ratios
  customBoxes?: LayoutBox[]; // user-resized custom grid boxes
  windows: ChartWindowState[];
  activeWindowIndex: number;
}
