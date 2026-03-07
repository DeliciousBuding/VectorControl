import { useCallback, useState } from 'react'
import { apiFetch } from '../api.js'

/**
 * Dev-only diagnostics panel for debugging
 * Only rendered in development mode
 */
export function DiagnosticsPanel() {
  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/system/diagnostics')
      setDiag(data)
    } catch (e) {
      console.error('Failed to fetch diagnostics:', e)
      setDiag(null)
      setError('诊断信息加载失败。下一步：确认后端已启动后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  const copyToClipboard = useCallback(async () => {
    if (!diag?.diagnostic_text) return
    try {
      await navigator.clipboard.writeText(diag.diagnostic_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
      setError('复制诊断文本失败。下一步：检查浏览器剪贴板权限后重试。')
    }
  }, [diag?.diagnostic_text])

  // Only show in development
  if (import.meta.env?.PROD) {
    return null
  }

  const overviewCards = [
    {
      key: 'environment',
      label: '运行环境',
      value: '开发模式',
      hint: '该面板只在本地开发环境显示。'
    },
    {
      key: 'status',
      label: '数据状态',
      value: loading ? '同步中' : (diag?.diagnostic_text ? '已就绪' : '待拉取'),
      hint: diag?.diagnostic_text ? '诊断文本已返回，可继续复制或检查明细。' : '点击同步诊断拉取最新 system diagnostics。'
    },
    {
      key: 'clipboard',
      label: '复制状态',
      value: copied ? '已复制' : '未复制',
      hint: diag?.diagnostic_text ? '支持一键复制完整诊断文本。' : '只有在成功拉取诊断后才可复制。'
    }
  ]

  return (
    <section className="diagnostics-panel" aria-label="开发诊断面板">
      <div className="diagnostics-panel__head">
        <div className="diagnostics-panel__copy">
          <span className="diagnostics-panel__eyebrow">Developer Snapshot</span>
          <h3>开发诊断面板</h3>
          <p>仅在开发环境显示，用于快速拉取 `/api/system/diagnostics` 并复制完整排障文本。</p>
        </div>
        <div className="diagnostics-panel__actions">
          <button type="button" onClick={fetchDiagnostics} disabled={loading} data-testid="diagnostics-refresh-btn">
            {loading ? '同步中...' : '同步诊断'}
          </button>
          {diag && (
            <button type="button" onClick={copyToClipboard} data-testid="diagnostics-copy-btn">
              {copied ? '已复制' : '复制文本'}
            </button>
          )}
        </div>
      </div>

      <div className="diagnostics-panel__overview">
        {overviewCards.map((card) => (
          <article key={card.key} className="diagnostics-panel__card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.hint}</p>
          </article>
        ))}
      </div>

      {!diag && !loading && !error ? (
        <p className="diagnostics-panel__empty">尚未拉取诊断文本。下一步：点击“同步诊断”查看当前系统的可复制排障信息。</p>
      ) : null}

      {error ? <p className="diagnostics-panel__error">{error}</p> : null}

      {diag ? (
        <pre className="diagnostics-panel__content" data-testid="diagnostics-content">{diag.diagnostic_text}</pre>
      ) : null}
    </section>
  )
}
