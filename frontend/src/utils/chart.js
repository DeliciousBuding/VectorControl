import { asNumber } from './format.js'

export const RANGE_OPTIONS = [
  { key: 'day', label: '当日', points: 16 },
  { key: '1m', label: '近1月', points: 22 },
  { key: '3m', label: '近3月', points: 30 },
  { key: '6m', label: '近6月', points: 34 },
  { key: '1y', label: '近1年', points: 42 },
  { key: '3y', label: '近3年', points: 50 }
]

function seedFromText(text) {
  const raw = String(text || '')
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 33 + raw.charCodeAt(i)) % 1000003
  }
  return hash / 99991
}

function labelsForRange(rangeKey, points) {
  if (rangeKey === 'day') {
    const times = ['09:35', '10:00', '10:30', '11:00', '11:30', '13:15', '13:45', '14:15', '14:45', '15:00']
    if (points <= times.length) return times.slice(0, points)
    return Array.from({ length: points }, (_, i) => `${9 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`)
  }

  const now = new Date()
  const labels = []
  for (let i = points - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    if (rangeKey === '1m') d.setDate(now.getDate() - i)
    else if (rangeKey === '3m') d.setDate(now.getDate() - i * 3)
    else if (rangeKey === '6m') d.setDate(now.getDate() - i * 6)
    else if (rangeKey === '1y') d.setDate(now.getDate() - i * 8)
    else d.setDate(now.getDate() - i * 22)

    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return labels
}

function smoothSeries(basePct, points, seed, driftScale = 0.5, ampScale = 0.9) {
  const base = asNumber(basePct)
  const values = []
  for (let i = 0; i < points; i += 1) {
    const x = i / Math.max(1, points - 1)
    const drift = (x - 0.5) * base * driftScale
    const wave = Math.sin(seed * 5 + i * 0.68) * ampScale + Math.cos(seed * 3 + i * 0.27) * ampScale * 0.55
    values.push(base * 0.4 + drift + wave)
  }

  const delta = base - values[values.length - 1]
  return values.map((v, index) => {
    const x = index / Math.max(1, points - 1)
    return Number((v + delta * x).toFixed(3))
  })
}

export function buildFundSeries(fund, rangeKey) {
  const range = RANGE_OPTIONS.find((item) => item.key === rangeKey) || RANGE_OPTIONS[0]
  const seed = seedFromText(fund?.fund_id || fund?.name || 'fund')
  const estimatePct = asNumber(fund?.estimate_pct)
  const labels = labelsForRange(range.key, range.points)
  const fundValues = smoothSeries(estimatePct, labels.length, seed)
  const benchmarkBase = estimatePct * 0.55 + Math.sin(seed * 2) * 0.8
  const benchmarkValues = smoothSeries(benchmarkBase, labels.length, seed + 0.37, 0.35, 0.62)
  const userProfitValues = smoothSeries(estimatePct * 0.75, labels.length, seed + 0.81, 0.42, 0.5)

  return labels.map((label, index) => ({
    label,
    fund: fundValues[index],
    benchmark: benchmarkValues[index],
    userProfit: userProfitValues[index],
    zero: 0,
    cost: asNumber(fund?.cost_basis_cny)
  }))
}

export function buildPortfolioSeries(rows, rangeKey) {
  const range = RANGE_OPTIONS.find((item) => item.key === rangeKey) || RANGE_OPTIONS[0]
  const labels = labelsForRange(range.key, range.points)
  const totalValue = rows.reduce((sum, item) => sum + asNumber(item.market_value_cny), 0)
  const totalCost = rows.reduce((sum, item) => sum + asNumber(item.cost_basis_cny), 0)
  const weightedPct = rows.reduce((sum, item) => {
    const mv = asNumber(item.market_value_cny)
    if (mv <= 0) return sum
    return sum + mv * asNumber(item.estimate_pct)
  }, 0) / Math.max(1, totalValue)

  const seed = seedFromText(`${totalValue}-${totalCost}-${rangeKey}`)
  const pctSeries = smoothSeries(weightedPct, labels.length, seed, 0.42, 0.58)
  const valueSeries = pctSeries.map((pct) => Number((totalValue * (1 + pct / 100)).toFixed(2)))
  return labels.map((label, index) => ({
    label,
    value: valueSeries[index],
    zero: totalValue,
    cost: totalCost
  }))
}

export function splitMarketGroups(rows) {
  const domestic = []
  const overseas = []
  for (const row of rows) {
    if (row.market_group === 'us_overseas') overseas.push(row)
    else domestic.push(row)
  }
  return { domestic, overseas }
}
