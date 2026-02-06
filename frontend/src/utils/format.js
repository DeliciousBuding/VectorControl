export function asNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${month}-${day}`
}

export function formatMoney(value, digits = 2) {
  const num = asNumber(value)
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function formatSignedMoney(value, digits = 2) {
  const num = asNumber(value)
  const prefix = num > 0 ? '+' : ''
  return `${prefix}${formatMoney(num, digits)}`
}

export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '--'
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  const prefix = num > 0 ? '+' : ''
  return `${prefix}${num.toFixed(digits)}%`
}

export function classBySign(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) return ''
  return num > 0 ? 'is-up' : 'is-down'
}

export function calcDays(startDate) {
  if (!startDate) return '--'
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return '--'
  const now = new Date()
  const diff = now.getTime() - start.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / (24 * 3600 * 1000))
}

export function toPercentValue(value, base) {
  const v = asNumber(value)
  const b = asNumber(base)
  if (b <= 0) return 0
  return (v / b) * 100
}
