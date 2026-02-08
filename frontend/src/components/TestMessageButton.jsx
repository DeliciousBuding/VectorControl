import { useState } from 'react'
import { toGuidedError } from '../utils/errorFeedback.js'

function buildToast(label, payload) {
  const traceId = String(payload?.trace_id || '').trim()
  const ok = payload?.ok === true && payload?.sent === true
  const category = String(payload?.error?.category || '').trim()
  const message = String(payload?.error?.message || payload?.error?.description || '').trim()
  const suffix = [category, message].filter(Boolean).join(' - ')

  if (ok) {
    return {
      type: 'success',
      message: `${label} 测试消息已发送${traceId ? `（trace_id: ${traceId}）` : ''}`
    }
  }

  return {
    type: 'error',
    message: `${label} 测试消息发送失败${traceId ? `（trace_id: ${traceId}）` : ''}${suffix ? `：${suffix}` : ''}`
  }
}

export function TestMessageButton({
  label,
  onSend,
  onToast,
  afterSend,
  disabled = false,
  disabledReason = '',
  dataTestId = ''
}) {
  const [loading, setLoading] = useState(false)

  const title = disabledReason && disabled ? disabledReason : ''

  const handleClick = async () => {
    if (loading || disabled) return
    if (typeof onSend !== 'function') {
      onToast?.({ type: 'error', message: `${label} 测试消息未接入。下一步：请检查前端回调与后端接口是否已集成。` })
      return
    }

    setLoading(true)
    try {
      const payload = await onSend()
      onToast?.(buildToast(label, payload))
    } catch (error) {
      onToast?.({ type: 'error', message: toGuidedError(error, 'settings_save', `${label} 测试消息发送失败`) })
    } finally {
      setLoading(false)
      if (typeof afterSend === 'function') {
        try {
          await afterSend()
        } catch {
          // 忽略刷新状态失败
        }
      }
    }
  }

  return (
    <button
      type="button"
      className="ghost"
      data-testid={dataTestId || undefined}
      onClick={handleClick}
      disabled={disabled || loading}
      title={title}
    >
      {loading ? '发送中...' : `${label} 发送测试消息`}
    </button>
  )
}

