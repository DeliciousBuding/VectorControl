const SESSION_TOKEN_KEY = 'vectorcontrol_session_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY)
    }
  } catch {
    // 忽略浏览器存储异常
  }
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let body = options.body
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(path, {
      ...options,
      headers,
      body
    })
  } catch {
    throw new Error('网络请求失败，请检查连接状态')
  }

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { detail: text }
    }
  }

  if (!response.ok) {
    const message = payload?.detail || payload?.message || payload?.error || `请求失败（${response.status}）`
    const error = new Error(message)
    error.status = response.status
    error.path = path
    throw error
  }

  return payload
}

async function apiFetchWithFallback(paths, options = {}) {
  const candidates = Array.isArray(paths) ? paths : [paths]
  let lastError = null
  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index]
    try {
      return await apiFetch(path, options)
    } catch (error) {
      lastError = error
      if (error?.status !== 404 || index === candidates.length - 1) {
        throw error
      }
    }
  }
  throw lastError || new Error('请求失败')
}

export function registerUser(payload) {
  return apiFetch('/api/auth/register', { method: 'POST', body: payload })
}

export function loginUser(payload) {
  return apiFetch('/api/auth/login', { method: 'POST', body: payload })
}

export function fetchMe() {
  return apiFetch('/api/auth/me')
}

export function logoutUser() {
  return apiFetch('/api/auth/logout', { method: 'POST' })
}

export function fetchSettings() {
  return apiFetch('/api/settings')
}

export function saveSettings(payload) {
  return apiFetch('/api/settings', { method: 'PUT', body: payload })
}

export function fetchNetworkBenchmarkLatest() {
  return apiFetchWithFallback([
    '/api/settings/network-benchmark/latest',
    '/api/settings/network_benchmark/latest'
  ])
}

export function runNetworkBenchmark(payload) {
  return apiFetchWithFallback(
    ['/api/settings/network-benchmark/run', '/api/settings/network_benchmark/run'],
    { method: 'POST', body: payload }
  )
}

export function fetchSystemStatus() {
  return apiFetch('/api/system/status')
}

export function fetchConfig() {
  return apiFetch('/api/config')
}

export function fetchEstimate(options = {}) {
  const query = new URLSearchParams()
  if (options.forceRefresh !== undefined) {
    query.set('force_refresh', options.forceRefresh ? '1' : '0')
  }
  if (options.preferCached !== undefined) {
    query.set('prefer_cached', options.preferCached ? '1' : '0')
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiFetch(`/api/estimate${suffix}`)
}

export function fetchRiskOverview() {
  return apiFetch('/api/risk/overview')
}

export function fetchAdvice() {
  return apiFetch('/api/advice')
}

export function fetchActions(date = '') {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch(`/api/actions${query}`)
}

export function saveAction(payload) {
  return apiFetch('/api/actions', { method: 'POST', body: payload })
}

export function fetchTransactions(options = {}) {
  const query = new URLSearchParams()
  if (options.status) query.set('status', String(options.status))
  if (options.from) query.set('from', String(options.from))
  if (options.to) query.set('to', String(options.to))
  if (options.fundId) query.set('fund_id', String(options.fundId))
  if (options.limit !== undefined && options.limit !== null) {
    query.set('limit', String(options.limit))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiFetch(`/api/transactions${suffix}`)
}

export function syncPendingTransactions(payload = {}) {
  return apiFetch('/api/transactions/sync_pending', { method: 'POST', body: payload })
}

export function patchTransaction(transactionId, payload = {}) {
  return apiFetch(`/api/transactions/${encodeURIComponent(String(transactionId || '').trim())}`, {
    method: 'PATCH',
    body: payload
  })
}

export function fetchTransactionAudit(transactionId, limit = 20) {
  const query = new URLSearchParams({
    limit: String(limit)
  })
  return apiFetch(
    `/api/transactions/${encodeURIComponent(String(transactionId || '').trim())}/audit?${query.toString()}`
  )
}

export function updateHolding(fundId, payload) {
  return apiFetch(`/api/holdings/${encodeURIComponent(fundId)}`, {
    method: 'PATCH',
    body: payload
  })
}

export function fetchHoldingAudit(fundId, limit = 50) {
  const query = new URLSearchParams({
    limit: String(limit)
  })
  return apiFetch(`/api/holdings/${encodeURIComponent(String(fundId || '').trim())}/audit?${query.toString()}`)
}

export function fetchDailyReport(date = '') {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch(`/api/report/daily${query}`)
}

export function fetchFundSuggest(keyword, limit = 8) {
  const query = new URLSearchParams({
    keyword: String(keyword || ''),
    limit: String(limit)
  })
  return apiFetch(`/api/funds/suggest?${query.toString()}`)
}

export function searchFunds(q, limit = 10) {
  const query = new URLSearchParams({
    q: String(q || ''),
    limit: String(limit)
  })
  return apiFetch(`/api/funds/search?${query.toString()}`)
}

export function fetchFundDetail(fundId) {
  return apiFetch(`/api/funds/${encodeURIComponent(String(fundId || '').trim())}`)
}

export function fetchFundNavLatest(fundId) {
  return apiFetch(`/api/funds/${encodeURIComponent(String(fundId || '').trim())}/nav/latest`)
}

export function fetchFundNavHistory(fundId, options = {}) {
  const query = new URLSearchParams()
  if (options.from) query.set('from', String(options.from))
  if (options.to) query.set('to', String(options.to))
  if (options.limit !== undefined && options.limit !== null) {
    query.set('limit', String(options.limit))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiFetch(`/api/funds/${encodeURIComponent(String(fundId || '').trim())}/nav/history${suffix}`)
}
