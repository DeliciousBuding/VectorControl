import { useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { usePortfolio } from './hooks/usePortfolio.js'
import { buildFundSeries, splitMarketGroups } from './utils/chart.js'
import { cycleSortState } from './utils/holdings.js'
import { formatDate } from './utils/format.js'
import { LoginPanel } from './components/LoginPanel.jsx'
import { TopToolbar } from './components/TopToolbar.jsx'
import { SummaryCards } from './components/SummaryCards.jsx'
import { HoldingsTable } from './components/HoldingsTable.jsx'
import { FundDetailPanel } from './components/FundDetailPanel.jsx'
import { RiskCenter } from './components/RiskCenter.jsx'
import { SettingsDrawer } from './components/SettingsDrawer.jsx'

function App() {
  const [sortState, setSortState] = useState({ key: 'market_value_cny', order: 'desc' })
  const [selectedFundId, setSelectedFundId] = useState('')
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

  const { domestic, overseas } = useMemo(() => splitMarketGroups(rows), [rows])

  const currentFund = useMemo(() => {
    if (!rows.length) return null
    const target = rows.find((item) => item.fund_id === selectedFundId)
    return target || rows[0]
  }, [rows, selectedFundId])

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
        autoRefreshEnabled={Boolean(settings.display.auto_refresh_enabled)}
        onRefresh={() => refresh()}
        onToggleAutoRefresh={() => setAutoRefreshEnabled(!settings.display.auto_refresh_enabled)}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={logout}
      />

      <SummaryCards rows={rows} />

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

      <FundDetailPanel fund={currentFund} rows={rows} dateLabel={dateLabel} />

      <RiskCenter risk={riskOverview} />

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
