import { StatusPill } from './StatusPill.jsx'

function formatClock(value) {
  if (!value || value === '--') return '--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export function TopToolbar({
  user,
  status,
  refreshing,
  lastRefresh,
  asof,
  confirmState,
  coverage,
  refreshElapsedMs,
  estimateCacheHit,
  incrementalMode,
  incrementalReusedQuotes,
  incrementalFetchedQuotes,
  dataStatus,
  searchQuery,
  suggestions,
  searchLoading,
  onSearchChange,
  onPickSuggestion,
  autoRefreshEnabled,
  onRefresh,
  onToggleAutoRefresh,
  onOpenSettings,
  onLogout,
  marketDataHint
}) {
  const confirmText = confirmState === 'confirmed'
    ? '已结算'
    : confirmState === 'partial'
      ? '部分结算'
      : '估算中'

  const refreshClock = formatClock(lastRefresh)
  const asofClock = formatClock(asof)
  const dataStatusNote = String(dataStatus?.note || '').trim()
  const dataStatusText = dataStatus?.status === 'confirmed'
    ? '已确认'
    : dataStatus?.status === 'partial'
      ? '部分可用'
      : '估算中'
  const incrementalTotal = Number(incrementalReusedQuotes || 0) + Number(incrementalFetchedQuotes || 0)
  const incrementalText = incrementalMode === 'snapshot_hit'
    ? '增量：快照直出'
    : incrementalTotal > 0
      ? `增量：复用 ${Number(incrementalReusedQuotes || 0)}/${incrementalTotal}`
      : '增量：未复用'

  return (
    <header className="panel top-toolbar">
      <div className="brand-block">
        <div className="logo">VC</div>
        <div>
          <h1>持仓决策台</h1>
          <p>基金持仓与当日收益一屏掌握</p>
        </div>
      </div>

      <div className="toolbar-actions">
        <label className="toolbar-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="🔍 搜索基金代码/名称/拼音..."
          />
          {(searchLoading || suggestions.length > 0) && (
            <div className="toolbar-suggest">
              {searchLoading && <div className="suggest-item muted">正在加载联想...</div>}
              {!searchLoading && suggestions.map((item) => (
                <button
                  type="button"
                  key={item.fund_id}
                  className="suggest-item"
                  onClick={() => onPickSuggestion(item)}
                >
                  <strong>{item.name}</strong>
                  <span>{item.fund_id}</span>
                </button>
              ))}
            </div>
          )}
        </label>

        <div className="toolbar-row">
          <span className="toolbar-user">👤 {user?.username || '--'}</span>
          <button type="button" className="primary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? '⏳' : '🔄'}
          </button>
          <button type="button" className={autoRefreshEnabled ? 'primary' : 'ghost'} onClick={onToggleAutoRefresh} title={autoRefreshEnabled ? '关闭自动刷新' : '开启自动刷新'}>
            {autoRefreshEnabled ? '⏱️' : '⏸️'}
          </button>
          <button type="button" className="ghost" onClick={onOpenSettings} title="设置中心">⚙️</button>
          <button type="button" className="danger" onClick={onLogout} title="退出登录">🚪</button>
        </div>
      </div>

      <div className="toolbar-meta-bar">
        <StatusPill status={status} />
        <span>上次刷新：{refreshClock}</span>
        <span>数据时点：{asofClock}</span>
        <span>刷新用时：{refreshElapsedMs > 0 ? `${refreshElapsedMs} ms` : '--'}</span>
        <span>数据来源：{estimateCacheHit ? '缓存快照' : '实时拉取'}</span>
        <span>{incrementalText}</span>
        <span>状态：{confirmText}</span>
        <span>覆盖率：{coverage?.ok ?? 0}/{coverage?.total ?? 0}</span>
        <span className="toolbar-data-status" title={dataStatusNote || '暂无说明'}>
          口径：{dataStatusText}
        </span>
        <div className="toolbar-note">{marketDataHint}</div>
      </div>
    </header>
  )
}
