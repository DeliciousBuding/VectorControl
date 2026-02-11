import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, AUTH_EVENT_EXPIRY } from './api.js'

describe('apiFetch request id', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('错误响应包含 X-Request-ID 时应透传到错误对象与提示文案', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: '测速接口异常' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-abc-123'
        }
      })
    ))

    let captured = null
    try {
      await apiFetch('/api/settings/network-benchmark/run', { method: 'POST', body: {} })
    } catch (error) {
      captured = error
    }

    expect(captured).toBeTruthy()
    expect(captured.status).toBe(502)
    expect(captured.requestId).toBe('req-abc-123')
    expect(captured.request_id).toBe('req-abc-123')
    expect(captured.message).toContain('测速接口异常')
    expect(captured.message).toContain('请求ID: req-abc-123')
  })

  it('错误响应无 request id 时保持原始错误文案', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: '请求失败' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    ))

    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 500,
      requestId: '',
      message: '请求失败'
    })
  })
})
