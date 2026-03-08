import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FundDetailPage } from './FundDetailPage.jsx'

vi.mock('../api.js', () => ({
  fetchFundDetailPageData: vi.fn()
}))

import { fetchFundDetailPageData } from '../api.js'

describe('FundDetailPage', () => {
  it('以独立页面形式渲染基金详情，并展示左右信息区块', async () => {
    const onBack = vi.fn()
    fetchFundDetailPageData.mockResolvedValue({
      fund: {
        fund_id: '110006',
        name: '易方达消费',
        market_value_cny: 12345.67,
        holding_profit_cny: 2345.67,
        holding_profit_rate: 0.1234,
        day_change_pct: 0.015,
        market_group: 'cn_hk',
        shares: 1000,
        cost_basis_cny: 10000,
        holding_days: 120,
        start_date: '2025-01-01',
        confirm_state: 'confirmed',
        as_of: '2026-03-07T15:00:00+08:00'
      },
      latest: {
        unit_nav: 1.2345,
        estimate_nav: 1.2456,
        trade_date: '2026-03-07',
        asof: '2026-03-07T15:00:00+08:00'
      },
      history: [
        { trade_date: '2026-02-10', unit_nav: 1.2, estimate_nav: 1.21, confirm_state: 'confirmed' },
        { trade_date: '2026-03-07', unit_nav: 1.2345, estimate_nav: 1.2456, confirm_state: 'estimating' }
      ],
      transactions: [
        { id: 1, occurred_at: '2026-03-01T10:00:00+08:00', action: 'buy', amount_cny: 1000, shares: 100, status: 'confirmed' }
      ],
      transactionSummary: {
        total_count: 1,
        pending_count: 0,
        confirmed_count: 1
      }
    })

    const { container } = render(<FundDetailPage fundId="110006" onBack={onBack} />)

    await waitFor(() => {
      expect(fetchFundDetailPageData).toHaveBeenCalledWith('110006', { historyLimit: 90, transactionLimit: 20 })
    })

    expect(container.querySelector('.fund-detail-page')).toBeTruthy()
    expect(screen.getByText('易方达消费')).toBeInTheDocument()
    expect(screen.getByText('基金详情')).toBeInTheDocument()
    expect(screen.getByText('净值走势')).toBeInTheDocument()
    expect(screen.getByText('Performance Snapshot')).toBeInTheDocument()
    expect(screen.getByLabelText('净值快照')).toBeInTheDocument()
    expect(screen.getByText(/交易记录 \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('Execution Snapshot')).toBeInTheDocument()
    expect(screen.getByLabelText('交易执行快照')).toBeInTheDocument()
    expect(screen.getByText('Holding Snapshot')).toBeInTheDocument()
    expect(screen.getByLabelText('持仓快照')).toBeInTheDocument()
    expect(screen.getByText('持仓详情')).toBeInTheDocument()
    expect(screen.getAllByText('单位净值').length).toBeGreaterThan(0)
    expect(screen.getByText('Latest Valuation')).toBeInTheDocument()
    expect(screen.getByLabelText('最新净值快照')).toBeInTheDocument()
    expect(screen.getByText('当日涨跌')).toBeInTheDocument()
    expect(screen.getByLabelText('基金详情概览')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
