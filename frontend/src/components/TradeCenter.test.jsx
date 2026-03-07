import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TradeCenter } from './TradeCenter.jsx'

function buildProps(overrides = {}) {
  return {
    user: { id: 'u1' },
    actionDataStatus: { status: 'confirmed', note: 'ok', asof: '2026-03-08T00:00:00+08:00' },
    tradeType: 'buy',
    setTradeType: vi.fn(),
    setTradeSubmitError: vi.fn(),
    setTradeSubmitResult: vi.fn(),
    recordMetric: vi.fn(),
    tradeFundCode: '',
    setTradeFundCode: vi.fn(),
    tradeFundSuggestLoading: false,
    tradeFundSuggestions: [],
    handlePickTradeSuggestion: vi.fn(),
    tradeAmount: null,
    setTradeAmount: vi.fn(),
    tradeOccurredAt: '',
    setTradeOccurredAt: vi.fn(),
    tradeDone: false,
    setTradeDone: vi.fn(),
    tradeSubmitting: false,
    handleTradeSubmit: (event) => event.preventDefault(),
    tradeSubmitError: '',
    tradeSubmitResult: null,
    formatDateTime: vi.fn((value) => String(value || '--')),
    actionLoading: false,
    actionError: '',
    actionLogs: [],
    transactionLifecycle: { step: 2, note: '等待最终确认' },
    transactionSummary: { total_count: 3, pending_count: 2, confirmed_count: 1 },
    transactionLoading: false,
    transactionDataStatus: { status: 'confirmed', note: 'ok', asof: '2026-03-08T00:00:00+08:00' },
    transactionFilterStatus: 'pending',
    setTransactionFilterStatus: vi.fn(),
    handleSyncPending: vi.fn(),
    syncPendingLoading: false,
    loadTransactionList: vi.fn(),
    syncPendingError: '',
    syncPendingResult: null,
    transactionError: '',
    transactionLogs: [],
    beginEditTransaction: vi.fn(),
    transactionPatchLoading: false,
    loadTransactionAudit: vi.fn(),
    transactionAuditLoading: false,
    editingTransactionId: null,
    editingTransactionForm: {},
    setEditingTransactionForm: vi.fn(),
    nowForDateTimeInput: vi.fn(() => '2026-03-08T00:00'),
    handlePatchTransaction: (event) => event.preventDefault(),
    cancelEditTransaction: vi.fn(),
    transactionPatchError: '',
    transactionPatchResult: null,
    transactionAuditTargetId: null,
    transactionAuditError: '',
    transactionAuditItems: [],
    dcaPlans: [],
    dcaFailedPlans: [{ id: 1 }, { id: 2 }],
    planName: '',
    setPlanName: vi.fn(),
    planFundCode: '',
    setPlanFundCode: vi.fn(),
    planAmount: '',
    setPlanAmount: vi.fn(),
    planSchedule: 'monthly',
    setPlanSchedule: vi.fn(),
    planSubmitting: false,
    handleCreatePlan: (event) => event.preventDefault(),
    planError: '',
    dcaStatusMap: {},
    dcaLastRunAtMap: {},
    handlePlanAction: vi.fn(),
    handleTogglePlan: vi.fn(),
    formatDate: vi.fn((value) => String(value || '--')),
    ...overrides
  }
}

describe('TradeCenter', () => {
  it('渲染交易工作台概览与流水筛选区', () => {
    render(<TradeCenter {...buildProps()} />)

    expect(screen.getByRole('heading', { level: 2, name: '交易工作台' })).toBeInTheDocument()

    const overview = screen.getByLabelText('交易工作台概览')
    expect(within(overview).getByText('待确认')).toBeInTheDocument()
    expect(within(overview).getByText('已确认')).toBeInTheDocument()
    expect(within(overview).getByText('失败待办')).toBeInTheDocument()
    const pendingCard = within(overview).getByText('待确认').closest('article')
    const confirmedCard = within(overview).getByText('已确认').closest('article')
    const followupCard = within(overview).getByText('失败待办').closest('article')
    expect(within(pendingCard).getByText('2')).toBeInTheDocument()
    expect(within(confirmedCard).getByText('1')).toBeInTheDocument()
    expect(within(followupCard).getByText('2')).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 3, name: '交易生命周期' })).toBeInTheDocument()
    expect(screen.getByLabelText('交易流水筛选')).toBeInTheDocument()
    expect(screen.getByText('当前筛选条件下暂无交易流水')).toBeInTheDocument()
  })

  it('高亮当前交易类型并在切换时触发副作用', () => {
    const setTradeType = vi.fn()
    const setTradeSubmitError = vi.fn()
    const setTradeSubmitResult = vi.fn()
    const recordMetric = vi.fn()

    render(
      <TradeCenter
        {...buildProps({
          tradeType: 'redeem',
          setTradeType,
          setTradeSubmitError,
          setTradeSubmitResult,
          recordMetric
        })}
      />
    )

    const redeemButton = screen.getByRole('button', { name: '赎回' })
    expect(redeemButton.className).toContain('trade-type-tab--active')

    fireEvent.click(screen.getByRole('button', { name: '定投' }))

    expect(setTradeType).toHaveBeenCalledWith('dca')
    expect(setTradeSubmitError).toHaveBeenCalledWith('')
    expect(setTradeSubmitResult).toHaveBeenCalledWith(null)
    expect(recordMetric).toHaveBeenCalledWith('交易类型切换', { trade_type: 'dca' })
  })
})
