const TOKEN_STORAGE_KEY = 'fund_watchtower_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors (private mode, denied access)
  }
}

export function getQueryToken() {
  try {
    return new URLSearchParams(window.location.search).get('token') || ''
  } catch {
    return ''
  }
}

export function getAuthToken() {
  const stored = getStoredToken()
  if (stored) return stored
  return getQueryToken()
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

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
  } catch (error) {
    throw new Error('网络请求失败，请检查连接。')
  }

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { message: text }
    }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || `请求失败 (${response.status})`
    throw new Error(message)
  }

  return payload
}

export function fetchEstimate() {
  return apiFetch('/api/estimate')
}

export function fetchAdvice() {
  return apiFetch('/api/advice')
}

export function fetchReportDaily() {
  return apiFetch('/api/report/daily')
}

export function fetchActions() {
  return apiFetch('/api/actions')
}

export function saveActions(payload) {
  return apiFetch('/api/actions', {
    method: 'POST',
    body: payload
  })
}
