import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BenchmarkComparisonPanel } from './BenchmarkComparisonPanel.jsx'
import { fetchBenchmarkComparison, fetchBenchmarks } from '../api.js'

vi.mock('../api.js', () => ({
  fetchBenchmarks: vi.fn(),
  fetchBenchmarkComparison: vi.fn()
}))

describe('BenchmarkComparisonPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('benchmark unknown 时只展示 unknown，不显示跑赢/跑输', async () => {
    fetchBenchmarks.mockResolvedValue({
      benchmarks: {
        hs300: {
          name: '沪深300',
          code: '000300',
          description: 'A 股代表性指数'
        }
      }
    })
    fetchBenchmarkComparison.mockResolvedValue({
      portfolio_return: 2.34,
      benchmarks: {
        hs300: {
          name: '沪深300',
          code: '000300',
          description: 'A 股代表性指数'
        }
      },
      comparison: {
        hs300: {
          portfolio_return: 2.34,
          benchmark_return: null,
          excess_return: null,
          outperform: null
        }
      },
      data_status: {
        status: 'partial',
        asof: '2026-02-09T10:00:00+08:00',
        note: '基准数据源尚未就绪'
      }
    })

    render(<BenchmarkComparisonPanel user={{ id: 'u1' }} lastRefresh={1} />)

    await waitFor(() => {
      expect(fetchBenchmarks).toHaveBeenCalledTimes(1)
      expect(fetchBenchmarkComparison).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(screen.queryByText('跑赢')).not.toBeInTheDocument()
    expect(screen.queryByText('跑输')).not.toBeInTheDocument()
  })

  it('data_status=confirmed 且 benchmark 已知时显示跑赢/跑输判断', async () => {
    fetchBenchmarks.mockResolvedValue({
      benchmarks: {
        hs300: {
          name: '沪深300',
          code: '000300',
          description: 'A 股代表性指数'
        }
      }
    })
    fetchBenchmarkComparison.mockResolvedValue({
      portfolio_return: 2.34,
      benchmarks: {
        hs300: {
          name: '沪深300',
          code: '000300',
          description: 'A 股代表性指数'
        }
      },
      comparison: {
        hs300: {
          portfolio_return: 2.34,
          benchmark_return: 1.01,
          excess_return: 1.33,
          outperform: true
        }
      },
      data_status: {
        status: 'confirmed',
        asof: '2026-02-09T10:00:00+08:00',
        note: '已确认'
      }
    })

    render(<BenchmarkComparisonPanel user={{ id: 'u1' }} lastRefresh={1} />)

    await waitFor(() => {
      expect(fetchBenchmarkComparison).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('跑赢')).toBeInTheDocument()
  })
})
