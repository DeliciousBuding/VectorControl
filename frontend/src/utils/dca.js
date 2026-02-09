const DAY_MS = 24 * 60 * 60 * 1000

export function normalizeDcaSchedule(schedule) {
  const value = String(schedule || '').trim().toLowerCase()
  if (value === 'weekly' || value === 'biweekly' || value === 'monthly') return value
  // Legacy value kept for forward-compat with old settings.
  if (value === 'daily') return 'weekly'
  return 'weekly'
}

export function getDcaScheduleLabel(schedule) {
  const normalized = normalizeDcaSchedule(schedule)
  if (normalized === 'weekly') return '每周'
  if (normalized === 'biweekly') return '双周'
  return '每月'
}

function startOfDay(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function computeNextRunDate({ schedule, lastRunAt, now = new Date() }) {
  const normalized = normalizeDcaSchedule(schedule)
  const base = startOfDay(lastRunAt || now) || startOfDay(now) || new Date()
  const next = new Date(base)
  if (normalized === 'weekly') next.setDate(next.getDate() + 7)
  else if (normalized === 'biweekly') next.setDate(next.getDate() + 14)
  else next.setMonth(next.getMonth() + 1)
  return next
}

export function daysUntil(date, now = new Date()) {
  const start = startOfDay(now)
  const target = startOfDay(date)
  if (!start || !target) return null
  return Math.round((target.getTime() - start.getTime()) / DAY_MS)
}

