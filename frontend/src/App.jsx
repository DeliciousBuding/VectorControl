import { useEffect, useState } from 'react'
import {
  fetchActions,
  fetchAdvice,
  fetchEstimate,
  fetchReportDaily,
  getQueryToken,
  getStoredToken,
  saveActions,
  setStoredToken
} from './api.js'

const ships = [
  {
    name: '科技',
    estimate_pct: '+0.00%',
    confidence: '—',
    note: '等待刷新'
  },
  {
    name: '红利',
    estimate_pct: '+0.00%',
    confidence: '—',
    note: '等待刷新'
  },
  {
    name: '消费',
    estimate_pct: '+0.00%',
    confidence: '—',
    note: '等待刷新'
  },
  {
    name: '制造',
    estimate_pct: '+0.00%',
    confidence: '—',
    note: '等待刷新'
  }
]

const initialActions = [
  {
    id: 'fx-001',
    title: '加仓科技主力',
    amount: '2,000',
    enabled: true,
    reason: '趋势延续，等待确认。',
    type: 'fixed'
  },
  {
    id: 'cd-002',
    title: '红利低吸',
    amount: '1,200',
    enabled: false,
    reason: '仅当日内回撤触发。',
    type: 'conditional'
  }
]

const executionRecords = [
  { id: 'morgan-a', label: '摩根A 已执行' },
  { id: 'morgan-c', label: '摩根C 已执行' },
  { id: 'nanfang', label: '南方 已执行' }
]

const reportPreview = {
  summary:
    '今日复盘摘要占位：策略执行状态、风险提示与明日观察点将在刷新后显示。',
  sections: [
    { title: '仓位观察', lines: ['等待数据接入。'] },
    { title: '风险提示', lines: ['等待数据接入。'] },
    { title: '明日计划', lines: ['等待数据接入。'] }
  ]
}

const formatTimestamp = () => {
  const now = new Date()
  return now.toLocaleString('zh-CN', { hour12: false })
}

const normalizeAdvice = (payload) => {
  if (Array.isArray(payload?.actions)) return payload.actions
  if (Array.isArray(payload)) return payload
  return null
}

const normalizeActionMap = (payload) => {
  const map = new Map()
  const add = (key, value) => {
    if (!key) return
    map.set(String(key), Boolean(value))
  }

  if (Array.isArray(payload?.actions)) {
    payload.actions.forEach((item) => {
      const key = item?.id || item?.key || item?.action_key || item?.name
      const value = item?.done ?? item?.checked ?? item?.enabled
      add(key, value)
    })
  } else if (Array.isArray(payload)) {
    payload.forEach((item) => {
      const key = item?.id || item?.key || item?.action_key || item?.name
      const value = item?.done ?? item?.checked ?? item?.enabled
      add(key, value)
    })
  } else if (payload?.records && typeof payload.records === 'object') {
    Object.entries(payload.records).forEach(([key, value]) => add(key, value))
  } else if (payload?.data && typeof payload.data === 'object') {
    Object.entries(payload.data).forEach(([key, value]) => add(key, value))
  }

  return map.size ? map : null
}

const normalizeReport = (payload) => {
  if (!payload || typeof payload !== 'object') return null

  const summary =
    typeof payload.summary === 'string' && payload.summary.trim()
      ? payload.summary
      : reportPreview.summary

  const sections = Array.isArray(payload.sections)
    ? payload.sections.map((section, index) => {
        const title =
          typeof section?.title === 'string' && section.title.trim()
            ? section.title
            : `Section ${index + 1}`
        const lines = Array.isArray(section?.lines)
          ? section.lines.filter((line) => line !== null && line !== undefined)
          : typeof section?.lines === 'string'
            ? [section.lines]
            : []
        return {
          title,
          lines: lines.length ? lines : ['—']
        }
      })
    : []

  return {
    summary,
    sections: sections.length ? sections : reportPreview.sections
  }
}

const buildActionsPayload = (records) => ({
  actions: records.map((record) => ({
    action_key: record.id,
    done: record.checked,
    label: record.label
  }))
})

