import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listMetrics, recordMetric } from './metrics.js'

const METRIC_KEY = 'vectorcontrol_frontend_metrics'
const METRIC_STATE_KEY = '__vectorcontrolFrontendMetricsState__'

function resetMetricsState() {
  const state = globalThis[METRIC_STATE_KEY]
  if (!state) return

  if (state.flushTimer !== null) {
    clearTimeout(state.flushTimer)
  }

  state.metrics = null
  state.pendingMetrics = []
  state.flushTimer = null
}

describe('metrics utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetMetricsState()
  })

  it('buffers localStorage writes and flushes once after the delay', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    recordMetric('first', { source: 'home' })
    recordMetric('second', { source: 'trade' })

    expect(getItemSpy).toHaveBeenCalledTimes(1)
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(listMetrics()).toEqual([
      expect.objectContaining({ event: 'first', source: 'home' }),
      expect.objectContaining({ event: 'second', source: 'trade' })
    ])

    vi.advanceTimersByTime(1000)

    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(getItemSpy).toHaveBeenCalledTimes(2)
    expect(JSON.parse(localStorage.getItem(METRIC_KEY))).toEqual([
      expect.objectContaining({ event: 'first', source: 'home' }),
      expect.objectContaining({ event: 'second', source: 'trade' })
    ])
  })

  it('flushes pending metrics when the page becomes hidden', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    let visibilityState = 'visible'

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    })

    recordMetric('hidden-flush', { scene: 'settings' })
    expect(setItemSpy).not.toHaveBeenCalled()

    visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))

    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(METRIC_KEY))).toEqual([
      expect.objectContaining({ event: 'hidden-flush', scene: 'settings' })
    ])

    vi.advanceTimersByTime(1000)
    expect(setItemSpy).toHaveBeenCalledTimes(1)
  })

  it('keeps the latest 120 metrics in memory and storage', () => {
    for (let index = 1; index <= 125; index += 1) {
      recordMetric(`event-${index}`, { index })
    }

    const buffered = listMetrics()
    expect(buffered).toHaveLength(120)
    expect(buffered[0]).toEqual(expect.objectContaining({ event: 'event-6', index: 6 }))
    expect(buffered[119]).toEqual(expect.objectContaining({ event: 'event-125', index: 125 }))

    vi.advanceTimersByTime(1000)

    const stored = JSON.parse(localStorage.getItem(METRIC_KEY))
    expect(stored).toHaveLength(120)
    expect(stored[0]).toEqual(expect.objectContaining({ event: 'event-6', index: 6 }))
    expect(stored[119]).toEqual(expect.objectContaining({ event: 'event-125', index: 125 }))
  })
})
