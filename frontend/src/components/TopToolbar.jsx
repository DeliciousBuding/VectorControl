import { StatusPill } from './StatusPill.jsx'

export function TopToolbar({
  user,
  status,
  refreshing,
  lastRefresh,
  asof,
  autoRefreshEnabled,
  onRefresh,
  onToggleAutoRefresh,
  onOpenSettings,
  onLogout
}) {
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
        </div>
      </div>
    </header>
  )
}
