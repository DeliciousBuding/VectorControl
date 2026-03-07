import { StatusPill } from './StatusPill.jsx'
import {
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  LogoutOutlined,
  PauseOutlined,
  SyncOutlined,
  UserOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  PieChartOutlined,
  DashboardOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { useState, useRef, useEffect } from 'react'

function formatClock(value) {
  if (!value || value === '--') return '--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function InlineRow({ icon: Icon, label, value, children }) {
  return (
    <div className="vc-status-row">
      <div className="vc-status-inline">
        {Icon ? <Icon className="vc-status-icon" /> : null}
        <span>{label}</span>
      </div>
      {children || <span className="vc-status-value">{value}</span>}
    </div>
  )
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
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAdvancedStatus, setShowAdvancedStatus] = useState(false)
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false)
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)
  const statusRef = useRef(null)

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
    ? '快照直出'
    : incrementalTotal > 0
      ? `复用 ${Number(incrementalReusedQuotes || 0)}/${incrementalTotal}`
      : '未复用'

  const statusBadgeClass = status?.type === 'error'
    ? 'vc-badge-dot--error'
    : status?.type === 'warning'
      ? 'vc-badge-dot--warning'
      : 'vc-badge-dot--processing'

  const statusTagClass = confirmState === 'confirmed'
    ? 'status-success'
    : confirmState === 'partial'
      ? 'status-warning'
      : 'status-info'

  useEffect(() => {
    const hasSuggestions = suggestions.length > 0 && searchQuery
    setShowSuggestions(hasSuggestions)
  }, [suggestions, searchQuery])

  useEffect(() => {
    const handleClickOutside = (event) => {
      const searchTarget = searchRef.current && searchRef.current.contains(event.target)
      const dropdownTarget = dropdownRef.current && dropdownRef.current.contains(event.target)
      const statusTarget = statusRef.current && statusRef.current.contains(event.target)

      if (!searchTarget && !dropdownTarget) {
        setShowSuggestions(false)
      }
      if (!statusTarget) {
        setStatusPopoverOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSuggestionClick = (item) => {
    onPickSuggestion(item)
    onSearchChange('')
    setShowSuggestions(false)
  }

  const handleClearSearch = () => {
    onSearchChange('')
    setShowSuggestions(false)
  }

  return (
    <header className="top-header">
      <div className="vc-header-main-row">
        <div className="vc-brand-section">
          <div className="vc-brand-logo">
            <span className="vc-brand-logo__text">VC</span>
          </div>
          <div className="vc-brand-text">
            <h1 className="vc-brand-text__title">持仓决策台</h1>
            <span className="vc-brand-text__subtitle">基金持仓与当日收益一屏掌握</span>
          </div>
        </div>

        <div className="vc-actions-section">
          <div
            ref={searchRef}
            className={`vc-search-wrapper ${isSearchFocused ? 'vc-search-wrapper--focused' : ''} ${showSuggestions ? 'vc-search-wrapper--has-suggestions' : ''}`}
          >
            <div className="vc-search-input-container">
              <SearchOutlined className="vc-search-icon" />
              <input
                type="text"
                className="vc-search-input"
                placeholder="搜索基金代码/名称"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery && suggestions.length > 0) {
                    handleSuggestionClick(suggestions[0])
                  }
                }}
              />
              {searchLoading && <SyncOutlined spin className="vc-search-loading" />}
              {searchQuery && !searchLoading && (
                <button
                  type="button"
                  className="vc-search-clear"
                  onClick={handleClearSearch}
                  aria-label="清除搜索"
                >
                  <CloseCircleOutlined />
                </button>
              )}
              <button
                type="button"
                className="vc-search-button"
                onClick={() => {
                  if (searchQuery && suggestions.length > 0) {
                    handleSuggestionClick(suggestions[0])
                  }
                }}
              >
                搜索
              </button>
            </div>

            {showSuggestions && (
              <div ref={dropdownRef} className="vc-search-dropdown">
                <div className="vc-search-dropdown__header">
                  <span>搜索建议</span>
                  <span className="vc-search-dropdown__count">{suggestions.length} 个结果</span>
                </div>
                <div className="vc-search-dropdown__list">
                  {suggestions.map((item, index) => (
                    <div
                      key={item.fund_id}
                      className="vc-suggest-item"
                      onClick={() => handleSuggestionClick(item)}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="vc-suggest-item__info">
                        <span className="vc-suggest-item__name">{item.name}</span>
                        <span className="vc-suggest-item__meta">{item.fund_id}</span>
                      </div>
                      <SearchOutlined className="vc-suggest-item__icon" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="vc-toolbar-actions">
            <span className="vc-user-tag" title={`当前用户: ${user?.username || '--'}`}>
              <UserOutlined />
              <span>{user?.username || '--'}</span>
            </span>

            <div className="vc-btn-group vc-btn-group--refresh">
              <button
                type="button"
                className="vc-toolbar-btn vc-toolbar-btn--refresh"
                onClick={onRefresh}
                title="刷新数据"
                disabled={refreshing}
              >
                {refreshing ? <SyncOutlined spin /> : <ReloadOutlined />}
              </button>
              <button
                type="button"
                className={`vc-toolbar-btn vc-toolbar-btn--toggle ${autoRefreshEnabled ? 'vc-toolbar-btn--active' : ''}`}
                onClick={onToggleAutoRefresh}
                title={autoRefreshEnabled ? '关闭自动刷新' : '开启自动刷新'}
              >
                {autoRefreshEnabled ? <SyncOutlined /> : <PauseOutlined />}
              </button>
            </div>

            <div ref={statusRef} className="vc-status-popover-anchor">
              <button
                type="button"
                className="vc-toolbar-btn vc-toolbar-btn--status"
                onClick={() => setStatusPopoverOpen((value) => !value)}
              >
                <span className={`vc-badge-dot ${statusBadgeClass}`} />
                <DashboardOutlined />
                <span>状态</span>
              </button>

              {statusPopoverOpen && (
                <div className="vc-status-popover">
                  <div className="vc-popover-title">系统状态看板</div>
                  <div className="vc-status-popover-content">
                    <div className="vc-status-section">
                      <div className="vc-status-label">系统状态</div>
                      <StatusPill status={status} />
                    </div>

                    <div className="vc-status-section">
                      <div className="vc-status-label">数据时效</div>
                      <div className="vc-status-stack">
                        <InlineRow icon={ClockCircleOutlined} label="上次刷新">
                          <span className="vc-status-value">
                            {refreshClock}
                            <span className="vc-status-unit">({refreshElapsedMs}ms)</span>
                          </span>
                        </InlineRow>
                        <InlineRow icon={CheckCircleOutlined} label="数据时点" value={asofClock} />
                        <InlineRow icon={InfoCircleOutlined} label="结算状态">
                          <span className={`status-pill ${statusTagClass} vc-status-tag`}>{confirmText}</span>
                        </InlineRow>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--vc-border-primary)',
                        cursor: 'pointer'
                      }}
                      onClick={() => setShowAdvancedStatus(!showAdvancedStatus)}
                    >
                      <span style={{ color: 'var(--vc-text-secondary)', fontSize: 12 }}>
                        {showAdvancedStatus ? '收起高级信息' : '展开高级信息'}
                      </span>
                    </div>

                    {showAdvancedStatus && (
                      <>
                        <div className="vc-status-section" style={{ marginTop: 12 }}>
                          <div className="vc-status-label">计算指标</div>
                          <div className="vc-status-stack">
                            <InlineRow icon={CloudServerOutlined} label="数据来源" value={estimateCacheHit ? '缓存快照' : '实时拉取'} />
                            <InlineRow
                              icon={DatabaseOutlined}
                              label="计算模式"
                              value={`${incrementalMode === 'snapshot_hit' ? 'Hit' : 'Calc'} (${incrementalText})`}
                            />
                            <InlineRow
                              icon={PieChartOutlined}
                              label="覆盖率"
                              value={`${coverage?.ok ?? 0}/${coverage?.total ?? 0}`}
                            />
                          </div>
                        </div>

                        <div className="vc-status-section">
                          <div className="vc-status-label">口径说明</div>
                          <div className="vc-status-stack">
                            <InlineRow label="数据口径" value={dataStatusText} />
                            {dataStatusNote && <div className="vc-status-note">{dataStatusNote}</div>}
                          </div>
                        </div>
                      </>
                    )}

                    {marketDataHint && <div className="vc-status-hint">{marketDataHint}</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="vc-btn-group vc-btn-group--actions">
              <button
                type="button"
                className="vc-toolbar-btn vc-toolbar-btn--settings"
                title="设置中心"
                onClick={onOpenSettings}
              >
                <SettingOutlined />
              </button>
              <button
                type="button"
                className="vc-toolbar-btn vc-toolbar-btn--logout"
                title="退出登录"
                onClick={onLogout}
              >
                <LogoutOutlined />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
