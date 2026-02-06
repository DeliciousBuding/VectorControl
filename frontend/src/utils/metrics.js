const METRIC_KEY = 'vectorcontrol_frontend_metrics'
const MAX_ITEMS = 120

function readRaw() {
  try {
    const raw = localStorage.getItem(METRIC_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function recordMetric(event, payload = {}) {
  try {
    const list = readRaw()
    list.push({
      event,
      ts: new Date().toISOString(),
      ...payload
    })
    while (list.length > MAX_ITEMS) list.shift()
    localStorage.setItem(METRIC_KEY, JSON.stringify(list))
  } catch {
    // 忽略本地存储异常，避免影响主流程
  }
}

export function listMetrics() {
  return readRaw()
}
