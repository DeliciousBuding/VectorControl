export function isFundInHoldings(rows, fundId) {
  const target = String(fundId || '').trim()
  if (!target) return false
  if (!Array.isArray(rows)) return false
  return rows.some((row) => String(row?.fund_id || '').trim() === target)
}

export function resolveGlobalSearchTarget(rows, fundId) {
  return isFundInHoldings(rows, fundId) ? 'holdings' : 'fund_center'
}

