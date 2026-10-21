import { Drawing, DetailedAlert, Timeframe } from '../types';

export type ConditionLogicType = 'IF' | 'IF (AND)' | 'IF (OR)' | 'WHENEVER';

export type DependencyType =
  | 'drawing'
  | 'alert'
  | 'indicator'
  | 'price'
  | 'position'
  | 'volume'
  | 'orderbook';

export type ComparisonOperator =
  | 'crosses_above'
  | 'crosses_below'
  | 'touches'
  | 'greater_than'
  | 'less_than'
  | 'triggered'
  | 'pnl_above_percent'
  | 'pnl_below_percent';

export interface SingleCondition {
  id: string;
  dependencyType: DependencyType;
  dependencyId?: string;
  dependencyLabel: string;
  operator: ComparisonOperator;
  thresholdValue?: number;
  secondaryValue?: number;
}

export type OrderActionType =
  | 'enter_long'
  | 'enter_short'
  | 'exit_long'
  | 'exit_short'
  | 'tp'
  | 'sl_set'
  | 'sl_trailing'
  | 'reduce_position'
  | 'increase_position'
  | 'cancel_all';

export interface OrderExecutionDetails {
  orderType: 'market' | 'limit';
  limitPrice?: number;
  size: number;
  sizeUnit: 'units' | 'usd' | 'percent';
  tpPrice?: number;
  tpPercent?: number;
  slPrice?: number;
  slPercent?: number;
  trailingPercent?: number;
  reducePercent?: number;
  increasePercent?: number;
  leverage?: number;
}

export interface ConditionalOrder {
  id: string;
  symbol: string;
  title: string;
  conditionLogic: ConditionLogicType;
  conditions: SingleCondition[];
  action: OrderActionType;
  execution: OrderExecutionDetails;
  status: 'active' | 'triggered' | 'paused' | 'cancelled';
  createdAt: number;
  triggeredAt?: number;
  lastTriggeredAt?: number;
  triggerCount: number;
  maxTriggers: number; // 1 for IF/AND/OR, unlimited (9999) for WHENEVER
  notes?: string;
  sourceDependency?: {
    type: DependencyType;
    id: string;
    label: string;
    price?: number;
  };
}

export interface DependencyContext {
  type: DependencyType;
  id?: string;
  label: string;
  price?: number;
  drawing?: Drawing;
  alert?: DetailedAlert;
  indicatorKey?: string;
}
