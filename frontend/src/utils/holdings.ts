/**
 * 持仓数据处理工具函数
 * @module utils/holdings
 */

import { asNumber, calcDays, toPercentValue } from './format.js';
import type { 
  RawFundData, 
  FundRow, 
  SortColumn, 
  SortOrder, 
  SorterState 
} from '../types';

/** 可排序列映射 */
export const SORT_COLUMNS: Record<string, SortColumn> = {
  name: 'name',
  market_value_cny: 'market_value_cny',
  day_profit_cny: 'day_profit_cny',
  holding_profit_cny: 'holding_profit_cny',
  holding_profit_rate: 'holding_profit_rate',
  estimate_pct: 'estimate_pct',
  holding_days: 'holding_days'
};

/**
 * 规范化基金数据行
 * @param funds - 原始基金数据数组
 * @returns 规范化后的基金数据行数组
 */
export function normalizeFundRows(funds: unknown[]): FundRow[] {
  if (!Array.isArray(funds)) return [];
  
  return funds.map((item: unknown) => {
    const raw = item as RawFundData;
    const marketValue = asNumber(raw.market_value_cny);
    const costBasis = asNumber(raw.cost_basis_cny);
    const holdingProfit = Number.isFinite(Number(raw.holding_profit_cny))
      ? Number(raw.holding_profit_cny)
      : marketValue - costBasis;
    const estimatePct = raw.estimate_pct === null || raw.estimate_pct === undefined
      ? null
      : Number(raw.estimate_pct);
    const dayProfit = Number.isFinite(Number(raw.day_profit_cny))
      ? Number(raw.day_profit_cny)
      : (estimatePct === null ? null : (marketValue * estimatePct) / 100);
    const yesterdayProfit = Number.isFinite(Number(raw.yesterday_profit_cny))
      ? Number(raw.yesterday_profit_cny)
      : dayProfit;
    const holdingDays = calcDays(raw.start_date);

    return {
      fund_id: raw.fund_id || '--',
      name: raw.name || '未命名基金',
      bucket: raw.bucket || '',
      market_value_cny: marketValue,
      cost_basis_cny: costBasis,
      shares: asNumber(raw.shares),
      start_date: raw.start_date || '',
      holding_profit_cny: holdingProfit,
      holding_profit_rate: toPercentValue(holdingProfit, costBasis),
      day_profit_cny: dayProfit,
      yesterday_profit_cny: yesterdayProfit,
      estimate_pct: estimatePct,
      latest_nav: marketValue > 0 && estimatePct !== null 
        ? Number((1 + estimatePct / 100).toFixed(4)) 
        : null,
      source: raw.source || '--',
      status: raw.status || 'failed',
      reason: raw.reason || '',
      as_of: raw.as_of || raw.asof || '',
      updated_at: raw.updated_at || '',
      confirm_state: raw.confirm_state || (raw.status === 'ok' ? 'estimated' : 'partial'),
      yesterday_profit_source: raw.yesterday_profit_source || 'estimated_today',
      market_group: raw.market_group || 'cn_hk',
      holding_days: holdingDays,
      tags: Array.isArray(raw.tags) ? raw.tags : []
    };
  });
}

/** 可排序项接口 */
interface SortableItem {
  item: FundRow;
  index: number;
}

/**
 * 对基金数据行进行排序
 * @param rows - 基金数据行数组
 * @param sorter - 排序状态
 * @returns 排序后的基金数据行数组
 */
export function sortRows(rows: FundRow[], sorter: SorterState | null): FundRow[] {
  const next: SortableItem[] = rows.map((item, index) => ({ item, index }));
  const { key, order } = sorter || {};
  
  if (!key || !order) return next.map((entry) => entry.item);
  
  const direction = order === 'asc' ? 1 : -1;

  next.sort((a, b) => {
    const va = a.item[key as keyof FundRow];
    const vb = b.item[key as keyof FundRow];
    
    if (key === 'name') {
      const compare = String(va || '').localeCompare(String(vb || ''), 'zh-CN');
      if (compare !== 0) return compare * direction;
      return a.index - b.index;
    }

    const na = Number(va);
    const nb = Number(vb);
    if (!Number.isFinite(na) && !Number.isFinite(nb)) return a.index - b.index;
    if (!Number.isFinite(na)) return 1;
    if (!Number.isFinite(nb)) return -1;
    const compare = (na - nb) * direction;
    if (compare !== 0) return compare;
    return a.index - b.index;
  });
  
  return next.map((entry) => entry.item);
}

/**
 * 循环切换排序状态
 * @param current - 当前排序状态
 * @param nextKey - 下一个排序键
 * @returns 新的排序状态
 */
export function cycleSortState(current: SorterState, nextKey: SortColumn): SorterState {
  if (current.key !== nextKey) {
    return { key: nextKey, order: 'desc' };
  }
  if (current.order === 'desc') {
    return { key: nextKey, order: 'asc' };
  }
  if (current.order === 'asc') {
    return { key: '', order: '' };
  }
  return { key: nextKey, order: 'desc' };
}
