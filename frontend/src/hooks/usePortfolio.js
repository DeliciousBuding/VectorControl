import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createHolding as createHoldingApi,
  fetchEstimate,
  fetchSettings,
  saveSettings,
  sendFeishuTestMessage as sendFeishuTestMessageApi,
  sendTelegramTestMessage as sendTelegramTestMessageApi,
  updateFeishuWebhookCredential as updateFeishuWebhookCredentialApi,
  updateTelegramCredential as updateTelegramCredentialApi,
  updateHolding
} from '../api.js'
import { formatDateTime } from '../utils/format.js'
import { normalizeFundRows, sortRows } from '../utils/holdings.js'
import { toGuidedError } from '../utils/errorFeedback.js'

const DEFAULT_SETTINGS = {
  display: {
    auto_refresh_enabled: true,
    auto_refresh_seconds: 60,
    auto_refresh_visible_only: true
  },
  notifications: {
    feishu: {
      enabled: false,
      webhook_url: '',
      advice_time: '14:50',
      report_time: '15:10',
      timeout_seconds: 3,
      retry_times: 2,
      template: 'title_content_metadata'
    },
    telegram: {
      enabled: false,
      bot_token: '',
      chat_id: '',
      parse_mode: '',
      disable_web_page_preview: true,
      timeout_seconds: 3,
      retry_times: 2
    },
    email: {
      enabled: false,
      smtp_host: '',
      smtp_port: 587,
      sender: '',
      recipients: '',
      use_tls: true
    }
  },
  network_benchmark: {
    default_profile: 'cn_fund',
    timeout_seconds: 6,
    last_run_at: '',
    last_result: null
  }
}

function mergeDeep(base, incoming) {
  const result = { ...base }
  if (!incoming || typeof incoming !== 'object') return result
  for (const [key, value] of Object.entries(incoming)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object'
    ) {
      result[key] = mergeDeep(result[key], value)
    } else {
      result[key] = value
    }
  }
  return result
}

