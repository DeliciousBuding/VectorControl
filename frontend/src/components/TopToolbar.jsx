import { StatusPill } from './StatusPill.jsx'

export function TopToolbar({
  user,
  status,
  refreshing,
  lastRefresh,
  asof,
  updatedAt,
  confirmState,
  searchQuery,
  suggestions,
  searchLoading,
  onSearchChange,
  onPickSuggestion,
  autoRefreshEnabled,
  onRefresh,
  onToggleAutoRefresh,
  onOpenSettings,
  onLogout
}) {
  const confirmText = confirmState === 'confirmed'
    ? '已更新'
    : confirmState === 'partial'
      ? '数据不完整'
      : '估算中'
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
        <div className="toolbar-row">
          <label className="toolbar-search">
            <span>全局搜索</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="输入基金代码/名称/拼音"
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
        </div>
        <div className="toolbar-row">
          <span>当前用户：{user?.username || '--'}</span>
          <button type="button" className="primary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? '刷新中...' : '刷新数据'}
          </button>
          <button type="button" className={autoRefreshEnabled ? 'primary' : 'ghost'} onClick={onToggleAutoRefresh}>
            {autoRefreshEnabled ? '自动刷新：已开启' : '自动刷新：已关闭'}
          </button>
          <button type="button" className="ghost" onClick={onOpenSettings}>设置中心</button>
          <button type="button" className="danger" onClick={onLogout}>退出登录</button>
        </div>
        <div className="toolbar-row">
          <StatusPill status={status} />
          <span>上次刷新：{lastRefresh}</span>
          <span>数据时点：{asof}</span>
          <span>拉取时间：{updatedAt}</span>
          <span>确认状态：{confirmText}</span>
        </div>
      </div>
    </header>
  )
}
