import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { usePortfolio } from './hooks/usePortfolio.js'
import { fetchActions, fetchDailyReport, fetchFundSuggest } from './api.js'
import { buildFundSeries, splitMarketGroups } from './utils/chart.js'
import { cycleSortState } from './utils/holdings.js'
import { classBySign, formatDate, formatPercent } from './utils/format.js'
import { LoginPanel } from './components/LoginPanel.jsx'
import { TopToolbar } from './components/TopToolbar.jsx'
import { SummaryCards } from './components/SummaryCards.jsx'
import { HoldingsTable } from './components/HoldingsTable.jsx'
import { FundDetailPanel } from './components/FundDetailPanel.jsx'
import { RiskCenter } from './components/RiskCenter.jsx'
import { SettingsDrawer } from './components/SettingsDrawer.jsx'
import { BottomTabs } from './components/BottomTabs.jsx'
import { listMetrics, recordMetric } from './utils/metrics.js'

function App() {
  const [sortState, setSortState] = useState({ key: 'market_value_cny', order: 'desc' })
  const [selectedFundId, setSelectedFundId] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLogs, setActionLogs] = useState([])
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [reportSummary, setReportSummary] = useState('')
  const [assetReadyMs, setAssetReadyMs] = useState(0)
  const [assetTimedOut, setAssetTimedOut] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const firstLoadStartRef = useRef(0)

  const { user, authLoading, authReady, login, logout } = useAuth()
  const {
    rows,
    riskOverview,
    status,
    loading,
    lastRefresh,
    asof,
    settings,
    refresh,
    setAutoRefreshEnabled,
    saveSettingsPatch,
    saveHolding
  } = usePortfolio({ user, sorter: sortState })

  const dateLabel = useMemo(() => {
    if (asof && asof !== '--') {
      const fromAsof = formatDate(asof)
      if (fromAsof !== '--') return fromAsof
    }
    return formatDate(new Date())
  }, [asof])

  const sparklineMap = useMemo(() => {
    const map = {}
    rows.forEach((row) => {
      map[row.fund_id] = buildFundSeries(row, 'day').map((item) => ({ label: item.label, value: item.fund }))
    })
    return map
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => {
      const name = String(row.name || '').toLowerCase()
      const code = String(row.fund_id || '').toLowerCase()
      return name.includes(query) || code.includes(query)
    })
  }, [rows, searchQuery])

  const { domestic, overseas } = useMemo(() => splitMarketGroups(filteredRows), [filteredRows])

  const currentFund = useMemo(() => {
    if (!filteredRows.length) return null
    const target = filteredRows.find((item) => item.fund_id === selectedFundId)
    return target || filteredRows[0]
  }, [filteredRows, selectedFundId])

  const topMovers = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => Math.abs(Number(b.day_profit_cny || 0)) - Math.abs(Number(a.day_profit_cny || 0)))
      .slice(0, 6)
  }, [filteredRows])

  const handleToggleAutoRefresh = () => {
    setAutoRefreshEnabled(!settings.display.auto_refresh_enabled)
  }

  useEffect(() => {
    recordMetric('应用打开')
  }, [])

  useEffect(() => {
    const keyword = searchQuery.trim()
    if (!keyword) {
      setSuggestions([])
      setSearchLoading(false)
      return undefined
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true)
        const payload = await fetchFundSuggest(keyword, 8)
        setSuggestions(Array.isArray(payload?.items) ? payload.items : [])
      } catch {
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 280)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const handlePickSuggestion = (item) => {
    const pickedCode = String(item?.fund_id || '').trim()
    if (!pickedCode) return
    setSearchQuery(pickedCode)
    setSelectedFundId(pickedCode)
    setActiveTab('holdings')
    setSuggestions([])
  }

  useEffect(() => {
    if (!user) {
      setActionLogs([])
      setActionError('')
      setReportSummary('')
      return
    }
    if (activeTab !== 'trade' && activeTab !== 'profile') return

    let mounted = true
    const loadTradeAndReport = async () => {
      setActionLoading(true)
      setActionError('')
      try {
        const records = []
        for (let offset = 0; offset < 7; offset += 1) {
          const date = new Date()
          date.setDate(date.getDate() - offset)
          const day = date.toISOString().slice(0, 10)
          const payload = await fetchActions(day)
          const actions = Array.isArray(payload?.actions) ? payload.actions : []
          actions.forEach((item) => {
            records.push({
              ...item,
              date: payload?.date || day
            })
          })
        }
        records.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
        if (mounted) setActionLogs(records)
      } catch (error) {
        if (mounted) {
          setActionLogs([])
          setActionError(error?.message || '交易记录加载失败')
        }
      } finally {
        if (mounted) setActionLoading(false)
      }

      try {
        const report = await fetchDailyReport()
        if (mounted) setReportSummary(String(report?.summary || ''))
      } catch {
        if (mounted) setReportSummary('')
      }
    }

    void loadTradeAndReport()
    return () => {
      mounted = false
    }
  }, [activeTab, user])

  useEffect(() => {
    if (!user) {
      setAssetReadyMs(0)
      setAssetTimedOut(false)
      return
    }

    firstLoadStartRef.current = performance.now()
    recordMetric('首屏加载开始')
    const timeout = window.setTimeout(() => {
      if (rows.length === 0) {
        setAssetTimedOut(true)
        recordMetric('首屏加载超时', { timeout_ms: 5000 })
      }
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [user])

  useEffect(() => {
    if (!user || rows.length === 0 || assetReadyMs > 0) return
    const elapsed = Math.round(performance.now() - firstLoadStartRef.current)
    setAssetReadyMs(elapsed)
    setAssetTimedOut(false)
    recordMetric('资产卡更新完成', { elapsed_ms: elapsed })
  }, [assetReadyMs, rows.length, user])

  useEffect(() => {
    if (!user) return
    recordMetric('底部Tab切换', { tab: activeTab })
  }, [activeTab, user])

  const messageItems = useMemo(() => {
    const items = []
    const failedFunds = rows.filter((item) => item.status !== 'ok').length
    if (failedFunds > 0) {
      items.push({
        type: 'warning',
        title: '估值提醒',
        content: `当前有 ${failedFunds} 只基金估值异常，建议优先核对持仓页。`,
        actionLabel: '查看持仓',
        actionTab: 'holdings'
      })
    }
    const undoneActions = actionLogs.filter((item) => !item.done).length
    if (undoneActions > 0) {
      items.push({
        type: 'info',
        title: '交易待确认',
        content: `最近 7 天有 ${undoneActions} 条未执行记录，可在交易页确认。`,
        actionLabel: '查看交易',
        actionTab: 'trade'
      })
    }
    if (reportSummary) {
      const firstLine = reportSummary.split('\n')[0] || '今日复盘已生成'
      items.push({
        type: 'success',
        title: '复盘摘要',
        content: firstLine,
        actionLabel: '打开持仓',
        actionTab: 'holdings'
      })
    }
    if (items.length === 0) {
      items.push({
        type: 'success',
        title: '系统状态正常',
        content: '当前无待处理提醒，可按计划执行当日动作。',
        actionLabel: '返回首页',
        actionTab: 'home'
      })
    }
    return items
  }, [actionLogs, reportSummary, rows])

  const onAuthSubmit = async (payload) => {
    try {
      await login(payload)
    } catch {
      // 状态在 hooks 内由后续接口更新
    }
  }

  if (!authReady) {
    return (
      <div className="page-shell">
        <section className="panel loading-panel">正在初始化会话...</section>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell">
        <LoginPanel loading={authLoading} onSubmit={onAuthSubmit} />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <TopToolbar
        user={user}
        status={status}
        refreshing={loading}
        lastRefresh={lastRefresh}
        asof={asof}
        searchQuery={searchQuery}
        suggestions={suggestions}
        searchLoading={searchLoading}
        onSearchChange={setSearchQuery}
        onPickSuggestion={handlePickSuggestion}
        autoRefreshEnabled={Boolean(settings.display.auto_refresh_enabled)}
        onRefresh={() => refresh()}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={logout}
      />

      <BottomTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'home' && (
        <>
          <SummaryCards rows={rows} loading={loading} />
          <section className="panel home-main perf-panel">
            <div className="section-head">
              <h2>首屏性能</h2>
              <span>用于 Gate-B 验收</span>
            </div>
            <div className="perf-grid">
              <article className="todo-card">
                <h3>资产卡首刷耗时</h3>
                <p>{assetReadyMs > 0 ? `${assetReadyMs} ms` : '尚未完成'}</p>
              </article>
              <article className="todo-card">
                <h3>5秒超时状态</h3>
                <p>{assetTimedOut ? '已触发降级提示' : '未触发'}</p>
              </article>
              <article className="todo-card">
                <h3>最近埋点条数</h3>
                <p>{listMetrics().length} 条</p>
              </article>
            </div>
            {assetTimedOut && (
              <div className="chart-empty">
                首屏数据超过 5 秒未完成，请检查后端连接或外部数据源状态。
              </div>
            )}
          </section>
          <section className="panel home-main">
            <div className="section-head">
              <h2>今日待办</h2>
              <span>优先处理这 3 项</span>
            </div>
            <div className="todo-grid">
              <article className="todo-card">
                <h3>主操作</h3>
                <p>进入交易页完成买入、定投、赎回或转换。</p>
                <button type="button" className="primary" onClick={() => setActiveTab('trade')}>去交易</button>
              </article>
              <article className="todo-card">
                <h3>持仓巡检</h3>
                <p>检查当日收益异常基金，确认是否执行动作。</p>
                <button type="button" className="ghost" onClick={() => setActiveTab('holdings')}>查看持仓</button>
              </article>
              <article className="todo-card">
                <h3>提醒中心</h3>
                <p>统一管理阈值提醒与系统消息。</p>
                <button type="button" className="ghost" onClick={() => setActiveTab('profile')}>去我的</button>
              </article>
            </div>
            {searchQuery.trim() && filteredRows.length === 0 && (
              <div className="chart-empty">未匹配到基金：请尝试代码、名称或拼音。</div>
            )}
          </section>
        </>
      )}

      {activeTab === 'watch' && (
        <section className="panel holdings-main">
          <div className="section-head">
            <h2>自选观察</h2>
            <span>按当日收益波动排序</span>
          </div>
          <div className="watch-list">
            {topMovers.length === 0 && <div className="chart-empty">暂无可展示的基金</div>}
            {topMovers.map((row) => (
              <article key={row.fund_id} className="watch-item">
                <div>
                  <h3>{row.name}</h3>
                  <p>{row.fund_id}</p>
                </div>
                <div className={`watch-profit ${classBySign(row.day_profit_cny)}`}>
                  {formatPercent(row.estimate_pct)}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'trade' && (
        <section className="panel holdings-main">
          <div className="section-head">
            <h2>交易入口</h2>
            <span>买入/定投/赎回/转换</span>
          </div>
          <div className="trade-grid">
            <button type="button" className="primary">买入</button>
            <button type="button" className="ghost">定投</button>
            <button type="button" className="ghost">赎回</button>
            <button type="button" className="ghost">转换</button>
          </div>
          <p className="trade-tip">交易详细流程按 ROADMAP 持续完善，当前先提供记录视图与待办闭环。</p>

          <div className="section-head trade-head">
            <h3>交易记录（近7天）</h3>
            <span>{actionLoading ? '加载中...' : `共 ${actionLogs.length} 条`}</span>
          </div>
          {actionError && <div className="chart-empty">{actionError}</div>}
          {!actionError && actionLogs.length === 0 && !actionLoading && (
            <div className="chart-empty">近 7 天暂无交易记录</div>
          )}
          {actionLogs.length > 0 && (
            <div className="record-list">
              {actionLogs.map((item) => (
                <article key={`${item.date}-${item.action_key}-${item.ts}`} className="record-item">
                  <div>
                    <h4>{item.action_key}</h4>
                    <p>{item.date} {item.ts || '--'}</p>
                  </div>
                  <div className="record-side">
                    <strong>{Number(item.amount || 0).toFixed(2)}</strong>
                    <span className={item.done ? 'record-done' : 'record-pending'}>
                      {item.done ? '已执行' : '未执行'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'holdings' && (
        <>
          <section className="panel holdings-main">
            <div className="section-head">
              <h2>全部持仓总览</h2>
              <span>支持排序、编辑与波形联动</span>
            </div>

            <HoldingsTable
              title="国内股 / 港股"
              rows={domestic}
              dateLabel={dateLabel}
              sortState={sortState}
              onSort={(key) => setSortState((prev) => cycleSortState(prev, key))}
              selectedFundId={currentFund?.fund_id || ''}
              onSelectFund={setSelectedFundId}
              sparklineMap={sparklineMap}
              onSaveHolding={saveHolding}
            />

            <HoldingsTable
              title="美股 / 海外"
              rows={overseas}
              dateLabel={dateLabel}
              sortState={sortState}
              onSort={(key) => setSortState((prev) => cycleSortState(prev, key))}
              selectedFundId={currentFund?.fund_id || ''}
              onSelectFund={setSelectedFundId}
              sparklineMap={sparklineMap}
              onSaveHolding={saveHolding}
            />
          </section>

          <FundDetailPanel fund={currentFund} rows={filteredRows} dateLabel={dateLabel} />
          <RiskCenter risk={riskOverview} />
        </>
      )}

      {activeTab === 'profile' && (
        <section className="panel holdings-main">
          <div className="section-head">
            <h2>我的</h2>
            <span>账号资料与偏好设置</span>
          </div>
          <div className="todo-grid">
            <article className="todo-card">
              <h3>当前账号</h3>
              <p>{user?.username || '--'}</p>
            </article>
            <article className="todo-card">
              <h3>自动刷新</h3>
              <p>{settings.display.auto_refresh_enabled ? '已开启' : '已关闭'}</p>
              <button type="button" className="ghost" onClick={handleToggleAutoRefresh}>
                切换自动刷新
              </button>
            </article>
            <article className="todo-card">
              <h3>更多设置</h3>
              <p>飞书和邮件配置入口已预留</p>
              <button type="button" className="primary" onClick={() => setSettingsOpen(true)}>打开设置</button>
            </article>
          </div>

          <div className="section-head trade-head">
            <h3>消息中心</h3>
            <span>交易 / 提醒 / 系统</span>
          </div>
          <div className="message-list">
            {messageItems.map((item) => (
              <article key={`${item.title}-${item.actionTab}`} className={`message-item message-${item.type}`}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.content}</p>
                </div>
                <button type="button" className="ghost" onClick={() => setActiveTab(item.actionTab)}>
                  {item.actionLabel}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={async (draft) => {
          await saveSettingsPatch(draft)
        }}
      />
    </div>
  )
}

export default App