function App() {
  const [tokenInput, setTokenInput] = useState('')
  const [lastRefresh, setLastRefresh] = useState('--')
  const [status, setStatus] = useState({ type: 'info', message: '等待刷新' })
  const [shipData, setShipData] = useState(ships)
  const [actionData, setActionData] = useState(initialActions)
  const [executionData, setExecutionData] = useState(
    executionRecords.map((record) => ({ ...record, checked: false }))
  )
  const [saveStatus, setSaveStatus] = useState('--')
  const [reportData, setReportData] = useState(reportPreview)

  useEffect(() => {
    const stored = getStoredToken()
    const query = getQueryToken()
    const initial = stored || query

    if (initial) {
      setTokenInput(initial)
    }

    if (query && !stored) {
      setStatus({ type: 'info', message: '检测到 URL Token（未保存）' })
    }
  }, [])

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim()
    setStoredToken(trimmed)
    if (trimmed) {
      setStatus({ type: 'success', message: 'Token 已保存' })
    } else {
      setStatus({ type: 'warning', message: 'Token 已清除' })
    }
  }

  const handleRefresh = async () => {
    setStatus({ type: 'info', message: '刷新中...' })
    const errors = []

    try {
      const estimate = await fetchEstimate()
      if (!Array.isArray(estimate?.buckets)) {
        throw new Error('数据格式异常：缺少 buckets')
      }

      const normalized = estimate.buckets.map((bucket, index) => {
        const fallback = ships[index] || { name: `Bucket ${index + 1}` }
        return {
          name: bucket?.label || bucket?.name || bucket?.key || fallback.name,
          estimate_pct: bucket?.estimate_pct ?? fallback.estimate_pct,
          confidence: bucket?.confidence ?? fallback.confidence,
          note: bucket?.note ?? fallback.note
        }
      })

      setShipData(normalized.length ? normalized : ships)
      setLastRefresh(formatTimestamp())
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || '刷新失败' })
      return
    }

    try {
      const advice = await fetchAdvice()
      const actions = normalizeAdvice(advice)
      if (!actions) {
        throw new Error('数据格式异常：缺少 actions')
      }

      setActionData(actions)
    } catch (error) {
      errors.push(error)
    }

    try {
      const actionsPayload = await fetchActions()
      const actionMap = normalizeActionMap(actionsPayload)
      if (!actionMap) {
        throw new Error('数据格式异常：缺少 actions')
      }

      setExecutionData((prev) =>
        prev.map((record) =>
          actionMap.has(record.id)
            ? { ...record, checked: actionMap.get(record.id) }
            : record
        )
      )
    } catch (error) {
      errors.push(error)
    }

    try {
      const report = await fetchReportDaily()
      const normalized = normalizeReport(report)
      if (!normalized) {
        throw new Error('数据格式异常：缺少 report')
      }
      setReportData(normalized)
    } catch (error) {
      errors.push(error)
    }

    if (errors.length) {
      setStatus({ type: 'error', message: errors[0]?.message || '刷新失败' })
      return
    }

    setStatus({ type: 'success', message: '已刷新' })
  }

  const handleToggleAction = async (id) => {
    const previous = executionData
    const next = executionData.map((record) =>
      record.id === id ? { ...record, checked: !record.checked } : record
    )

    setExecutionData(next)
    setSaveStatus('保存中...')

    try {
      await saveActions(buildActionsPayload(next))
      setSaveStatus('已保存')
    } catch (error) {
      setExecutionData(previous)
      setSaveStatus(`保存失败：${error?.message || '请重试'}`)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">FW</div>
          <div>
            <div className="title">Fund Watchtower</div>
            <div className="subtitle">单页盯盘看板 · 手动刷新</div>
          </div>
        </div>
        <label className="searchbar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input type="text" placeholder="搜索基金代码 / 名称..." />
        </label>
        <div className="nav-actions">
          <button className="icon-button" type="button" aria-label="通知">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.41L4 17h5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 17a3 3 0 006 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="avatar" aria-hidden="true" />
        </div>
      </header>

      <section className="control-panel">
        <div className="control-header">
          <div>
            <div className="control-title">API Token</div>
            <div className="control-subtitle">保存后用于访问后端接口</div>
          </div>
          <div className={`status ${status.type}`}>状态：{status.message}</div>
        </div>
        <div className="control-body">
          <label className="token-input">
            <input
              type="password"
              placeholder="粘贴或输入 Token"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
            <button type="button" onClick={handleSaveToken}>
              保存
            </button>
          </label>
          <div className="refresh-row">
            <button className="refresh" type="button" onClick={handleRefresh}>
              刷新
            </button>
            <span className="last-refresh">上次刷新：{lastRefresh}</span>
          </div>
        </div>
      </section>

      <main className="content">
        <section className="panel">
          <div className="panel-header">
            <h2>四船看板</h2>
            <span className="panel-note">estimate_pct · confidence · note</span>
          </div>
          <div className="ship-grid">
            {shipData.map((ship) => (
              <article className="ship-card" key={ship.name}>
                <div className="ship-title">{ship.name}</div>
                <div className="ship-metrics">
                  <div>
                    <span className="label">estimate_pct</span>
                    <span className="value">{ship.estimate_pct}</span>
                  </div>
                  <div>
                    <span className="label">confidence</span>
                    <span className="value">{ship.confidence}</span>
                  </div>
                </div>
                <div className="ship-note">{ship.note}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>今日指令</h2>
            <span className="panel-note">/api/advice</span>
          </div>
          <div className="action-list">
            {actionData.map((action) => {
              const isEnabled = action.enabled !== false
              const type = action.type === 'fixed' ? 'fixed' : 'conditional'
              const title = action.title || action.name || '未命名指令'
              const amount = action.amount ?? '--'
              const reason = action.reason || action.note || '—'

              return (
                <article
                  className={`action-card ${isEnabled ? '' : 'disabled'}`}
                  key={action.id || title}
                >
                  <div className="action-top">
                    <div>
                      <div className="action-title">{title}</div>
                      <div className="action-amount">金额：{amount}</div>
                    </div>
                    <span className={`badge ${type}`}>
                      {type === 'fixed' ? '固定' : '条件'}
                    </span>
                  </div>
                  <div className="action-meta">
                    <span className={isEnabled ? 'enabled' : 'disabled'}>
                      {isEnabled ? '已启用' : '未启用'}
                    </span>
                    <span className="reason">{reason}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>执行记录</h2>
            <span className="panel-note">勾选后保存至 /api/actions</span>
          </div>
          <div className="checkbox-list">
            {executionData.map((record) => (
              <label className="checkbox-item" key={record.id}>
                <input
                  type="checkbox"
                  checked={record.checked}
                  onChange={() => handleToggleAction(record.id)}
                />
                <span>{record.label}</span>
              </label>
            ))}
          </div>
          <div className="save-hint">保存结果：{saveStatus}</div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>复盘预览</h2>
            <span className="panel-note">/api/report/daily</span>
          </div>
          <div className="report-summary">{reportData.summary}</div>
          <div className="report-grid">
            {reportData.sections.map((section) => (
              <article className="report-card" key={section.title}>
                <div className="report-title">{section.title}</div>
                <div className="report-content">
                  {section.lines.map((line, index) => (
                    <p className="report-line" key={`${section.title}-${index}`}>
                      {line}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
