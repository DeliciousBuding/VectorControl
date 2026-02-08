import { useEffect, useState } from 'react'
import { fetchNetworkBenchmarkLatest, runNetworkBenchmark } from '../api.js'
import { toGuidedError } from '../utils/errorFeedback.js'

const PROFILE_OPTIONS = [
  { value: 'cn_fund', label: '国内基金站点' },
  { value: 'global', label: '国际站点' }
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
      webhook_url: ''
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

export function SettingsDrawer({ open, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeDrawerSettings(settings))
  const [benchmarkProfile, setBenchmarkProfile] = useState('cn_fund')
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState('')
  const [benchmarkResult, setBenchmarkResult] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const normalized = normalizeDrawerSettings(settings)
    setDraft(normalized)
    setBenchmarkProfile(normalized.network_benchmark.default_profile || 'cn_fund')
    setSaveError('')
  }, [settings])

  useEffect(() => {
    if (!open) return

    let active = true
    ;(async () => {
      try {
        setBenchmarkError('')
        const payload = await fetchNetworkBenchmarkLatest()
        if (!active) return
        setBenchmarkResult(payload?.result || null)
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
  const benchmarkSummary = benchmarkResult?.summary || null

  const save = async () => {
    setSaveError('')
    setSaving(true)

    const nextDraft = {
      ...draft,
      network_benchmark: {
        ...draft.network_benchmark,
        default_profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds
      }
    }

    setDraft(nextDraft)

    try {
      if (typeof onSave !== 'function') {
        setSaveError('设置保存失败。下一步：刷新页面后重试。')
        return
      }
      const ok = await onSave(nextDraft)
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
      const result = payload?.result || null
      setBenchmarkResult(result)
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
          {benchmarkSummary && (
            <div className="settings-benchmark-summary">
              <span>站点：{benchmarkSummary.site_count}</span>
              <span>成功：{benchmarkSummary.success_count}</span>
              <span>失败：{benchmarkSummary.failed_count}</span>
              <span>平均总耗时：{benchmarkSummary.avg_total_ms} ms</span>
              <span>总用时：{benchmarkSummary.elapsed_ms} ms</span>
            </div>
          )}
          {Array.isArray(benchmarkResult?.results) && benchmarkResult.results.length > 0 && (
            <div className="settings-benchmark-list">
              {benchmarkResult.results.map((item) => (
                <article key={item.site} className="settings-benchmark-item">
                  <div className="settings-benchmark-title">
                    <strong>{item.site}</strong>
                    <span className={item.ok ? 'ok' : 'bad'}>{item.ok ? '正常' : '失败'}</span>
                  </div>
                  <p>
                    DNS {item.dns_ms} ms / TCP {item.tcp_ms} ms / TLS {item.tls_ms} ms /
                    TTFB {item.ttfb_ms} ms / TOTAL {item.total_ms} ms
                  </p>
                  {!item.ok && item.error ? <p className="settings-error">{item.error}</p> : null}
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
          <label>
            <span>Webhook 地址</span>
            <input
              value={draft.notifications.feishu.webhook_url || ''}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, webhook_url: e.target.value }
                }
              }))}
              placeholder="填入飞书机器人 Webhook"
            />
          </label>
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
          <button type="button" className="primary" onClick={save} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </footer>
      </section>
    </div>
  )
}
