import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, AUTH_EVENT_EXPIRY, fetchFundDetailPageData } from './api.js'

const AUTH_EXPIRY_EVENT = AUTH_EVENT_EXPIRY

describe('fetchFundDetailPageData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('整合详情与交易摘要，并在交易失败时保留详情数据', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          fund: { fund_id: '110006', name: '易方达消费' },
          holding: { shares: 12, market_group: 'cn_hk' },
          latest: { unit_nav: 1.2345, estimate_nav: 1.25 },
          history: [{ trade_date: '2026-03-05', unit_nav: 1.2 }],
          data_status: { status: 'confirmed', asof: '2026-03-05T15:00:00+08:00', note: '详情已确认' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [{ id: 1, fund_id: '110006', status: 'confirmed', amount_cny: 100 }],
          summary: {
            total_count: 1,
            pending_count: 0,
            confirmed_count: 1,
            last_occurred_at: '2026-03-05T10:00:00+08:00'
          },
          data_status: { status: 'estimating', asof: '2026-03-05T10:00:00+08:00', note: '交易口径更新中' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          fund: { fund_id: '110006', name: '易方达消费' },
          latest: null,
          history: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: '交易服务暂不可用' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    vi.stubGlobal('fetch', fetchMock)

    const detail = await fetchFundDetailPageData('110006', { historyLimit: 60, transactionLimit: 10 })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/funds/110006/full?history_limit=60', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/transactions?status=all&fund_id=110006&limit=10', expect.any(Object))
    expect(detail).toMatchObject({
      fund: expect.objectContaining({
        fund_id: '110006',
        name: '易方达消费',
        shares: 12,
        market_group: 'cn_hk'
      }),
      latest: { unit_nav: 1.2345, estimate_nav: 1.25 },
      history: [{ trade_date: '2026-03-05', unit_nav: 1.2 }],
      transactions: [{ id: 1, fund_id: '110006', status: 'confirmed', amount_cny: 100 }],
      transactionSummary: {
        total_count: 1,
        pending_count: 0,
        confirmed_count: 1,
        last_occurred_at: '2026-03-05T10:00:00+08:00'
      },
      dataStatus: {
        status: 'estimating',
        asof: '2026-03-05T10:00:00+08:00',
        note: '交易口径更新中'
      }
    })

    const fallback = await fetchFundDetailPageData('110006')
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/funds/110006/full?history_limit=90', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/transactions?status=all&fund_id=110006&limit=20', expect.any(Object))
    expect(fallback).toMatchObject({
      fund: expect.objectContaining({
        fund_id: '110006',
        name: '易方达消费',
        market_group: 'cn_hk'
      }),
      latest: null,
      history: [],
      transactions: [],
      transactionSummary: {
        total_count: 0,
        pending_count: 0,
        confirmed_count: 0,
        last_occurred_at: ''
      },
      dataStatus: {
        status: 'estimating',
        asof: '',
        note: '基金详情已加载'
      }
    })
  })
})

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

  it('401 响应会广播认证过期事件', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: '访问令牌无效或已过期' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-auth-expired'
        }
      })
    ))

    const listener = vi.fn()
    window.addEventListener(AUTH_EXPIRY_EVENT, listener)

    try {
      await expect(apiFetch('/api/config')).rejects.toMatchObject({
        status: 401,
        requestId: 'req-auth-expired',
        authExpired: true
      })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.calls[0][0].detail).toMatchObject({
        path: '/api/config',
        status: 401,
        requestId: 'req-auth-expired'
      })
    } finally {
      window.removeEventListener(AUTH_EXPIRY_EVENT, listener)
    }
  })

  it('登录接口 401 不广播认证过期事件', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: '密码错误，请重试' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    ))

    const listener = vi.fn()
    window.addEventListener(AUTH_EXPIRY_EVENT, listener)

    try {
      let captured = null
      try {
        await apiFetch('/api/auth/login', { method: 'POST', body: { username: 'demo', password: 'bad-pass' } })
      } catch (error) {
        captured = error
      }

      expect(captured).toBeTruthy()
      expect(captured.status).toBe(401)
      expect(captured.authExpired).not.toBe(true)
      expect(listener).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(AUTH_EXPIRY_EVENT, listener)
    }
  })
})
