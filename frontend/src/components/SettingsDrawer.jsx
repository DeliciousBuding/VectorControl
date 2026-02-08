import { useEffect, useState } from 'react'
import { fetchNetworkBenchmarkLatest, runNetworkBenchmark } from '../api.js'
import { toGuidedError } from '../utils/errorFeedback.js'

const PROFILE_OPTIONS = [
  { value: 'cn_fund', label: '国内基金站点' },
  { value: 'global', label: '国际站点' }
]

const FEISHU_TEMPLATE_OPTIONS = [
  { value: 'title_content_metadata', label: '标题+正文+元数据' },
  { value: 'content_only', label: '仅正文' }
]

const DEFAULT_DRAWER_SETTINGS = {
  display: {
    auto_refresh_enabled: true,
    auto_refresh_seconds: 60,
    auto_refresh_visible_only: true
  },
  notifications: {
    feishu: {
      enabled: false,
      webhook_url: '',
      advice_time: '14:50',
      report_time: '15:10',
      timeout_seconds: 3,
      retry_times: 2,
      template: 'title_content_metadata'
    },
    telegram: {
      enabled: false,
      bot_token: '',
      chat_id: '',
      parse_mode: '',
      disable_web_page_preview: true,
      timeout_seconds: 3,
      retry_times: 2
    },
    email: {
      enabled: false,
      recipients: ''
    }
  },
  network_benchmark: {
    default_profile: 'cn_fund',
    timeout_seconds: 6,
    last_run_at: '',
    last_result: null
  }
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeDrawerSettings(source) {
  const root = asPlainObject(source)
  const display = asPlainObject(root.display)
  const notifications = asPlainObject(root.notifications)
  const feishu = asPlainObject(notifications.feishu)
  const telegram = asPlainObject(notifications.telegram)
  const email = asPlainObject(notifications.email)
  const networkBenchmark = asPlainObject(root.network_benchmark)

  return {
    ...DEFAULT_DRAWER_SETTINGS,
    ...root,
    display: {
      ...DEFAULT_DRAWER_SETTINGS.display,
      ...display
    },
    notifications: {
      ...DEFAULT_DRAWER_SETTINGS.notifications,
      ...notifications,
      feishu: {
        ...DEFAULT_DRAWER_SETTINGS.notifications.feishu,
        ...feishu
      },
      telegram: {
        ...DEFAULT_DRAWER_SETTINGS.notifications.telegram,
        ...telegram
      },
      email: {
        ...DEFAULT_DRAWER_SETTINGS.notifications.email,
        ...email
      }
    },
    network_benchmark: {
      ...DEFAULT_DRAWER_SETTINGS.network_benchmark,
      ...networkBenchmark
    }
  }
}

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed * 100) / 100
  }
  return fallback
}

function normalizeBenchmarkResult(result) {
  if (result == null) {
    return { result: null, warning: '' }
  }

  const root = asPlainObject(result)
  if (root !== result) {
    return {
      result: null,
      warning: '测速结果格式异常，已自动降级为空结果。下一步：稍后重试，必要时检查后端服务状态。'
    }
  }

  const sourceSummary = asPlainObject(root.summary)
  const sourceResults = Array.isArray(root.results) ? root.results : []
  let hasInvalidItem = false

  const normalizedResults = sourceResults.map((item, index) => {
    const row = asPlainObject(item)
    if (row !== item) hasInvalidItem = true
    const site = String(row.site || `site_${index + 1}`).trim() || `site_${index + 1}`
    const ok = Boolean(row.ok)
    return {
      site,
      ok,
      dns_ms: toNonNegativeNumber(row.dns_ms, 0),
      tcp_ms: toNonNegativeNumber(row.tcp_ms, 0),
      tls_ms: toNonNegativeNumber(row.tls_ms, 0),
      ttfb_ms: toNonNegativeNumber(row.ttfb_ms, 0),
      total_ms: toNonNegativeNumber(row.total_ms, 0),
      error: String(row.error || '').trim()
    }
  })

  const successCountByRows = normalizedResults.filter((item) => item.ok).length
  const failedCountByRows = normalizedResults.length - successCountByRows
  const avgByRows = normalizedResults.length > 0
    ? normalizedResults.reduce((sum, item) => sum + item.total_ms, 0) / normalizedResults.length
    : 0
  const elapsedByRows = normalizedResults.reduce((sum, item) => sum + item.total_ms, 0)

  const normalizedSummary = {
    site_count: toNonNegativeNumber(sourceSummary.site_count, normalizedResults.length),
    success_count: toNonNegativeNumber(sourceSummary.success_count, successCountByRows),
    failed_count: toNonNegativeNumber(sourceSummary.failed_count, failedCountByRows),
    avg_total_ms: toNonNegativeNumber(sourceSummary.avg_total_ms, avgByRows),
    elapsed_ms: toNonNegativeNumber(sourceSummary.elapsed_ms, elapsedByRows)
  }

  return {
    result: {
      ...root,
      summary: normalizedSummary,
      results: normalizedResults
    },
    warning: hasInvalidItem
      ? '测速结果包含异常站点记录，已自动兜底。下一步：请重试测速并核对后端返回格式。'
      : ''
  }
}

