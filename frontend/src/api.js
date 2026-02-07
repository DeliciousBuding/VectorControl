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
    throw new Error(message)
  }

  return payload
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

export function fetchConfig() {
  return apiFetch('/api/config')
}

export function fetchEstimate() {
  return apiFetch('/api/estimate')
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

export function updateHolding(fundId, payload) {
  return apiFetch(`/api/holdings/${encodeURIComponent(fundId)}`, {
    method: 'PATCH',
    body: payload
  })
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