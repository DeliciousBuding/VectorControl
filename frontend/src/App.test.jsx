import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

vi.mock('./hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: null,
    authLoading: false,
    authReady: true,
    login: vi.fn(),
    logout: vi.fn()
  })
}))

vi.mock('./hooks/usePortfolio.js', () => ({
  usePortfolio: () => ({
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
  })
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
})
