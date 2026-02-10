import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortfolioReturnsPanel } from './PortfolioReturnsPanel.jsx'
import { fetchPortfolioReturnsHistory } from '../api.js'

vi.mock('../api.js', () => ({
  fetchPortfolioReturnsHistory: vi.fn()
}))

describe('PortfolioReturnsPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('days 切换会触发重新拉取并渲染', async () => {
    fetchPortfolioReturnsHistory
      .mockResolvedValueOnce({
        data: [
          { date: '2026-02-01', asof: '2026-02-01T10:00:00Z', total_return: 1.2, day_profit: 10.0 },
          { date: '2026-02-02', asof: '2026-02-02T10:00:00Z', total_return: 2.2, day_profit: -3.0 }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          { date: '2026-02-03', asof: '2026-02-03T10:00:00Z', total_return: 3.3, day_profit: 1.0 },
          { date: '2026-02-04', asof: '2026-02-04T10:00:00Z', total_return: 4.4, day_profit: 2.0 }
        ]
      })

    render(<PortfolioReturnsPanel user={{ id: 'u1' }} lastRefresh={1} />)

    await waitFor(() => {
      expect(fetchPortfolioReturnsHistory).toHaveBeenCalledTimes(1)
    })
    expect(fetchPortfolioReturnsHistory).toHaveBeenLastCalledWith(30)
    expect(screen.getByRole('img', { name: /累计收益率/ })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('portfolio-returns-days-7'))

    await waitFor(() => {
      expect(fetchPortfolioReturnsHistory).toHaveBeenCalledTimes(2)
    })
    expect(fetchPortfolioReturnsHistory).toHaveBeenLastCalledWith(7)

    expect(screen.getByText('最近 7 天日收益')).toBeInTheDocument()
    // "02-04" 同时会出现在图表 x-axis 与列表里，这里限定在列表容器内断言避免歧义
    const list = screen.getByTestId('portfolio-returns-day-profit-list')
    expect(within(list).getByText('02-04')).toBeInTheDocument()
  })

  it('显示摘要信息（累计收益/最大回撤/近30天波动）', async () => {
    fetchPortfolioReturnsHistory.mockResolvedValueOnce({
      data: [
        { date: '2026-02-01', asof: '2026-02-01T10:00:00Z', total_return: 0, day_profit: 0 },
        { date: '2026-02-02', asof: '2026-02-02T10:00:00Z', total_return: 1.0, day_profit: 1.0 },
        { date: '2026-02-03', asof: '2026-02-03T10:00:00Z', total_return: 0.5, day_profit: -0.5 },
        { date: '2026-02-04', asof: '2026-02-04T10:00:00Z', total_return: 2.0, day_profit: 1.5 }
      ]
    })

    render(<PortfolioReturnsPanel user={{ id: 'u1' }} lastRefresh={1} />)

    await waitFor(() => {
      expect(fetchPortfolioReturnsHistory).toHaveBeenCalledTimes(1)
    })

    // 验证摘要面板存在
    const summary = screen.getByTestId('portfolio-returns-summary')
    expect(summary).toBeInTheDocument()

    // 验证三个摘要项
    expect(within(summary).getByText('累计收益')).toBeInTheDocument()
    expect(within(summary).getByText('最大回撤')).toBeInTheDocument()
    expect(within(summary).getByText('近30天波动')).toBeInTheDocument()

    // 验证口径提示
    expect(within(summary).getByText('基于估值快照')).toBeInTheDocument()
    expect(within(summary).getByText('区间峰值到谷值')).toBeInTheDocument()
    expect(within(summary).getByText('日收益率标准差')).toBeInTheDocument()
  })

  it('空数据时显示可解释提示和下一步建议', async () => {
    fetchPortfolioReturnsHistory.mockResolvedValueOnce({ data: [] })

    render(<PortfolioReturnsPanel user={{ id: 'u1' }} lastRefresh={1} />)

    await waitFor(() => {
      expect(fetchPortfolioReturnsHistory).toHaveBeenCalledTimes(1)
    })

    // 验证空状态提示
    expect(screen.getByText('暂无足够的历史数据')).toBeInTheDocument()
    expect(screen.getByText(/需要至少 2 个估值快照点/)).toBeInTheDocument()
    expect(screen.getByText(/进行几次手动刷新/)).toBeInTheDocument()
  })
})
