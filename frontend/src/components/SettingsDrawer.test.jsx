import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsDrawer } from './SettingsDrawer.jsx'
import {
  createSIPPlan,
  fetchHealthz,
  fetchNetworkBenchmarkLatest,
  fetchNotificationsStatus,
  fetchSIPPlans,
  fetchSystemStatus,
  issueTelegramDiscoverySecret,
  runNetworkBenchmark
} from '../api.js'

vi.mock('../api.js', () => ({
  createSIPPlan: vi.fn(),
  fetchHealthz: vi.fn(),
  fetchNetworkBenchmarkLatest: vi.fn(),
  fetchNotificationsStatus: vi.fn(),
  fetchSIPPlans: vi.fn(),
  fetchSystemStatus: vi.fn(),
  issueTelegramDiscoverySecret: vi.fn(),
  runNetworkBenchmark: vi.fn(),
  updateSIPPlan: vi.fn(),
  deleteSIPPlan: vi.fn(),
  executeSIPPlan: vi.fn()
}))

describe('SettingsDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fetchNetworkBenchmarkLatest.mockResolvedValue({ result: null })
    fetchNotificationsStatus.mockResolvedValue({
      status: {
        feishu: { enabled: false, credential_configured: false, last_test_summary: null },
        telegram: { enabled: false, credential_configured: false, last_test_summary: null },
        email: { enabled: false, credential_configured: false, last_test_summary: null }
      }
    })
    fetchSystemStatus.mockResolvedValue({})
    fetchHealthz.mockResolvedValue({ status: 'ok' })
    issueTelegramDiscoverySecret.mockResolvedValue({
      discovery: {
        secret: 'secret-123',
        webhook_path: '/api/settings/notifications/telegram/inbound/secret-123',
        webhook_url: 'https://vectorcontrol.test/api/settings/notifications/telegram/inbound/secret-123'
      }
    })
    runNetworkBenchmark.mockResolvedValue({ result: null })
    fetchSIPPlans.mockResolvedValue({ plans: [], count: 0, enabled_only: false })
    createSIPPlan.mockResolvedValue({ plan: { id: 1 } })
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

    expect(screen.getByText('设置中心')).toBeInTheDocument()
    expect(fetchNetworkBenchmarkLatest).not.toHaveBeenCalled()
    expect(fetchSIPPlans).not.toHaveBeenCalled()
    expect(fetchNotificationsStatus).not.toHaveBeenCalled()
    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(fetchHealthz).not.toHaveBeenCalled()
    expect(screen.getByText('控制台设置')).toBeInTheDocument()
    expect(screen.getByText(/最近测速记录按需加载/)).toBeInTheDocument()
    expect(screen.getByText(/按需加载中。下一步：点击“加载计划”查看现有计划/)).toBeInTheDocument()
    expect(screen.getByText(/按需加载。下一步：点击“一键复制状态”或“加载系统状态”/)).toBeInTheDocument()
    expect(screen.getByText(/按需加载。下一步：点击“加载诊断”或直接发送测试消息/)).toBeInTheDocument()
  })

  it('网络与消息凭据区展示新的摘要标题层', () => {
    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(screen.getByText('Network Snapshot')).toBeInTheDocument()
    expect(screen.getByText('Feishu Delivery')).toBeInTheDocument()
    expect(screen.getByText('Telegram Delivery')).toBeInTheDocument()
  })

  it('点击分区动作前不会预取非关键数据，且各区块仍可按需加载', async () => {
    fetchNetworkBenchmarkLatest.mockResolvedValueOnce({
      result: {
        summary: {
          site_count: 1,
          success_count: 1,
          failed_count: 0,
          avg_total_ms: 45,
          elapsed_ms: 45
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
    fetchSIPPlans.mockResolvedValueOnce({ plans: [], count: 0, enabled_only: false })
    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: { enabled: false, credential_configured: true, last_test_summary: null },
        telegram: { enabled: false, credential_configured: true, last_test_summary: null }
      }
    })
    fetchSystemStatus.mockResolvedValueOnce({
      service: 'vectorcontrol',
      version: 'v1.2.3',
      commit: 'abc123',
      server_time: '2026-02-09T03:00:00Z'
    })
    fetchHealthz.mockResolvedValueOnce({ status: 'ok' })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(fetchNetworkBenchmarkLatest).not.toHaveBeenCalled()
    expect(fetchSIPPlans).not.toHaveBeenCalled()
    expect(fetchNotificationsStatus).not.toHaveBeenCalled()
    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(fetchHealthz).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('benchmark-load-latest-btn'))
    await waitFor(() => {
      expect(fetchNetworkBenchmarkLatest).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('eastmoney')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sip-plan-load-btn'))
    await waitFor(() => {
      expect(fetchSIPPlans).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('当前暂无定投计划')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('diagnostic-load-btn'))
    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByText(/未测试\/无记录/).length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByTestId('system-status-load-btn'))
    await waitFor(() => {
      expect(fetchSystemStatus).toHaveBeenCalledTimes(1)
      expect(fetchHealthz).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId('system-status-commit').textContent || '').toMatch(/abc123/)
  })

  it('SIP 面板支持创建计划并回刷列表', async () => {
    fetchSIPPlans
      .mockResolvedValueOnce({ plans: [], count: 0, enabled_only: false })
      .mockResolvedValueOnce({
        plans: [
          {
            id: 101,
            fund_id: '000001',
            fund_name: '华夏成长',
            amount: 500,
            frequency: 'monthly',
            day: 15,
            enabled: true,
            next_date: '2026-03-15',
            last_executed: '',
            note: '长期'
          }
        ],
        count: 1,
        enabled_only: false
      })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(fetchSIPPlans).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('sip-plan-create-toggle-btn'))

    await waitFor(() => {
      expect(fetchSIPPlans).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByTestId('sip-plan-fund-id-input'), { target: { value: '000001' } })
    fireEvent.change(screen.getByTestId('sip-plan-fund-name-input'), { target: { value: '华夏成长' } })
    fireEvent.change(screen.getByTestId('sip-plan-amount-input'), { target: { value: '500' } })
    fireEvent.change(screen.getByTestId('sip-plan-frequency-select'), { target: { value: 'monthly' } })
    fireEvent.change(screen.getByTestId('sip-plan-day-select'), { target: { value: '15' } })
    fireEvent.change(screen.getByTestId('sip-plan-note-input'), { target: { value: '长期' } })
    fireEvent.click(screen.getByTestId('sip-plan-submit-btn'))

    await waitFor(() => {
      expect(createSIPPlan).toHaveBeenCalledTimes(1)
    })

    expect(createSIPPlan.mock.calls[0][0]).toMatchObject({
      fund_id: '000001',
      fund_name: '华夏成长',
      amount: 500,
      frequency: 'monthly',
      day: 15,
      note: '长期'
    })

    await waitFor(() => {
      expect(fetchSIPPlans).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText(/定投计划已创建/)).toBeInTheDocument()
    expect(screen.getByText(/000001/)).toBeInTheDocument()
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

    fireEvent.click(screen.getByTestId('benchmark-load-latest-btn'))

    expect(await screen.findByText('站点数')).toBeInTheDocument()
    expect(screen.getByText('eastmoney')).toBeInTheDocument()
    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
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

    fireEvent.click(screen.getByTestId('benchmark-load-latest-btn'))

    expect(await screen.findByText('需重试')).toBeInTheDocument()
    expect(screen.getByText(/最近一次测速记录加载失败/)).toBeInTheDocument()
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

    fireEvent.click(screen.getByTestId('benchmark-load-latest-btn'))

    expect(await screen.findByText(/测速结果包含异常站点记录/)).toBeInTheDocument()
    expect(screen.getByText('site_1')).toBeInTheDocument()
    expect(screen.getByText('设置中心')).toBeInTheDocument()
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
    expect(screen.getByText('设置中心')).toBeInTheDocument()
  })

  it('系统状态面板展示 /api/system/status 与 /api/healthz 结果', async () => {
    fetchSystemStatus.mockResolvedValueOnce({
      service: 'vectorcontrol',
      version: 'v1.2.3',
      commit: 'abc123',
      server_time: '2026-02-09T03:00:00Z'
    })
    fetchHealthz.mockResolvedValueOnce({ status: 'ok', service: 'vectorcontrol' })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(fetchHealthz).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('system-status-load-btn'))

    await waitFor(() => {
      expect(fetchSystemStatus).toHaveBeenCalledTimes(1)
      expect(fetchHealthz).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('system-status-service').textContent || '').toMatch(/vectorcontrol/)
    expect(screen.getByTestId('system-status-commit').textContent || '').toMatch(/abc123/)
    expect(screen.getByTestId('system-healthz-result').textContent || '').toMatch(/ok/)
  })

  it('系统状态面板支持一键复制状态', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    fetchSystemStatus.mockResolvedValueOnce({
      service: 'vectorcontrol',
      version: 'v1.2.3',
      commit: 'abc123',
      server_time: '2026-02-09T03:00:00Z'
    })
    fetchHealthz.mockResolvedValueOnce({ status: 'ok' })

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(fetchSystemStatus).not.toHaveBeenCalled()
    expect(fetchHealthz).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('system-status-copy-btn'))

    await waitFor(() => {
      expect(fetchSystemStatus).toHaveBeenCalledTimes(1)
      expect(fetchHealthz).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const copied = String(writeText.mock.calls[0][0] || '')
    expect(copied).toMatch(/"system_status"/)
    expect(copied).toMatch(/"healthz"/)
    expect(await screen.findByText(/已复制状态/)).toBeInTheDocument()
  })

  it('支持编辑飞书高级参数并随保存请求提交', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()

    render(
      <SettingsDrawer
        open
        settings={{}}
        onClose={onClose}
        onSave={onSave}
      />
    )

    fireEvent.change(screen.getByLabelText('飞书超时（秒）'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('飞书重试次数'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('飞书消息模板'), { target: { value: 'content_only' } })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onSave.mock.calls[0][0]).toMatchObject({
      notifications: {
        feishu: {
          timeout_seconds: 1.5,
          retry_times: 4,
          template: 'content_only'
        }
      }
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('default masks existing webhook and updates only through explicit action', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onUpdateFeishuWebhook = vi.fn().mockResolvedValue(true)
    const currentWebhook = 'https://open.feishu.cn/open-apis/bot/v2/hook/current-token-1234'
    const nextWebhook = 'https://open.feishu.cn/open-apis/bot/v2/hook/new-token-5678'

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: {
              webhook_url: currentWebhook
            }
          }
        }}
        onClose={vi.fn()}
        onSave={onSave}
        onUpdateFeishuWebhook={onUpdateFeishuWebhook}
      />
    )

    const masked = screen.getByTestId('feishu-webhook-masked').textContent || ''
    expect(masked).not.toContain(currentWebhook)
    expect(masked).toContain('...')
    expect(screen.queryByTestId('feishu-webhook-input')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('feishu-webhook-edit'))
    fireEvent.change(screen.getByTestId('feishu-webhook-input'), { target: { value: nextWebhook } })
    fireEvent.click(screen.getByTestId('settings-save-btn'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onUpdateFeishuWebhook).toHaveBeenCalledTimes(1)
    expect(onUpdateFeishuWebhook).toHaveBeenCalledWith(nextWebhook)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      notifications: {
        feishu: {
          timeout_seconds: 3,
          retry_times: 2,
          template: 'title_content_metadata'
        }
      }
    })
    expect(onSave.mock.calls[0][0]?.notifications?.feishu?.webhook_url).toBeUndefined()
  })

  it('blank webhook update keeps existing credential unchanged', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onUpdateFeishuWebhook = vi.fn().mockResolvedValue(true)
    const currentWebhook = 'https://open.feishu.cn/open-apis/bot/v2/hook/current-token-1234'

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: {
              webhook_url: currentWebhook
            }
          }
        }}
        onClose={vi.fn()}
        onSave={onSave}
        onUpdateFeishuWebhook={onUpdateFeishuWebhook}
      />
    )

    fireEvent.click(screen.getByTestId('feishu-webhook-edit'))
    fireEvent.click(screen.getByTestId('settings-save-btn'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onUpdateFeishuWebhook).not.toHaveBeenCalled()
    expect(onSave.mock.calls[0][0]).toMatchObject({
      notifications: {
        feishu: {
          timeout_seconds: 3,
          retry_times: 2,
          template: 'title_content_metadata'
        }
      }
    })
    expect(onSave.mock.calls[0][0]?.notifications?.feishu?.webhook_url).toBeUndefined()
  })

  it('通知诊断在 last_test_summary 为空时显示未测试/无记录', async () => {
    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: { enabled: false, credential_configured: true, last_test_summary: null },
        telegram: { enabled: false, credential_configured: true, last_test_summary: null },
        email: { enabled: false, credential_configured: true, last_test_summary: null }
      }
    })

    render(
      <SettingsDrawer
        open
        settings={{ notifications: { telegram: { chat_id: '-1001234567890' } } }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(fetchNotificationsStatus).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('diagnostic-load-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByLabelText('通知诊断概览')).toBeInTheDocument()
    // 当前前端只渲染飞书/Telegram 两通道，email 会被过滤掉
    expect(screen.getAllByText(/未测试\/无记录/).length).toBeGreaterThanOrEqual(2)
  })

  it('通知诊断支持复制 trace_id 并格式化 last_test_summary.time', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    fetchNotificationsStatus
      .mockResolvedValueOnce({
        status: {
          feishu: {
            enabled: true,
            credential_configured: true,
            last_test_summary: { ok: true, sent: true, trace_id: 't123', time: '2026-02-08T12:34:56.000Z' }
          },
          telegram: { enabled: false, credential_configured: true, last_test_summary: null }
        }
      })
      .mockResolvedValueOnce({
        status: {
          feishu: {
            enabled: true,
            credential_configured: true,
            last_test_summary: { ok: true, sent: true, trace_id: 't123', time: '2026-02-08T12:34:56.000Z' }
          },
          telegram: { enabled: false, credential_configured: true, last_test_summary: null }
        }
      })

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: { webhook_url: '<REDACTED>' },
            telegram: { chat_id: '-1001234567890' }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    fireEvent.click(screen.getByTestId('diagnostic-load-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/时间:/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('diagnostic-feishu-trace-copy-btn'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('t123')
    })

    expect(await screen.findByText(/已复制 trace_id: t123/)).toBeInTheDocument()
  })

  it('通知诊断在有 last_test_history 时支持折叠展开并复制 trace_id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: {
          enabled: true,
          credential_configured: true,
          last_test_summary: null,
          last_test_history: [
            { ok: false, sent: false, trace_id: 'h1', time: '2026-02-09T00:00:01Z', error_category: 'timeout' },
            { ok: true, sent: true, trace_id: 'h2', time: '2026-02-09T00:00:02Z' }
          ]
        },
        telegram: { enabled: false, credential_configured: true, last_test_summary: null }
      }
    })

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: { webhook_url: '<REDACTED>' },
            telegram: { chat_id: '-1001234567890' }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    fireEvent.click(screen.getByTestId('diagnostic-load-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('diagnostic-feishu-history-toggle-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('diagnostic-feishu-history-list')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('diagnostic-feishu-history-toggle-btn'))

    const list = await screen.findByTestId('diagnostic-feishu-history-list')
    expect(list).toBeInTheDocument()
    expect(within(list).getByText('h1')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('diagnostic-feishu-history-0-trace-copy-btn'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('h1')
    })

    // Toast message is a plain string, so it won't be split across nodes.
    expect(await screen.findByText(/trace_id: h1/)).toBeInTheDocument()
  })

  it('通知诊断支持复制整包诊断信息（status + 版本信息）', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    fetchSystemStatus.mockResolvedValueOnce({
      service: 'vectorcontrol',
      version: 'v1.2.3',
      commit: 'abc123',
      server_time: '2026-02-09T03:00:00Z'
    })

    fetchNotificationsStatus
      .mockResolvedValueOnce({
        status: {
          feishu: { enabled: true, credential_configured: true, last_test_summary: null },
          telegram: { enabled: false, credential_configured: false, last_test_summary: null }
        }
      })
      .mockResolvedValueOnce({
        status: {
          feishu: { enabled: true, credential_configured: true, last_test_summary: null },
          telegram: { enabled: false, credential_configured: false, last_test_summary: null }
        }
      })

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: { webhook_url: '<REDACTED>' },
            telegram: { chat_id: '-1001234567890' }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(fetchNotificationsStatus).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('diagnostic-copy-bundle-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const copied = String(writeText.mock.calls[0][0] || '')
    expect(copied).toMatch(/"notifications_status"/)
    expect(copied).toMatch(/"system_status"/)
    expect(copied).toMatch(/"commit": "abc123"/)
    expect(await screen.findByText(/已复制诊断信息/)).toBeInTheDocument()
  })

  it('can send feishu test message and show hint', async () => {
    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: { enabled: true, credential_configured: true, last_test_summary: null },
        telegram: { enabled: false, credential_configured: false, last_test_summary: null },
        email: { enabled: false, credential_configured: false, last_test_summary: null }
      }
    })

    const onSendFeishuTestMessage = vi.fn().mockResolvedValue({
      ok: true,
      sent: true,
      trace_id: 'f123'
    })

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: { webhook_url: '<REDACTED>' }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
        onSendFeishuTestMessage={onSendFeishuTestMessage}
      />
    )

    fireEvent.click(screen.getByTestId('diagnostic-feishu-test-message-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
      expect(onSendFeishuTestMessage).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText(/飞书 测试消息已发送/)).toBeInTheDocument()
    expect(screen.getByText(/trace_id: f123/)).toBeInTheDocument()
  })

  it('disables feishu test message when webhook is pending update', async () => {
    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: { enabled: true, credential_configured: true, last_test_summary: null },
        telegram: { enabled: false, credential_configured: false, last_test_summary: null },
        email: { enabled: false, credential_configured: false, last_test_summary: null }
      }
    })

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            feishu: { webhook_url: '<REDACTED>' }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
        onUpdateFeishuWebhook={vi.fn().mockResolvedValue(true)}
        onSendFeishuTestMessage={vi.fn().mockResolvedValue(true)}
      />
    )

    fireEvent.click(screen.getByTestId('diagnostic-feishu-test-message-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('diagnostic-feishu-test-message-btn')).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('feishu-webhook-edit'))
    fireEvent.change(screen.getByTestId('feishu-webhook-input'), {
      target: { value: 'https://open.feishu.cn/open-apis/bot/v2/hook/new-token-5678' }
    })

    expect(screen.getByTestId('diagnostic-feishu-test-message-btn')).toBeDisabled()
  })

  it('telegram credential preview never leaks token and updates only through explicit action', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onUpdateTelegramCredential = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()

    const currentBotToken = 'telegram-token-1234'
    const currentChatId = '-1001234567890'
    const nextBotToken = 'telegram-token-5678'
    const nextChatId = '-1009998887776'

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            telegram: {
              bot_token: currentBotToken,
              chat_id: currentChatId
            }
          }
        }}
        onClose={onClose}
        onSave={onSave}
        onUpdateTelegramCredential={onUpdateTelegramCredential}
      />
    )

    const preview = await screen.findByText(new RegExp(`chat_id=${currentChatId}`))
    expect(preview.textContent || '').not.toContain(currentBotToken)
    expect(screen.queryByPlaceholderText(/bot_token/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更新凭据' }))
    fireEvent.change(screen.getByPlaceholderText(/bot_token/), { target: { value: nextBotToken } })
    fireEvent.change(screen.getByPlaceholderText(/chat_id/), { target: { value: nextChatId } })
    fireEvent.click(screen.getByTestId('settings-save-btn'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onUpdateTelegramCredential).toHaveBeenCalledTimes(1)
    expect(onUpdateTelegramCredential).toHaveBeenCalledWith(nextBotToken, nextChatId)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      notifications: {
        telegram: {
          timeout_seconds: 3,
          retry_times: 2
        }
      }
    })
    expect(onSave.mock.calls[0][0]?.notifications?.telegram?.bot_token).toBeUndefined()
    expect(onSave.mock.calls[0][0]?.notifications?.telegram?.chat_id).toBeUndefined()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('blank telegram credential update keeps existing credential unchanged', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onUpdateTelegramCredential = vi.fn().mockResolvedValue(true)

    const currentBotToken = 'telegram-token-1234'
    const currentChatId = '-1001234567890'

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            telegram: {
              bot_token: currentBotToken,
              chat_id: currentChatId
            }
          }
        }}
        onClose={vi.fn()}
        onSave={onSave}
        onUpdateTelegramCredential={onUpdateTelegramCredential}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '更新凭据' }))
    fireEvent.click(screen.getByTestId('settings-save-btn'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onUpdateTelegramCredential).not.toHaveBeenCalled()
    expect(onSave.mock.calls[0][0]?.notifications?.telegram?.bot_token).toBeUndefined()
    expect(onSave.mock.calls[0][0]?.notifications?.telegram?.chat_id).toBeUndefined()
  })

  it('can issue telegram discovery webhook after saving bot token only', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onUpdateTelegramCredential = vi.fn().mockResolvedValue(true)

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            telegram: {
              bot_token: '<REDACTED>',
              chat_id: ''
            }
          }
        }}
        onClose={vi.fn()}
        onSave={onSave}
        onUpdateTelegramCredential={onUpdateTelegramCredential}
      />
    )

    fireEvent.click(screen.getByTestId('telegram-discovery-issue-btn'))

    await waitFor(() => {
      expect(issueTelegramDiscoverySecret).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByTestId('telegram-discovery-preview')).toHaveTextContent(
      'https://vectorcontrol.test/api/settings/notifications/telegram/inbound/secret-123'
    )
  })

  it('can send telegram test message and show hint', async () => {
    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: { enabled: false, credential_configured: false, last_test_summary: null },
        telegram: { enabled: true, credential_configured: true, last_test_summary: null },
        email: { enabled: false, credential_configured: false, last_test_summary: null }
      }
    })

    const onSendTelegramTestMessage = vi.fn().mockResolvedValue({
      ok: true,
      sent: true,
      trace_id: 't123'
    })

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            telegram: {
              bot_token: 'telegram-token-1234',
              chat_id: '-1001234567890'
            }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
        onSendTelegramTestMessage={onSendTelegramTestMessage}
      />
    )

    fireEvent.click(screen.getByTestId('diagnostic-telegram-test-message-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
      expect(onSendTelegramTestMessage).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText(/Telegram 测试消息已发送/)).toBeInTheDocument()
    expect(screen.getByText(/trace_id: t123/)).toBeInTheDocument()
  })

  it('disables telegram test message when credential is pending update', async () => {
    fetchNotificationsStatus.mockResolvedValueOnce({
      status: {
        feishu: { enabled: false, credential_configured: false, last_test_summary: null },
        telegram: { enabled: true, credential_configured: true, last_test_summary: null },
        email: { enabled: false, credential_configured: false, last_test_summary: null }
      }
    })

    const onSendTelegramTestMessage = vi.fn().mockResolvedValue(true)

    render(
      <SettingsDrawer
        open
        settings={{
          notifications: {
            telegram: {
              bot_token: 'telegram-token-1234',
              chat_id: '-1001234567890'
            }
          }
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
        onUpdateTelegramCredential={vi.fn().mockResolvedValue(true)}
        onSendTelegramTestMessage={onSendTelegramTestMessage}
      />
    )

    fireEvent.click(screen.getByTestId('diagnostic-telegram-test-message-btn'))

    await waitFor(() => {
      expect(fetchNotificationsStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('diagnostic-telegram-test-message-btn')).not.toBeDisabled()

    const telegramHeading = screen.getByText('Telegram 机器人（预留）')
    const telegramGroup = telegramHeading.closest('.settings-group')
    expect(telegramGroup).toBeTruthy()
    fireEvent.click(within(telegramGroup).getByRole('button', { name: '更新凭据' }))

    fireEvent.change(await screen.findByPlaceholderText(/bot_token/), { target: { value: 'telegram-token-5678' } })

    expect(screen.getByTestId('diagnostic-telegram-test-message-btn')).toBeDisabled()
  })
})
