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
  DashboardOutlined
} from '@ant-design/icons'

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

  const statusContent = (
    <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
       <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>系统状态</div>
        <StatusPill status={status} />
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>数据时效</div>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
             <Space><ClockCircleOutlined style={{ color: 'var(--muted)' }} /> 上次刷新</Space>
             <span style={{ fontFamily: 'monospace' }}>{refreshClock} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({refreshElapsedMs}ms)</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
             <Space><CheckCircleOutlined style={{ color: 'var(--muted)' }} /> 数据时点</Space>
             <span style={{ fontFamily: 'monospace' }}>{asofClock}</span>
          </div>
        </Space>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>计算指标</div>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
             <Space><CloudServerOutlined style={{ color: 'var(--muted)' }} /> 数据来源</Space>
             <span>{estimateCacheHit ? '缓存快照' : '实时拉取'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
             <Space><DatabaseOutlined style={{ color: 'var(--muted)' }} /> 计算模式</Space>
             <span>{incrementalMode === 'snapshot_hit' ? 'Hit' : 'Calc'} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({incrementalText})</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
             <Space><PieChartOutlined style={{ color: 'var(--muted)' }} /> 覆盖率</Space>
             <span style={{ fontFamily: 'monospace' }}>{coverage?.ok ?? 0}/{coverage?.total ?? 0}</span>
          </div>
        </Space>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>口径说明</div>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {confirmState && (
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span>结算状态</span>
              <Tag color={confirmState === 'confirmed' ? 'success' : confirmState === 'partial' ? 'warning' : 'processing'} bordered={false} style={{ margin: 0 }}>
                {confirmText}
              </Tag>
            </div>
          )}
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <Space><InfoCircleOutlined style={{ color: 'var(--muted)' }} /> 数据口径</Space>
              <span>{dataStatusText}</span>
           </div>
           {dataStatusNote && (
             <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg-secondary)', padding: 6, borderRadius: 4, marginTop: 4 }}>
               {dataStatusNote}
             </div>
           )}
        </Space>
      </div>

      {marketDataHint && (
        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 8, fontSize: 12, color: 'var(--muted)' }}>
          {marketDataHint}
        </div>
      )}
    </div>
  )

  return (
    <Header className="top-header">
      <div className="header-main-row">
        <div className="brand-section">
          <div className="brand-logo">
            VC
          </div>
          <div className="brand-text">
            <Title level={4}>持仓决策台</Title>
            <Text type="secondary">基金持仓与当日收益一屏掌握</Text>
          </div>
        </div>

        <div className="actions-section">
          <Search
            className="toolbar-search"
            placeholder="搜索基金代码/名称"
            allowClear
            enterButton="搜索"
            size="large"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onSearch={(value) => {
              if (value && suggestions.length > 0) {
                onPickSuggestion(suggestions[0])
              }
            }}
            loading={searchLoading}
            style={{ width: 320 }}
          />
          {(suggestions.length > 0 && searchQuery) && (
            <div className="toolbar-suggest-dropdown">
              {suggestions.map((item) => (
                <div
                  key={item.fund_id}
                  className="suggest-dropdown-item"
                  onClick={() => {
                    onPickSuggestion(item)
                    onSearchChange('')
                  }}
                >
                  <span className="suggest-name">{item.name}</span>
                  <span className="suggest-code">{item.fund_id}</span>
                </div>
              ))}
            </div>
          )}

          <Space size={12}>
            <Tooltip title={`当前用户: ${user?.username || '--'}`}>
              <Tag icon={<UserOutlined />} color="blue" style={{ margin: 0, padding: '4px 10px', fontSize: 13 }}>
                {user?.username || '--'}
              </Tag>
            </Tooltip>
            
            <Space.Compact>
              <Tooltip title="刷新数据">
                <Button 
                  icon={refreshing ? <SyncOutlined spin /> : <ReloadOutlined />} 
                  onClick={onRefresh} 
                  loading={refreshing}
                />
              </Tooltip>
              <Tooltip title={autoRefreshEnabled ? '关闭自动刷新' : '开启自动刷新'}>
                <Button 
                  icon={autoRefreshEnabled ? <SyncOutlined /> : <PauseOutlined />} 
                  onClick={onToggleAutoRefresh}
                  type={autoRefreshEnabled ? 'primary' : 'default'}
                />
              </Tooltip>
            </Space.Compact>

            <Popover 
              content={statusContent} 
              title={
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>系统状态看板</span>
                </div>
              } 
              trigger="click" 
              placement="bottomRight"
            >
              <Badge dot status={statusBadge} offset={[-4, 4]}>
                <Button icon={<DashboardOutlined />}>状态</Button>
              </Badge>
            </Popover>

            <Space.Compact>
              <Tooltip title="设置中心">
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={onOpenSettings}
                />
              </Tooltip>
              <Tooltip title="退出登录">
                <Button 
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
