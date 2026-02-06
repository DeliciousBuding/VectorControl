import { asNumber, calcDays, toPercentValue } from './format.js'

export const SORT_COLUMNS = {
  name: 'name',
  market_value_cny: 'market_value_cny',
  day_profit_cny: 'day_profit_cny',
  holding_profit_cny: 'holding_profit_cny',
  holding_profit_rate: 'holding_profit_rate',
  estimate_pct: 'estimate_pct',
  holding_days: 'holding_days'
}

export function normalizeFundRows(funds) {
  if (!Array.isArray(funds)) return []
  return funds.map((item) => {
    const marketValue = asNumber(item.market_value_cny)
    const costBasis = asNumber(item.cost_basis_cny)
    const holdingProfit = Number.isFinite(Number(item.holding_profit_cny))
      ? Number(item.holding_profit_cny)
      : marketValue - costBasis
    const estimatePct = item.estimate_pct === null || item.estimate_pct === undefined
      ? null
      : Number(item.estimate_pct)
    const dayProfit = estimatePct === null ? null : (marketValue * estimatePct) / 100
    const yesterdayProfit = dayProfit === null ? null : dayProfit * 0.78
    const holdingDays = calcDays(item.start_date)
    return {
      fund_id: item.fund_id || '--',
      name: item.name || '未命名基金',
      bucket: item.bucket || '',
      market_value_cny: marketValue,
      cost_basis_cny: costBasis,
      shares: asNumber(item.shares),
      start_date: item.start_date || '',
      holding_profit_cny: holdingProfit,
      holding_profit_rate: toPercentValue(holdingProfit, costBasis),
      day_profit_cny: dayProfit,
      yesterday_profit_cny: yesterdayProfit,
      estimate_pct: estimatePct,
      latest_nav: marketValue > 0 && estimatePct !== null ? Number((1 + estimatePct / 100).toFixed(4)) : null,
      source: item.source || '--',
      status: item.status || 'failed',
      reason: item.reason || '',
      yesterday_profit_source: item.yesterday_profit_source || 'estimated_today',
      market_group: item.market_group || 'cn_hk',
      holding_days: holdingDays,
      tags: Array.isArray(item.tags) ? item.tags : []
    }
  })
}

export function sortRows(rows, sorter) {
  const next = rows.map((item, index) => ({ item, index }))
  const { key, order } = sorter || {}
  if (!key || !order) return next.map((entry) => entry.item)
  const direction = order === 'asc' ? 1 : -1

  next.sort((a, b) => {
    const va = a.item[key]
    const vb = b.item[key]
    if (key === 'name') {
      const compare = String(va || '').localeCompare(String(vb || ''), 'zh-CN')
      if (compare !== 0) return compare * direction
      return a.index - b.index
    }

    const na = Number(va)
    const nb = Number(vb)
    if (!Number.isFinite(na) && !Number.isFinite(nb)) return a.index - b.index
    if (!Number.isFinite(na)) return 1
    if (!Number.isFinite(nb)) return -1
    const compare = (na - nb) * direction
    if (compare !== 0) return compare
    return a.index - b.index
  })
  return next.map((entry) => entry.item)
}

export function cycleSortState(current, nextKey) {
  if (current.key !== nextKey) {
    return { key: nextKey, order: 'desc' }
  }
  if (current.order === 'desc') {
    return { key: nextKey, order: 'asc' }
  }
  if (current.order === 'asc') {
    return { key: '', order: '' }
  }
  return { key: nextKey, order: 'desc' }
}
