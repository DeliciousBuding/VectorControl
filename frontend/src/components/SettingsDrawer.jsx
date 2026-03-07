import { useEffect, useState } from 'react'
import {
  createSIPPlan,
  deleteSIPPlan,
  executeSIPPlan,
  fetchHealthz,
  fetchNetworkBenchmarkLatest,
  fetchNotificationsStatus,
  fetchSettingsAuditLogs,
  fetchSIPPlans,
  fetchSystemStatus,
  issueTelegramDiscoverySecret,
  runNetworkBenchmark,
  testAllNotifications,
  updateSIPPlan
} from '../api.js'
import { toGuidedError } from '../utils/errorFeedback.js'
import { assertSettingsSchema } from '../utils/assertSettingsSchema.js'
import { recordMetric } from '../utils/metrics.js'
import { TestMessageButton } from './TestMessageButton.jsx'
import { formatDateTime } from '../utils/format.js'
import { 
  Drawer, Tabs, Form, Input, Switch, Button, 
  Select, Collapse, Timeline, Tag, Space,
  Table, Tooltip, Spin, Alert, message 
} from 'antd'
import {
  SettingOutlined, ExperimentOutlined, BellOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, CopyOutlined, PlayCircleOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined,
  PauseCircleOutlined, CheckOutlined, HistoryOutlined
} from '@ant-design/icons'

const PROFILE_OPTIONS = [
  { value: 'cn_fund', label: '国内基金站点' },
  { value: 'global', label: '国际站点' }
]

const FEISHU_TEMPLATE_OPTIONS = [
  { value: 'title_content_metadata', label: '标题+正文+元数据' },
  { value: 'content_only', label: '仅正文' }
]

const SIP_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '双周' },
  { value: 'monthly', label: '每月' }
]

const SIP_WEEKLY_DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
]

const DEFAULT_DRAWER_SETTINGS = {
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
      recipients: ''
    }
  },
  network_benchmark: {
    default_profile: 'cn_fund',
    timeout_seconds: 6,
    last_run_at: '',
    last_result: null
  }
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeDrawerSettings(source) {
  const root = asPlainObject(source)
  const display = asPlainObject(root.display)
  const notifications = asPlainObject(root.notifications)
  const feishu = asPlainObject(notifications.feishu)
  const telegram = asPlainObject(notifications.telegram)
  const email = asPlainObject(notifications.email)
  const networkBenchmark = asPlainObject(root.network_benchmark)

  return {
    ...DEFAULT_DRAWER_SETTINGS,
    ...root,
    display: {
      ...DEFAULT_DRAWER_SETTINGS.display,
      ...display
    },
    notifications: {
      ...DEFAULT_DRAWER_SETTINGS.notifications,
      ...notifications,
      feishu: {
        ...DEFAULT_DRAWER_SETTINGS.notifications.feishu,
        ...feishu
      },
      telegram: {
        ...DEFAULT_DRAWER_SETTINGS.notifications.telegram,
        ...telegram
      },
      email: {
        ...DEFAULT_DRAWER_SETTINGS.notifications.email,
        ...email
      }
    },
    network_benchmark: {
      ...DEFAULT_DRAWER_SETTINGS.network_benchmark,
      ...networkBenchmark
    }
  }
}

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed * 100) / 100
  }
  return fallback
}

function normalizeBenchmarkResult(result) {
  if (result == null) {
    return { result: null, warning: '' }
  }

  const root = asPlainObject(result)
  if (root !== result) {
    return {
      result: null,
      warning: '测速结果格式异常，已自动降级为空结果。下一步：稍后重试，必要时检查后端服务状态。'
    }
  }

  const sourceSummary = asPlainObject(root.summary)
  const sourceResults = Array.isArray(root.results) ? root.results : []
  let hasInvalidItem = false

  const normalizedResults = sourceResults.map((item, index) => {
    const row = asPlainObject(item)
    if (row !== item) hasInvalidItem = true
    const site = String(row.site || `site_${index + 1}`).trim() || `site_${index + 1}`
    const ok = Boolean(row.ok)
    return {
      site,
      ok,
      dns_ms: toNonNegativeNumber(row.dns_ms, 0),
      tcp_ms: toNonNegativeNumber(row.tcp_ms, 0),
      tls_ms: toNonNegativeNumber(row.tls_ms, 0),
      ttfb_ms: toNonNegativeNumber(row.ttfb_ms, 0),
      total_ms: toNonNegativeNumber(row.total_ms, 0),
      error: String(row.error || '').trim()
    }
  })

  const successCountByRows = normalizedResults.filter((item) => item.ok).length
  const failedCountByRows = normalizedResults.length - successCountByRows
  const avgByRows = normalizedResults.length > 0
    ? normalizedResults.reduce((sum, item) => sum + item.total_ms, 0) / normalizedResults.length
    : 0
  const elapsedByRows = normalizedResults.reduce((sum, item) => sum + item.total_ms, 0)

  const normalizedSummary = {
    site_count: toNonNegativeNumber(sourceSummary.site_count, normalizedResults.length),
    success_count: toNonNegativeNumber(sourceSummary.success_count, successCountByRows),
    failed_count: toNonNegativeNumber(sourceSummary.failed_count, failedCountByRows),
    avg_total_ms: toNonNegativeNumber(sourceSummary.avg_total_ms, avgByRows),
    elapsed_ms: toNonNegativeNumber(sourceSummary.elapsed_ms, elapsedByRows)
  }

  return {
    result: {
      ...root,
      summary: normalizedSummary,
      results: normalizedResults
    },
    warning: hasInvalidItem
      ? '测速结果包含异常站点记录，已自动兜底。下一步：请重试测速并核对后端返回格式。'
      : ''
  }
}

