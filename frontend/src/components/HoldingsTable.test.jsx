import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HoldingsTable } from './HoldingsTable.jsx'

function buildRow(index) {
  return {
    fund_id: `16${String(index).padStart(4, '0')}`,
    name: `基金-${index}`,
    market_value_cny: 10000 + index,
    shares: 100 + index,
    cost_basis_cny: 9000 + index,
    holding_profit_cny: 1000 + index,
    holding_profit_rate: 10 + index / 100,
    day_profit_cny: index % 2 === 0 ? 20 : -12,
    yesterday_profit_cny: index % 2 === 0 ? 16 : -8,
    estimate_pct: index % 2 === 0 ? 0.66 : -0.35,
    latest_nav: 1.2345,
    holding_days: 30 + index,
    start_date: '2025-01-01',
    confirm_state: 'confirmed'
  }
}

function buildSparklineMap(rows) {
  const points = [
    { label: '2026-01-05', value: -0.6 },
    { label: '2026-01-12', value: 0.2 },
    { label: '2026-01-19', value: 0.9 }
  ]
  const map = {}
  rows.forEach((row) => {
    map[row.fund_id] = points
  })
  return map
}

describe('HoldingsTable 50+ 回归', () => {
  it('可渲染 60 条持仓并支持行点击', () => {
    const rows = Array.from({ length: 60 }, (_, idx) => buildRow(idx + 1))
    const onSelectFund = vi.fn()

    render(
      <HoldingsTable
        title="国内股 / 港股"
        rows={rows}
        dateLabel="2026-02-08"
        sortState={{ key: 'market_value_cny', order: 'desc' }}
        onSort={vi.fn()}
        selectedFundId=""
        onSelectFund={onSelectFund}
        sparklineMap={buildSparklineMap(rows)}
        onSaveHolding={vi.fn().mockResolvedValue(true)}
        onOpenAudit={vi.fn()}
      />
    )

    expect(screen.getByText('60 只基金')).toBeInTheDocument()
    fireEvent.click(screen.getByText('基金-1'))
    expect(onSelectFund).toHaveBeenCalledWith('160001')
  })

  it('可在大列表中进入编辑并保存单条持仓', async () => {
    const rows = Array.from({ length: 60 }, (_, idx) => buildRow(idx + 1))
    const onSaveHolding = vi.fn().mockResolvedValue(true)

    render(
      <HoldingsTable
        title="国内股 / 港股"
        rows={rows}
        dateLabel="2026-02-08"
        sortState={{ key: 'market_value_cny', order: 'desc' }}
        onSort={vi.fn()}
        selectedFundId=""
        onSelectFund={vi.fn()}
        sparklineMap={buildSparklineMap(rows)}
        onSaveHolding={onSaveHolding}
        onOpenAudit={vi.fn()}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0])
    const marketInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(marketInput, { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(onSaveHolding).toHaveBeenCalledTimes(1)
    })
    expect(onSaveHolding).toHaveBeenCalledWith('160001', expect.objectContaining({ market_value_cny: 12345 }))
  })
})
