import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchEstimate, fetchRiskOverview, fetchSettings, saveSettings, updateHolding } from '../api.js'
import { formatDateTime } from '../utils/format.js'
import { normalizeFundRows, sortRows } from '../utils/holdings.js'

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
      report_time: '15:10'
    },
    email: {
      enabled: false,
      smtp_host: '',
      smtp_port: 587,
      sender: '',
      recipients: '',
      use_tls: true
    }
  }
}

function mergeDeep(base, incoming) {
  const result = { ...base }
  if (!incoming || typeof incoming !== 'object') return result
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object') {
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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsReady, setSettingsReady] = useState(false)
  const loadingRef = useRef(false)

  const refresh = useCallback(async ({ silent = false, auto = false } = {}) => {
    if (!user) return
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    if (!silent) {
      setStatus({ type: 'info', message: auto ? '自动刷新中...' : '正在刷新数据...' })
    }

    try {
      const payload = await fetchEstimate()
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
      setLastRefresh(formatDateTime())

      const failedCount = normalized.filter((item) => item.status !== 'ok').length

      try {
        const risk = await fetchRiskOverview()
        setRiskOverview(risk)
      } catch (error) {
        setStatus({ type: 'warning', message: `持仓已刷新，风险中枢加载失败：${error.message}` })
        return
      }

      if (failedCount > 0) {
        setStatus({ type: 'warning', message: `刷新完成：${failedCount} 只基金估值异常` })
      } else {
        setStatus({ type: 'success', message: auto ? '自动刷新成功' : '刷新成功' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || '刷新失败' })
    } finally {
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
      setStatus({ type: 'error', message: error?.message || '自动刷新设置保存失败' })
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
      setStatus({ type: 'error', message: error?.message || '设置保存失败' })
      return false
    }
  }, [settings])

  const saveHolding = useCallback(async (fundId, payload) => {
    try {
      const response = await updateHolding(fundId, payload)
      const updated = response?.holding
      if (!updated) {
        throw new Error('后端未返回更新后的持仓')
      }
      setRows((prev) => prev.map((item) => {
        if (item.fund_id !== fundId) return item
        const merged = { ...item, ...normalizeFundRows([updated])[0] }
        return merged
      }))
      setStatus({ type: 'success', message: `已更新 ${fundId} 持仓` })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || '持仓更新失败' })
      return false
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
    settings,
    refresh,
    setAutoRefreshEnabled,
    saveSettingsPatch,
    saveHolding
  }
}
