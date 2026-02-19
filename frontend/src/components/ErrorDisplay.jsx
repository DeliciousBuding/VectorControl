import { Button, Space } from 'antd'
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons'

/**
 * 错误展示组件 - 带重试按钮
 */
export function ErrorDisplay({
  error,
  onRetry,
  message,
  tip = '点击重试'
}) {
  const errorMessage = error?.message || message || '加载失败'
  const isNetworkError = error?.message?.includes('network') ||
    error?.message?.includes('fetch') ||
    error?.message?.includes('连接')

  return (
    <div style={{
      padding: '24px',
      textAlign: 'center',
      color: 'var(--vc-text-secondary)'
    }}>
      <WarningOutlined style={{ fontSize: 24, color: 'var(--vc-warning-500)', marginBottom: 12 }} />
      <div style={{ marginBottom: 8, color: 'var(--vc-text-primary)' }}>{errorMessage}</div>
      {isNetworkError && (
        <div style={{ fontSize: 12, marginBottom: 16, color: 'var(--vc-text-tertiary)' }}>
          网络连接不稳定，请检查网络后重试
        </div>
      )}
      {onRetry && (
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={onRetry}
          loading={false}
        >
          {tip}
        </Button>
      )}
    </div>
  )
}

/**
 * 空状态组件 - 带主动作按钮
 */
export function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction
}) {
  return (
    <div style={{
      padding: '40px 24px',
      textAlign: 'center'
    }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>{icon}</div>}
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>{title}</div>
      {description && (
        <div style={{ color: 'var(--vc-text-secondary)', marginBottom: 16 }}>
          {description}
        </div>
      )}
      {actionText && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  )
}
