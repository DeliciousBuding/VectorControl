const METRIC_KEY = 'vectorcontrol_frontend_metrics'
const MAX_ITEMS = 120
const FLUSH_DELAY_MS = 1000
const METRIC_STATE_KEY = '__vectorcontrolFrontendMetricsState__'

function trimMetrics(list) {
  return list.length > MAX_ITEMS ? list.slice(-MAX_ITEMS) : list
}

function createMetricsState() {
  return {
    metrics: null,
    pendingMetrics: [],
    flushTimer: null,
    lifecycleBound: false
  }
}

function getMetricsState() {
  if (typeof globalThis === 'undefined') return createMetricsState()
  if (!globalThis[METRIC_STATE_KEY]) {
    globalThis[METRIC_STATE_KEY] = createMetricsState()
  }
  return globalThis[METRIC_STATE_KEY]
}

const state = getMetricsState()

function readRaw() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(METRIC_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? trimMetrics(parsed) : []
  } catch {
    return []
  }
}

function ensureMetricsLoaded() {
  if (state.metrics === null) {
    state.metrics = readRaw()
  }
  return state.metrics
}

function clearFlushTimer() {
  if (state.flushTimer !== null) {
    clearTimeout(state.flushTimer)
    state.flushTimer = null
  }
}

function flushMetrics() {
  if (!state.pendingMetrics.length) {
    clearFlushTimer()
    return
  }

  const pendingMetrics = state.pendingMetrics.slice()

  try {
    const latestMetrics = readRaw()
    const nextMetrics = trimMetrics([...latestMetrics, ...pendingMetrics])
    localStorage.setItem(METRIC_KEY, JSON.stringify(nextMetrics))
    state.metrics = nextMetrics
    state.pendingMetrics = []
  } catch {
    // 忽略本地存储异常，避免影响主流程
  } finally {
    clearFlushTimer()
  }
}

function scheduleFlush() {
  if (state.flushTimer !== null) return

  if (typeof setTimeout === 'undefined') {
    flushMetrics()
    return
  }

  state.flushTimer = setTimeout(() => {
    flushMetrics()
  }, FLUSH_DELAY_MS)
}

function bindLifecycleFlush() {
  if (state.lifecycleBound) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const flushBeforeBackground = () => {
    flushMetrics()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushBeforeBackground()
    }
  })

  window.addEventListener('pagehide', flushBeforeBackground)
  window.addEventListener('beforeunload', flushBeforeBackground)

  state.lifecycleBound = true
}

export function recordMetric(event, payload = {}) {
  try {
    bindLifecycleFlush()
    const metrics = ensureMetricsLoaded()
    const item = {
      event,
      ts: new Date().toISOString(),
      ...payload
    }

    metrics.push(item)
    while (metrics.length > MAX_ITEMS) metrics.shift()

    state.pendingMetrics.push(item)
    while (state.pendingMetrics.length > MAX_ITEMS) state.pendingMetrics.shift()

    scheduleFlush()
  } catch {
    // 忽略本地存储异常，避免影响主流程
  }
}

export function listMetrics() {
  if (!state.pendingMetrics.length) {
    state.metrics = readRaw()
    return state.metrics.slice()
  }

  return ensureMetricsLoaded().slice()
}