function maskWebhookUrl(webhookUrl) {
  const raw = String(webhookUrl || '').trim()
  if (!raw) return ''
  if (raw.length <= 8) {
    return `${raw.slice(0, 1)}***${raw.slice(-1)}`
  }
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`
}

export function SettingsDrawer({
  open,
  settings,
  onClose,
  onSave,
  onUpdateFeishuWebhook,
  onUpdateTelegramCredential,
  onSendTelegramTestMessage
}) {
  const [draft, setDraft] = useState(() => normalizeDrawerSettings(settings))
  const [benchmarkProfile, setBenchmarkProfile] = useState('cn_fund')
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState('')
  const [benchmarkResult, setBenchmarkResult] = useState(null)
  const [editingFeishuWebhook, setEditingFeishuWebhook] = useState(false)
  const [pendingFeishuWebhook, setPendingFeishuWebhook] = useState('')
  const [editingTelegramCredential, setEditingTelegramCredential] = useState(false)
  const [pendingTelegramBotToken, setPendingTelegramBotToken] = useState('')
  const [pendingTelegramChatId, setPendingTelegramChatId] = useState('')
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)
  const [telegramTestError, setTelegramTestError] = useState('')
  const [telegramTestHint, setTelegramTestHint] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const normalized = normalizeDrawerSettings(settings)
    const webhook = String(normalized.notifications?.feishu?.webhook_url || '').trim()
    const telegramBotToken = String(normalized.notifications?.telegram?.bot_token || '').trim()
    const telegramChatId = String(normalized.notifications?.telegram?.chat_id || '').trim()
    setDraft(normalized)
    setBenchmarkProfile(normalized.network_benchmark.default_profile || 'cn_fund')
    setEditingFeishuWebhook(!webhook)
    setPendingFeishuWebhook('')
    setEditingTelegramCredential(!telegramBotToken)
    setPendingTelegramBotToken('')
    setPendingTelegramChatId(telegramChatId)
    setTelegramTestLoading(false)
    setTelegramTestError('')
    setTelegramTestHint('')
    setSaveError('')
  }, [settings])

  useEffect(() => {
    if (!open) return

    let active = true
    ;(async () => {
      try {
        const payload = await fetchNetworkBenchmarkLatest()
        if (!active) return
        const normalized = normalizeBenchmarkResult(payload?.result)
        setBenchmarkResult(normalized.result)
        setBenchmarkError(normalized.warning || '')
      } catch (error) {
        if (!active) return
        setBenchmarkResult(null)
        setBenchmarkError(toGuidedError(error, 'settings_benchmark_load', '测速记录加载失败'))
      }
    })()

    return () => {
      active = false
    }
  }, [open])

  if (!open) return null

  const updateDraft = (updater) => {
    setDraft((prev) => {
      const safePrev = normalizeDrawerSettings(prev)
      const next = typeof updater === 'function' ? updater(safePrev) : safePrev
      return normalizeDrawerSettings(next)
    })
  }

  const timeoutSeconds = Number(draft.network_benchmark.timeout_seconds || 6)
  const currentFeishuWebhook = String(draft.notifications.feishu.webhook_url || '').trim()
  const requestedFeishuWebhook = String(pendingFeishuWebhook || '').trim()
  const hasFeishuWebhook = currentFeishuWebhook.length > 0
  const showFeishuWebhookInput = editingFeishuWebhook || !hasFeishuWebhook
  const shouldUpdateFeishuWebhook = showFeishuWebhookInput
    && requestedFeishuWebhook.length > 0
    && requestedFeishuWebhook !== currentFeishuWebhook
  const maskedFeishuWebhook = maskWebhookUrl(currentFeishuWebhook)

  const currentTelegramBotToken = String(draft.notifications.telegram.bot_token || '').trim()
  const currentTelegramChatId = String(draft.notifications.telegram.chat_id || '').trim()
  const requestedTelegramBotToken = String(pendingTelegramBotToken || '').trim()
  const requestedTelegramChatId = String(pendingTelegramChatId || '').trim()
  const hasTelegramCredential = currentTelegramBotToken.length > 0 && currentTelegramChatId.length > 0
  const showTelegramCredentialInput = editingTelegramCredential || !hasTelegramCredential
  const shouldUpdateTelegramCredential = showTelegramCredentialInput
    && requestedTelegramBotToken.length > 0
    && requestedTelegramChatId.length > 0
    && (requestedTelegramBotToken !== currentTelegramBotToken || requestedTelegramChatId !== currentTelegramChatId)
  const telegramMode = String(draft.notifications.telegram.parse_mode || '').trim().toUpperCase() === 'HTML'
    ? 'HTML（安全转义）'
    : '纯文本'
  const benchmarkSummary = benchmarkResult?.summary || null
  const hasBenchmarkRows = Array.isArray(benchmarkResult?.results) && benchmarkResult.results.length > 0

  const save = async () => {
    setSaveError('')
    setSaving(true)

    const nextFeishuWebhook = shouldUpdateFeishuWebhook
      ? requestedFeishuWebhook
      : currentFeishuWebhook

    const nextTelegramBotToken = shouldUpdateTelegramCredential
      ? requestedTelegramBotToken
      : currentTelegramBotToken
    const nextTelegramChatId = shouldUpdateTelegramCredential
      ? requestedTelegramChatId
      : currentTelegramChatId

    const nextDraft = {
      ...draft,
      notifications: {
        ...draft.notifications,
        feishu: {
          ...draft.notifications.feishu,
          webhook_url: nextFeishuWebhook
        },
        telegram: {
          ...draft.notifications.telegram,
          bot_token: nextTelegramBotToken,
          chat_id: nextTelegramChatId
        }
      },
      network_benchmark: {
        ...draft.network_benchmark,
        default_profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds
      }
    }

    const nextDraftWithoutSecrets = {
      ...nextDraft,
      notifications: {
        ...nextDraft.notifications,
        feishu: {
          ...nextDraft.notifications.feishu
        },
        telegram: {
          ...nextDraft.notifications.telegram
        }
      }
    }
    delete nextDraftWithoutSecrets.notifications.feishu.webhook_url
    delete nextDraftWithoutSecrets.notifications.telegram.bot_token
    delete nextDraftWithoutSecrets.notifications.telegram.chat_id

    setDraft(nextDraft)

    try {
      if (shouldUpdateFeishuWebhook) {
        if (typeof onUpdateFeishuWebhook !== 'function') {
          setSaveError('飞书 webhook 更新失败。下一步：稍后重试或联系管理员检查后端接口。')
          return
        }
        const updated = await onUpdateFeishuWebhook(requestedFeishuWebhook)
        if (updated === false) {
          setSaveError('飞书 webhook 更新失败。下一步：检查新凭据格式后重试。')
          return
        }
      }

      if (shouldUpdateTelegramCredential) {
        if (typeof onUpdateTelegramCredential !== 'function') {
          setSaveError('Telegram 凭据更新失败。下一步：稍后重试或联系管理员检查后端接口。')
          return
        }
        const updated = await onUpdateTelegramCredential(requestedTelegramBotToken, requestedTelegramChatId)
        if (updated === false) {
          setSaveError('Telegram 凭据更新失败。下一步：检查 bot_token/chat_id 后重试。')
          return
        }
      }

      if (typeof onSave !== 'function') {
        setSaveError('设置保存失败。下一步：刷新页面后重试。')
        return
      }
      const ok = await onSave(nextDraftWithoutSecrets)
      if (ok === false) {
        setSaveError('设置保存失败。下一步：检查表单配置后重试；若持续失败请重新登录。')
        return
      }
      onClose()
    } catch (error) {
      setSaveError(toGuidedError(error, 'settings_save', '设置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const executeBenchmark = async () => {
    setBenchmarkLoading(true)
    setBenchmarkError('')
    try {
      const payload = await runNetworkBenchmark({
        profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds,
        persist: true
      })
      const normalized = normalizeBenchmarkResult(payload?.result)
      const result = normalized.result
      setBenchmarkResult(result)
      setBenchmarkError(
        normalized.warning
          || (result ? '' : '测速完成但未返回有效结果。下一步：稍后重试，必要时检查后端服务状态。')
      )
      updateDraft((prev) => ({
        ...prev,
        network_benchmark: {
          ...prev.network_benchmark,
          default_profile: benchmarkProfile,
          timeout_seconds: timeoutSeconds,
          last_run_at: result?.generated_at || '',
          last_result: result
        }
      }))
    } catch (error) {
      setBenchmarkError(toGuidedError(error, 'settings_benchmark_run', '测速执行失败'))
    } finally {
      setBenchmarkLoading(false)
    }
  }

  const sendTelegramTest = async () => {
    setTelegramTestError('')
    setTelegramTestHint('')

    if (shouldUpdateTelegramCredential) {
      setTelegramTestError('已输入新凭据，请先保存设置以更新凭据后再发送测试消息。')
      return
    }

    if (!currentTelegramChatId) {
      setTelegramTestError('chat_id 为空，无法发送测试消息。请先配置并保存凭据。')
      return
    }

    if (typeof onSendTelegramTestMessage !== 'function') {
      setTelegramTestError('Telegram 测试消息未接入。下一步：请检查前端回调与后端接口是否已集成。')
      return
    }

    setTelegramTestLoading(true)
    try {
      const payload = await onSendTelegramTestMessage()
      const traceId = String(payload?.trace_id || '').trim()
      const ok = payload?.ok === true && payload?.sent === true

      if (ok) {
        setTelegramTestHint(`Telegram 测试消息已发送${traceId ? `（trace_id: ${traceId}）` : ''}`)
      } else {
        const category = String(payload?.error?.category || '').trim()
        const description = String(payload?.error?.description || payload?.error?.message || '').trim()
        const suffix = [category, description].filter(Boolean).join(' - ')
        setTelegramTestError(
          `Telegram 测试消息发送失败${traceId ? `（trace_id: ${traceId}）` : ''}${suffix ? `：${suffix}` : ''}`
        )
      }
    } catch (error) {
      setTelegramTestError(toGuidedError(error, 'settings_save', 'Telegram 测试消息发送失败'))
    } finally {
      setTelegramTestLoading(false)
    }
  }

  return (
    <div className="settings-mask" onClick={onClose}>
      <section className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>设置中心</h3>
          <button type="button" className="ghost" onClick={onClose}>关闭</button>
        </header>

        <div className="settings-group">
          <h4>自动刷新</h4>
          <label>
            <span>是否开启</span>
            <input
              type="checkbox"
              checked={Boolean(draft.display.auto_refresh_enabled)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_enabled: e.target.checked }
              }))}
            />
          </label>
          <label>
            <span>刷新间隔（秒）</span>
            <input
              type="number"
              min={15}
              max={600}
              value={draft.display.auto_refresh_seconds ?? 60}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_seconds: Number(e.target.value) || 60 }
              }))}
            />
          </label>
          <label>
            <span>页面不可见时暂停</span>
            <input
              type="checkbox"
              checked={Boolean(draft.display.auto_refresh_visible_only)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_visible_only: e.target.checked }
              }))}
            />
          </label>
        </div>

        <div className="settings-group">
          <h4>网络测速</h4>
          <label>
            <span>测速站点组</span>
            <select value={benchmarkProfile} onChange={(e) => setBenchmarkProfile(e.target.value)}>
              {PROFILE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>超时（秒）</span>
            <input
              type="number"
              min={1}
              max={12}
              value={timeoutSeconds}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                network_benchmark: {
                  ...prev.network_benchmark,
                  timeout_seconds: Number(e.target.value) || 6
                }
              }))}
            />
          </label>
          <div className="settings-benchmark-actions">
            <button type="button" className="primary" onClick={executeBenchmark} disabled={benchmarkLoading}>
              {benchmarkLoading ? '测速中...' : '开始测速'}
            </button>
          </div>
          {benchmarkError && <p className="settings-error">{benchmarkError}</p>}
          {!benchmarkError && !benchmarkSummary && !hasBenchmarkRows && (
            <p className="settings-note">暂无测速记录。下一步：点击“开始测速”获取链路健康状态。</p>
          )}
          {benchmarkSummary && (
            <div className="settings-benchmark-summary">
              <span>站点：{benchmarkSummary.site_count}</span>
              <span>成功：{benchmarkSummary.success_count}</span>
              <span>失败：{benchmarkSummary.failed_count}</span>
              <span>平均总耗时：{benchmarkSummary.avg_total_ms} ms</span>
              <span>总用时：{benchmarkSummary.elapsed_ms} ms</span>
            </div>
          )}
          {hasBenchmarkRows && (
            <div className="settings-benchmark-list">
              {benchmarkResult.results.map((item, index) => (
                <article key={`${item.site}-${index}`} className="settings-benchmark-item">
                  <div className="settings-benchmark-title">
                    <strong>{item.site}</strong>
                    <span className={item.ok ? 'ok' : 'bad'}>{item.ok ? '正常' : '失败'}</span>
                  </div>
                  <p>
                    DNS {item.dns_ms} ms / TCP {item.tcp_ms} ms / TLS {item.tls_ms} ms /
                    TTFB {item.ttfb_ms} ms / TOTAL {item.total_ms} ms
                  </p>
                  {!item.ok ? (
                    <p className="settings-error">
                      {item.error || '测速失败，未返回错误详情。下一步：稍后重试并检查后端服务状态。'}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="settings-group">
          <h4>飞书机器人（预留）</h4>
          <label>
            <span>启用</span>
            <input
              type="checkbox"
              checked={Boolean(draft.notifications.feishu.enabled)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, enabled: e.target.checked }
                }
              }))}
            />
          </label>
          <div className="settings-secret-block">
            <span className="settings-secret-label">Webhook 地址</span>
            {!showFeishuWebhookInput ? (
              <div className="settings-secret-preview">
                <code className="settings-secret-value" data-testid="feishu-webhook-masked">
                  {maskedFeishuWebhook}
                </code>
                <button
                  type="button"
                  className="ghost"
                  data-testid="feishu-webhook-edit"
                  onClick={() => setEditingFeishuWebhook(true)}
                >
                  更新凭据
                </button>
              </div>
            ) : (
              <div className="settings-secret-editor">
                <input
                  data-testid="feishu-webhook-input"
                  value={pendingFeishuWebhook}
                  onChange={(e) => setPendingFeishuWebhook(e.target.value)}
                  placeholder={hasFeishuWebhook ? '如需更换请输入新的 Webhook，留空则保持不变' : '填入飞书机器人 Webhook'}
                  autoComplete="off"
                />
                {hasFeishuWebhook && (
                  <div className="settings-secret-actions">
                    <button
                      type="button"
                      className="ghost"
                      data-testid="feishu-webhook-cancel-edit"
                      onClick={() => {
                        setPendingFeishuWebhook('')
                        setEditingFeishuWebhook(false)
                      }}
                    >
                      取消更新
                    </button>
                    <p className="settings-note">留空并保存将保持当前凭据不变。</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <label>
            <span>飞书超时（秒）</span>
            <input
              type="number"
              min={0.5}
              max={30}
              step={0.5}
              value={draft.notifications.feishu.timeout_seconds ?? 3}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, timeout_seconds: Number(e.target.value) || 3 }
                }
              }))}
            />
          </label>
          <label>
            <span>飞书重试次数</span>
            <input
              type="number"
              min={0}
              max={5}
              step={1}
              value={draft.notifications.feishu.retry_times ?? 2}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, retry_times: Math.max(0, Number(e.target.value) || 0) }
                }
              }))}
            />
          </label>
          <label>
            <span>飞书消息模板</span>
            <select
              value={draft.notifications.feishu.template || 'title_content_metadata'}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, template: e.target.value || 'title_content_metadata' }
                }
              }))}
            >
              {FEISHU_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="settings-group">
          <h4>Telegram 机器人（预留）</h4>
          <label>
            <span>启用</span>
            <input
              type="checkbox"
              checked={Boolean(draft.notifications.telegram.enabled)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  telegram: { ...prev.notifications.telegram, enabled: e.target.checked }
                }
              }))}
            />
          </label>
          <label>
            <span>消息格式</span>
            <span className="settings-note">{telegramMode}</span>
          </label>
          <label>
            <span>启用 HTML（安全转义）</span>
            <input
              type="checkbox"
              checked={String(draft.notifications.telegram.parse_mode || '').trim().toUpperCase() === 'HTML'}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  telegram: { ...prev.notifications.telegram, parse_mode: e.target.checked ? 'HTML' : '' }
                }
              }))}
            />
          </label>
          <label>
            <span>禁用网页预览</span>
            <input
              type="checkbox"
              checked={Boolean(draft.notifications.telegram.disable_web_page_preview)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  telegram: { ...prev.notifications.telegram, disable_web_page_preview: e.target.checked }
                }
              }))}
            />
          </label>
          <label>
            <span>Telegram 超时（秒）</span>
            <input
              type="number"
              min={0.5}
              max={30}
              step={0.5}
              value={draft.notifications.telegram.timeout_seconds ?? 3}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  telegram: { ...prev.notifications.telegram, timeout_seconds: Number(e.target.value) || 3 }
                }
              }))}
            />
          </label>
          <label>
            <span>Telegram 重试次数</span>
            <input
              type="number"
              min={0}
              max={5}
              step={1}
              value={draft.notifications.telegram.retry_times ?? 2}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  telegram: { ...prev.notifications.telegram, retry_times: Math.max(0, Number(e.target.value) || 0) }
                }
              }))}
            />
          </label>

          <div className="settings-secret-block">
            <span className="settings-secret-label">凭据</span>
            {!showTelegramCredentialInput ? (
              <div className="settings-secret-preview">
                <code className="settings-secret-value">
                  {hasTelegramCredential ? `已配置（chat_id=${currentTelegramChatId || '--'}）` : '未配置'}
                </code>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setEditingTelegramCredential(true)}
                >
                  更新凭据
                </button>
              </div>
            ) : (
              <div className="settings-secret-editor">
                <input
                  type="password"
                  value={pendingTelegramBotToken}
                  onChange={(e) => setPendingTelegramBotToken(e.target.value)}
                  placeholder={hasTelegramCredential ? '如需更换请输入新的 bot_token，留空则保持不变' : '填入 bot_token'}
                  autoComplete="off"
                />
                <input
                  value={pendingTelegramChatId}
                  onChange={(e) => setPendingTelegramChatId(e.target.value)}
                  placeholder="填入 chat_id（群通常为负数）"
                  autoComplete="off"
                />
                {hasTelegramCredential && (
                  <div className="settings-secret-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setPendingTelegramBotToken('')
                        setPendingTelegramChatId(currentTelegramChatId)
                        setEditingTelegramCredential(false)
                      }}
                    >
                      取消更新
                    </button>
                    <p className="settings-note">留空并保存将保持当前凭据不变。</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="settings-secret-actions">
            <button
              type="button"
              className="ghost"
              data-testid="telegram-test-message-btn"
              onClick={sendTelegramTest}
              disabled={telegramTestLoading || saving || shouldUpdateTelegramCredential || !currentTelegramChatId}
            >
              {telegramTestLoading ? '发送中...' : '发送测试消息'}
            </button>
            <p className="settings-note">将使用已保存的 Telegram 凭据发送固定测试文案。</p>
          </div>
          {telegramTestHint && <p className="settings-note">{telegramTestHint}</p>}
          {telegramTestError && <p className="settings-error">{telegramTestError}</p>}
        </div>

        <div className="settings-group">
          <h4>邮件推送（预留）</h4>
          <label>
            <span>启用</span>
            <input
              type="checkbox"
              checked={Boolean(draft.notifications.email.enabled)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email: { ...prev.notifications.email, enabled: e.target.checked }
                }
              }))}
            />
          </label>
          <label>
            <span>收件人</span>
            <input
              value={draft.notifications.email.recipients || ''}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email: { ...prev.notifications.email, recipients: e.target.value }
                }
              }))}
              placeholder="多个邮箱使用逗号分隔"
            />
          </label>
        </div>

        <footer>
          {saveError && <p className="settings-error">{saveError}</p>}
          <button type="button" className="primary" onClick={save} disabled={saving} data-testid="settings-save-btn">
            {saving ? '保存中...' : '保存设置'}
          </button>
        </footer>
      </section>
    </div>
  )
}
