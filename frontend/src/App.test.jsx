import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const authState = {
  user: null,
  authLoading: false,
  authReady: true,
  login: vi.fn(),
  logout: vi.fn()
}

const portfolioState = {
  rows: [],
  riskOverview: null,
  status: { type: 'success', message: '' },
  loading: false,
  lastRefresh: '',
  asof: '',
  updatedAt: '',
  confirmState: 'confirmed',
  coverage: { total: 0, ok: 0, failed: 0 },
  refreshElapsedMs: 0,
  estimateCacheHit: false,
  incrementalMode: '',
  incrementalReusedQuotes: 0,
  incrementalFetchedQuotes: 0,
  estimateDataStatus: { status: 'confirmed', asof: '', note: '' },
  settings: {
    display: { auto_refresh_enabled: false },
    notifications: { rules: [] },
    network_benchmark: {}
  },
  refresh: vi.fn(),
  setAutoRefreshEnabled: vi.fn(),
  saveSettingsPatch: vi.fn(),
  updateFeishuWebhookCredential: vi.fn(),
  updateTelegramCredential: vi.fn(),
  sendFeishuTestMessage: vi.fn(),
  sendTelegramTestMessage: vi.fn(),
  saveHolding: vi.fn(),
  createHolding: vi.fn()
}

vi.mock('./hooks/useAuth.js', () => ({
  useAuth: () => authState
}))

vi.mock('./hooks/usePortfolio.js', () => ({
  usePortfolio: () => portfolioState
}))

vi.mock('./hooks/useAppNavigation.js', () => ({
  useAppNavigation: () => ({
    activeTab: 'home',
    currentView: 'home',
    detailFundId: '',
    profileView: 'overview',
    setActiveTab: vi.fn(),
    navigate: vi.fn(),
    handleTabChange: vi.fn(),
    navigateToFundDetail: vi.fn(),
    navigateFromFundDetail: vi.fn(),
    openSystemStatusView: vi.fn(),
    openProfileOverview: vi.fn()
  })
}))

vi.mock('./components/LoginPanel.jsx', () => ({
  LoginPanel: () => <div>登录面板</div>
}))

describe('App', () => {
  it('在未登录时可渲染登录面板而不抛错', async () => {
    render(<App />)
    expect(await screen.findByText('登录面板')).toBeInTheDocument()
  })

  it('已登录时可渲染首页而不会因收益序列构建报错', async () => {
    authState.user = { id: 'u1', username: 'admin' }
    portfolioState.rows = [
      {
        fund_id: '110006',
        fund_name: '易方达消费',
        market_value_cny: 12345.67,
        holding_profit_cny: 2345.67,
        holding_profit_rate: 0.1234,
        day_change_pct: 0.015,
        day_profit_cny: 120,
        market_group: 'cn_hk',
        shares: 1000,
        cost_basis_cny: 10000,
        gain_1m_pct: 3.2,
        gain_3m_pct: 5.6,
        gain_6m_pct: 8.9,
        gain_1y_pct: 12.3
      }
    ]

    render(<App />)
    expect(await screen.findByTestId('portfolio-returns-panel')).toBeInTheDocument()

    authState.user = null
    portfolioState.rows = []
  })
})
