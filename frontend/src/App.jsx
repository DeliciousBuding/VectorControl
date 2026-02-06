import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { usePortfolio } from './hooks/usePortfolio.js'
import { fetchFundSuggest } from './api.js'
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

function App() {
  const [sortState, setSortState] = useState({ key: 'market_value_cny', order: 'desc' })
  const [selectedFundId, setSelectedFundId] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
          <SummaryCards rows={rows} />
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
          <p className="trade-tip">交易详细流程与流水页将按 ROADMAP 持续完善。</p>
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