function maskWebhookUrl(webhookUrl) {
  const raw = String(webhookUrl || '').trim()
  if (!raw) return ''
  if (raw.length <= 8) {
    return `${raw.slice(0, 1)}***${raw.slice(-1)}`
  }
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`
}

function normalizeNotificationsStatus(payload) {
  const root = asPlainObject(payload)
  const candidates = root.status || root.channels || root.notifications || root
  const container = asPlainObject(candidates)
  const nestedNotifications = asPlainObject(container.notifications)
  return {
    feishu: asPlainObject(container.feishu || nestedNotifications.feishu),
    telegram: asPlainObject(container.telegram || nestedNotifications.telegram)
  }
}

function createEmptySIPDraft() {
  return {
    fund_id: '',
    fund_name: '',
    amount: '',
    frequency: 'monthly',
    day: 1,
    note: ''
  }
}

function getSIPDayUpperBound(frequency) {
  return frequency === 'monthly' ? 31 : 7
}

function clampSIPDay(frequency, value) {
  const parsed = Number(value)
  const upper = getSIPDayUpperBound(frequency)
  if (!Number.isFinite(parsed)) return 1
  return Math.min(upper, Math.max(1, Math.round(parsed)))
}

function formatSIPSchedule(frequency, day) {
  const safeDay = clampSIPDay(frequency, day)
  if (frequency === 'monthly') return `每月 ${safeDay} 号`
  const weekday = SIP_WEEKLY_DAY_OPTIONS.find((item) => item.value === safeDay)?.label || `周${safeDay}`
  return frequency === 'biweekly' ? `双周 ${weekday}` : `每周 ${weekday}`
}

function formatSIPDate(value) {
  const text = String(value || '').trim()
  if (!text) return '--'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatSIPAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '--'
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function SettingsDrawer({
  open,
  settings,
  onClose,
  onSave,
  onUpdateFeishuWebhook,
  onUpdateTelegramCredential,
  onSendFeishuTestMessage,
  onSendTelegramTestMessage
}) {
  const normalizedSettings = normalizeDrawerSettings(settings)
  const initialBenchmarkState = normalizeBenchmarkResult(normalizedSettings.network_benchmark.last_result)

  const [draft, setDraft] = useState(() => normalizedSettings)
  const [benchmarkProfile, setBenchmarkProfile] = useState('cn_fund')
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkLatestLoading, setBenchmarkLatestLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState(() => initialBenchmarkState.warning || '')
  const [benchmarkResult, setBenchmarkResult] = useState(() => initialBenchmarkState.result)
  const [editingFeishuWebhook, setEditingFeishuWebhook] = useState(false)
  const [pendingFeishuWebhook, setPendingFeishuWebhook] = useState('')
  const [editingTelegramCredential, setEditingTelegramCredential] = useState(false)
  const [pendingTelegramBotToken, setPendingTelegramBotToken] = useState('')
  const [pendingTelegramChatId, setPendingTelegramChatId] = useState('')
  const [telegramDiscoveryLoading, setTelegramDiscoveryLoading] = useState(false)
  const [telegramDiscoveryError, setTelegramDiscoveryError] = useState('')
  const [telegramDiscoveryData, setTelegramDiscoveryData] = useState(null)
  const [notificationsStatusLoading, setNotificationsStatusLoading] = useState(false)
  const [notificationsStatusError, setNotificationsStatusError] = useState('')
  const [notificationsStatus, setNotificationsStatus] = useState(null)
  const [systemStatusLoading, setSystemStatusLoading] = useState(false)
  const [systemStatusError, setSystemStatusError] = useState('')
  const [systemStatusSnapshot, setSystemStatusSnapshot] = useState(null)
  const [healthzLoading, setHealthzLoading] = useState(false)
  const [healthzError, setHealthzError] = useState('')
  const [healthzSnapshot, setHealthzSnapshot] = useState(null)
  const [systemPanelHint, setSystemPanelHint] = useState('')
  const [systemPanelError, setSystemPanelError] = useState('')
  const [diagnosticHint, setDiagnosticHint] = useState('')
  const [diagnosticError, setDiagnosticError] = useState('')
  const [feishuHistoryOpen, setFeishuHistoryOpen] = useState(false)
  const [telegramHistoryOpen, setTelegramHistoryOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testAllLoading, setTestAllLoading] = useState(false)
  const [testAllResult, setTestAllResult] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [auditLogsOpen, setAuditLogsOpen] = useState(false)
  const [sipPlans, setSipPlans] = useState([])
  const [sipLoading, setSipLoading] = useState(false)
  const [sipSaving, setSipSaving] = useState(false)
  const [sipBusyPlanId, setSipBusyPlanId] = useState(null)
  const [sipError, setSipError] = useState('')
  const [sipHint, setSipHint] = useState('')
  const [sipFormOpen, setSipFormOpen] = useState(false)
  const [editingSipPlanId, setEditingSipPlanId] = useState(null)
  const [sipDraft, setSipDraft] = useState(() => createEmptySIPDraft())

  const [internalOpen, setInternalOpen] = useState(open)
  const [hydratedSections, setHydratedSections] = useState(() => ({
    benchmark: false,
    sip: false,
    diagnostics: false,
    system: false
  }))

  useEffect(() => {
    setInternalOpen(open)
    if (!open) {
      const resetBenchmark = normalizeBenchmarkResult(normalizeDrawerSettings(settings).network_benchmark.last_result)
      setHydratedSections({
        benchmark: false,
        sip: false,
        diagnostics: false,
        system: false
      })
      setBenchmarkResult(resetBenchmark.result)
      setBenchmarkError(resetBenchmark.warning || '')
      setBenchmarkLatestLoading(false)
      setSipLoading(false)
      setSipPlans([])
      setSipError('')
      setSipHint('')
      setNotificationsStatusLoading(false)
      setNotificationsStatus(null)
      setNotificationsStatusError('')
      setTelegramDiscoveryLoading(false)
      setTelegramDiscoveryError('')
      setTelegramDiscoveryData(null)
      setSystemStatusLoading(false)
      setSystemStatusSnapshot(null)
      setSystemStatusError('')
      setHealthzLoading(false)
      setHealthzSnapshot(null)
      setHealthzError('')
      setSystemPanelHint('')
      setSystemPanelError('')
      setAuditLogs([])
      setAuditLogsLoading(false)
      setAuditLogsOpen(false)
      setDiagnosticHint('')
      setDiagnosticError('')
      setTestAllLoading(false)
      setTestAllResult(null)
    }
  }, [open, settings])

  useEffect(() => {
    const normalized = normalizeDrawerSettings(settings)
    const initialBenchmark = normalizeBenchmarkResult(normalized.network_benchmark.last_result)
    const webhook = String(normalized.notifications?.feishu?.webhook_url || '').trim()
    const telegramBotToken = String(normalized.notifications?.telegram?.bot_token || '').trim()
    const telegramChatId = String(normalized.notifications?.telegram?.chat_id || '').trim()

    // Dev-only schema assertion
    assertSettingsSchema(normalized, 'SettingsDrawer.useEffect[settings]')

    setDraft(normalized)
    setBenchmarkProfile(normalized.network_benchmark.default_profile || 'cn_fund')
    setBenchmarkResult(initialBenchmark.result)
    setBenchmarkError(initialBenchmark.warning || '')
    setBenchmarkLatestLoading(false)
    setEditingFeishuWebhook(!webhook)
    setPendingFeishuWebhook('')
    setEditingTelegramCredential(!telegramBotToken)
    setPendingTelegramBotToken('')
    setPendingTelegramChatId(telegramChatId)
    setNotificationsStatusLoading(false)
    setNotificationsStatusError('')
    setNotificationsStatus(null)
    setSystemStatusLoading(false)
    setSystemStatusError('')
    setSystemStatusSnapshot(null)
    setSystemPanelHint('')
    setSystemPanelError('')
    setHealthzLoading(false)
    setHealthzError('')
    setHealthzSnapshot(null)
    setDiagnosticHint('')
    setDiagnosticError('')
    setSaveError('')
    setSipLoading(false)
    setSipPlans([])
    setSipError('')
    setSipHint('')
    setSipFormOpen(false)
    setEditingSipPlanId(null)
    setSipDraft(createEmptySIPDraft())
    setHydratedSections({
      benchmark: false,
      sip: false,
      diagnostics: false,
      system: false
    })
  }, [settings])

  const updateDraft = (updater) => {
    setDraft((prev) => {
      const safePrev = normalizeDrawerSettings(prev)
      const next = typeof updater === 'function' ? updater(safePrev) : safePrev
      return normalizeDrawerSettings(next)
    })
  }

  const hydrateSection = (sectionKey) => {
    setHydratedSections((prev) => {
      if (prev[sectionKey]) return prev
      return { ...prev, [sectionKey]: true }
    })
  }

  const ensureBenchmarkHydrated = () => {
    recordMetric('设置中心测速记录加载')
    hydrateSection('benchmark')
  }
  const ensureSipHydrated = () => hydrateSection('sip')
  const ensureDiagnosticsHydrated = () => hydrateSection('diagnostics')
  const ensureSystemHydrated = () => hydrateSection('system')

  useEffect(() => {
    if (!open || !hydratedSections.benchmark || benchmarkLoading || benchmarkLatestLoading) return

    let active = true
    setBenchmarkLatestLoading(true)
    ;(async () => {
      try {
        const payload = await fetchNetworkBenchmarkLatest()
        if (!active) return
        const normalized = normalizeBenchmarkResult(payload?.result)
        setBenchmarkResult(normalized.result)
        setBenchmarkError(normalized.warning || '')
      } catch (error) {
        if (!active) return
        setBenchmarkResult(null)
        setBenchmarkError(toGuidedError(error, 'settings_benchmark_load', '测速记录加载失败'))
      } finally {
        if (!active) return
        setBenchmarkLatestLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, hydratedSections.benchmark])

  useEffect(() => {
    if (!open || !hydratedSections.sip) return

    let active = true
    setSipLoading(true)
    setSipError('')
    setSipHint('')
    ;(async () => {
      try {
        const payload = await fetchSIPPlans(false)
        if (!active) return
        setSipPlans(Array.isArray(payload?.plans) ? payload.plans : [])
      } catch (error) {
        if (!active) return
        setSipPlans([])
        setSipError(toGuidedError(error, 'sip_list_load', '定投计划加载失败'))
      } finally {
        if (!active) return
        setSipLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, hydratedSections.sip])

  useEffect(() => {
    if (!open || !hydratedSections.diagnostics || notificationsStatusLoading) return

    let active = true
    setNotificationsStatusLoading(true)
    setNotificationsStatusError('')
    ;(async () => {
      try {
        const payload = await fetchNotificationsStatus()
        if (!active) return
        setNotificationsStatus(normalizeNotificationsStatus(payload))
      } catch (error) {
        if (!active) return
        setNotificationsStatus(null)
        setNotificationsStatusError(toGuidedError(error, 'notifications_status_load', '通知诊断加载失败'))
      } finally {
        if (!active) return
        setNotificationsStatusLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, hydratedSections.diagnostics])

  useEffect(() => {
    if (!open || !hydratedSections.system || systemStatusLoading || healthzLoading) return

    let active = true
    setSystemStatusLoading(true)
    setSystemStatusError('')
    setSystemStatusSnapshot(null)
    setSystemPanelHint('')
    setSystemPanelError('')
    setHealthzLoading(true)
    setHealthzError('')
    setHealthzSnapshot(null)
    ;(async () => {
      try {
        const payload = await fetchSystemStatus()
        if (!active) return
        setSystemStatusSnapshot(asPlainObject(payload))
      } catch (error) {
        if (!active) return
        setSystemStatusSnapshot(null)
        setSystemStatusError(toGuidedError(error, 'system_status_load', '系统状态加载失败'))
      } finally {
        if (!active) return
        setSystemStatusLoading(false)
      }
    })()

    ;(async () => {
      try {
        const payload = await fetchHealthz()
        if (!active) return
        setHealthzSnapshot(asPlainObject(payload))
      } catch (error) {
        if (!active) return
        setHealthzSnapshot(null)
        setHealthzError(toGuidedError(error, 'healthz_check', '健康检查失败'))
      } finally {
        if (!active) return
        setHealthzLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, hydratedSections.system])

  const timeoutSeconds = Number(draft.network_benchmark.timeout_seconds || 6)
  const currentFeishuWebhook = String(draft.notifications.feishu.webhook_url || '').trim()
  const requestedFeishuWebhook = String(pendingFeishuWebhook || '').trim()
  const hasFeishuWebhook = currentFeishuWebhook.length > 0
  const showFeishuWebhookInput = editingFeishuWebhook || !hasFeishuWebhook
  const shouldUpdateFeishuWebhook = showFeishuWebhookInput
    && requestedFeishuWebhook.length > 0
    && requestedFeishuWebhook !== currentFeishuWebhook
  const maskedFeishuWebhook = maskWebhookUrl(currentFeishuWebhook)

  const currentTelegramBotToken = String(draft.notifications.telegram.bot_token || '').trim()
  const currentTelegramChatId = String(draft.notifications.telegram.chat_id || '').trim()
  const requestedTelegramBotToken = String(pendingTelegramBotToken || '').trim()
  const requestedTelegramChatId = String(pendingTelegramChatId || '').trim()
  const hasTelegramBotToken = currentTelegramBotToken.length > 0
  const hasTelegramCredential = hasTelegramBotToken && currentTelegramChatId.length > 0
  const showTelegramCredentialInput = editingTelegramCredential || !hasTelegramBotToken
  const shouldUpdateTelegramCredential = showTelegramCredentialInput
    && requestedTelegramBotToken.length > 0
    && (requestedTelegramBotToken !== currentTelegramBotToken || requestedTelegramChatId !== currentTelegramChatId)
  const canIssueTelegramDiscovery = hasTelegramBotToken && !shouldUpdateTelegramCredential
  const telegramDiscoveryPreview = asPlainObject(telegramDiscoveryData)
  const telegramDiscoveryWebhook = String(telegramDiscoveryPreview.webhook_url || telegramDiscoveryPreview.webhook_path || '').trim()
  const telegramMode = String(draft.notifications.telegram.parse_mode || '').trim().toUpperCase() === 'HTML'
    ? 'HTML（安全转义）'
    : '纯文本'
  const benchmarkSummary = benchmarkResult?.summary || null
  const hasBenchmarkRows = Array.isArray(benchmarkResult?.results) && benchmarkResult.results.length > 0
  const sipDayUpperBound = getSIPDayUpperBound(sipDraft.frequency)
  const sipDayOptions = sipDraft.frequency === 'monthly'
    ? Array.from({ length: 31 }, (_, index) => ({ value: index + 1, label: `${index + 1} 号` }))
    : SIP_WEEKLY_DAY_OPTIONS

  const save = async () => {
    setSaveError('')
    setSaving(true)

    const nextFeishuWebhook = shouldUpdateFeishuWebhook
      ? requestedFeishuWebhook
      : currentFeishuWebhook

    const nextTelegramBotToken = shouldUpdateTelegramCredential
      ? requestedTelegramBotToken
      : currentTelegramBotToken
    const nextTelegramChatId = shouldUpdateTelegramCredential
      ? requestedTelegramChatId
      : currentTelegramChatId

    const nextDraft = {
      ...draft,
      notifications: {
        ...draft.notifications,
        feishu: {
          ...draft.notifications.feishu,
          webhook_url: nextFeishuWebhook
        },
        telegram: {
          ...draft.notifications.telegram,
          bot_token: nextTelegramBotToken,
          chat_id: nextTelegramChatId
        }
      },
      network_benchmark: {
        ...draft.network_benchmark,
        default_profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds
      }
    }

    const nextDraftWithoutSecrets = {
      ...nextDraft,
      notifications: {
        ...nextDraft.notifications,
        feishu: {
          ...nextDraft.notifications.feishu
        },
        telegram: {
          ...nextDraft.notifications.telegram
        }
      }
    }
    delete nextDraftWithoutSecrets.notifications.feishu.webhook_url
    delete nextDraftWithoutSecrets.notifications.telegram.bot_token
    delete nextDraftWithoutSecrets.notifications.telegram.chat_id

    setDraft(nextDraft)

    try {
      if (shouldUpdateFeishuWebhook) {
        if (typeof onUpdateFeishuWebhook !== 'function') {
          setSaveError('飞书 webhook 更新失败。下一步：稍后重试或联系管理员检查后端接口。')
          return
        }
        const updated = await onUpdateFeishuWebhook(requestedFeishuWebhook)
        if (updated === false) {
          setSaveError('飞书 webhook 更新失败。下一步：检查新凭据格式后重试。')
          return
        }
      }

      if (shouldUpdateTelegramCredential) {
        if (typeof onUpdateTelegramCredential !== 'function') {
          setSaveError('Telegram 凭据更新失败。下一步：稍后重试或联系管理员检查后端接口。')
          return
        }
        const updated = await onUpdateTelegramCredential(requestedTelegramBotToken, requestedTelegramChatId)
        if (updated === false) {
          setSaveError('Telegram 凭据更新失败。下一步：检查 bot_token/chat_id 后重试。')
          return
        }
      }

      if (typeof onSave !== 'function') {
        setSaveError('设置保存失败。下一步：刷新页面后重试。')
        return
      }
      const ok = await onSave(nextDraftWithoutSecrets)
      if (ok === false) {
        setSaveError('设置保存失败。下一步：检查表单配置后重试；若持续失败请重新登录。')
        return
      }
      onClose()
    } catch (error) {
      setSaveError(toGuidedError(error, 'settings_save', '设置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const executeBenchmark = async () => {
    setBenchmarkLoading(true)
    setBenchmarkError('')
    try {
      const payload = await runNetworkBenchmark({
        profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds,
        persist: true
      })
      const normalized = normalizeBenchmarkResult(payload?.result)
      const result = normalized.result
      setBenchmarkResult(result)
      setBenchmarkError(
        normalized.warning
          || (result ? '' : '测速完成但未返回有效结果。下一步：稍后重试，必要时检查后端服务状态。')
      )
      updateDraft((prev) => ({
        ...prev,
        network_benchmark: {
          ...prev.network_benchmark,
          default_profile: benchmarkProfile,
          timeout_seconds: timeoutSeconds,
          last_run_at: result?.generated_at || '',
          last_result: result
        }
      }))
      recordMetric('设置中心测速执行成功', {
        profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds,
        site_count: Array.isArray(result?.results) ? result.results.length : 0
      })
    } catch (error) {
      setBenchmarkError(toGuidedError(error, 'settings_benchmark_run', '测速执行失败'))
      recordMetric('设置中心测速执行失败', {
        profile: benchmarkProfile,
        timeout_seconds: timeoutSeconds
      })
    } finally {
      setBenchmarkLoading(false)
    }
  }

  const copyTextToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        return true
      } catch {
        return false
      }
    }
  }

  const refreshNotificationsStatus = async () => {
    const shouldHydrate = !hydratedSections.diagnostics
    if (shouldHydrate) {
      ensureDiagnosticsHydrated()
    }
    if (notificationsStatusLoading && !shouldHydrate) {
      return false
    }
    setNotificationsStatusLoading(true)
    try {
      const payload = await fetchNotificationsStatus()
      setNotificationsStatus(normalizeNotificationsStatus(payload))
      setNotificationsStatusError('')
      return true
    } catch (error) {
      setNotificationsStatus(null)
      setNotificationsStatusError(toGuidedError(error, 'notifications_status_load', '通知诊断加载失败'))
      return false
    } finally {
      setNotificationsStatusLoading(false)
    }
  }

  const handleIssueTelegramDiscovery = async () => {
    setTelegramDiscoveryLoading(true)
    setTelegramDiscoveryError('')
    try {
      const payload = await issueTelegramDiscoverySecret({ rotate: false })
      const discovery = asPlainObject(payload?.discovery)
      setTelegramDiscoveryData(discovery)
      setDiagnosticHint('Telegram 自动发现地址已生成。下一步：复制 webhook URL，给 bot 发一条消息后再刷新诊断。')
      await refreshNotificationsStatus()
    } catch (error) {
      setTelegramDiscoveryData(null)
      setTelegramDiscoveryError(toGuidedError(error, 'telegram_discovery_issue', 'Telegram 自动发现地址生成失败'))
    } finally {
      setTelegramDiscoveryLoading(false)
    }
  }

  const handleCopyDiagnosticBundle = async () => {
    ensureDiagnosticsHydrated()
    try {
      let statusSnapshot = notificationsStatus ? asPlainObject(notificationsStatus) : null
      let statusErrorSnapshot = String(notificationsStatusError || '').trim()

      if (!statusSnapshot || Object.keys(statusSnapshot).length === 0) {
        setNotificationsStatusLoading(true)
        try {
          const payload = await fetchNotificationsStatus()
          statusSnapshot = asPlainObject(normalizeNotificationsStatus(payload))
          setNotificationsStatus(statusSnapshot)
          setNotificationsStatusError('')
          statusErrorSnapshot = ''
        } catch (error) {
          statusSnapshot = null
          statusErrorSnapshot = toGuidedError(error, 'notifications_status_load', '通知诊断加载失败')
          setNotificationsStatusError(statusErrorSnapshot)
        } finally {
          setNotificationsStatusLoading(false)
        }
      }

      let systemStatus = systemStatusSnapshot ? asPlainObject(systemStatusSnapshot) : null
      if (!systemStatus || Object.keys(systemStatus).length === 0) {
        try {
          // Best-effort: include backend version/commit if available.
          systemStatus = await fetchSystemStatus()
        } catch {
          systemStatus = null
        }
      }

      const system = asPlainObject(systemStatus)
      const bundle = {
        copied_at: new Date().toISOString(),
        notifications_status: statusSnapshot,
        ...(statusErrorSnapshot ? { notifications_status_error: statusErrorSnapshot } : {}),
        ...(system
          ? {
              system_status: {
                service: system.service || '',
                version: system.version || '',
                commit: system.commit || '',
                server_time: system.server_time || ''
              }
            }
          : {})
      }

      const text = JSON.stringify(bundle, null, 2)
      const ok = await copyTextToClipboard(text)
      if (ok) {
        handleDiagnosticToast({ type: 'success', message: '已复制诊断信息（脱敏）' })
      } else {
        handleDiagnosticToast({ type: 'error', message: '复制失败：浏览器不支持剪贴板' })
      }
    } catch (error) {
      const detail = String(error?.message || '').trim()
      handleDiagnosticToast({ type: 'error', message: detail ? `复制失败：${detail}` : '复制失败' })
    }
  }

  const handleTestAll = async () => {
    setTestAllLoading(true)
    setTestAllResult(null)
    try {
      const result = await testAllNotifications()
      setTestAllResult(result)
      const summary = result?.summary || {}
      const passed = summary.passed || 0
      const failed = summary.failed || 0
      if (failed === 0 && passed > 0) {
        handleDiagnosticToast({ type: 'success', message: `全部测试通过 (${passed}/${summary.tested})` })
      } else if (passed > 0) {
        handleDiagnosticToast({ type: 'warning', message: `部分测试通过 (${passed}/${summary.tested})，${failed} 个失败` })
      } else {
        handleDiagnosticToast({ type: 'error', message: '所有测试失败' })
      }
      await refreshNotificationsStatus()
    } catch (error) {
      const detail = String(error?.message || '').trim()
      handleDiagnosticToast({ type: 'error', message: detail ? `测试失败：${detail}` : '测试失败' })
    } finally {
      setTestAllLoading(false)
    }
  }

  const loadAuditLogs = async () => {
    setAuditLogsLoading(true)
    try {
      const result = await fetchSettingsAuditLogs(10)
      setAuditLogs(result?.logs || [])
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setAuditLogsLoading(false)
    }
  }

  const toggleAuditLogs = async () => {
    if (!auditLogsOpen && auditLogs.length === 0) {
      await loadAuditLogs()
    }
    setAuditLogsOpen(!auditLogsOpen)
  }

  const handleCopySystemStatus = async () => {
    ensureSystemHydrated()
    try {
      let snapshot = systemStatusSnapshot ? asPlainObject(systemStatusSnapshot) : null
      let statusErrorSnapshot = String(systemStatusError || '').trim()
      let healthSnapshot = healthzSnapshot ? asPlainObject(healthzSnapshot) : null
      let healthErrorSnapshot = String(healthzError || '').trim()

      const shouldFetchSystemStatus = !snapshot || Object.keys(snapshot).length === 0
      const shouldFetchHealthz = !healthSnapshot || Object.keys(healthSnapshot).length === 0

      if (shouldFetchSystemStatus) {
        setSystemStatusLoading(true)
      }
      if (shouldFetchHealthz) {
        setHealthzLoading(true)
      }

      if (shouldFetchSystemStatus) {
        try {
          snapshot = asPlainObject(await fetchSystemStatus())
          setSystemStatusSnapshot(snapshot)
          setSystemStatusError('')
          statusErrorSnapshot = ''
        } catch (error) {
          statusErrorSnapshot = toGuidedError(error, 'system_status_load', '系统状态加载失败')
          setSystemStatusError(statusErrorSnapshot)
          snapshot = null
        } finally {
          setSystemStatusLoading(false)
        }
      }

      if (shouldFetchHealthz) {
        try {
          healthSnapshot = asPlainObject(await fetchHealthz())
          setHealthzSnapshot(healthSnapshot)
          setHealthzError('')
          healthErrorSnapshot = ''
        } catch (error) {
          healthErrorSnapshot = toGuidedError(error, 'healthz_check', '健康检查失败')
          setHealthzError(healthErrorSnapshot)
          healthSnapshot = null
        } finally {
          setHealthzLoading(false)
        }
      }

      // v2: 增强复制内容 - 包含版本/页面URL/request_id（脱敏）
      const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

      const bundle = {
        copied_at: new Date().toISOString(),
        page_url: pageUrl,
        user_agent: userAgent,
        system_status: snapshot,
        healthz: healthSnapshot,
        ...(statusErrorSnapshot ? { system_status_error: statusErrorSnapshot } : {}),
        ...(healthErrorSnapshot ? { healthz_error: healthErrorSnapshot } : {})
      }

      const text = JSON.stringify(bundle, null, 2)
      const ok = await copyTextToClipboard(text)
      if (ok) {
        setSystemPanelHint('已复制状态（脱敏）')
        setSystemPanelError('')
      } else {
        setSystemPanelError('复制失败：浏览器不支持剪贴板')
        setSystemPanelHint('')
      }
    } catch (error) {
      const detail = String(error?.message || '').trim()
      setSystemPanelError(detail ? `复制失败：${detail}` : '复制失败')
      setSystemPanelHint('')
    }
  }

  const handleDiagnosticToast = (toast) => {
    const type = String(toast?.type || '').trim()
    const message = String(toast?.message || '').trim()
    if (!message) return

    if (type === 'success') {
      setDiagnosticHint(message)
      setDiagnosticError('')
    } else {
      setDiagnosticError(message)
      setDiagnosticHint('')
    }
  }

  const refreshSIPPlans = async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setSipLoading(true)
    }
    try {
      const payload = await fetchSIPPlans(false)
      setSipPlans(Array.isArray(payload?.plans) ? payload.plans : [])
      setSipError('')
      return true
    } catch (error) {
      setSipPlans([])
      setSipError(toGuidedError(error, 'sip_list_refresh', '定投计划加载失败'))
      return false
    } finally {
      if (showLoading) {
        setSipLoading(false)
      }
    }
  }

  const resetSIPForm = () => {
    setSipFormOpen(false)
    setEditingSipPlanId(null)
    setSipDraft(createEmptySIPDraft())
  }

  const startCreateSIPPlan = () => {
    if (sipFormOpen && editingSipPlanId == null) {
      resetSIPForm()
      return
    }
    setSipFormOpen(true)
    setEditingSipPlanId(null)
    setSipDraft(createEmptySIPDraft())
  }

  const startEditSIPPlan = (plan) => {
    const frequency = String(plan?.frequency || 'monthly')
    setSipFormOpen(true)
    setEditingSipPlanId(plan?.id ?? null)
    setSipDraft({
      fund_id: String(plan?.fund_id || ''),
      fund_name: String(plan?.fund_name || ''),
      amount: String(plan?.amount ?? ''),
      frequency,
      day: clampSIPDay(frequency, plan?.day ?? 1),
      note: String(plan?.note || '')
    })
  }

  const submitSIPPlan = async (event) => {
    event.preventDefault()
    setSipError('')
    setSipHint('')
    setSipSaving(true)
    try {
      const frequency = String(sipDraft.frequency || 'monthly')
      const payload = {
        fund_id: String(sipDraft.fund_id || '').trim(),
        fund_name: String(sipDraft.fund_name || '').trim(),
        amount: Number(sipDraft.amount),
        frequency,
        day: clampSIPDay(frequency, sipDraft.day),
        note: String(sipDraft.note || '').trim()
      }

      if (editingSipPlanId == null) {
        await createSIPPlan(payload)
        setSipHint('定投计划已创建')
      } else {
        await updateSIPPlan(editingSipPlanId, payload)
        setSipHint('定投计划已更新')
      }
      const ok = await refreshSIPPlans()
      if (ok) {
        resetSIPForm()
      }
    } catch (error) {
      setSipError(toGuidedError(error, 'sip_save', '定投计划保存失败'))
    } finally {
      setSipSaving(false)
    }
  }

  const toggleSIPPlanEnabled = async (plan) => {
    const planId = plan?.id
    if (planId == null) return

    setSipError('')
    setSipHint('')
    setSipBusyPlanId(planId)
    try {
      await updateSIPPlan(planId, { enabled: !Boolean(plan.enabled) })
      setSipHint(Boolean(plan.enabled) ? '定投计划已暂停' : '定投计划已启用')
      await refreshSIPPlans()
    } catch (error) {
      setSipError(toGuidedError(error, 'sip_toggle', '定投计划状态更新失败'))
    } finally {
      setSipBusyPlanId(null)
    }
  }

  const executeSIPPlanNow = async (planId) => {
    if (planId == null) return

    setSipError('')
    setSipHint('')
    setSipBusyPlanId(planId)
    try {
      await executeSIPPlan(planId)
      setSipHint('已记录本次执行')
      await refreshSIPPlans()
    } catch (error) {
      setSipError(toGuidedError(error, 'sip_execute', '执行记录失败'))
    } finally {
      setSipBusyPlanId(null)
    }
  }

  const deleteSIPPlanById = async (planId) => {
    if (planId == null) return
    if (!window.confirm('确定删除该定投计划吗？')) return

    setSipError('')
    setSipHint('')
    setSipBusyPlanId(planId)
    try {
      await deleteSIPPlan(planId)
      setSipHint('定投计划已删除')
      await refreshSIPPlans()
      if (editingSipPlanId === planId) {
        resetSIPForm()
      }
    } catch (error) {
      setSipError(toGuidedError(error, 'sip_delete', '定投计划删除失败'))
    } finally {
      setSipBusyPlanId(null)
    }
  }

  const handleClose = () => {
    setInternalOpen(false)
    if (onClose) onClose()
  }

  if (!internalOpen && !open) return null

  const drawerSize =
    typeof window !== 'undefined' && window.innerWidth <= 768
      ? 'default'
      : 'large'
  const enabledNotificationChannels = [
    Boolean(draft.notifications.feishu.enabled),
    Boolean(draft.notifications.telegram.enabled),
    Boolean(draft.notifications.email.enabled)
  ].filter(Boolean).length
  const activeSipPlansCount = sipPlans.filter((plan) => Boolean(plan?.enabled)).length
  const feishuTemplateLabel = FEISHU_TEMPLATE_OPTIONS.find(
    (item) => item.value === (draft.notifications.feishu.template || 'title_content_metadata')
  )?.label || '标题+正文+元数据'
  const benchmarkStatusCard = !hydratedSections.benchmark
    ? {
        value: '按需加载',
        description: '点击加载最近记录或直接开始测速。'
      }
    : benchmarkLoading || benchmarkLatestLoading
      ? {
          value: '同步中',
          description: '正在拉取最近一次链路结果。'
        }
      : benchmarkError
        ? {
            value: '需重试',
            description: '最近一次测速记录加载失败。'
          }
        : benchmarkSummary
          ? {
              value: `${benchmarkSummary.success_count}/${benchmarkSummary.site_count}`,
              description: '已完成链路汇总，可继续查看单站点明细。'
            }
          : hasBenchmarkRows
            ? {
                value: `${benchmarkResult.results.length} 条`,
                description: '已返回测速明细，可直接比对各站点耗时。'
              }
            : {
                value: '暂无记录',
                description: '当前还没有可展示的测速历史。'
              };
  const settingsOverviewCards = [
    {
      key: 'refresh',
      icon: SettingOutlined,
      eyebrow: '自动刷新',
      value: Boolean(draft.display.auto_refresh_enabled) ? `${draft.display.auto_refresh_seconds ?? 60}s` : '已关闭',
      description: Boolean(draft.display.auto_refresh_enabled)
        ? (draft.display.auto_refresh_visible_only ? '仅页面可见时刷新' : '后台继续刷新')
        : '当前改为手动刷新模式'
    },
    {
      key: 'sip',
      icon: ExperimentOutlined,
      eyebrow: '定投计划',
      value: hydratedSections.sip ? `${sipPlans.length} 个计划` : '按需加载',
      description: hydratedSections.sip
        ? (sipPlans.length > 0 ? `已启用 ${activeSipPlansCount} 个执行计划` : '当前暂无定投计划')
        : '点击加载计划查看执行规则'
    },
    {
      key: 'notifications',
      icon: BellOutlined,
      eyebrow: '通知通道',
      value: `${enabledNotificationChannels} 个启用`,
      description: hydratedSections.diagnostics
        ? '通知诊断已同步，可直接发送测试消息'
        : '诊断按需加载，支持一键复制状态'
    }
  ]
  const benchmarkOverviewCards = [
    {
      key: 'profile',
      label: '测速配置',
      value: PROFILE_OPTIONS.find((item) => item.value === benchmarkProfile)?.label || benchmarkProfile,
      hint: '当前链路会按该站点组发起测速。'
    },
    {
      key: 'timeout',
      label: '超时预算',
      value: `${timeoutSeconds}s`,
      hint: '控制单次测速的等待窗口，避免阻塞设置中心。'
    },
    {
      key: 'status',
      label: '最近记录',
      value: benchmarkStatusCard.value,
      hint: benchmarkStatusCard.description
    }
  ]
  const benchmarkSummaryCards = benchmarkSummary ? [
    {
      key: 'site-count',
      label: '站点数',
      value: String(benchmarkSummary.site_count),
      hint: '本次汇总纳入的站点数量。'
    },
    {
      key: 'success-rate',
      label: '成功站点',
      value: `${benchmarkSummary.success_count}/${benchmarkSummary.site_count}`,
      hint: `失败 ${benchmarkSummary.failed_count} 个站点`
    },
    {
      key: 'latency',
      label: '平均总耗时',
      value: `${benchmarkSummary.avg_total_ms} ms`,
      hint: `整轮总用时 ${benchmarkSummary.elapsed_ms} ms`
    }
  ] : []
  const feishuOverviewCards = [
    {
      key: 'enabled',
      label: '通道状态',
      value: Boolean(draft.notifications.feishu.enabled) ? '已启用' : '未启用',
      hint: Boolean(draft.notifications.feishu.enabled) ? '当前允许发送飞书通知。' : '保存后仍不会发送飞书通知。'
    },
    {
      key: 'credential',
      label: '凭据状态',
      value: hasFeishuWebhook ? '已配置' : '未配置',
      hint: hasFeishuWebhook ? '当前 Webhook 已掩码展示。' : '填写 Webhook 后即可进入联调。'
    },
    {
      key: 'template',
      label: '消息模板',
      value: feishuTemplateLabel,
      hint: '控制消息正文与元数据的组织方式。'
    }
  ]
  const telegramOverviewCards = [
    {
      key: 'enabled',
      label: '通道状态',
      value: Boolean(draft.notifications.telegram.enabled) ? '已启用' : '未启用',
      hint: Boolean(draft.notifications.telegram.enabled) ? '当前允许发送 Telegram 通知。' : '保存后仍不会发送 Telegram 通知。'
    },
    {
      key: 'credential',
      label: '凭据状态',
      value: hasTelegramCredential ? '已配置' : (hasTelegramBotToken ? '等待发现' : '未配置'),
      hint: hasTelegramCredential
        ? `chat_id ${currentTelegramChatId || '--'} 已可用`
        : (hasTelegramBotToken ? '已保存 bot_token，等待自动发现或补齐 chat_id。' : '需要先写入 bot_token。')
    },
    {
      key: 'delivery',
      label: '发送模式',
      value: telegramMode,
      hint: telegramDiscoveryWebhook ? '自动发现地址已生成，可继续回写 chat_id。' : '支持自动发现 webhook 与手工填写 chat_id。'
    }
  ]

  const renderSectionHeader = (Icon, title, description) => (
    <div className="settings-section-header">
      <span className="section-icon">
        <Icon aria-hidden="true" />
      </span>
      <div className="settings-section-copy">
        <span className="section-title">{title}</span>
        <p>{description}</p>
      </div>
    </div>
  )

  const renderPanelOverview = (items, className = 'settings-panel-overview') => (
    <div className={className}>
      {items.map((item) => (
        <article key={item.key} className="settings-panel-overview__card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.hint}</p>
        </article>
      ))}
    </div>
  )

  return (
    <Drawer
      className="settings-drawer"
      title={(
        <div className="settings-drawer__heading">
          <span className="settings-drawer__eyebrow">控制台设置</span>
          <div>
            <h2>设置中心</h2>
            <p>统一管理自动刷新、定投计划、网络诊断与消息推送。</p>
          </div>
        </div>
      )}
      placement="right"
      onClose={handleClose}
      open={internalOpen}
      size={drawerSize}
      footer={
        <div className="settings-footer-actions">
          <Button onClick={handleClose}>关闭</Button>
          <Button type="primary" onClick={save} loading={saving} data-testid="settings-save-btn">
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      }
    >
        <section className="settings-overview" aria-label="设置概览">
          {settingsOverviewCards.map((card) => {
            const Icon = card.icon
            return (
              <article key={card.key} className="settings-overview-card">
                <span className="settings-overview-card__icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="settings-overview-card__eyebrow">{card.eyebrow}</span>
                <strong>{card.value}</strong>
                <p>{card.description}</p>
              </article>
            )
          })}
        </section>

        {renderSectionHeader(SettingOutlined, '常用设置', '先处理刷新策略和定投执行节奏，再进入诊断或通知配置。')}

        <div className="settings-group">
          <h4>自动刷新</h4>
          <label>
            <span>是否开启</span>
            <input
              type="checkbox"
              checked={Boolean(draft.display.auto_refresh_enabled)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_enabled: e.target.checked }
              }))}
            />
          </label>
          <label>
            <span>刷新间隔（秒）</span>
            <input
              type="number"
              min={15}
              max={600}
              value={draft.display.auto_refresh_seconds ?? 60}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_seconds: Number(e.target.value) || 60 }
              }))}
            />
          </label>
          <label>
            <span>页面不可见时暂停</span>
            <input
              type="checkbox"
              checked={Boolean(draft.display.auto_refresh_visible_only)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_visible_only: e.target.checked }
              }))}
            />
          </label>
        </div>

        <div className="settings-group">
          <h4>定投计划（SIP）</h4>
          <div className="settings-secret-actions">
            <button
              type="button"
              className="ghost"
              data-testid="sip-plan-load-btn"
              onClick={ensureSipHydrated}
              disabled={sipLoading || sipSaving || sipBusyPlanId != null}
            >
              {hydratedSections.sip ? '已加载计划' : '加载计划'}
            </button>
            <button
              type="button"
              className="primary"
              data-testid="sip-plan-create-toggle-btn"
              onClick={() => {
                ensureSipHydrated()
                startCreateSIPPlan()
              }}
              disabled={sipSaving || sipBusyPlanId != null}
            >
              {sipFormOpen && editingSipPlanId == null ? '取消新增' : '新增计划'}
            </button>
            <button
              type="button"
              className="ghost"
              data-testid="sip-plan-refresh-btn"
              onClick={() => {
                ensureSipHydrated()
                refreshSIPPlans({ showLoading: true })
              }}
              disabled={!hydratedSections.sip || sipLoading || sipSaving || sipBusyPlanId != null}
            >
              刷新
            </button>
          </div>

          {sipHint ? <p className="settings-note">{sipHint}</p> : null}
          {sipError ? <p className="settings-error">{sipError}</p> : null}

          {sipFormOpen ? (
            <form className="settings-sip-form" onSubmit={submitSIPPlan}>
              <div className="settings-sip-grid">
                <label>
                  <span>基金代码</span>
                  <input
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    data-testid="sip-plan-fund-id-input"
                    value={sipDraft.fund_id}
                    onChange={(event) => {
                      const next = String(event.target.value || '').replace(/[^\d]/g, '').slice(0, 6)
                      setSipDraft((prev) => ({ ...prev, fund_id: next }))
                    }}
                    disabled={editingSipPlanId != null}
                    placeholder="000001"
                  />
                </label>

                <label>
                  <span>基金名称</span>
                  <input
                    data-testid="sip-plan-fund-name-input"
                    value={sipDraft.fund_name}
                    onChange={(event) => setSipDraft((prev) => ({ ...prev, fund_name: event.target.value }))}
                    placeholder="可选"
                  />
                </label>

                <label>
                  <span>定投金额（元）</span>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step={0.01}
                    data-testid="sip-plan-amount-input"
                    value={sipDraft.amount}
                    onChange={(event) => setSipDraft((prev) => ({ ...prev, amount: event.target.value }))}
                    placeholder="1000"
                  />
                </label>

                <label>
                  <span>频率</span>
                  <select
                    data-testid="sip-plan-frequency-select"
                    value={sipDraft.frequency}
                    onChange={(event) => {
                      const frequency = String(event.target.value || 'monthly')
                      setSipDraft((prev) => ({
                        ...prev,
                        frequency,
                        day: clampSIPDay(frequency, prev.day)
                      }))
                    }}
                  >
                    {SIP_FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{sipDraft.frequency === 'monthly' ? '每月几号' : '周几'}</span>
                  <select
                    data-testid="sip-plan-day-select"
                    value={clampSIPDay(sipDraft.frequency, sipDraft.day)}
                    onChange={(event) => setSipDraft((prev) => ({
                      ...prev,
                      day: clampSIPDay(prev.frequency, event.target.value)
                    }))}
                  >
                    {sipDayOptions.map((option) => (
                      <option key={`${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {sipDraft.frequency !== 'monthly' ? (
                    <span className="settings-note">周投/双周定投仅支持 1-7（周一到周日）</span>
                  ) : null}
                  {sipDraft.frequency === 'monthly' && sipDayUpperBound === 31 ? (
                    <span className="settings-note">月投支持 1-31 号</span>
                  ) : null}
                </label>

                <label className="settings-sip-note-field">
                  <span>备注</span>
                  <input
                    data-testid="sip-plan-note-input"
                    value={sipDraft.note}
                    onChange={(event) => setSipDraft((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="可选"
                  />
                </label>
              </div>

              <div className="settings-secret-actions">
                <button
                  type="submit"
                  className="primary"
                  data-testid="sip-plan-submit-btn"
                  disabled={sipSaving}
                >
                  {sipSaving ? '保存中...' : (editingSipPlanId == null ? '创建计划' : '保存修改')}
                </button>
                <button type="button" className="ghost" onClick={resetSIPForm} disabled={sipSaving}>
                  取消
                </button>
              </div>
            </form>
          ) : null}

          {!hydratedSections.sip ? (
            <p className="settings-note">按需加载中。下一步：点击“加载计划”查看现有计划，或直接“新增计划”。</p>
          ) : null}
          {sipLoading ? <p className="settings-note">加载中...</p> : null}

          {hydratedSections.sip && !sipLoading && sipPlans.length === 0 ? (
            <p className="settings-note">暂无定投计划。下一步：点击“新增计划”完成配置。</p>
          ) : null}

          {hydratedSections.sip && sipPlans.length > 0 ? (
            <div className="plan-list" data-testid="sip-plan-list">
              {sipPlans.map((plan) => {
                const planId = plan?.id
                const busy = sipBusyPlanId === planId
                return (
                  <article key={planId} className="plan-item">
                    <div>
                      <h4>{String(plan?.fund_id || '--')} {plan?.fund_name ? `· ${String(plan.fund_name)}` : ''}</h4>
                      <p>
                        金额：¥{formatSIPAmount(plan?.amount)} ｜ 频率：{formatSIPSchedule(plan?.frequency, plan?.day)}
                      </p>
                      <p>
                        下次执行：{formatSIPDate(plan?.next_date)} ｜ 最近执行：{formatSIPDate(plan?.last_executed)}
                      </p>
                      {String(plan?.note || '').trim() ? <p>{`备注：${String(plan.note)}`}</p> : null}
                    </div>
                    <div className="plan-actions">
                      <span className={plan?.enabled ? 'record-done' : 'record-pending'}>
                        {plan?.enabled ? '启用中' : '已暂停'}
                      </span>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => startEditSIPPlan(plan)}
                        disabled={busy || sipSaving}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => toggleSIPPlanEnabled(plan)}
                        disabled={busy || sipSaving}
                      >
                        {plan?.enabled ? '暂停' : '启用'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => executeSIPPlanNow(planId)}
                        disabled={busy || sipSaving}
                      >
                        记录执行
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => deleteSIPPlanById(planId)}
                        disabled={busy || sipSaving}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>

        {renderSectionHeader(ExperimentOutlined, '网络与诊断', '用于排查链路、同步系统状态，并给出可复制的排障上下文。')}

        <div className="settings-group settings-group--network">
          <div className="settings-panel-header">
            <div className="settings-panel-header__copy">
              <span className="settings-panel-header__eyebrow">Network Snapshot</span>
              <h4>网络测速</h4>
              <p>先看当前测速配置和最近记录状态，再决定是读取历史还是立即执行新一轮测速。</p>
            </div>
          </div>
          {renderPanelOverview(benchmarkOverviewCards)}
          <div className="settings-form-grid settings-form-grid--dual">
            <label>
              <span>测速站点组</span>
              <select value={benchmarkProfile} onChange={(e) => setBenchmarkProfile(e.target.value)}>
                {PROFILE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>超时（秒）</span>
              <input
                type="number"
                min={1}
                max={12}
                value={timeoutSeconds}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  network_benchmark: {
                    ...prev.network_benchmark,
                    timeout_seconds: Number(e.target.value) || 6
                  }
                }))}
              />
            </label>
          </div>
          <div className="settings-secret-actions settings-secret-actions--toolbar">
            <button
              type="button"
              className="ghost"
              data-testid="benchmark-load-latest-btn"
              onClick={ensureBenchmarkHydrated}
              disabled={benchmarkLoading || benchmarkLatestLoading}
            >
              {hydratedSections.benchmark ? '已加载记录' : '加载最近记录'}
            </button>
            <button type="button" className="primary" onClick={executeBenchmark} disabled={benchmarkLoading || benchmarkLatestLoading}>
              {benchmarkLoading ? '测速中...' : '开始测速'}
            </button>
          </div>
          {benchmarkLatestLoading ? <p className="settings-note">加载中...</p> : null}
          {!hydratedSections.benchmark ? (
            <p className="settings-note">最近测速记录按需加载。下一步：点击“加载最近记录”查看历史，或直接“开始测速”。</p>
          ) : null}
          {benchmarkError && <p className="settings-error">{benchmarkError}</p>}
          {hydratedSections.benchmark && !benchmarkError && !benchmarkSummary && !hasBenchmarkRows && (
            <p className="settings-note">暂无测速记录。下一步：点击“开始测速”获取链路健康状态。</p>
          )}
          {benchmarkSummary ? renderPanelOverview(benchmarkSummaryCards, 'settings-panel-overview settings-panel-overview--compact') : null}
          {hasBenchmarkRows && (
            <div className="settings-benchmark-list">
              {benchmarkResult.results.map((item, index) => (
                <article key={`${item.site}-${index}`} className="settings-benchmark-item">
                  <span className="settings-benchmark-item__eyebrow">Latency Breakdown</span>
                  <div className="settings-benchmark-title">
                    <strong>{item.site}</strong>
                    <span className={item.ok ? 'ok' : 'bad'}>{item.ok ? '正常' : '失败'}</span>
                  </div>
                  <div className="settings-benchmark-metrics">
                    <span>DNS {item.dns_ms} ms</span>
                    <span>TCP {item.tcp_ms} ms</span>
                    <span>TLS {item.tls_ms} ms</span>
                    <span>TTFB {item.ttfb_ms} ms</span>
                    <span>TOTAL {item.total_ms} ms</span>
                  </div>
                  {!item.ok ? (
                    <p className="settings-error">
                      {item.error || '测速失败，未返回错误详情。下一步：稍后重试并检查后端服务状态。'}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>

        {renderSectionHeader(BellOutlined, '消息推送（预留）', '统一查看凭据状态、测试记录与自动发现入口。')}

        <div className="settings-group settings-group--messaging">
          <div className="settings-panel-header">
            <div className="settings-panel-header__copy">
              <span className="settings-panel-header__eyebrow">Feishu Delivery</span>
              <h4>飞书机器人（预留）</h4>
              <p>先确认通道状态、凭据状态与模板，再决定是否更新 Webhook 或调整发送参数。</p>
            </div>
          </div>
          {renderPanelOverview(feishuOverviewCards)}
          <div className="settings-form-grid settings-form-grid--triple">
            <label>
              <span>启用</span>
              <input
                type="checkbox"
                checked={Boolean(draft.notifications.feishu.enabled)}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    feishu: { ...prev.notifications.feishu, enabled: e.target.checked }
                  }
                }))}
              />
            </label>
            <label>
              <span>飞书超时（秒）</span>
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={draft.notifications.feishu.timeout_seconds ?? 3}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    feishu: { ...prev.notifications.feishu, timeout_seconds: Number(e.target.value) || 3 }
                  }
                }))}
              />
            </label>
            <label>
              <span>飞书重试次数</span>
              <input
                type="number"
                min={0}
                max={5}
                step={1}
                value={draft.notifications.feishu.retry_times ?? 2}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    feishu: { ...prev.notifications.feishu, retry_times: Math.max(0, Number(e.target.value) || 0) }
                  }
                }))}
              />
            </label>
            <label className="settings-form-grid__full">
              <span>飞书消息模板</span>
              <select
                value={draft.notifications.feishu.template || 'title_content_metadata'}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    feishu: { ...prev.notifications.feishu, template: e.target.value || 'title_content_metadata' }
                  }
                }))}
              >
                {FEISHU_TEMPLATE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings-secret-shell">
            <div className="settings-secret-shell__copy">
              <span className="settings-secret-shell__eyebrow">Credential</span>
              <strong>Webhook 地址</strong>
              <p>当前使用掩码展示的飞书 Webhook；只有在明确点击更新时才进入编辑态。</p>
            </div>
            <div className="settings-secret-block">
              {!showFeishuWebhookInput ? (
                <div className="settings-secret-preview">
                  <code className="settings-secret-value" data-testid="feishu-webhook-masked">
                    {maskedFeishuWebhook}
                  </code>
                  <button
                    type="button"
                    className="ghost"
                    data-testid="feishu-webhook-edit"
                    onClick={() => setEditingFeishuWebhook(true)}
                  >
                    更新凭据
                  </button>
                </div>
              ) : (
                <div className="settings-secret-editor">
                  <input
                    data-testid="feishu-webhook-input"
                    value={pendingFeishuWebhook}
                    onChange={(e) => setPendingFeishuWebhook(e.target.value)}
                    placeholder={hasFeishuWebhook ? '如需更换请输入新的 Webhook，留空则保持不变' : '填入飞书机器人 Webhook'}
                    autoComplete="off"
                  />
                  {hasFeishuWebhook && (
                    <div className="settings-secret-actions">
                      <button
                        type="button"
                        className="ghost"
                        data-testid="feishu-webhook-cancel-edit"
                        onClick={() => {
                          setPendingFeishuWebhook('')
                          setEditingFeishuWebhook(false)
                        }}
                      >
                        取消更新
                      </button>
                      <p className="settings-note">留空并保存将保持当前凭据不变。</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="settings-group settings-group--messaging">
          <div className="settings-panel-header">
            <div className="settings-panel-header__copy">
              <span className="settings-panel-header__eyebrow">Telegram Delivery</span>
              <h4>Telegram 机器人（预留）</h4>
              <p>把发送模式、凭据状态与自动发现入口整理到同一块面板里，降低调试时的上下跳转。</p>
            </div>
          </div>
          {renderPanelOverview(telegramOverviewCards)}
          <div className="settings-form-grid settings-form-grid--triple">
            <label>
              <span>启用</span>
              <input
                type="checkbox"
                checked={Boolean(draft.notifications.telegram.enabled)}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    telegram: { ...prev.notifications.telegram, enabled: e.target.checked }
                  }
                }))}
              />
            </label>
            <label>
              <span>消息格式</span>
              <span className="settings-note settings-note--field">{telegramMode}</span>
            </label>
            <label>
              <span>启用 HTML（安全转义）</span>
              <input
                type="checkbox"
                checked={String(draft.notifications.telegram.parse_mode || '').trim().toUpperCase() === 'HTML'}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    telegram: { ...prev.notifications.telegram, parse_mode: e.target.checked ? 'HTML' : '' }
                  }
                }))}
              />
            </label>
            <label>
              <span>禁用网页预览</span>
              <input
                type="checkbox"
                checked={Boolean(draft.notifications.telegram.disable_web_page_preview)}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    telegram: { ...prev.notifications.telegram, disable_web_page_preview: e.target.checked }
                  }
                }))}
              />
            </label>
            <label>
              <span>Telegram 超时（秒）</span>
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={draft.notifications.telegram.timeout_seconds ?? 3}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    telegram: { ...prev.notifications.telegram, timeout_seconds: Number(e.target.value) || 3 }
                  }
                }))}
              />
            </label>
            <label>
              <span>Telegram 重试次数</span>
              <input
                type="number"
                min={0}
                max={5}
                step={1}
                value={draft.notifications.telegram.retry_times ?? 2}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    telegram: { ...prev.notifications.telegram, retry_times: Math.max(0, Number(e.target.value) || 0) }
                  }
                }))}
              />
            </label>
          </div>

          <div className="settings-secret-shell">
            <div className="settings-secret-shell__copy">
              <span className="settings-secret-shell__eyebrow">Credential</span>
              <strong>机器人凭据</strong>
              <p>支持先保存 `bot_token`，再通过自动发现回写 `chat_id`；已有值始终以安全掩码或摘要形式展示。</p>
            </div>
            <div className="settings-secret-block">
              {!showTelegramCredentialInput ? (
                <div className="settings-secret-preview">
                  <code className="settings-secret-value">
                    {hasTelegramCredential
                      ? `已配置（chat_id=${currentTelegramChatId || '--'}）`
                      : (hasTelegramBotToken ? '已配置 bot_token（等待自动发现或手工填写 chat_id）' : '未配置')}
                  </code>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setEditingTelegramCredential(true)}
                  >
                    更新凭据
                  </button>
                </div>
              ) : (
                <div className="settings-secret-editor">
                  <input
                    type="password"
                    value={pendingTelegramBotToken}
                    onChange={(e) => setPendingTelegramBotToken(e.target.value)}
                    placeholder={hasTelegramCredential ? '如需更换请输入新的 bot_token，留空则保持不变' : '填入 bot_token'}
                    autoComplete="off"
                  />
                  <input
                    value={pendingTelegramChatId}
                    onChange={(e) => setPendingTelegramChatId(e.target.value)}
                    placeholder="可留空，后续通过自动发现或手工填入 chat_id（群通常为负数）"
                    autoComplete="off"
                  />
                  <p className="settings-note">`chat_id` 可留空；先保存 `bot_token` 后可通过自动发现回写。</p>
                  {hasTelegramCredential && (
                    <div className="settings-secret-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setPendingTelegramBotToken('')
                          setPendingTelegramChatId(currentTelegramChatId)
                          setEditingTelegramCredential(false)
                        }}
                      >
                        取消更新
                      </button>
                      <p className="settings-note">留空并保存将保持当前凭据不变。</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="settings-secret-actions settings-secret-actions--toolbar">
              <button
                type="button"
                className="ghost"
                data-testid="telegram-discovery-issue-btn"
                onClick={handleIssueTelegramDiscovery}
                disabled={telegramDiscoveryLoading || !canIssueTelegramDiscovery}
              >
                {telegramDiscoveryLoading ? '生成中...' : '生成自动发现地址'}
              </button>
              {!canIssueTelegramDiscovery ? (
                <p className="settings-note">请先保存 Telegram `bot_token`；如已修改凭据，先点击保存。</p>
              ) : null}
            </div>
            {telegramDiscoveryError ? <p className="settings-error">{telegramDiscoveryError}</p> : null}
            {telegramDiscoveryWebhook ? (
              <div className="settings-secret-callout">
                <div className="settings-secret-preview" data-testid="telegram-discovery-preview">
                  <code className="settings-secret-value">{telegramDiscoveryWebhook}</code>
                  <button
                    type="button"
                    className="ghost"
                    data-testid="telegram-discovery-copy-btn"
                    onClick={async () => {
                      const ok = await copyTextToClipboard(telegramDiscoveryWebhook)
                      if (ok) {
                        setDiagnosticHint('已复制 Telegram 自动发现 webhook URL。')
                      } else {
                        setTelegramDiscoveryError('复制失败：浏览器不支持剪贴板')
                      }
                    }}
                  >
                    复制
                  </button>
                </div>
                <p className="settings-note">
                  下一步：把该 URL 配到 Telegram webhook，然后给 bot 发一条消息，系统会自动回写 `chat_id`。
                </p>
              </div>
            ) : null}
          </div>

        </div>

        <div className="settings-group settings-group--diagnostics">
          <div className="settings-panel-header">
            <div className="settings-panel-header__copy">
              <span className="settings-panel-header__eyebrow">System Snapshot</span>
              <h4>系统状态</h4>
              <p>按需加载服务版本、健康检查和变更记录，先看快照，再决定是否继续排障。</p>
            </div>
          </div>
          {!hydratedSections.system ? <p className="settings-note">按需加载。下一步：点击“一键复制状态”或“加载系统状态”拉取最新后端状态。</p> : null}
          {systemStatusLoading || healthzLoading ? <p className="settings-note">加载中...</p> : null}
          {systemStatusError ? <p className="settings-error">{systemStatusError}</p> : null}
          {healthzError ? <p className="settings-error">{healthzError}</p> : null}

          <div className="settings-status-grid" data-testid="system-status-panel">
            <p data-testid="system-status-service">
              服务：<code>{String(systemStatusSnapshot?.service || '--')}</code>
            </p>
            <p data-testid="system-status-version">
              版本：<code>{String(systemStatusSnapshot?.version || '--')}</code>
            </p>
            <p data-testid="system-status-commit">
              commit：<code>{String(systemStatusSnapshot?.commit || '--')}</code>
            </p>
            <p data-testid="system-status-server-time">
              服务时间：<code>{formatDateTime(systemStatusSnapshot?.server_time || '')}</code>
            </p>
            <p data-testid="system-healthz-result">
              健康检查（/api/healthz）：<code>{healthzSnapshot ? 'ok' : (healthzError ? 'failed' : '--')}</code>
            </p>
          </div>

          <div className="settings-secret-actions settings-secret-actions--toolbar">
            <button
              type="button"
              className="ghost"
              data-testid="system-status-load-btn"
              onClick={ensureSystemHydrated}
              disabled={systemStatusLoading || healthzLoading}
            >
              {hydratedSections.system ? '已加载系统状态' : '加载系统状态'}
            </button>
            <button
              type="button"
              className="ghost"
              data-testid="system-status-copy-btn"
              onClick={handleCopySystemStatus}
              disabled={systemStatusLoading || healthzLoading}
            >
              一键复制状态
            </button>
          </div>

          {systemPanelHint ? <p className="settings-note">{systemPanelHint}</p> : null}
          {systemPanelError ? <p className="settings-error">{systemPanelError}</p> : null}

          <div className="settings-secret-actions settings-secret-actions--toolbar" style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="ghost"
              onClick={toggleAuditLogs}
              disabled={auditLogsLoading}
            >
              {auditLogsOpen ? '收起变更记录' : '查看变更记录'}
            </button>
          </div>

          {auditLogsOpen && (
            <div className="settings-audit-logs">
              {auditLogsLoading ? (
                <p className="settings-note">加载中...</p>
              ) : auditLogs.length === 0 ? (
                <p className="settings-note">暂无变更记录</p>
              ) : (
                <ul className="audit-log-list">
                  {auditLogs.map((log, idx) => (
                    <li key={log.id || idx} className="audit-log-item">
                      <span className="audit-time">{formatDateTime(log.created_at)}</span>
                      <span className="audit-action">{log.action}</span>
                      {log.note && <span className="audit-note">{log.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="settings-group settings-group--diagnostics">
          <div className="settings-panel-header">
            <div className="settings-panel-header__copy">
              <span className="settings-panel-header__eyebrow">Notification Diagnostics</span>
              <h4>通知诊断</h4>
              <p>统一查看 Feishu / Telegram 通道状态、最近测试结果与诊断动作，减少散装排障。</p>
            </div>
          </div>
          {!hydratedSections.diagnostics ? <p className="settings-note">按需加载。下一步：点击“加载诊断”或直接发送测试消息/复制诊断信息。</p> : null}
          {notificationsStatusLoading ? (
            <p className="settings-note">加载中...</p>
          ) : null}
          {notificationsStatusError ? (
            <p className="settings-error">{notificationsStatusError}</p>
          ) : null}

          {(() => {
            const root = asPlainObject(notificationsStatus)
            const feishuStatus = asPlainObject(root.feishu)
            const telegramStatus = asPlainObject(root.telegram)

            const feishuEnabled = feishuStatus.enabled ?? Boolean(draft.notifications.feishu.enabled)
            const telegramEnabled = telegramStatus.enabled ?? Boolean(draft.notifications.telegram.enabled)

            const feishuCredentialConfigured = Boolean(feishuStatus.credential_configured) || hasFeishuWebhook
            const telegramCredentialConfigured = Boolean(telegramStatus.credential_configured) || hasTelegramCredential

            const feishuLast = feishuStatus.last_test_summary ?? null
            const telegramLast = telegramStatus.last_test_summary ?? null
            const telegramDiscovery = asPlainObject(telegramStatus.discovery)
            const telegramDiscoveryLastSeen = formatDateTime(telegramDiscovery.last_seen_at)
            const diagnosticOverview = [
              {
                key: 'feishu',
                label: 'Feishu',
                value: feishuEnabled ? '已启用' : '未启用',
                hint: feishuCredentialConfigured ? '凭据已配置' : '凭据未配置'
              },
              {
                key: 'telegram',
                label: 'Telegram',
                value: telegramEnabled ? '已启用' : '未启用',
                hint: telegramCredentialConfigured ? '凭据已配置' : '凭据未配置'
              },
              {
                key: 'discovery',
                label: '自动发现',
                value: telegramDiscovery.secret_configured ? '已生成地址' : '未生成地址',
                hint: `最近 chat_id：${String(telegramDiscovery.last_chat_id || '--')}`
              }
            ]

            const parseLast = (last) => {
              const raw = asPlainObject(last)
              if (!raw || Object.keys(raw).length === 0) return null
              return {
                ok: raw.ok === true && raw.sent === true,
                traceId: String(raw.trace_id || '').trim(),
                time: formatDateTime(raw.time),
                errorCategory: String(raw.error_category || '').trim()
              }
            }

            const renderLast = (parsed, channelKey) => {
              if (!parsed) return '未测试/无记录'

              const pieces = []
              pieces.push(<span key="result">{parsed.ok ? '成功' : '失败'}</span>)

              if (parsed.traceId) {
                const copyTestId = `diagnostic-${channelKey}-trace-copy-btn`
                pieces.push(
                  <span key="trace">
                    {'｜trace_id: '}<code>{parsed.traceId}</code>{' '}
                    <button
                      type="button"
                      className="settings-inline-btn"
                      data-testid={copyTestId}
                      onClick={async () => {
                        try {
                          const ok = await copyTextToClipboard(parsed.traceId)
                          if (ok) {
                            handleDiagnosticToast({ type: 'success', message: `已复制 trace_id: ${parsed.traceId}` })
                          } else {
                            handleDiagnosticToast({ type: 'error', message: '复制失败：浏览器不支持剪贴板' })
                          }
                        } catch (error) {
                          const detail = String(error?.message || '').trim()
                          handleDiagnosticToast({ type: 'error', message: detail ? `复制失败：${detail}` : '复制失败' })
                        }
                      }}
                    >
                      复制
                    </button>
                  </span>
                )
              }

              if (parsed.time && parsed.time !== '--') {
                pieces.push(<span key="time">{`｜时间: ${parsed.time}`}</span>)
              }

              if (!parsed.ok && parsed.errorCategory) {
                pieces.push(<span key="error">{`｜错误: ${parsed.errorCategory}`}</span>)
              }

              return <span>{pieces}</span>
            }

            const canSendFeishu = feishuCredentialConfigured && !shouldUpdateFeishuWebhook
            const canSendTelegram = telegramCredentialConfigured && Boolean(currentTelegramChatId) && !shouldUpdateTelegramCredential

            // Cooldown handling
            const feishuCooldownRemaining = Number(feishuStatus.cooldown_remaining || 0)
            const telegramCooldownRemaining = Number(telegramStatus.cooldown_remaining || 0)
            const feishuInCooldown = feishuCooldownRemaining > 0
            const telegramInCooldown = telegramCooldownRemaining > 0

            const feishuDisabledReason = feishuInCooldown
              ? `冷却中（${feishuCooldownRemaining}秒）`
              : (!feishuCredentialConfigured
                ? '请先配置并保存凭据'
                : (shouldUpdateFeishuWebhook ? '已输入新凭据，请先保存设置' : ''))
            const telegramDisabledReason = telegramInCooldown
              ? `冷却中（${telegramCooldownRemaining}秒）`
              : (!telegramCredentialConfigured
              ? '请先配置并保存凭据'
              : (!currentTelegramChatId ? 'chat_id 为空；可先生成自动发现地址并给 bot 发消息' : (shouldUpdateTelegramCredential ? '已输入新凭据，请先保存设置' : '')))

            const parseHistory = (history) => {
              if (!Array.isArray(history)) return []
              return history
                .map((item) => {
                  const raw = asPlainObject(item)
                  if (!raw || Object.keys(raw).length === 0) return null
                  const ok = raw.ok === true
                  const sent = raw.sent === true
                  return {
                    ok,
                    sent,
                    success: ok && sent,
                    traceId: String(raw.trace_id || '').trim(),
                    time: formatDateTime(raw.time),
                    errorCategory: String(raw.error_category || '').trim()
                  }
                })
                .filter(Boolean)
            }

            const renderHistory = (channelKey, history, open, setOpen) => {
              const parsed = parseHistory(history)
              if (parsed.length === 0) return null
              const showCount = Math.min(parsed.length, 10)

              const toggleTestId = `diagnostic-${channelKey}-history-toggle-btn`
              return (
                <div className="diagnostic-history">
                  <button
                    type="button"
                    className="settings-inline-btn"
                    data-testid={toggleTestId}
                    onClick={() => setOpen((prev) => !prev)}
                  >
                    {open ? `收起最近记录（${showCount}）` : `展开最近记录（${showCount}）`}
                  </button>

                  {open ? (
                    <ul className="diagnostic-history-list" data-testid={`diagnostic-${channelKey}-history-list`}>
                      {parsed.slice(0, showCount).map((row, idx) => {
                        const traceCopyTestId = `diagnostic-${channelKey}-history-${idx}-trace-copy-btn`
                        return (
                          <li key={`${row.traceId || 'trace'}-${idx}`} className="diagnostic-history-item">
                            <span>{row.success ? '成功' : '失败'}</span>
                            {row.time && row.time !== '--' ? <span>{`｜时间: ${row.time}`}</span> : null}
                            <span>{`｜ok: ${row.ok ? 'true' : 'false'}`}</span>
                            <span>{`｜sent: ${row.sent ? 'true' : 'false'}`}</span>
                            {row.traceId ? (
                              <span>
                                {'｜trace_id: '}<code>{row.traceId}</code>{' '}
                                <button
                                  type="button"
                                  className="settings-inline-btn"
                                  data-testid={traceCopyTestId}
                                  onClick={async () => {
                                    try {
                                      const ok = await copyTextToClipboard(row.traceId)
                                      if (ok) {
                                        handleDiagnosticToast({ type: 'success', message: `已复制 trace_id: ${row.traceId}` })
                                      } else {
                                        handleDiagnosticToast({ type: 'error', message: '复制失败：浏览器不支持剪贴板' })
                                      }
                                    } catch (error) {
                                      const detail = String(error?.message || '').trim()
                                      handleDiagnosticToast({ type: 'error', message: detail ? `复制失败：${detail}` : '复制失败' })
                                    }
                                  }}
                                >
                                  复制
                                </button>
                              </span>
                            ) : null}
                            {!row.success && row.errorCategory ? <span>{`｜错误: ${row.errorCategory}`}</span> : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              )
            }

            return (
              <div className="settings-diagnostic-shell">
                <div className="settings-diagnostic-overview" aria-label="通知诊断概览">
                  {diagnosticOverview.map((item) => (
                    <article key={item.key} className="settings-diagnostic-overview__card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p>{item.hint}</p>
                    </article>
                  ))}
                </div>

                <div className="settings-diagnostic-summary">
                  <p>
                    飞书：{feishuEnabled ? '已启用' : '未启用'}｜凭据：{feishuCredentialConfigured ? '已配置' : '未配置'}｜最近：
                    {renderLast(parseLast(feishuLast), 'feishu')}
                  </p>
                  {renderHistory('feishu', feishuStatus.last_test_history, feishuHistoryOpen, setFeishuHistoryOpen)}
                  <p>
                    Telegram：{telegramEnabled ? '已启用' : '未启用'}｜凭据：{telegramCredentialConfigured ? '已配置' : '未配置'}｜最近：
                    {renderLast(parseLast(telegramLast), 'telegram')}
                  </p>
                  <p>
                    Telegram 自动发现：{telegramDiscovery.secret_configured ? '已生成地址' : '未生成地址'}｜
                    最近 chat_id：{String(telegramDiscovery.last_chat_id || '--')}｜
                    最近时间：{telegramDiscoveryLastSeen}
                    {telegramDiscovery.last_chat_title ? `｜会话：${String(telegramDiscovery.last_chat_title)}` : ''}
                  </p>
                  {renderHistory('telegram', telegramStatus.last_test_history, telegramHistoryOpen, setTelegramHistoryOpen)}
                </div>

                <div className="settings-secret-actions settings-secret-actions--toolbar">
                  <button
                    type="button"
                    className="ghost"
                    data-testid="diagnostic-load-btn"
                    onClick={ensureDiagnosticsHydrated}
                    disabled={notificationsStatusLoading}
                  >
                    {hydratedSections.diagnostics ? '已加载诊断' : '加载诊断'}
                  </button>
                  <TestMessageButton
                    label="飞书"
                    dataTestId="diagnostic-feishu-test-message-btn"
                    disabled={saving || !canSendFeishu || feishuInCooldown}
                    disabledReason={feishuDisabledReason}
                    onSend={onSendFeishuTestMessage}
                    onToast={handleDiagnosticToast}
                    afterSend={refreshNotificationsStatus}
                  />
                  <TestMessageButton
                    label="Telegram"
                    dataTestId="diagnostic-telegram-test-message-btn"
                    disabled={saving || !canSendTelegram || telegramInCooldown}
                    disabledReason={telegramDisabledReason}
                    onSend={onSendTelegramTestMessage}
                    onToast={handleDiagnosticToast}
                    afterSend={refreshNotificationsStatus}
                  />
                  <button
                    type="button"
                    className="ghost"
                    data-testid="diagnostic-copy-bundle-btn"
                    disabled={notificationsStatusLoading}
                    onClick={handleCopyDiagnosticBundle}
                  >
                    复制诊断信息
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    data-testid="diagnostic-test-all-btn"
                    disabled={saving || testAllLoading}
                    onClick={handleTestAll}
                  >
                    {testAllLoading ? '测试中...' : '测试全部通道'}
                  </button>
                </div>

                {testAllResult && (
                  <div className="settings-test-all-result">
                    <p className="test-all-summary">
                      测试结果：{testAllResult.summary?.passed || 0}/{testAllResult.summary?.tested || 0} 通过
                    </p>
                    {Object.entries(testAllResult.channels || {}).map(([channel, info]) => (
                      <p key={channel} className={`test-all-item ${info.ok ? 'success' : 'fail'}`}>
                        {channel === 'telegram' ? 'Telegram' : '飞书'}：
                        {!info.enabled && '未启用'}
                        {info.enabled && !info.credential_configured && '未配置凭据'}
                        {info.tested && (info.ok ? '✓ 通过' : `✗ 失败${info.error?.message ? `: ${info.error.message}` : ''}`)}
                      </p>
                    ))}
                  </div>
                )}

                {diagnosticHint ? <p className="settings-note">{diagnosticHint}</p> : null}
                {diagnosticError ? <p className="settings-error">{diagnosticError}</p> : null}
              </div>
            )
          })()}
        </div>

        <div className="settings-group">
          <h4>邮件推送（预留）</h4>
          <label>
            <span>启用</span>
            <input
              type="checkbox"
              checked={Boolean(draft.notifications.email.enabled)}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email: { ...prev.notifications.email, enabled: e.target.checked }
                }
              }))}
            />
          </label>
          <label>
            <span>收件人</span>
            <input
              value={draft.notifications.email.recipients || ''}
              onChange={(e) => updateDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email: { ...prev.notifications.email, recipients: e.target.value }
                }
              }))}
              placeholder="多个邮箱使用逗号分隔"
            />
          </label>
        </div>

        <div>
          {saveError && <p className="settings-error">{saveError}</p>}
        </div>
      </Drawer>
    )
  }
