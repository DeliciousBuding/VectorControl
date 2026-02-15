import { StatusPill } from './StatusPill.jsx'
import { Layout, Button, Space, Typography, Tag, Tooltip, Popover, Badge, Input } from 'antd'
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

const { Search } = Input

const { Header } = Layout
const { Title, Text } = Typography

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
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)

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

  const statusBadge = status?.type === 'error' ? 'error' : (status?.type === 'warning' ? 'warning' : 'processing')

  // 控制下拉框显示/隐藏
  useEffect(() => {
    const hasSuggestions = suggestions.length > 0 && searchQuery
    setShowSuggestions(hasSuggestions && isSearchFocused)
  }, [suggestions, searchQuery, isSearchFocused])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
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

  const statusContent = (
    <div className="vc-status-popover-content">
      <div className="vc-status-section">
        <div className="vc-status-label">系统状态</div>
        <StatusPill status={status} />
      </div>

      <div className="vc-status-section">
        <div className="vc-status-label">数据时效</div>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div className="vc-status-row">
            <Space size={8}>
              <ClockCircleOutlined className="vc-status-icon" />
              <span>上次刷新</span>
            </Space>
            <span className="vc-status-value">
              {refreshClock}
              <span className="vc-status-unit">({refreshElapsedMs}ms)</span>
            </span>
          </div>
          <div className="vc-status-row">
            <Space size={8}>
              <CheckCircleOutlined className="vc-status-icon" />
              <span>数据时点</span>
            </Space>
            <span className="vc-status-value">{asofClock}</span>
          </div>
        </Space>
      </div>

      <div className="vc-status-section">
        <div className="vc-status-label">计算指标</div>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div className="vc-status-row">
            <Space size={8}>
              <CloudServerOutlined className="vc-status-icon" />
              <span>数据来源</span>
            </Space>
            <span>{estimateCacheHit ? '缓存快照' : '实时拉取'}</span>
          </div>
          <div className="vc-status-row">
            <Space size={8}>
              <DatabaseOutlined className="vc-status-icon" />
              <span>计算模式</span>
            </Space>
            <span>
              {incrementalMode === 'snapshot_hit' ? 'Hit' : 'Calc'}
              <span className="vc-status-unit">({incrementalText})</span>
            </span>
          </div>
          <div className="vc-status-row">
            <Space size={8}>
              <PieChartOutlined className="vc-status-icon" />
              <span>覆盖率</span>
            </Space>
            <span className="vc-status-value">{coverage?.ok ?? 0}/{coverage?.total ?? 0}</span>
          </div>
        </Space>
      </div>

      <div className="vc-status-section">
        <div className="vc-status-label">口径说明</div>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {confirmState && (
            <div className="vc-status-row vc-status-row--center">
              <span>结算状态</span>
              <Tag
                color={confirmState === 'confirmed' ? 'success' : confirmState === 'partial' ? 'warning' : 'processing'}
                bordered={false}
                className="vc-status-tag"
              >
                {confirmText}
              </Tag>
            </div>
          )}
          <div className="vc-status-row">
            <Space size={8}>
              <InfoCircleOutlined className="vc-status-icon" />
              <span>数据口径</span>
            </Space>
            <span>{dataStatusText}</span>
          </div>
          {dataStatusNote && (
            <div className="vc-status-note">
              {dataStatusNote}
            </div>
          )}
        </Space>
      </div>

      {marketDataHint && (
        <div className="vc-status-hint">
          {marketDataHint}
        </div>
      )}
    </div>
  )

  return (
    <Header className="top-header">
      <div className="vc-header-main-row">
        {/* 品牌区域 */}
        <div className="vc-brand-section">
          <div className="vc-brand-logo">
            <span className="vc-brand-logo__text">VC</span>
          </div>
          <div className="vc-brand-text">
            <Title level={4} className="vc-brand-text__title">持仓决策台</Title>
            <Text type="secondary" className="vc-brand-text__subtitle">基金持仓与当日收益一屏掌握</Text>
          </div>
        </div>

        {/* 操作区域 */}
        <div className="vc-actions-section">
          {/* 搜索框容器 */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery && suggestions.length > 0) {
                    handleSuggestionClick(suggestions[0])
                  }
                }}
              />
              {searchLoading && (
                <SyncOutlined spin className="vc-search-loading" />
              )}
              {searchQuery && !searchLoading && (
                <button
                  className="vc-search-clear"
                  onClick={handleClearSearch}
                  aria-label="清除搜索"
                >
                  <CloseCircleOutlined />
                </button>
              )}
              <button
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

            {/* 搜索建议下拉框 */}
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

          {/* 按钮组 */}
          <Space size={12} className="vc-toolbar-actions">
            {/* 用户信息标签 */}
            <Tooltip title={`当前用户: ${user?.username || '--'}`}>
              <Tag
                icon={<UserOutlined />}
                color="blue"
                className="vc-user-tag"
              >
                {user?.username || '--'}
              </Tag>
            </Tooltip>

            {/* 刷新按钮组 */}
            <Space.Compact className="vc-btn-group vc-btn-group--refresh">
              <Tooltip title="刷新数据">
                <Button
                  className="vc-toolbar-btn vc-toolbar-btn--refresh"
                  icon={refreshing ? <SyncOutlined spin /> : <ReloadOutlined />}
                  onClick={onRefresh}
                  loading={refreshing}
                />
              </Tooltip>
              <Tooltip title={autoRefreshEnabled ? '关闭自动刷新' : '开启自动刷新'}>
                <Button
                  className={`vc-toolbar-btn vc-toolbar-btn--toggle ${autoRefreshEnabled ? 'vc-toolbar-btn--active' : ''}`}
                  icon={autoRefreshEnabled ? <SyncOutlined /> : <PauseOutlined />}
                  onClick={onToggleAutoRefresh}
                  type={autoRefreshEnabled ? 'primary' : 'default'}
                />
              </Tooltip>
            </Space.Compact>

            {/* 状态看板 */}
            <Popover
              content={statusContent}
              title={<span className="vc-popover-title">系统状态看板</span>}
              trigger="click"
              placement="bottomRight"
              overlayClassName="vc-status-popover"
            >
              <Badge dot status={statusBadge} offset={[-4, 4]}>
                <Button
                  className="vc-toolbar-btn vc-toolbar-btn--status"
                  icon={<DashboardOutlined />}
                >
                  状态
                </Button>
              </Badge>
            </Popover>

            {/* 设置和退出按钮组 */}
            <Space.Compact className="vc-btn-group vc-btn-group--actions">
              <Tooltip title="设置中心">
                <Button
                  className="vc-toolbar-btn vc-toolbar-btn--settings"
                  icon={<SettingOutlined />}
                  onClick={onOpenSettings}
                />
              </Tooltip>
              <Tooltip title="退出登录">
                <Button
                  className="vc-toolbar-btn vc-toolbar-btn--logout"
                  danger
                  icon={<LogoutOutlined />}
                  onClick={onLogout}
                />
              </Tooltip>
            </Space.Compact>
          </Space>
        </div>
      </div>
    </Header>
  )
}
