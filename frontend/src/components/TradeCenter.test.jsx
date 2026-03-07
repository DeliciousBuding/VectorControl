import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TradeCenter } from './TradeCenter.jsx'

describe('TradeCenter', () => {
  it('渲染交易工作台头部与概览卡', () => {
    render(
      <TradeCenter
        user={{ id: 'u1' }}
        actionDataStatus={{ status: 'confirmed', note: 'ok', asof: '2026-03-08T00:00:00+08:00' }}
        tradeType="buy"
        setTradeType={vi.fn()}
        setTradeSubmitError={vi.fn()}
        setTradeSubmitResult={vi.fn()}
        recordMetric={vi.fn()}
        tradeFundCode=""
        setTradeFundCode={vi.fn()}
        tradeFundSuggestLoading={false}
        tradeFundSuggestions={[]}
        handlePickTradeSuggestion={vi.fn()}
        tradeAmount={null}
        setTradeAmount={vi.fn()}
        tradeOccurredAt=""
        setTradeOccurredAt={vi.fn()}
        tradeDone={false}
        setTradeDone={vi.fn()}
        tradeSubmitting={false}
        handleTradeSubmit={(event) => event.preventDefault()}
        tradeSubmitError=""
        tradeSubmitResult={null}
        formatDateTime={vi.fn((value) => String(value || '--'))}
        actionLoading={false}
        actionError=""
        actionLogs={[]}
        transactionLifecycle={{ step: 1, note: '等待确认' }}
        transactionSummary={{ total_count: 3, pending_count: 2, confirmed_count: 1 }}
        transactionLoading={false}
        transactionDataStatus={{ status: 'confirmed', note: 'ok', asof: '2026-03-08T00:00:00+08:00' }}
        transactionFilterStatus="all"
        setTransactionFilterStatus={vi.fn()}
        handleSyncPending={vi.fn()}
        syncPendingLoading={false}
        loadTransactionList={vi.fn()}
        syncPendingError=""
        syncPendingResult={null}
        transactionError=""
        transactionLogs={[]}
        beginEditTransaction={vi.fn()}
        transactionPatchLoading={false}
        loadTransactionAudit={vi.fn()}
        transactionAuditLoading={false}
        editingTransactionId={null}
        editingTransactionForm={{}}
        setEditingTransactionForm={vi.fn()}
        nowForDateTimeInput="2026-03-08T00:00"
        handlePatchTransaction={(event) => event.preventDefault()}
        cancelEditTransaction={vi.fn()}
        transactionPatchError=""
        transactionPatchResult={null}
        transactionAuditTargetId={null}
        transactionAuditError=""
        transactionAuditItems={[]}
        dcaPlans={[]}
        dcaFailedPlans={[{ id: 1 }]}
        planName=""
        setPlanName={vi.fn()}
        planFundCode=""
        setPlanFundCode={vi.fn()}
        planAmount=""
        setPlanAmount={vi.fn()}
        planSchedule="monthly"
        setPlanSchedule={vi.fn()}
        planSubmitting={false}
        handleCreatePlan={(event) => event.preventDefault()}
        planError=""
        dcaStatusMap={{}}
        dcaLastRunAtMap={{}}
        handlePlanAction={vi.fn()}
        handleTogglePlan={vi.fn()}
        formatDate={vi.fn((value) => String(value || '--'))}
      />
    )

    expect(screen.getByText('交易工作台')).toBeInTheDocument()
    expect(screen.getByLabelText('交易工作台概览')).toBeInTheDocument()
    expect(screen.getByText('待确认')).toBeInTheDocument()
    expect(screen.getByText('失败待办')).toBeInTheDocument()
  })
})
