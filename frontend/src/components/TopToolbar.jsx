import { StatusPill } from './StatusPill.jsx'
import { Layout, Input, Button, Space, Typography, Badge, Tag } from 'antd'
import { SearchOutlined, ReloadOutlined, SettingOutlined, LogoutOutlined, PauseOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons'

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

  return (
    <Header style={{ 
      padding: '16px 20px', 
      background: 'var(--panel)', 
      border: '1px solid var(--line)', 
      borderRadius: 18,
      boxShadow: 'var(--shadow)',
      marginBottom: 14,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 20,
      flexWrap: 'wrap'
    }}>
      <div className="brand-block" style={{ 
        display: 'flex', 
        gap: 12, 
        alignItems: 'center', 
        flexShrink: 0 
      }}>
        <div className="logo" style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(140deg, #4361ee, #3a0ca3)',
          color: '#fff',
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: 20,
          boxShadow: '0 4px 12px rgba(67, 97, 238, 0.3)'
        }}>
          VC
        </div>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 26 }}>持仓决策台</Title>
          <Text type="secondary" style={{ fontSize: 15, margin: '2px 0 0', display: 'block' }}>
            基金持仓与当日收益一屏掌握
          </Text>
        </div>
      </div>

      <div className="toolbar-actions" style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 16, 
        flex: 1, 
        flexWrap: 'wrap' 
      }}>
        <Input.Search
          placeholder="🔍 搜索基金代码/名称/拼音..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onSearch={(value) => {
            if (suggestions.length > 0) {
              onPickSuggestion(suggestions[0])
            }
          }}
          loading={searchLoading}
          style={{ 
            minWidth: min(100, 360), 
            maxWidth: 400,
            borderRadius: 24
          }}
          enterButton={false}
        />
        {(searchLoading || suggestions.length > 0) && (
          <div className="toolbar-suggest" style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0,
            border: '1px solid var(--line)', 
            borderRadius: 12, 
            background: '#fff', 
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)', 
            zIndex: 20, 
            overflow: 'hidden',
            marginTop: 6
          }}>
            {searchLoading && (
              <div style={{ 
                padding: '10px 12px', 
                color: 'var(--muted)',
                fontSize: 13 
              }}>
                正在加载联想...
              </div>
            )}
            {!searchLoading && suggestions.map((item) => (
              <div
                key={item.fund_id}
                style={{
                  width: '100%',
                  borderBottom: '1px solid #edf2fb',
                  background: '#fff',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onClick={() => onPickSuggestion(item)}
              >
                <strong style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</strong>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.fund_id}</span>
              </div>
            ))}
          </div>
        )}

        <Space size={8}>
          <Tag icon={<UserOutlined />} color="blue">
            {user?.username || '--'}
          </Tag>
          <Button 
            icon={refreshing ? <SyncOutlined spin /> : <ReloadOutlined />} 
            onClick={onRefresh} 
            loading={refreshing}
          />
          <Button 
            icon={autoRefreshEnabled ? <SyncOutlined /> : <PauseOutlined />} 
            onClick={onToggleAutoRefresh}
            type={autoRefreshEnabled ? 'primary' : 'default'}
            title={autoRefreshEnabled ? '关闭自动刷新' : '开启自动刷新'}
          />
          <Button 
            icon={<SettingOutlined />} 
            onClick={onOpenSettings}
            title="设置中心"
          />
          <Button 
            danger
            icon={<LogoutOutlined />} 
            onClick={onLogout}
            title="退出登录"
          />
        </Space>
      </div>

      <div className="toolbar-meta-bar" style={{ 
        width: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 12, 
        padding: '10px 16px', 
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
        borderRadius: 12, 
        marginTop: 4, 
        fontSize: 13, 
        color: 'var(--muted)' 
      }}>
        <StatusPill status={status} />
        <Text type="secondary">上次刷新：{refreshClock}</Text>
        <Text type="secondary">数据时点：{asofClock}</Text>
        <Text type="secondary">刷新用时：{refreshElapsedMs > 0 ? `${refreshElapsedMs} ms` : '--'}</Text>
        <Text type="secondary">数据来源：{estimateCacheHit ? '缓存快照' : '实时拉取'}</Text>
        <Tag>{incrementalText}</Tag>
        <Tag color={confirmState === 'confirmed' ? 'green' : confirmState === 'partial' ? 'orange' : 'blue'}>
          {confirmText}
        </Tag>
        <Text type="secondary">覆盖率：{coverage?.ok ?? 0}/{coverage?.total ?? 0}</Text>
        <Text type="secondary" title={dataStatusNote || '暂无说明'}>
          口径：{dataStatusText}
        </Text>
        <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {marketDataHint}
        </Text>
      </div>
    </Header>
  )
}
