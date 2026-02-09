import { describe, expect, it } from 'vitest'
import { computeNextRunDate, daysUntil, getDcaScheduleLabel, normalizeDcaSchedule } from './dca.js'

describe('dca utils', () => {
  it('normalizeDcaSchedule keeps allowed values and maps legacy daily', () => {
    expect(normalizeDcaSchedule('weekly')).toBe('weekly')
    expect(normalizeDcaSchedule('biweekly')).toBe('biweekly')
    expect(normalizeDcaSchedule('monthly')).toBe('monthly')
    expect(normalizeDcaSchedule('daily')).toBe('weekly')
    expect(normalizeDcaSchedule('UNKNOWN')).toBe('weekly')
  })

  it('getDcaScheduleLabel maps to Chinese labels', () => {
    expect(getDcaScheduleLabel('weekly')).toBe('每周')
    expect(getDcaScheduleLabel('biweekly')).toBe('双周')
    expect(getDcaScheduleLabel('monthly')).toBe('每月')
  })

  it('computeNextRunDate + daysUntil works for weekly schedule', () => {
    const now = new Date(2026, 1, 9, 10, 0, 0)
    const next = computeNextRunDate({ schedule: 'weekly', lastRunAt: new Date(2026, 1, 9, 1, 0, 0), now })
    const ymd = (value) => {
      const d = value instanceof Date ? value : new Date(value)
      const y = String(d.getFullYear())
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }
    expect(ymd(next)).toBe('2026-02-16')
    expect(daysUntil(next, now)).toBe(7)
  })
})