export function usePortfolio({ user, sorter }) {
  const [rows, setRows] = useState([])
  const [riskOverview, setRiskOverview] = useState(null)
  const [status, setStatus] = useState({ type: 'info', message: '请先登录' })
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState('--')
  const [asof, setAsof] = useState('--')
  const [updatedAt, setUpdatedAt] = useState('--')
  const [confirmState, setConfirmState] = useState('estimated')
  const [coverage, setCoverage] = useState({ total: 0, ok: 0, failed: 0 })
  const [refreshElapsedMs, setRefreshElapsedMs] = useState(0)
  const [estimateCacheHit, setEstimateCacheHit] = useState(false)
  const [incrementalMode, setIncrementalMode] = useState('full_refresh')
  const [incrementalReusedQuotes, setIncrementalReusedQuotes] = useState(0)
  const [incrementalFetchedQuotes, setIncrementalFetchedQuotes] = useState(0)
  const [estimateDataStatus, setEstimateDataStatus] = useState({
    status: 'estimating',
    asof: '',
    note: '等待估值刷新'
  })
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsReady, setSettingsReady] = useState(false)
  const loadingRef = useRef(false)

  const refresh = useCallback(async ({ silent = false, auto = false } = {}) => {
    if (!user) return
    if (loadingRef.current) return

    const refreshStarted = performance.now()
    loadingRef.current = true
    setLoading(true)

    if (!silent) {
      setStatus({ type: 'info', message: auto ? '自动刷新中...' : '正在刷新数据...' })
    }

    try {
      const payload = await fetchEstimate({ preferCached: true, forceRefresh: false })
      if (!Array.isArray(payload?.funds)) {
        throw new Error('估值接口返回格式异常')
      }

      const normalized = normalizeFundRows(payload.funds)
      setRows(normalized)
      setAsof(payload?.as_of || payload?.asof || '--')
      setUpdatedAt(payload?.updated_at || '--')
      setConfirmState(payload?.confirm_state || 'estimated')
      setCoverage({
        total: Number(payload?.coverage?.total || normalized.length || 0),
        ok: Number(payload?.coverage?.ok || normalized.filter((item) => item.status === 'ok').length || 0),
        failed: Number(payload?.coverage?.failed || 0)
      })
      setEstimateCacheHit(Boolean(payload?.cache_hit))
      setIncrementalMode(String(payload?.incremental_mode || 'full_refresh'))
      setIncrementalReusedQuotes(Number(payload?.incremental_reused_quotes || 0))
      setIncrementalFetchedQuotes(Number(payload?.incremental_fetched_quotes || 0))
      setEstimateDataStatus(
        payload?.data_status && typeof payload.data_status === 'object'
          ? payload.data_status
          : {
              status: payload?.confirm_state === 'confirmed' ? 'confirmed' : 'estimating',
              asof: payload?.asof || payload?.as_of || '',
              note: '估值口径由后端返回'
            }
      )
      setLastRefresh(formatDateTime())
      setRiskOverview(payload?.risk_overview && typeof payload.risk_overview === 'object' ? payload.risk_overview : null)

      const failedCount = normalized.filter((item) => item.status !== 'ok').length

      if (failedCount > 0) {
        setStatus({ type: 'warning', message: `刷新完成，${failedCount} 只基金估值异常` })
      } else {
        setStatus({ type: 'success', message: auto ? '自动刷新成功' : '刷新成功' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'estimate_refresh', '刷新失败') })
    } finally {
      setRefreshElapsedMs(Math.max(0, Math.round(performance.now() - refreshStarted)))
      loadingRef.current = false
      setLoading(false)
    }
  }, [user])

  const loadSettings = useCallback(async () => {
    if (!user) return DEFAULT_SETTINGS
    try {
      const payload = await fetchSettings()
      const merged = mergeDeep(DEFAULT_SETTINGS, payload?.settings || {})
      setSettings(merged)
      return merged
    } catch {
      setSettings(DEFAULT_SETTINGS)
      return DEFAULT_SETTINGS
    } finally {
      setSettingsReady(true)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setRows([])
      setRiskOverview(null)
      setLastRefresh('--')
      setAsof('--')
      setUpdatedAt('--')
      setConfirmState('estimated')
      setCoverage({ total: 0, ok: 0, failed: 0 })
      setRefreshElapsedMs(0)
      setEstimateCacheHit(false)
      setIncrementalMode('full_refresh')
      setIncrementalReusedQuotes(0)
      setIncrementalFetchedQuotes(0)
      setEstimateDataStatus({
        status: 'estimating',
        asof: '',
        note: '请先登录后再刷新估值'
      })
      setSettingsReady(false)
      setSettings(DEFAULT_SETTINGS)
      setStatus({ type: 'info', message: '请先登录' })
      return
    }

    ;(async () => {
      await loadSettings()
      await refresh()
    })()
  }, [user, refresh, loadSettings])

  useEffect(() => {
    if (!user || !settingsReady) return undefined
    if (!settings.display.auto_refresh_enabled) return undefined

    const raw = Number(settings.display.auto_refresh_seconds)
    const seconds = Number.isFinite(raw) ? Math.min(600, Math.max(15, Math.round(raw))) : 60

    const timer = window.setInterval(() => {
      if (settings.display.auto_refresh_visible_only && document.visibilityState !== 'visible') {
        return
      }
      void refresh({ silent: true, auto: true })
    }, seconds * 1000)

    return () => window.clearInterval(timer)
  }, [refresh, settings, settingsReady, user])

  const setAutoRefreshEnabled = useCallback(async (enabled) => {
    const next = mergeDeep(settings, { display: { auto_refresh_enabled: enabled } })
    setSettings(next)
    try {
      await saveSettings({ settings: next })
      setStatus({ type: 'success', message: enabled ? '已开启自动刷新' : '已关闭自动刷新' })
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', '自动刷新设置保存失败') })
    }
  }, [settings])

  const saveSettingsPatch = useCallback(async (patch) => {
    const next = mergeDeep(settings, patch)
    setSettings(next)
    try {
      await saveSettings({ settings: next })
      setStatus({ type: 'success', message: '设置已保存' })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', '设置保存失败') })
      return false
    }
  }, [settings])

  const updateFeishuWebhookCredential = useCallback(async (webhookUrl) => {
    const nextWebhook = String(webhookUrl || '').trim()
    if (!nextWebhook) {
      setStatus({ type: 'error', message: '飞书 webhook 不能为空' })
      return false
    }

    try {
      await updateFeishuWebhookCredentialApi({ webhook_url: nextWebhook })
      setSettings((prev) => mergeDeep(prev, {
        notifications: {
          feishu: {
            webhook_url: nextWebhook
          }
        }
      }))
      setStatus({ type: 'success', message: '飞书 webhook 已更新' })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', '飞书 webhook 更新失败') })
      return false
    }
  }, [])

  const updateTelegramCredential = useCallback(async (botToken, chatId) => {
    const nextBotToken = String(botToken || '').trim()
    const nextChatId = String(chatId || '').trim()
    if (!nextBotToken || !nextChatId) {
      setStatus({ type: 'error', message: 'Telegram 凭据缺失：bot_token 与 chat_id 均不能为空' })
      return false
    }

    try {
      await updateTelegramCredentialApi({ bot_token: nextBotToken, chat_id: nextChatId })
      setSettings((prev) => mergeDeep(prev, {
        notifications: {
          telegram: {
            bot_token: nextBotToken,
            chat_id: nextChatId
          }
        }
      }))
      setStatus({ type: 'success', message: 'Telegram 凭据已更新' })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', 'Telegram 凭据更新失败') })
      return false
    }
  }, [])

  const sendTelegramTestMessage = useCallback(async () => {
    try {
      const payload = await sendTelegramTestMessageApi()
      const traceId = String(payload?.trace_id || '').trim()
      const ok = payload?.ok === true && payload?.sent === true

      if (ok) {
        setStatus({
          type: 'success',
          message: `Telegram 测试消息已发送${traceId ? `（trace_id: ${traceId}）` : ''}`
        })
      } else {
        const category = String(payload?.error?.category || '').trim()
        const description = String(payload?.error?.description || payload?.error?.message || '').trim()
        const suffix = [category, description].filter(Boolean).join(' - ')
        setStatus({
          type: 'error',
          message: `Telegram 测试消息发送失败${traceId ? `（trace_id: ${traceId}）` : ''}${suffix ? `：${suffix}` : ''}`
        })
      }

      return payload || null
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', 'Telegram 测试消息发送失败') })
      return null
    }
  }, [])

  const sendFeishuTestMessage = useCallback(async () => {
    try {
      const payload = await sendFeishuTestMessageApi()
      const traceId = String(payload?.trace_id || '').trim()
      const ok = payload?.ok === true && payload?.sent === true

      if (ok) {
        setStatus({
          type: 'success',
          message: `飞书 测试消息已发送${traceId ? `（trace_id: ${traceId}）` : ''}`
        })
      } else {
        const category = String(payload?.error?.category || '').trim()
        const description = String(payload?.error?.description || payload?.error?.message || '').trim()
        const suffix = [category, description].filter(Boolean).join(' - ')
        setStatus({
          type: 'error',
          message: `飞书 测试消息发送失败${traceId ? `（trace_id: ${traceId}）` : ''}${suffix ? `：${suffix}` : ''}`
        })
      }

      return payload || null
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', '飞书 测试消息发送失败') })
      return null
    }
  }, [])

  const saveHolding = useCallback(async (fundId, payload) => {
    try {
      const response = await updateHolding(fundId, payload)
      const updated = response?.holding
      if (!updated) {
        throw new Error('后端未返回更新后的持仓')
      }
      setRows((prev) => prev.map((item) => {
        if (item.fund_id !== fundId) return item
        return { ...item, ...normalizeFundRows([updated])[0] }
      }))
      setStatus({ type: 'success', message: `已更新 ${fundId} 持仓` })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'settings_save', '持仓更新失败') })
      return false
    }
  }, [])

  const createHolding = useCallback(async (payload) => {
    try {
      const response = await createHoldingApi(payload)
      const created = response?.holding
      if (!created) {
        throw new Error('后端未返回新增后的持仓')
      }
      const normalized = normalizeFundRows([created])[0]
      if (!normalized) {
        throw new Error('新增持仓数据格式异常')
      }
      setRows((prev) => {
        const index = prev.findIndex((item) => item.fund_id === normalized.fund_id)
        if (index < 0) {
          return [normalized, ...prev]
        }
        return prev.map((item) => (item.fund_id === normalized.fund_id ? { ...item, ...normalized } : item))
      })
      setStatus({ type: 'success', message: `已新增/覆盖 ${normalized.fund_id} 持仓` })
      return normalized
    } catch (error) {
      setStatus({ type: 'error', message: toGuidedError(error, 'holding_create', '新增持仓失败') })
      return null
    }
  }, [])

  const sortedRows = useMemo(() => sortRows(rows, sorter), [rows, sorter])

  return {
    rows: sortedRows,
    riskOverview,
    status,
    loading,
    lastRefresh,
    asof,
    updatedAt,
    confirmState,
    coverage,
    refreshElapsedMs,
    estimateCacheHit,
    incrementalMode,
    incrementalReusedQuotes,
    incrementalFetchedQuotes,
    estimateDataStatus,
    settings,
    refresh,
    setAutoRefreshEnabled,
    saveSettingsPatch,
    updateFeishuWebhookCredential,
    updateTelegramCredential,
    sendFeishuTestMessage,
    sendTelegramTestMessage,
    saveHolding,
    createHolding
  }
}
