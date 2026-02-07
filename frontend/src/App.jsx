import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { usePortfolio } from './hooks/usePortfolio.js'
import { fetchActions, fetchDailyReport, fetchFundSuggest, saveAction } from './api.js'
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
import { StateShowcase } from './components/StateShowcase.jsx'
import { recordMetric } from './utils/metrics.js'

const TRADE_TYPES = [
  { key: 'buy', label: '买入' },
  { key: 'dca', label: '定投' },
  { key: 'redeem', label: '赎回' },
  { key: 'convert', label: '转换' }
]

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
  const [tradeType, setTradeType] = useState('buy')
  const [tradeFundCode, setTradeFundCode] = useState('')
  const [tradeAmount, setTradeAmount] = useState('')
  const [tradeDone, setTradeDone] = useState(false)
  const [tradeSubmitting, setTradeSubmitting] = useState(false)
  const [tradeSubmitError, setTradeSubmitError] = useState('')
  const [tradeSubmitResult, setTradeSubmitResult] = useState(null)
  const [planName, setPlanName] = useState('')
  const [planFundCode, setPlanFundCode] = useState('')
  const [planAmount, setPlanAmount] = useState('')
  const [planSchedule, setPlanSchedule] = useState('weekly')
  const [planSubmitting, setPlanSubmitting] = useState(false)
  const [planError, setPlanError] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleFundCode, setRuleFundCode] = useState('')
  const [ruleOperator, setRuleOperator] = useState('<=')
  const [ruleThreshold, setRuleThreshold] = useState('')
  const [ruleSilentHours, setRuleSilentHours] = useState('24')
  const [ruleSubmitting, setRuleSubmitting] = useState(false)
  const [ruleError, setRuleError] = useState('')
  const [reportSummary, setReportSummary] = useState('')
  const [assetReadyMs, setAssetReadyMs] = useState(0)
  const [assetTimedOut, setAssetTimedOut] = useState(false)
  const [skeletonLock, setSkeletonLock] = useState(false)
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
    updatedAt,
    confirmState,
    coverage,
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
  const { domestic: homeDomesticRows, overseas: homeOverseasRows } = useMemo(() => splitMarketGroups(rows), [rows])
  const homeDomesticPreview = useMemo(() => [...homeDomesticRows].sort((a, b) => Number(b.market_value_cny || 0) - Number(a.market_value_cny || 0)).slice(0, 4), [homeDomesticRows])
  const homeOverseasPreview = useMemo(() => [...homeOverseasRows].sort((a, b) => Number(b.market_value_cny || 0) - Number(a.market_value_cny || 0)).slice(0, 4), [homeOverseasRows])

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

  const dcaPlans = useMemo(() => {
    const items = settings?.strategy?.dca_plans
    return Array.isArray(items) ? items : []
  }, [settings])

  const dcaStatusMap = useMemo(() => {
    const map = {}
    for (const item of actionLogs) {
      const key = String(item?.action_key || '')
      if (!key.startsWith('dca_plan_')) continue
      const planId = key.slice('dca_plan_'.length)
      if (!planId || map[planId]) continue
      map[planId] = item.done ? 'ok' : 'failed'
    }
    return map
  }, [actionLogs])

  const dcaFailedPlans = useMemo(() => {
    return dcaPlans.filter((plan) => dcaStatusMap[String(plan.id)] === 'failed')
  }, [dcaPlans, dcaStatusMap])

  const reminderRules = useMemo(() => {
    const items = settings?.notifications?.rules
    return Array.isArray(items) ? items : []
  }, [settings])

  const reminderRuleStates = useMemo(() => {
    return reminderRules.map((rule) => {
      const targetRows = rule.fund_id
        ? rows.filter((row) => String(row.fund_id) === String(rule.fund_id))
        : rows
      const values = targetRows.map((row) => Number(row.estimate_pct || 0))
      const minValue = values.length > 0 ? Math.min(...values) : null
      const maxValue = values.length > 0 ? Math.max(...values) : null
      let hit = false
      if (values.length > 0) {
        if (rule.operator === '<=') hit = values.some((value) => value <= Number(rule.threshold))
        if (rule.operator === '>=') hit = values.some((value) => value >= Number(rule.threshold))
      }
      return {
        ...rule,
        hit: Boolean(rule.enabled) && hit,
        currentValue: rule.operator === '<=' ? minValue : maxValue,
        scopeCount: targetRows.length
      }
    })
  }, [reminderRules, rows])

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
    if (activeTab !== 'trade' && activeTab !== 'profile' && activeTab !== 'home') return

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
    if (!user) {
      setSkeletonLock(false)
      return
    }
    setSkeletonLock(true)
    const timer = window.setTimeout(() => {
      setSkeletonLock(false)
    }, 3000)
    return () => window.clearTimeout(timer)
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


  const openHoldingFromHome = (fundId) => {
    setSelectedFundId(String(fundId || ''))
    setActiveTab('holdings')
  }
  const handleTradeSubmit = async (event) => {
    event.preventDefault()
    const code = tradeFundCode.trim()
    const amount = Number(tradeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setTradeSubmitError('请输入大于 0 的交易金额')
      return
    }

    setTradeSubmitError('')
    setTradeSubmitting(true)
    try {
      const date = new Date().toISOString().slice(0, 10)
      const actionKey = code ? `${tradeType}_${code}` : `${tradeType}_manual`
      const payload = await saveAction({
        date,
        action_key: actionKey,
        amount,
        done: tradeDone
      })
      const latest = Array.isArray(payload?.actions) ? payload.actions[0] : null
      if (latest) {
        const record = { ...latest, date: payload?.date || date }
        setActionLogs((prev) =>
          [record, ...prev].sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
        )
        setTradeSubmitResult(record)
      } else {
        setTradeSubmitResult(null)
      }
      setTradeAmount('')
      setTradeFundCode('')
      recordMetric('交易入口提交成功', { trade_type: tradeType, amount, done: tradeDone })
    } catch (error) {
      setTradeSubmitError(error?.message || '交易提交失败')
      recordMetric('交易入口提交失败', { trade_type: tradeType })
    } finally {
      setTradeSubmitting(false)
    }
  }

  const handleCreatePlan = async (event) => {
    event.preventDefault()
    const amount = Number(planAmount)
    if (!planName.trim()) {
      setPlanError('请输入计划名称')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPlanError('请输入大于 0 的计划金额')
      return
    }

    setPlanError('')
    setPlanSubmitting(true)
    try {
      const nextPlans = [
        ...dcaPlans,
        {
          id: `plan_${Date.now()}`,
          name: planName.trim(),
          fund_id: planFundCode.trim(),
          amount,
          schedule: planSchedule,
          paused: false,
          created_at: new Date().toISOString()
        }
      ]
      await saveSettingsPatch({ strategy: { dca_plans: nextPlans } })
      setPlanName('')
      setPlanFundCode('')
      setPlanAmount('')
      setPlanSchedule('weekly')
      recordMetric('定投计划创建成功', { schedule: planSchedule, amount })
    } catch (error) {
      setPlanError(error?.message || '定投计划保存失败')
    } finally {
      setPlanSubmitting(false)
    }
  }

  const handleTogglePlan = async (planId) => {
    const nextPlans = dcaPlans.map((item) =>
      String(item.id) === String(planId) ? { ...item, paused: !item.paused } : item
    )
    await saveSettingsPatch({ strategy: { dca_plans: nextPlans } })
  }

  const handlePlanAction = async (plan, done) => {
    const date = new Date().toISOString().slice(0, 10)
    const actionKey = `dca_plan_${plan.id}`
    const payload = await saveAction({
      date,
      action_key: actionKey,
      amount: Number(plan.amount || 0),
      done
    })
    const latest = Array.isArray(payload?.actions) ? payload.actions[0] : null
    if (!latest) return
    const record = { ...latest, date: payload?.date || date }
    setActionLogs((prev) => [record, ...prev].sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || ''))))
  }

  const handleCreateRule = async (event) => {
    event.preventDefault()
    const threshold = Number(ruleThreshold)
    const silentHours = Number(ruleSilentHours)
    if (!ruleName.trim()) {
      setRuleError('请输入规则名称')
      return
    }
    if (!Number.isFinite(threshold)) {
      setRuleError('请输入有效阈值')
      return
    }
    if (!Number.isFinite(silentHours) || silentHours < 0) {
      setRuleError('静默期需为不小于 0 的数字')
      return
    }

    setRuleError('')
    setRuleSubmitting(true)
    try {
      const nextRules = [
        ...reminderRules,
        {
          id: `rule_${Date.now()}`,
          name: ruleName.trim(),
          fund_id: ruleFundCode.trim(),
          metric: 'estimate_pct',
          operator: ruleOperator,
          threshold,
          silent_hours: silentHours,
          enabled: true,
          created_at: new Date().toISOString(),
          reason_template: `当估值 ${ruleOperator} ${threshold}% 时触发提醒`
        }
      ]
      await saveSettingsPatch({ notifications: { rules: nextRules } })
      setRuleName('')
      setRuleFundCode('')
      setRuleThreshold('')
      setRuleSilentHours('24')
      setRuleOperator('<=')
      recordMetric('提醒规则创建成功', { operator: ruleOperator, threshold, silent_hours: silentHours })
    } catch (error) {
      setRuleError(error?.message || '提醒规则保存失败')
    } finally {
      setRuleSubmitting(false)
    }
  }

  const handleToggleRule = async (ruleId) => {
    const nextRules = reminderRules.map((item) =>
      String(item.id) === String(ruleId) ? { ...item, enabled: !item.enabled } : item
    )
    await saveSettingsPatch({ notifications: { rules: nextRules } })
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
        updatedAt={updatedAt}
        confirmState={confirmState}
        coverage={coverage}
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
                <p>
                  {dcaFailedPlans.length > 0
                    ? `有 ${dcaFailedPlans.length} 个定投计划扣款失败，建议优先处理。`
                    : '暂无定投失败待办，保持计划执行即可。'}
                </p>
                <button type="button" className="ghost" onClick={() => setActiveTab(dcaFailedPlans.length > 0 ? 'trade' : 'profile')}>
                  {dcaFailedPlans.length > 0 ? '去处理定投' : '去我的'}
                </button>
              </article>
            </div>
            {searchQuery.trim() && filteredRows.length === 0 && (
              <div className="chart-empty">未匹配到基金：请尝试代码、名称或拼音。</div>
            )}
          </section>
          <section className="panel home-main">
            <div className="section-head">
              <h2>持仓速览</h2>
              <button type="button" className="ghost" onClick={() => setActiveTab('holdings')}>查看全部持仓</button>
            </div>

            <div className="watch-list">
              <article className="watch-item watch-item-head">
                <div>
                  <h3>国内 / 港股</h3>
                  <p>按市值排序（前4）</p>
                </div>
              </article>
              {homeDomesticPreview.length === 0 && <div className="chart-empty">暂无国内 / 港股持仓</div>}
              {homeDomesticPreview.map((row) => (
                <article key={`home-domestic-${row.fund_id}`} className="watch-item">
                  <div>
                    <h3>{row.name}</h3>
                    <p>{row.fund_id} · 市值 {Number(row.market_value_cny || 0).toFixed(2)}</p>
                  </div>
                  <div className="plan-actions">
                    <span className={`watch-profit ${classBySign(row.day_profit_cny)}`}>
                      {formatPercent(row.estimate_pct)}
                    </span>
                    <button type="button" className="ghost" onClick={() => openHoldingFromHome(row.fund_id)}>详情</button>
                  </div>
                </article>
              ))}
            </div>

            <div className="watch-list">
              <article className="watch-item watch-item-head">
                <div>
                  <h3>美股 / 海外</h3>
                  <p>按市值排序（前4）</p>
                </div>
              </article>
              {homeOverseasPreview.length === 0 && <div className="chart-empty">暂无美股 / 海外持仓</div>}
              {homeOverseasPreview.map((row) => (
                <article key={`home-overseas-${row.fund_id}`} className="watch-item">
                  <div>
                    <h3>{row.name}</h3>
                    <p>{row.fund_id} · 市值 {Number(row.market_value_cny || 0).toFixed(2)}</p>
                  </div>
                  <div className="plan-actions">
                    <span className={`watch-profit ${classBySign(row.day_profit_cny)}`}>
                      {formatPercent(row.estimate_pct)}
                    </span>
                    <button type="button" className="ghost" onClick={() => openHoldingFromHome(row.fund_id)}>详情</button>
                  </div>
                </article>
              ))}
            </div>
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
            <span>买入 / 定投 / 赎回 / 转换</span>
          </div>

          <div className="trade-grid">
            {TRADE_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={tradeType === item.key ? 'primary' : 'ghost'}
                onClick={() => {
                  setTradeType(item.key)
                  setTradeSubmitError('')
                  setTradeSubmitResult(null)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form className="trade-form" onSubmit={handleTradeSubmit}>
            <label>
              基金代码（可选）
              <input
                value={tradeFundCode}
                onChange={(event) => setTradeFundCode(event.target.value)}
                placeholder="例如 016453"
                maxLength={16}
              />
            </label>
            <label>
              金额
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={tradeAmount}
                onChange={(event) => setTradeAmount(event.target.value)}
                placeholder="请输入金额"
              />
            </label>
            <label className="trade-check">
              <input type="checkbox" checked={tradeDone} onChange={(event) => setTradeDone(event.target.checked)} />
              提交后标记为已执行
            </label>
            <button type="submit" className="primary" disabled={tradeSubmitting}>
              {tradeSubmitting ? '提交中...' : `提交${TRADE_TYPES.find((item) => item.key === tradeType)?.label || '交易'}`}
            </button>
          </form>

          {tradeSubmitError && <div className="chart-empty">{tradeSubmitError}</div>}
          {tradeSubmitResult && (
            <div className="trade-result">
              <strong>交易提交成功</strong>
              <p>动作：{tradeSubmitResult.action_key}</p>
              <p>金额：{Number(tradeSubmitResult.amount || 0).toFixed(2)}</p>
              <p>状态：{tradeSubmitResult.done ? '已执行' : '未执行'}</p>
            </div>
          )}
          <p className="trade-tip">已打通买入/定投/赎回/转换入口，提交后写入执行记录并在下方列表回显。</p>

          <div className="section-head trade-head">
            <h3>定投多计划</h3>
            <span>{`共 ${dcaPlans.length} 个计划，失败待办 ${dcaFailedPlans.length} 个`}</span>
          </div>
          <form className="trade-form dca-plan-form" onSubmit={handleCreatePlan}>
            <label>
              计划名称
              <input
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="例如：纳指周定投"
                maxLength={40}
              />
            </label>
            <label>
              基金代码（可选）
              <input
                value={planFundCode}
                onChange={(event) => setPlanFundCode(event.target.value)}
                placeholder="例如 016533"
                maxLength={16}
              />
            </label>
            <label>
              每期金额
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={planAmount}
                onChange={(event) => setPlanAmount(event.target.value)}
                placeholder="请输入金额"
              />
            </label>
            <label>
              扣款频率
              <select value={planSchedule} onChange={(event) => setPlanSchedule(event.target.value)}>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </label>
            <button type="submit" className="primary" disabled={planSubmitting}>
              {planSubmitting ? '保存中...' : '新增计划'}
            </button>
          </form>
          {planError && <div className="chart-empty">{planError}</div>}
          {dcaPlans.length === 0 && <div className="chart-empty">暂无定投计划，请先新增。</div>}
          {dcaPlans.length > 0 && (
            <div className="plan-list">
              {dcaPlans.map((plan) => {
                const failed = dcaStatusMap[String(plan.id)] === 'failed'
                return (
                  <article key={plan.id} className="plan-item">
                    <div>
                      <h4>{plan.name}</h4>
                      <p>
                        代码：{plan.fund_id || '--'} ｜ 频率：{plan.schedule} ｜ 金额：{Number(plan.amount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="plan-actions">
                      <span className={failed ? 'record-pending' : 'record-done'}>
                        {failed ? '失败待办' : '状态正常'}
                      </span>
                      <button type="button" className="ghost" onClick={() => handleTogglePlan(plan.id)}>
                        {plan.paused ? '恢复' : '暂停'}
                      </button>
                      <button type="button" className="ghost" onClick={() => handlePlanAction(plan, false)}>
                        记录失败
                      </button>
                      <button type="button" className="primary" onClick={() => handlePlanAction(plan, true)}>
                        标记补扣
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

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

          <div className="section-head trade-head">
            <h3>组件状态样例页</h3>
            <span>默认 / 悬浮 / 禁用 / 加载 / 错误</span>
          </div>
          <StateShowcase />

          <div className="section-head trade-head">
            <h3>提醒规则中心</h3>
            <span>{`阈值规则 ${reminderRules.length} 条，已触发 ${reminderRuleStates.filter((item) => item.hit).length} 条`}</span>
          </div>
          <form className="trade-form reminder-form" onSubmit={handleCreateRule}>
            <label>
              规则名称
              <input
                value={ruleName}
                onChange={(event) => setRuleName(event.target.value)}
                placeholder="例如：纳指回撤提醒"
                maxLength={40}
              />
            </label>
            <label>
              基金代码（可选）
              <input
                value={ruleFundCode}
                onChange={(event) => setRuleFundCode(event.target.value)}
                placeholder="留空表示全持仓"
                maxLength={16}
              />
            </label>
            <label>
              触发条件
              <select value={ruleOperator} onChange={(event) => setRuleOperator(event.target.value)}>
                <option value="<=">小于等于阈值</option>
                <option value=">=">大于等于阈值</option>
              </select>
            </label>
            <label>
              阈值（%）
              <input
                type="number"
                step="0.01"
                value={ruleThreshold}
                onChange={(event) => setRuleThreshold(event.target.value)}
                placeholder="例如 -1.5"
              />
            </label>
            <label>
              静默期（小时）
              <input
                type="number"
                min="0"
                step="1"
                value={ruleSilentHours}
                onChange={(event) => setRuleSilentHours(event.target.value)}
              />
            </label>
            <button type="submit" className="primary" disabled={ruleSubmitting}>
              {ruleSubmitting ? '保存中...' : '新增提醒'}
            </button>
          </form>
          {ruleError && <div className="chart-empty">{ruleError}</div>}
          {reminderRuleStates.length === 0 && <div className="chart-empty">暂无提醒规则，请先新增阈值规则。</div>}
          {reminderRuleStates.length > 0 && (
            <div className="plan-list">
              {reminderRuleStates.map((rule) => (
                <article key={rule.id} className="plan-item">
                  <div>
                    <h4>{rule.name}</h4>
                    <p>
                      作用范围：{rule.fund_id || '全持仓'}（{rule.scopeCount}） ｜ 规则：估值 {rule.operator} {Number(rule.threshold).toFixed(2)}%
                    </p>
                    <p>
                      触发说明：{rule.reason_template} ｜ 当前值：{rule.currentValue == null ? '--' : `${Number(rule.currentValue).toFixed(2)}%`} ｜ 静默期：{rule.silent_hours} 小时
                    </p>
                  </div>
                  <div className="plan-actions">
                    <span className={rule.hit ? 'record-pending' : 'record-done'}>
                      {rule.hit ? '已触发' : '未触发'}
                    </span>
                    <button type="button" className="ghost" onClick={() => handleToggleRule(rule.id)}>
                      {rule.enabled ? '暂停' : '启用'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
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
