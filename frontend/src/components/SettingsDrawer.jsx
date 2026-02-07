import { useEffect, useMemo, useState } from 'react'
import { fetchNetworkBenchmarkLatest, runNetworkBenchmark } from '../api.js'

const PROFILE_OPTIONS = [
  { value: 'cn_fund', label: '国内基金站点' },
  { value: 'global', label: '国际站点' }
]

export function SettingsDrawer({ open, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(settings)
  const [benchmarkProfile, setBenchmarkProfile] = useState('cn_fund')
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState('')
  const [benchmarkResult, setBenchmarkResult] = useState(null)

  useEffect(() => {
    setDraft(settings)
    const profile = settings?.network_benchmark?.default_profile || 'cn_fund'
    setBenchmarkProfile(profile)
  }, [settings])

  useEffect(() => {
    if (!open) return

    let active = true
    ;(async () => {
      try {
        const payload = await fetchNetworkBenchmarkLatest()
        if (!active) return
        setBenchmarkResult(payload?.result || null)
      } catch {
        if (!active) return
        setBenchmarkResult(null)
      }
    })()

    return () => {
      active = false
    }
  }, [open])

  if (!open) return null

  const timeoutSeconds = Number(draft?.network_benchmark?.timeout_seconds || 6)

  const benchmarkSummary = useMemo(() => {
    if (!benchmarkResult?.summary) return null
    return benchmarkResult.summary
  }, [benchmarkResult])

  const save = async () => {
    const nextDraft = {
      ...draft,
      network_benchmark: {
        ...(draft?.network_benchmark || {}),
        default_profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds
      }
    }
    setDraft(nextDraft)
    await onSave(nextDraft)
    onClose()
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
      setDraft((prev) => ({
        ...prev,
        network_benchmark: {
          ...(prev?.network_benchmark || {}),
          default_profile: benchmarkProfile,
          timeout_seconds: timeoutSeconds,
          last_run_at: result?.generated_at || '',
          last_result: result
        }
      }))
    } catch (error) {
      setBenchmarkError(error?.message || '测速执行失败')
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
              checked={Boolean(draft?.display?.auto_refresh_enabled)}
              onChange={(e) => setDraft((prev) => ({
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
              value={draft?.display?.auto_refresh_seconds ?? 60}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_seconds: Number(e.target.value) || 60 }
              }))}
            />
          </label>
          <label>
            <span>页面不可见时暂停</span>
            <input
              type="checkbox"
              checked={Boolean(draft?.display?.auto_refresh_visible_only)}
              onChange={(e) => setDraft((prev) => ({
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
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                network_benchmark: {
                  ...(prev?.network_benchmark || {}),
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
              checked={Boolean(draft?.notifications?.feishu?.enabled)}
              onChange={(e) => setDraft((prev) => ({
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
              value={draft?.notifications?.feishu?.webhook_url || ''}
              onChange={(e) => setDraft((prev) => ({
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
              checked={Boolean(draft?.notifications?.email?.enabled)}
              onChange={(e) => setDraft((prev) => ({
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
              value={draft?.notifications?.email?.recipients || ''}
              onChange={(e) => setDraft((prev) => ({
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
          <button type="button" className="primary" onClick={save}>保存设置</button>
        </footer>
      </section>
    </div>
  )
}