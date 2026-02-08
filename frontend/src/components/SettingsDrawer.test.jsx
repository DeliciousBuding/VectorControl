import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsDrawer } from './SettingsDrawer.jsx'
import { fetchNetworkBenchmarkLatest, runNetworkBenchmark } from '../api.js'

vi.mock('../api.js', () => ({
  fetchNetworkBenchmarkLatest: vi.fn(),
  runNetworkBenchmark: vi.fn()
}))

describe('SettingsDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fetchNetworkBenchmarkLatest.mockResolvedValue({ result: null })
    runNetworkBenchmark.mockResolvedValue({ result: null })
  })

  it('可正常打开抽屉且兼容缺失设置字段', async () => {
    render(
      <SettingsDrawer
        open
        settings={{ notifications: null, network_benchmark: null, display: null }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(screen.getByRole('heading', { name: '设置中心' })).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchNetworkBenchmarkLatest).toHaveBeenCalledTimes(1)
    })
  })

  it('可渲染测速结果摘要与站点明细', async () => {
    fetchNetworkBenchmarkLatest.mockResolvedValue({
      result: {
        summary: {
          site_count: 2,
          success_count: 1,
          failed_count: 1,
          avg_total_ms: 88,
          elapsed_ms: 176
        },
        results: [
          {
            site: 'eastmoney',
            ok: true,
            dns_ms: 5,
            tcp_ms: 8,
            tls_ms: 12,
            ttfb_ms: 20,
            total_ms: 45
          }
        ]
      }
    })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(await screen.findByText('站点：2')).toBeInTheDocument()
    expect(screen.getByText('eastmoney')).toBeInTheDocument()
    expect(screen.getByText('成功：1')).toBeInTheDocument()
  })

  it('测速加载异常时显示兜底提示而非崩溃', async () => {
    fetchNetworkBenchmarkLatest.mockRejectedValue(new Error('测速记录加载失败'))

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(await screen.findByText(/测速记录加载失败/)).toBeInTheDocument()
    expect(screen.getByText(/下一步：/)).toBeInTheDocument()
  })

  it('测速返回脏数据时可兜底渲染并给出可解释提示', async () => {
    fetchNetworkBenchmarkLatest.mockResolvedValue({
      result: {
        summary: {
          site_count: 2,
          success_count: 0,
          failed_count: 2,
          avg_total_ms: 0,
          elapsed_ms: 0
        },
        results: [null, { ok: false }]
      }
    })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(await screen.findByText(/测速结果包含异常站点记录/)).toBeInTheDocument()
    expect(screen.getByText('site_1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '设置中心' })).toBeInTheDocument()
  })

  it('测速执行返回异常格式时显示可解释提示且不白屏', async () => {
    fetchNetworkBenchmarkLatest.mockResolvedValue({ result: null })
    runNetworkBenchmark.mockResolvedValue({ result: 'broken-payload' })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '开始测速' }))

    expect(await screen.findByText(/测速结果格式异常/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '设置中心' })).toBeInTheDocument()
  })
})
