import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useAuth } from './hooks/useAuth.js'
import { usePortfolio } from './hooks/usePortfolio.js'
import {
  fetchActions,
  fetchDailyReport,
  fetchFundDetail,
  fetchFundNavHistory,
  fetchFundNavLatest,
  fetchHoldingAudit,
  fetchTransactionAudit,
  fetchFundSuggest,
  fetchTransactions,
  fetchSystemStatus,
  patchTransaction,
  saveAction,
  searchFunds,
  syncPendingTransactions,
  AUTH_EVENT_EXPIRY
} from './api.js'
import { Layout, Spin, Alert, Button, Input, InputNumber, DatePicker, Checkbox, Select, message, Table, Tag, Tooltip, Space } from 'antd'
import { 
  ReloadOutlined, SettingOutlined, UserOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, 
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined 
} from '@ant-design/icons'
import { buildFundSeries, splitMarketGroups } from './utils/chart.js'
import { cycleSortState } from './utils/holdings.js'
import { classBySign, formatDate, formatDateTime, formatMoney, formatPercent } from './utils/format.js'
import { toGuidedError } from './utils/errorFeedback.js'
import { resolveGlobalSearchTarget } from './utils/searchRouting.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { LoginPanel } from './components/LoginPanel.jsx'
import { TopToolbar } from './components/TopToolbar.jsx'
import { SummaryCards } from './components/SummaryCards.jsx'
import { ReturnsChart } from './components/ReturnsChart.jsx'
import { BenchmarkComparison } from './components/BenchmarkComparison.jsx'
import { SIPPlanManager } from './components/SIPPlanManager.jsx'
import { HoldingsTable } from './components/HoldingsTable.jsx'
import { FundDetailPanel } from './components/FundDetailPanel.jsx'
import { RiskCenter } from './components/RiskCenter.jsx'
import { RiskStatusBar } from './components/RiskStatusBar.jsx'
import { PortfolioReturnsPanel } from './components/PortfolioReturnsPanel.jsx'
import { BenchmarkComparisonPanel } from './components/BenchmarkComparisonPanel.jsx'
import { SettingsDrawer } from './components/SettingsDrawer.jsx'
import { SideNav } from './components/SideNav.jsx'
import { BottomTabs } from './components/BottomTabs.jsx'
import { StateShowcase } from './components/StateShowcase.jsx'
import { DataStatusBanner } from './components/DataStatusBanner.jsx'
import { DiagnosticsPanel } from './components/DiagnosticsPanel.jsx'
import { recordMetric } from './utils/metrics.js'
import { computeNextRunDate, daysUntil, getDcaScheduleLabel, normalizeDcaSchedule } from './utils/dca.js'

const TRADE_TYPES = [
  { key: 'buy', label: '买入' },
  { key: 'dca', label: '定投' },
  { key: 'redeem', label: '赎回' },
  { key: 'convert', label: '转换' },
  { key: 'dividend', label: '分红' }
]

function nowForDateTimeInput() {
  const now = new Date()
  now.setSeconds(0, 0)
  const offset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

function isoToDateTimeInput(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function compareActionRecordsDesc(a, b) {
  const aTime = String(a?.occurred_at || a?.ts || '')
  const bTime = String(b?.occurred_at || b?.ts || '')
  return bTime.localeCompare(aTime)
}

function compareTransactionRecordsDesc(a, b) {
  const aTime = String(a?.occurred_at || '')
  const bTime = String(b?.occurred_at || '')
  if (aTime === bTime) {
    return Number(b?.id || 0) - Number(a?.id || 0)
  }
  return bTime.localeCompare(aTime)
}

function transactionActionLabel(action) {
  const key = String(action || '').toLowerCase()
  if (key === 'buy') return '买入'
  if (key === 'redeem') return '赎回'
  if (key === 'sip') return '定投'
  if (key === 'switch_in') return '转入'
  if (key === 'switch_out') return '转出'
  if (key === 'dividend') return '分红'
  return key || '--'
}

function holdingAuditActionLabel(action) {
  const key = String(action || '').toLowerCase()
  if (key === 'create') return '新增持仓'
  if (key === 'replace') return '覆盖持仓'
  if (key === 'patch') return '编辑持仓'
  if (key === 'archive') return '归档持仓'
  return key || '--'
}

function parseChangedFields(note) {
  const text = String(note || '')
  const matched = text.match(/fields=([a-zA-Z0-9_,]+)/)
  if (!matched) return []
  return String(matched[1] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildTransactionLifecycle(summary) {
  const totalCount = Number(summary?.total_count || 0)
  const pendingCount = Number(summary?.pending_count || 0)
  const confirmedCount = Number(summary?.confirmed_count || 0)

  if (totalCount <= 0) {
    return {
      step: 1,
      note: '当前无交易流水，新增交易后将进入 pending 阶段。'
    }
  }

  if (pendingCount > 0 && confirmedCount <= 0) {
    return {
      step: 1,
      note: `当前 ${pendingCount} 笔交易待确认，确认后会自动计入收益。`
    }
  }

  if (pendingCount > 0) {
    return {
      step: 2,
      note: `当前 ${pendingCount} 笔待确认，${confirmedCount} 笔已确认并计入收益。`
    }
  }

  return {
    step: 3,
    note: '当前交易均已确认，已进入收益口径。'
  }
}

function lifecycleStepClass(currentStep, targetStep) {
  if (currentStep > targetStep) return 'is-done'
  if (currentStep === targetStep) return 'is-active'
  return ''
}

function marketGroupLabel(value) {
  const key = String(value || '').toLowerCase()
  if (key === 'us_overseas') return '美股/海外'
  if (key === 'cn_hk') return 'A股/港股'
  return key ? key : '--'
}

function defaultBucketByMarketGroup(value) {
  return String(value || '').toLowerCase() === 'us_overseas' ? 'overseas' : 'core'
}

function parseTagList(text) {
  return String(text || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseFundIdFromPath(pathname) {
  const match = String(pathname || '').match(/^\/funds\/([^/]+)$/)
  if (!match) return ''
  try {
    return decodeURIComponent(match[1] || '').trim()
  } catch {
    return String(match[1] || '').trim()
  }
}

function isSystemStatusPath(pathname) {
  return /^\/system\/status\/?$/.test(String(pathname || ''))
}

function mergeDataStatus(items, fallbackNote = '暂无状态说明') {
  const list = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : []
  if (list.length === 0) {
    return { status: 'estimating', asof: '', note: fallbackNote }
  }

  const score = { confirmed: 1, estimating: 2, partial: 3 }
  let pickedStatus = 'confirmed'
  let pickedScore = 1
  let pickedAsof = ''
  const notes = []

  for (const item of list) {
    const status = String(item.status || 'estimating').toLowerCase()
    const normalizedStatus = status === 'confirmed' || status === 'partial' ? status : 'estimating'
    const currentScore = score[normalizedStatus] || 2
    if (currentScore > pickedScore) {
      pickedScore = currentScore
      pickedStatus = normalizedStatus
    }
    const asof = String(item.asof || '').trim()
    if (asof && asof > pickedAsof) pickedAsof = asof
    const note = String(item.note || '').trim()
    if (note) notes.push(note)
  }

  const uniqueNotes = [...new Set(notes)]
  return {
    status: pickedStatus,
    asof: pickedAsof,
    note: uniqueNotes[0] || fallbackNote
  }
}

function App() {
  const [sortState, setSortState] = useState({ key: 'market_value_cny', order: 'desc' })
  const [selectedFundId, setSelectedFundId] = useState('')
  const [holdingAuditFundId, setHoldingAuditFundId] = useState('')
  const [holdingAuditItems, setHoldingAuditItems] = useState([])
  const [holdingAuditLoading, setHoldingAuditLoading] = useState(false)
  const [holdingAuditError, setHoldingAuditError] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [fundCenterQuery, setFundCenterQuery] = useState('')
  const [fundCenterItems, setFundCenterItems] = useState([])
  const [fundCenterLoading, setFundCenterLoading] = useState(false)
  const [fundCenterError, setFundCenterError] = useState('')
  const [fundCenterSelectedId, setFundCenterSelectedId] = useState('')
  const [fundCenterDetailLoading, setFundCenterDetailLoading] = useState(false)
  const [fundCenterDetailError, setFundCenterDetailError] = useState('')
  const [fundCenterDetail, setFundCenterDetail] = useState(null)
  const [fundCenterNavLatest, setFundCenterNavLatest] = useState(null)
  const [fundCenterNavHistory, setFundCenterNavHistory] = useState([])
  const [fundCenterTxSummary, setFundCenterTxSummary] = useState({
    total_count: 0,
    pending_count: 0,
    confirmed_count: 0,
    last_occurred_at: ''
  })
  const [fundCenterDataStatus, setFundCenterDataStatus] = useState({
    status: 'estimating',
    asof: '',
    note: '请输入基金关键词后查看状态'
  })
  const [fundCenterSyncLoading, setFundCenterSyncLoading] = useState(false)
  const [fundCenterSyncError, setFundCenterSyncError] = useState('')
  const [fundCenterSyncResult, setFundCenterSyncResult] = useState(null)
  const [actionLogs, setActionLogs] = useState([])
  const [actionDataStatus, setActionDataStatus] = useState({
    status: 'estimating',
    asof: '',
    note: '交易记录状态待加载'
  })
  const [transactionLogs, setTransactionLogs] = useState([])
  const [transactionSummary, setTransactionSummary] = useState({
    total_count: 0,
    pending_count: 0,
    confirmed_count: 0,
    last_occurred_at: ''
  })
  const [transactionDataStatus, setTransactionDataStatus] = useState({
    status: 'estimating',
    asof: '',
    note: '交易流水状态待加载'
  })
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [transactionError, setTransactionError] = useState('')
  const [transactionFilterStatus, setTransactionFilterStatus] = useState('all')
  const [editingTransactionId, setEditingTransactionId] = useState(0)
  const [editingTransactionForm, setEditingTransactionForm] = useState({
    occurred_at: '',
    status: 'pending',
    confirmed_at: '',
    nav: '',
    note: '',
    audit_note: ''
  })
  const [transactionPatchLoading, setTransactionPatchLoading] = useState(false)
  const [transactionPatchError, setTransactionPatchError] = useState('')
  const [transactionPatchResult, setTransactionPatchResult] = useState(null)
  const [transactionAuditTargetId, setTransactionAuditTargetId] = useState(0)
  const [transactionAuditLoading, setTransactionAuditLoading] = useState(false)
  const [transactionAuditError, setTransactionAuditError] = useState('')
  const [transactionAuditItems, setTransactionAuditItems] = useState([])
  const [syncPendingLoading, setSyncPendingLoading] = useState(false)
  const [syncPendingError, setSyncPendingError] = useState('')
  const [syncPendingResult, setSyncPendingResult] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [tradeType, setTradeType] = useState('buy')
  const [tradeFundCode, setTradeFundCode] = useState('')
  const [tradeFundSuggestions, setTradeFundSuggestions] = useState([])
  const [tradeFundSuggestLoading, setTradeFundSuggestLoading] = useState(false)
  const [holdingCreateForm, setHoldingCreateForm] = useState({
    fund_id: '',
    name: '',
    bucket: 'core',
    market_group: 'cn_hk',
    tags_text: ''
  })
  const [holdingCreateSuggestions, setHoldingCreateSuggestions] = useState([])
  const [holdingCreateSuggestLoading, setHoldingCreateSuggestLoading] = useState(false)
  const [holdingCreateSubmitting, setHoldingCreateSubmitting] = useState(false)
  const [holdingCreateError, setHoldingCreateError] = useState('')
  const [holdingCreateResult, setHoldingCreateResult] = useState(null)
  const [holdingAutoFillLoadingFundId, setHoldingAutoFillLoadingFundId] = useState('')
  const [holdingAutoFillError, setHoldingAutoFillError] = useState('')
  const [holdingAutoFillResult, setHoldingAutoFillResult] = useState(null)
  const [tradeAmount, setTradeAmount] = useState('')
  const [tradeOccurredAt, setTradeOccurredAt] = useState(() => nowForDateTimeInput())
  const [tradeDone, setTradeDone] = useState(false)
  const [tradeSubmitting, setTradeSubmitting] = useState(false)
  const [tradeSubmitError, setTradeSubmitError] = useState('')
  const [tradeSubmitResult, setTradeSubmitResult] = useState(null)
  const [planName, setPlanName] = useState('')
  const [planFundCode, setPlanFundCode] = useState('')
  const [planAmount, setPlanAmount] = useState('')
  const [planSchedule, setPlanSchedule] = useState('weekly')
  const [planSubmitting, setPlanSubmitting] = useState(false)
  const [planError, setPlanError] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleFundCode, setRuleFundCode] = useState('')
  const [ruleOperator, setRuleOperator] = useState('<=')
  const [ruleThreshold, setRuleThreshold] = useState('')
  const [ruleSilentHours, setRuleSilentHours] = useState('24')
  const [ruleSubmitting, setRuleSubmitting] = useState(false)
  const [ruleError, setRuleError] = useState('')
  const [reportSummary, setReportSummary] = useState('')
  const [reportDataQuality, setReportDataQuality] = useState(null)
  const [assetReadyMs, setAssetReadyMs] = useState(0)
  const [assetTimedOut, setAssetTimedOut] = useState(false)
  const [skeletonLock, setSkeletonLock] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileView, setProfileView] = useState('overview')
  const [systemStatusLoading, setSystemStatusLoading] = useState(false)
  const [systemStatusError, setSystemStatusError] = useState('')
  const [systemStatusData, setSystemStatusData] = useState(null)
  const firstLoadStartRef = useRef(0)
  const riskCenterRef = useRef(null)

  const { user, authLoading, authReady, login, logout } = useAuth()
  const { Content } = Layout
  const {
    rows,
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
  } = usePortfolio({ user, sorter: sortState })

  const dateLabel = useMemo(() => {
    if (asof && asof !== '--') {
      const fromAsof = formatDate(asof)
      if (fromAsof !== '--') return fromAsof
    }
    return formatDate(new Date())
  }, [asof])

  const sparklineMap = useMemo(() => {
    const map = {}
    rows.forEach((row) => {
      map[row.fund_id] = buildFundSeries(row, '1m').map((item) => ({ label: item.label, value: item.fund }))
    })
    return map
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => {
      const name = String(row.name || '').toLowerCase()
      const code = String(row.fund_id || '').toLowerCase()
      return name.includes(query) || code.includes(query)
    })
  }, [rows, searchQuery])

  const { domestic, overseas } = useMemo(() => splitMarketGroups(filteredRows), [filteredRows])
  const { domestic: homeDomesticRows, overseas: homeOverseasRows } = useMemo(() => splitMarketGroups(rows), [rows])
  const homeDomesticPreview = useMemo(() => [...homeDomesticRows].sort((a, b) => Number(b.market_value_cny || 0) - Number(a.market_value_cny || 0)).slice(0, 4), [homeDomesticRows])
  const homeOverseasPreview = useMemo(() => [...homeOverseasRows].sort((a, b) => Number(b.market_value_cny || 0) - Number(a.market_value_cny || 0)).slice(0, 4), [homeOverseasRows])
  const hasOverseasHoldings = useMemo(
    () => rows.some((row) => String(row.market_group || '').toLowerCase() === 'overseas'),
    [rows]
  )
  const marketDataHint = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const isWeekend = day === 0 || day === 6
    const cnPart = isWeekend
      ? 'A股周末休市，当前显示最近交易日结算数据。'
      : 'A股按北京时间交易时段更新，非交易时段显示最近结算数据。'
    const usPart = hasOverseasHoldings
      ? '美股盘中显示估算值，北京时间凌晨收盘后切换为结算值；美股周末同样休市。'
      : '当前持仓无美股/海外基金。'
    return `${cnPart} ${usPart}`
  }, [hasOverseasHoldings])

  const currentFund = useMemo(() => {
    if (!filteredRows.length) return null
    const target = filteredRows.find((item) => item.fund_id === selectedFundId)
    return target || filteredRows[0]
  }, [filteredRows, selectedFundId])
  const fundDetailChartDataStatus = useMemo(() => {
    if (!currentFund) {
      return estimateDataStatus && typeof estimateDataStatus === 'object'
        ? estimateDataStatus
        : { status: 'estimating', asof: '', note: '请选择基金后查看图表口径' }
    }
    const confirmState = String(currentFund.confirm_state || '').toLowerCase()
    const status = confirmState === 'confirmed' || confirmState === 'partial' ? confirmState : 'estimating'
    const noteMap = {
      confirmed: '基金图表基于已确认净值，可用于结算口径复盘',
      partial: '基金图表存在部分估算或缺口，请结合交易状态核对',
      estimating: '基金图表当前为估算口径，收盘后将逐步切换为确认值'
    }
    return {
      status,
      asof: String(currentFund.as_of || estimateDataStatus?.asof || '').trim(),
      note: noteMap[status]
    }
  }, [currentFund, estimateDataStatus])

  const topMovers = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => Math.abs(Number(b.day_profit_cny || 0)) - Math.abs(Number(a.day_profit_cny || 0)))
      .slice(0, 6)
  }, [filteredRows])

  const dcaPlans = useMemo(() => {
    const items = settings?.strategy?.dca_plans
    return Array.isArray(items) ? items : []
  }, [settings])

  const dcaStatusMap = useMemo(() => {
    const map = {}
    for (const item of actionLogs) {
      const key = String(item?.action_key || '')
      if (!key.startsWith('dca_plan_')) continue
      const planId = key.slice('dca_plan_'.length)
      if (!planId || map[planId]) continue
      map[planId] = item.done ? 'ok' : 'failed'
    }
    return map
  }, [actionLogs])

  const dcaLastRunAtMap = useMemo(() => {
    const map = {}
    for (const item of actionLogs) {
      const key = String(item?.action_key || '')
      if (!key.startsWith('dca_plan_')) continue
      const planId = key.slice('dca_plan_'.length)
      if (!planId || map[planId]) continue
      const occurredAt = item?.occurred_at || item?.ts
      if (!occurredAt) continue
      map[planId] = occurredAt
    }
    return map
  }, [actionLogs])

  const dcaFailedPlans = useMemo(() => {
    return dcaPlans.filter((plan) => dcaStatusMap[String(plan.id)] === 'failed')
  }, [dcaPlans, dcaStatusMap])

  const reminderRules = useMemo(() => {
    const items = settings?.notifications?.rules
    return Array.isArray(items) ? items : []
  }, [settings])

  const reminderRuleStates = useMemo(() => {
    return reminderRules.map((rule) => {
      const targetRows = rule.fund_id
        ? rows.filter((row) => String(row.fund_id) === String(rule.fund_id))
        : rows
      const values = targetRows.map((row) => Number(row.estimate_pct || 0))
      const minValue = values.length > 0 ? Math.min(...values) : null
      const maxValue = values.length > 0 ? Math.max(...values) : null
      let hit = false
      if (values.length > 0) {
        if (rule.operator === '<=') hit = values.some((value) => value <= Number(rule.threshold))
        if (rule.operator === '>=') hit = values.some((value) => value >= Number(rule.threshold))
      }
      return {
        ...rule,
        hit: Boolean(rule.enabled) && hit,
        currentValue: rule.operator === '<=' ? minValue : maxValue,
        scopeCount: targetRows.length
      }
    })
  }, [reminderRules, rows])
  const transactionLifecycle = useMemo(
    () => buildTransactionLifecycle(transactionSummary),
    [transactionSummary]
  )

  const handleToggleAutoRefresh = () => {
    setAutoRefreshEnabled(!settings.display.auto_refresh_enabled)
  }

  const handleOpenTradeEntry = useCallback((source = 'unknown') => {
    recordMetric('交易入口点击', { source })
    setActiveTab('trade')
  }, [])

  const handleSortByKey = useCallback((key) => {
    setSortState((prev) => cycleSortState(prev, key))
  }, [])

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey)
    if (tabKey !== 'watch' && window.location.pathname.startsWith('/funds/')) {
      window.history.pushState({}, '', '/')
    }
    if (tabKey !== 'profile' && isSystemStatusPath(window.location.pathname)) {
      setProfileView('overview')
      window.history.pushState({}, '', '/')
    }
  }

  const openSystemStatusView = () => {
    setActiveTab('profile')
    setProfileView('system-status')
    if (!isSystemStatusPath(window.location.pathname)) {
      window.history.pushState({}, '', '/system/status')
    }
  }

  const openProfileOverview = () => {
    setProfileView('overview')
    if (isSystemStatusPath(window.location.pathname)) {
      window.history.pushState({}, '', '/')
    }
  }

  const loadSystemStatus = async () => {
    setSystemStatusLoading(true)
    setSystemStatusError('')
    try {
      const payload = await fetchSystemStatus()
      setSystemStatusData(payload || null)
    } catch (error) {
      setSystemStatusData(null)
      setSystemStatusError(error?.message || '系统状态加载失败')
    } finally {
      setSystemStatusLoading(false)
    }
  }

  const handleOpenHoldingAudit = useCallback(async (fundId) => {
    const cleanFundId = String(fundId || '').trim()
    if (!cleanFundId) return
    setHoldingAuditFundId(cleanFundId)
    setHoldingAuditError('')
    setHoldingAuditItems([])
    setHoldingAuditLoading(true)
    try {
      const payload = await fetchHoldingAudit(cleanFundId, 80)
      const items = Array.isArray(payload?.items) ? payload.items : []
      setHoldingAuditItems(items)
    } catch (error) {
      setHoldingAuditError(error?.message || '持仓审计记录加载失败')
      setHoldingAuditItems([])
    } finally {
      setHoldingAuditLoading(false)
    }
  }, [])

  const handleJumpToRiskCenter = () => {
    const node = riskCenterRef.current
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    recordMetric('应用打开')
  }, [])

  useEffect(() => {
    const applyPathState = () => {
      const fundIdFromPath = parseFundIdFromPath(window.location.pathname)
      if (fundIdFromPath) {
        setActiveTab('watch')
        setFundCenterSelectedId(fundIdFromPath)
        setFundCenterQuery((prev) => prev || fundIdFromPath)
        return
      }
      if (isSystemStatusPath(window.location.pathname)) {
        setActiveTab('profile')
        setProfileView('system-status')
        return
      }
      setProfileView('overview')
    }

    applyPathState()
    window.addEventListener('popstate', applyPathState)
    return () => {
      window.removeEventListener('popstate', applyPathState)
    }
  }, [])

  useEffect(() => {
    if (user) return
    setHoldingAuditFundId('')
    setHoldingAuditItems([])
    setHoldingAuditLoading(false)
    setHoldingAuditError('')
  }, [user])

  useEffect(() => {
    if (!user) return
    if (activeTab !== 'profile') return
    if (profileView !== 'system-status') return
    loadSystemStatus()
  }, [activeTab, profileView, user])

  useEffect(() => {
    const keyword = searchQuery.trim()
    if (!keyword) {
      setSuggestions([])
      setSearchLoading(false)
      return undefined
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true)
        const payload = await fetchFundSuggest(keyword, 8)
        const items = Array.isArray(payload?.items) ? payload.items : []
        setSuggestions(items)
        recordMetric('搜索联想返回', {
          scene: 'global',
          keyword: keyword.slice(0, 40),
          result_count: items.length
        })
      } catch {
        setSuggestions([])
        recordMetric('搜索联想失败', { scene: 'global', keyword: keyword.slice(0, 40) })
      } finally {
        setSearchLoading(false)
      }
    }, 280)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (activeTab !== 'watch') return undefined
    const keyword = fundCenterQuery.trim()
    if (!keyword) {
      setFundCenterItems([])
      setFundCenterDataStatus({
        status: 'estimating',
        asof: '',
        note: '请输入基金关键词后查看状态'
      })
      setFundCenterError('')
      setFundCenterLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setFundCenterLoading(true)
        setFundCenterError('')
        const payload = await searchFunds(keyword, 12)
        if (!active) return
        const items = Array.isArray(payload?.items) ? payload.items : []
        setFundCenterItems(items)
        recordMetric('搜索联想返回', {
          scene: 'fund_center',
          keyword: keyword.slice(0, 40),
          result_count: items.length
        })
        setFundCenterDataStatus(
          payload?.data_status && typeof payload.data_status === 'object'
            ? payload.data_status
            : {
                status: 'estimating',
                asof: '',
                note: '基金搜索已完成'
              }
        )
      } catch (error) {
        if (!active) return
        setFundCenterItems([])
        recordMetric('搜索联想失败', { scene: 'fund_center', keyword: keyword.slice(0, 40) })
        setFundCenterDataStatus({
          status: 'partial',
          asof: '',
          note: error?.message || '基金搜索失败'
        })
        setFundCenterError(error?.message || '基金搜索失败')
      } finally {
        if (active) setFundCenterLoading(false)
      }
    }, 280)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeTab, fundCenterQuery])

  useEffect(() => {
    if (activeTab !== 'watch') return undefined
    const fundId = String(fundCenterSelectedId || '').trim()
    if (!fundId) {
      setFundCenterDetail(null)
      setFundCenterNavLatest(null)
      setFundCenterNavHistory([])
      setFundCenterTxSummary({
        total_count: 0,
        pending_count: 0,
        confirmed_count: 0,
        last_occurred_at: ''
      })
      setFundCenterSyncLoading(false)
      setFundCenterSyncError('')
      setFundCenterSyncResult(null)
      setFundCenterDataStatus((prev) =>
        prev?.note ? prev : { status: 'estimating', asof: '', note: '请选择基金后查看详情口径' }
      )
      setFundCenterDetailError('')
      setFundCenterDetailLoading(false)
      return undefined
    }

    let active = true
    ;(async () => {
      try {
        setFundCenterDetailLoading(true)
        setFundCenterDetailError('')
        const [detailPayload, latestPayload, historyPayload, txPayload] = await Promise.all([
          fetchFundDetail(fundId),
          fetchFundNavLatest(fundId),
          fetchFundNavHistory(fundId, { limit: 60 }),
          fetchTransactions({ fundId, status: 'all', limit: 80 })
        ])
        if (!active) return
        setFundCenterDetail(detailPayload?.fund || null)
        setFundCenterNavLatest(latestPayload?.latest || null)
        setFundCenterNavHistory(Array.isArray(historyPayload?.items) ? historyPayload.items : [])
        setFundCenterTxSummary(
          txPayload?.summary && typeof txPayload.summary === 'object'
            ? txPayload.summary
            : {
                total_count: 0,
                pending_count: 0,
                confirmed_count: 0,
                last_occurred_at: ''
              }
        )
        setFundCenterSyncError('')
        setFundCenterSyncResult(null)
        setFundCenterDataStatus(
          mergeDataStatus(
            [detailPayload?.data_status, latestPayload?.data_status, historyPayload?.data_status, txPayload?.data_status],
            '基金详情已加载'
          )
        )
      } catch (error) {
        if (!active) return
        setFundCenterDetail(null)
        setFundCenterNavLatest(null)
        setFundCenterNavHistory([])
        setFundCenterTxSummary({
          total_count: 0,
          pending_count: 0,
          confirmed_count: 0,
          last_occurred_at: ''
        })
        setFundCenterDataStatus({
          status: 'partial',
          asof: '',
          note: error?.message || '基金详情加载失败'
        })
        setFundCenterDetailError(error?.message || '基金详情加载失败')
      } finally {
        if (active) setFundCenterDetailLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [activeTab, fundCenterSelectedId])

  useEffect(() => {
    if (activeTab !== 'trade') return undefined
    const keyword = String(tradeFundCode || '').trim()
    if (!keyword) {
      setTradeFundSuggestions([])
      setTradeFundSuggestLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setTradeFundSuggestLoading(true)
        const payload = await fetchFundSuggest(keyword, 6)
        if (!active) return
        const items = Array.isArray(payload?.items) ? payload.items : []
        setTradeFundSuggestions(items)
        recordMetric('搜索联想返回', {
          scene: 'trade',
          keyword: keyword.slice(0, 40),
          result_count: items.length
        })
      } catch {
        if (!active) return
        setTradeFundSuggestions([])
        recordMetric('搜索联想失败', { scene: 'trade', keyword: keyword.slice(0, 40) })
      } finally {
        if (active) setTradeFundSuggestLoading(false)
      }
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeTab, tradeFundCode])

  useEffect(() => {
    if (activeTab !== 'holdings') return undefined
    const keyword = String(holdingCreateForm.fund_id || '').trim()
    if (!keyword) {
      setHoldingCreateSuggestions([])
      setHoldingCreateSuggestLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setHoldingCreateSuggestLoading(true)
        const payload = await fetchFundSuggest(keyword, 8)
        if (!active) return
        const items = Array.isArray(payload?.items) ? payload.items : []
        setHoldingCreateSuggestions(items)
        recordMetric('搜索联想返回', {
          scene: 'holdings_create',
          keyword: keyword.slice(0, 40),
          result_count: items.length
        })
      } catch {
        if (!active) return
        setHoldingCreateSuggestions([])
        recordMetric('搜索联想失败', { scene: 'holdings_create', keyword: keyword.slice(0, 40) })
      } finally {
        if (active) setHoldingCreateSuggestLoading(false)
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeTab, holdingCreateForm.fund_id])

  const handlePickSuggestion = (item) => {
    const pickedCode = String(item?.fund_id || '').trim()
    if (!pickedCode) return
    const target = resolveGlobalSearchTarget(rows, pickedCode)
    recordMetric('搜索转化', {
      scene: 'global',
      keyword: String(searchQuery || '').trim().slice(0, 40),
      fund_id: pickedCode,
      target
    })

    if (target === 'holdings') {
      setSearchQuery(pickedCode)
      setSelectedFundId(pickedCode)
      setActiveTab('holdings')
    } else {
      const nextPath = `/funds/${encodeURIComponent(pickedCode)}`
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath)
      }
      setFundCenterQuery(String(item?.name || pickedCode).trim() || pickedCode)
      setFundCenterSelectedId(pickedCode)
      setActiveTab('watch')
    }
    setSuggestions([])
  }

  const handlePickFundCenter = (item) => {
    const pickedCode = String(item?.fund_id || '').trim()
    if (!pickedCode) return
    recordMetric('搜索转化', {
      scene: 'fund_center',
      keyword: String(fundCenterQuery || '').trim().slice(0, 40),
      fund_id: pickedCode,
      target: 'fund_detail'
    })
    const nextPath = `/funds/${encodeURIComponent(pickedCode)}`
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setActiveTab('watch')
    setFundCenterSelectedId(pickedCode)
  }

  const handlePickTradeSuggestion = useCallback((item) => {
    const pickedCode = String(item?.fund_id || '').trim()
    if (!pickedCode) return
    recordMetric('搜索转化', {
      scene: 'trade',
      keyword: String(tradeFundCode || '').trim().slice(0, 40),
      fund_id: pickedCode,
      target: 'trade_form'
    })
    setTradeFundCode(pickedCode)
  }, [tradeFundCode])

  const handlePickHoldingCreateSuggestion = useCallback((item) => {
    const pickedCode = String(item?.fund_id || '').trim()
    if (!pickedCode) return
    const pickedName = String(item?.name || '').trim()
    const marketGroup = String(item?.market_group || 'cn_hk').trim().toLowerCase() || 'cn_hk'
    const tagsText = Array.isArray(item?.tags) ? item.tags.filter(Boolean).join(',') : ''
    setHoldingCreateForm((prev) => ({
      ...prev,
      fund_id: pickedCode,
      name: pickedName || prev.name,
      market_group: marketGroup,
      bucket: defaultBucketByMarketGroup(marketGroup),
      tags_text: tagsText
    }))
    setHoldingCreateSuggestions([])
    recordMetric('搜索转化', {
      scene: 'holdings_create',
      keyword: String(holdingCreateForm.fund_id || '').trim().slice(0, 40),
      fund_id: pickedCode,
      target: 'holding_create_form'
    })
  }, [holdingCreateForm.fund_id])

  const handleSubmitHoldingCreate = useCallback(async (event) => {
    event.preventDefault()
    const fundId = String(holdingCreateForm.fund_id || '').trim()
    const name = String(holdingCreateForm.name || '').trim()
    const marketGroup = String(holdingCreateForm.market_group || 'cn_hk').trim().toLowerCase() || 'cn_hk'
    const bucket = String(holdingCreateForm.bucket || '').trim() || defaultBucketByMarketGroup(marketGroup)
    if (!fundId) {
      setHoldingCreateError('请输入基金代码')
      return
    }
    if (!name) {
      setHoldingCreateError('请输入基金名称')
      return
    }
    if (!bucket) {
      setHoldingCreateError('请选择持仓分组')
      return
    }

    setHoldingCreateSubmitting(true)
    setHoldingCreateError('')
    setHoldingCreateResult(null)
    try {
      const payload = {
        fund_id: fundId,
        name,
        bucket,
        market_group: marketGroup,
        tags: parseTagList(holdingCreateForm.tags_text)
      }
      const created = await createHolding(payload)
      if (!created) {
        setHoldingCreateError('新增持仓失败，请检查输入后重试')
        recordMetric('持仓新增失败', { fund_id: fundId })
        return
      }
      const existed = rows.some((item) => String(item.fund_id) === fundId)
      setSelectedFundId(created.fund_id)
      setHoldingCreateResult({
        ...created,
        action: existed ? '覆盖' : '新增'
      })
      setHoldingCreateForm({
        fund_id: '',
        name: '',
        bucket: defaultBucketByMarketGroup(marketGroup),
        market_group: marketGroup,
        tags_text: ''
      })
      setHoldingCreateSuggestions([])
      recordMetric('持仓新增成功', { fund_id: created.fund_id, action: existed ? 'replace' : 'create' })
    } catch (error) {
      setHoldingCreateError(toGuidedError(error, 'holding_create', '新增持仓失败'))
      recordMetric('持仓新增失败', { fund_id: fundId })
    } finally {
      setHoldingCreateSubmitting(false)
    }
  }, [createHolding, holdingCreateForm, rows])

  const handleAutoFillHolding = useCallback(async (row) => {
    const fundId = String(row?.fund_id || '').trim()
    if (!fundId) return
    setHoldingAutoFillLoadingFundId(fundId)
    setHoldingAutoFillError('')
    setHoldingAutoFillResult(null)
    try {
      const payload = await fetchFundSuggest(fundId, 8)
      const items = Array.isArray(payload?.items) ? payload.items : []
      const matched = items.find((item) => String(item?.fund_id || '').trim() === fundId) || items[0]
      if (!matched) {
        throw new Error(`未查询到 ${fundId} 的基金主数据`)
      }

      const patch = {}
      const nextName = String(matched.name || '').trim()
      const nextGroup = String(matched.market_group || '').trim().toLowerCase()
      const nextBucket = String(matched.bucket || '').trim()
      const nextTags = Array.isArray(matched.tags) ? matched.tags.filter(Boolean) : []

      if (nextName && nextName !== String(row.name || '').trim()) patch.name = nextName
      if (nextGroup && nextGroup !== String(row.market_group || '').trim().toLowerCase()) patch.market_group = nextGroup
      if (nextBucket && nextBucket !== String(row.bucket || '').trim()) patch.bucket = nextBucket
      if (nextTags.length > 0) patch.tags = nextTags

      if (Object.keys(patch).length === 0) {
        setHoldingAutoFillResult({
          fund_id: fundId,
          name: row.name || '--',
          market_group: row.market_group || 'cn_hk',
          bucket: row.bucket || '--',
          fields: []
        })
        recordMetric('持仓编辑自动补全跳过', { fund_id: fundId })
        return
      }

      const ok = await saveHolding(fundId, patch)
      if (!ok) {
        throw new Error('持仓更新失败')
      }
      setHoldingAutoFillResult({
        fund_id: fundId,
        name: patch.name || row.name || '--',
        market_group: patch.market_group || row.market_group || 'cn_hk',
        bucket: patch.bucket || row.bucket || '--',
        fields: Object.keys(patch)
      })
      recordMetric('持仓编辑自动补全成功', { fund_id: fundId, fields: Object.keys(patch).join(',') })
    } catch (error) {
      setHoldingAutoFillError(toGuidedError(error, 'holding_autofill', '持仓自动补全失败'))
      recordMetric('持仓编辑自动补全失败', { fund_id: fundId })
    } finally {
      setHoldingAutoFillLoadingFundId('')
    }
  }, [saveHolding])

  useEffect(() => {
    if (!user) {
      setActionLogs([])
      setActionDataStatus({
        status: 'estimating',
        asof: '',
        note: '请登录后查看交易状态'
      })
      setTransactionLogs([])
      setTransactionSummary({
        total_count: 0,
        pending_count: 0,
        confirmed_count: 0,
        last_occurred_at: ''
      })
      setTransactionDataStatus({
        status: 'estimating',
        asof: '',
        note: '请登录后查看交易流水状态'
      })
      setTransactionError('')
      setSyncPendingError('')
      setSyncPendingResult(null)
      setActionError('')
      setReportSummary('')
      setHoldingCreateSuggestions([])
      setHoldingCreateSuggestLoading(false)
      setHoldingCreateSubmitting(false)
      setHoldingCreateError('')
      setHoldingCreateResult(null)
      setHoldingAutoFillLoadingFundId('')
      setHoldingAutoFillError('')
      setHoldingAutoFillResult(null)
      setHoldingCreateForm({
        fund_id: '',
        name: '',
        bucket: 'core',
        market_group: 'cn_hk',
        tags_text: ''
      })
      return
    }
    if (activeTab !== 'trade' && activeTab !== 'profile' && activeTab !== 'home') return

    let mounted = true
    const loadTradeAndReport = async () => {
      setActionLoading(true)
      setActionError('')
      try {
        const records = []
        const statusItems = []
        for (let offset = 0; offset < 7; offset += 1) {
          const date = new Date()
          date.setDate(date.getDate() - offset)
          const day = date.toISOString().slice(0, 10)
          const payload = await fetchActions(day)
          if (payload?.data_status && typeof payload.data_status === 'object') {
            statusItems.push(payload.data_status)
          }
          const actions = Array.isArray(payload?.actions) ? payload.actions : []
          actions.forEach((item) => {
            records.push({
              ...item,
              date: payload?.date || day
            })
          })
        }
        records.sort(compareActionRecordsDesc)
        if (mounted) {
          setActionLogs(records)
          setActionDataStatus(mergeDataStatus(statusItems, '交易记录来自本地数据库'))
        }
      } catch (error) {
        if (mounted) {
          const guided = toGuidedError(error, 'trade_actions_load', '交易记录加载失败')
          setActionLogs([])
          setActionDataStatus({
            status: 'partial',
            asof: '',
            note: guided
          })
          setActionError(guided)
        }
      } finally {
        if (mounted) setActionLoading(false)
      }

      try {
        const report = await fetchDailyReport()
        if (mounted) {
          setReportSummary(String(report?.summary || ''))
          setReportDataQuality(report?.data_quality || null)
        }
      } catch {
        if (mounted) {
          setReportSummary('')
          setReportDataQuality(null)
        }
      }
    }

    void loadTradeAndReport()
    return () => {
      mounted = false
    }
  }, [activeTab, user])

  const loadTransactionList = useCallback(async (statusValue = transactionFilterStatus, { silent = false } = {}) => {
    if (!user) return
    setTransactionLoading(true)
    if (!silent) setTransactionError('')
    try {
      const payload = await fetchTransactions({ status: statusValue, limit: 80 })
      const items = Array.isArray(payload?.items) ? [...payload.items].sort(compareTransactionRecordsDesc) : []
      setTransactionLogs(items)
      setTransactionSummary(
        payload?.summary && typeof payload.summary === 'object'
          ? payload.summary
          : {
              total_count: items.length,
              pending_count: items.filter((item) => String(item?.status || '') === 'pending').length,
              confirmed_count: items.filter((item) => String(item?.status || '') === 'confirmed').length,
              last_occurred_at: items[0]?.occurred_at || ''
            }
      )
      setTransactionDataStatus(
        payload?.data_status && typeof payload.data_status === 'object'
          ? payload.data_status
          : {
              status: 'estimating',
              asof: '',
              note: '交易流水已加载'
            }
      )
      if (!silent) setTransactionError('')
    } catch (error) {
      const guided = toGuidedError(error, 'trade_transactions_load', '交易流水加载失败')
      setTransactionLogs([])
      setTransactionSummary({
        total_count: 0,
        pending_count: 0,
        confirmed_count: 0,
        last_occurred_at: ''
      })
      setTransactionDataStatus({
        status: 'partial',
        asof: '',
        note: guided
      })
      setTransactionError(guided)
    } finally {
      setTransactionLoading(false)
    }
  }, [transactionFilterStatus, user])

  const beginEditTransaction = useCallback((item) => {
    const txId = Number(item?.id || 0)
    if (!txId) return
    const status = String(item?.status || '').toLowerCase() === 'confirmed' ? 'confirmed' : 'pending'
    setEditingTransactionId(txId)
    setTransactionPatchError('')
    setTransactionPatchResult(null)
    setEditingTransactionForm({
      occurred_at: isoToDateTimeInput(item?.occurred_at) || nowForDateTimeInput(),
      status,
      confirmed_at: status === 'confirmed' ? (isoToDateTimeInput(item?.confirmed_at) || nowForDateTimeInput()) : '',
      nav: status === 'confirmed' ? String(Number(item?.nav || 0) || '') : '',
      note: String(item?.note || ''),
      audit_note: ''
    })
  }, [])

  const cancelEditTransaction = useCallback(() => {
    setEditingTransactionId(0)
    setTransactionPatchError('')
    setTransactionPatchResult(null)
    setEditingTransactionForm({
      occurred_at: '',
      status: 'pending',
      confirmed_at: '',
      nav: '',
      note: '',
      audit_note: ''
    })
  }, [])

  const loadTransactionAudit = useCallback(async (transactionId, { silent = false } = {}) => {
    const txId = Number(transactionId || 0)
    if (!txId) return
    setTransactionAuditLoading(true)
    if (!silent) setTransactionAuditError('')
    try {
      const payload = await fetchTransactionAudit(txId, 50)
      const items = Array.isArray(payload?.items) ? payload.items : []
      setTransactionAuditTargetId(txId)
      setTransactionAuditItems(items)
      if (!silent) setTransactionAuditError('')
    } catch (error) {
      const guided = toGuidedError(error, 'trade_transaction_audit', '交易审计记录加载失败')
      setTransactionAuditTargetId(txId)
      setTransactionAuditItems([])
      setTransactionAuditError(guided)
    } finally {
      setTransactionAuditLoading(false)
    }
  }, [])

  const handlePatchTransaction = useCallback(async (event) => {
    event.preventDefault()
    const txId = Number(editingTransactionId || 0)
    if (!txId) return

    const cleanOccurredAt = String(editingTransactionForm.occurred_at || '').trim()
    if (!cleanOccurredAt) {
      setTransactionPatchError('请输入发生时间')
      return
    }
    const nextStatus = String(editingTransactionForm.status || 'pending').trim().toLowerCase() === 'confirmed'
      ? 'confirmed'
      : 'pending'
    const navNumber = Number(editingTransactionForm.nav)
    if (nextStatus === 'confirmed' && (!Number.isFinite(navNumber) || navNumber <= 0)) {
      setTransactionPatchError('confirmed 状态必须填写大于 0 的净值')
      return
    }

    setTransactionPatchLoading(true)
    setTransactionPatchError('')
    setTransactionPatchResult(null)
    try {
      const payload = {
        occurred_at: cleanOccurredAt,
        status: nextStatus,
        note: String(editingTransactionForm.note || '').trim(),
        audit_note: String(editingTransactionForm.audit_note || '').trim()
      }
      if (nextStatus === 'confirmed') {
        payload.confirmed_at = String(editingTransactionForm.confirmed_at || '').trim() || nowForDateTimeInput()
        payload.nav = navNumber
      } else {
        payload.confirmed_at = ''
      }

      const result = await patchTransaction(txId, payload)
      setTransactionPatchResult(result?.transaction || null)
      if (result?.data_status && typeof result.data_status === 'object') {
        setTransactionDataStatus(result.data_status)
      }
      await loadTransactionList(transactionFilterStatus, { silent: true })
      await loadTransactionAudit(txId, { silent: true })
      setEditingTransactionForm((prev) => ({ ...prev, audit_note: '' }))
      recordMetric('交易流水手工修正成功', { transaction_id: txId, status: nextStatus })
    } catch (error) {
      setTransactionPatchError(toGuidedError(error, 'trade_transaction_patch', '交易修正失败'))
      recordMetric('交易流水手工修正失败', { transaction_id: txId })
    } finally {
      setTransactionPatchLoading(false)
    }
  }, [editingTransactionForm, editingTransactionId, loadTransactionAudit, loadTransactionList, transactionFilterStatus])

  useEffect(() => {
    if (!user) return
    if (activeTab !== 'trade') return
    void loadTransactionList(transactionFilterStatus, { silent: true })
  }, [activeTab, loadTransactionList, transactionFilterStatus, user])

  const refreshFundCenterTransactionStatus = useCallback(async (fundId, { silent = false } = {}) => {
    const cleanFundId = String(fundId || '').trim()
    if (!cleanFundId) return
    try {
      const payload = await fetchTransactions({ fundId: cleanFundId, status: 'all', limit: 80 })
      setFundCenterTxSummary(
        payload?.summary && typeof payload.summary === 'object'
          ? payload.summary
          : {
              total_count: 0,
              pending_count: 0,
              confirmed_count: 0,
              last_occurred_at: ''
            }
      )
      if (payload?.data_status && typeof payload.data_status === 'object') {
        setFundCenterDataStatus((prev) =>
          mergeDataStatus([prev, payload.data_status], '基金详情已加载')
        )
      }
      if (!silent) setFundCenterSyncError('')
    } catch (error) {
      if (!silent) setFundCenterSyncError(toGuidedError(error, 'trade_transactions_load', '基金交易状态刷新失败'))
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setAssetReadyMs(0)
      setAssetTimedOut(false)
      return
    }

    firstLoadStartRef.current = performance.now()
    recordMetric('首屏加载开始')
    const timeout = window.setTimeout(() => {
      if (rows.length === 0) {
        setAssetTimedOut(true)
        recordMetric('首屏加载超时', { timeout_ms: 5000 })
      }
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [user])

  useEffect(() => {
    if (!user) {
      setSkeletonLock(false)
      return
    }
    setSkeletonLock(true)
    const timer = window.setTimeout(() => {
      setSkeletonLock(false)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [user])

  useEffect(() => {
    if (!user || rows.length === 0 || assetReadyMs > 0) return
    const elapsed = Math.round(performance.now() - firstLoadStartRef.current)
    setAssetReadyMs(elapsed)
    setAssetTimedOut(false)
    recordMetric('资产卡更新完成', { elapsed_ms: elapsed, rows_count: rows.length })
  }, [assetReadyMs, rows.length, user])

  useEffect(() => {
    if (!user) return
    recordMetric('底部Tab切换', { tab: activeTab })
  }, [activeTab, user])

  const messageItems = useMemo(() => {
    const items = []
    const failedFunds = rows.filter((item) => item.status !== 'ok').length
    if (failedFunds > 0) {
      items.push({
        type: 'warning',
        title: '估值提醒',
        content: `当前有 ${failedFunds} 只基金估值异常，建议优先核对持仓页。`,
        actionLabel: '查看持仓',
        actionTab: 'holdings'
      })
    }
    const undoneActions = actionLogs.filter((item) => !item.done).length
    if (undoneActions > 0) {
      items.push({
        type: 'info',
        title: '交易待确认',
        content: `最近 7 天有 ${undoneActions} 条未执行记录，可在交易页确认。`,
        actionLabel: '查看交易',
        actionTab: 'trade'
      })
    }
    if (reportSummary) {
      const firstLine = reportSummary.split('\n')[0] || '今日复盘已生成'
      items.push({
        type: 'success',
        title: '复盘摘要',
        content: firstLine,
        actionLabel: '打开持仓',
        actionTab: 'holdings'
      })
    }
    if (items.length === 0) {
      items.push({
        type: 'success',
        title: '系统状态正常',
        content: '当前无待处理提醒，可按计划执行当日动作。',
        actionLabel: '返回首页',
        actionTab: 'home'
      })
    }
    return items
  }, [actionLogs, reportSummary, rows])

  const onAuthSubmit = async (payload) => {
    await login(payload)
  }


  const openHoldingFromHome = (fundId) => {
    setSelectedFundId(String(fundId || ''))
    setActiveTab('holdings')
  }
  const handleTradeSubmit = async (event) => {
    event.preventDefault()
    const code = tradeFundCode.trim()
    const amount = Number(tradeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setTradeSubmitError('请输入大于 0 的交易金额')
      return
    }

    setTradeSubmitError('')
    setTradeSubmitting(true)
    try {
      const occurredAtDate = new Date(tradeOccurredAt)
      if (Number.isNaN(occurredAtDate.getTime())) {
        setTradeSubmitError('请输入有效的发生时间')
        setTradeSubmitting(false)
        return
      }
      const occurredAt = occurredAtDate.toISOString()
      const date = occurredAt.slice(0, 10)
      const actionKey = code ? `${tradeType}_${code}` : `${tradeType}_manual`
      const payload = await saveAction({
        date,
        occurred_at: occurredAt,
        action_key: actionKey,
        amount,
        done: tradeDone
      })
      if (payload?.data_status && typeof payload.data_status === 'object') {
        setActionDataStatus(payload.data_status)
      }
      const latest = Array.isArray(payload?.actions) ? payload.actions[0] : null
      if (latest) {
        const record = { ...latest, date: payload?.date || date }
        setActionLogs((prev) =>
          [record, ...prev].sort(compareActionRecordsDesc)
        )
        setTradeSubmitResult(record)
      } else {
        setTradeSubmitResult(null)
      }
      setTradeAmount('')
      setTradeFundCode('')
      setTradeOccurredAt(nowForDateTimeInput())
      recordMetric('交易入口提交成功', { trade_type: tradeType, amount, done: tradeDone })
      recordMetric('交易转化提交成功', {
        trade_type: tradeType,
        amount,
        done: tradeDone,
        with_fund_code: Boolean(code)
      })
    } catch (error) {
      setTradeSubmitError(toGuidedError(error, 'trade_submit', '交易提交失败'))
      recordMetric('交易入口提交失败', { trade_type: tradeType })
      recordMetric('交易转化提交失败', {
        trade_type: tradeType,
        with_fund_code: Boolean(code)
      })
    } finally {
      setTradeSubmitting(false)
    }
  }

  const handleSyncPending = async () => {
    setSyncPendingError('')
    setSyncPendingResult(null)
    setSyncPendingLoading(true)
    try {
      const payload = await syncPendingTransactions({ limit: 300 })
      setSyncPendingResult(payload?.result || null)
      if (payload?.data_status && typeof payload.data_status === 'object') {
        setTransactionDataStatus(payload.data_status)
      }
      await loadTransactionList(transactionFilterStatus, { silent: true })
      recordMetric('pending对账成功', payload?.result || {})
    } catch (error) {
      setSyncPendingError(toGuidedError(error, 'trade_sync_pending', 'pending 对账失败'))
      recordMetric('pending对账失败')
    } finally {
      setSyncPendingLoading(false)
    }
  }

  const handleFundCenterSyncPending = async () => {
    const fundId = String(fundCenterSelectedId || '').trim()
    if (!fundId) {
      setFundCenterSyncError('请先选择基金后再执行对账')
      return
    }
    setFundCenterSyncError('')
    setFundCenterSyncResult(null)
    setFundCenterSyncLoading(true)
    try {
      const payload = await syncPendingTransactions({ limit: 200, fund_id: fundId })
      setFundCenterSyncResult(payload?.result || null)
      if (payload?.data_status && typeof payload.data_status === 'object') {
        setFundCenterDataStatus((prev) => mergeDataStatus([prev, payload.data_status], '基金对账已执行'))
      }
      await refreshFundCenterTransactionStatus(fundId, { silent: true })
      recordMetric('基金详情pending对账成功', { fund_id: fundId, ...(payload?.result || {}) })
    } catch (error) {
      setFundCenterSyncError(toGuidedError(error, 'fund_sync_pending', '基金 pending 对账失败'))
      recordMetric('基金详情pending对账失败', { fund_id: fundId })
    } finally {
      setFundCenterSyncLoading(false)
    }
  }

  const handleCreatePlan = async (event) => {
    event.preventDefault()
    const amount = Number(planAmount)
    if (!planName.trim()) {
      setPlanError('请输入计划名称')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPlanError('请输入大于 0 的计划金额')
      return
    }

    setPlanError('')
    setPlanSubmitting(true)
    try {
      const normalizedExistingPlans = dcaPlans.map((plan) => ({
        ...plan,
        schedule: normalizeDcaSchedule(plan.schedule)
      }))
      const nextPlans = [
        ...normalizedExistingPlans,
        {
          id: `plan_${Date.now()}`,
          name: planName.trim(),
          fund_id: planFundCode.trim(),
          amount,
          schedule: normalizeDcaSchedule(planSchedule),
          paused: false,
          created_at: new Date().toISOString()
        }
      ]
      const saved = await saveSettingsPatch({ strategy: { dca_plans: nextPlans } })
      if (!saved) {
        throw new Error('定投计划保存失败')
      }
      setPlanName('')
      setPlanFundCode('')
      setPlanAmount('')
      setPlanSchedule('weekly')
      recordMetric('定投计划创建成功', { schedule: planSchedule, amount })
    } catch (error) {
      setPlanError(error?.message || '定投计划保存失败')
      recordMetric('定投计划创建失败', { schedule: planSchedule, amount })
    } finally {
      setPlanSubmitting(false)
    }
  }

  const handleTogglePlan = async (planId) => {
    const target = dcaPlans.find((item) => String(item.id) === String(planId))
    const nextPlans = dcaPlans.map((item) =>
      String(item.id) === String(planId)
        ? { ...item, schedule: normalizeDcaSchedule(item.schedule), paused: !item.paused }
        : { ...item, schedule: normalizeDcaSchedule(item.schedule) }
    )
    const saved = await saveSettingsPatch({ strategy: { dca_plans: nextPlans } })
    if (saved) {
      recordMetric('定投计划状态切换', {
        plan_id: String(planId),
        paused: Boolean(!target?.paused)
      })
    } else {
      recordMetric('定投计划状态切换失败', { plan_id: String(planId) })
    }
  }

  const handlePlanAction = async (plan, done) => {
    const occurredAt = new Date().toISOString()
    const date = occurredAt.slice(0, 10)
    const actionKey = `dca_plan_${plan.id}`
    try {
      const payload = await saveAction({
        date,
        occurred_at: occurredAt,
        action_key: actionKey,
        amount: Number(plan.amount || 0),
        done
      })
      if (payload?.data_status && typeof payload.data_status === 'object') {
        setActionDataStatus(payload.data_status)
      }
      const latest = Array.isArray(payload?.actions) ? payload.actions[0] : null
      if (!latest) return
      const record = { ...latest, date: payload?.date || date }
      setActionLogs((prev) => [record, ...prev].sort(compareActionRecordsDesc))
      recordMetric('定投行为记录', {
        plan_id: String(plan.id),
        done: Boolean(done),
        amount: Number(plan.amount || 0)
      })
    } catch {
      recordMetric('定投行为记录失败', { plan_id: String(plan.id), done: Boolean(done) })
    }
  }

  const handleCreateRule = async (event) => {
    event.preventDefault()
    const threshold = Number(ruleThreshold)
    const silentHours = Number(ruleSilentHours)
    if (!ruleName.trim()) {
      setRuleError('请输入规则名称')
      return
    }
    if (!Number.isFinite(threshold)) {
      setRuleError('请输入有效阈值')
      return
    }
    if (!Number.isFinite(silentHours) || silentHours < 0) {
      setRuleError('静默期需为不小于 0 的数字')
      return
    }

    setRuleError('')
    setRuleSubmitting(true)
    try {
      const nextRules = [
        ...reminderRules,
        {
          id: `rule_${Date.now()}`,
          name: ruleName.trim(),
          fund_id: ruleFundCode.trim(),
          metric: 'estimate_pct',
          operator: ruleOperator,
          threshold,
          silent_hours: silentHours,
          enabled: true,
          created_at: new Date().toISOString(),
          reason_template: `当估值 ${ruleOperator} ${threshold}% 时触发提醒`
        }
      ]
      await saveSettingsPatch({ notifications: { rules: nextRules } })
      setRuleName('')
      setRuleFundCode('')
      setRuleThreshold('')
      setRuleSilentHours('24')
      setRuleOperator('<=')
      recordMetric('提醒规则创建成功', { operator: ruleOperator, threshold, silent_hours: silentHours })
    } catch (error) {
      setRuleError(error?.message || '提醒规则保存失败')
    } finally {
      setRuleSubmitting(false)
    }
  }

  const handleToggleRule = async (ruleId) => {
    const nextRules = reminderRules.map((item) =>
      String(item.id) === String(ruleId) ? { ...item, enabled: !item.enabled } : item
    )
    await saveSettingsPatch({ notifications: { rules: nextRules } })
  }

  if (!authReady) {
    return (
      <div className="page-shell" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="正在初始化会话..." />
      </div>
    )
  }

  if (!user) {
    return (
      <LoginPanel loading={authLoading} onSubmit={onAuthSubmit} />
    )
  }

  return (
    <ErrorBoundary>
      <Layout style={{ minHeight: '100vh', flexDirection: 'row' }}>
        <SideNav active={activeTab} onChange={handleTabChange} />
        <Layout style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
          <TopToolbar
            user={user}
            status={status}
            refreshing={loading}
            lastRefresh={lastRefresh}
            asof={asof}
            updatedAt={updatedAt}
            confirmState={confirmState}
            coverage={coverage}
            refreshElapsedMs={refreshElapsedMs}
            estimateCacheHit={estimateCacheHit}
            incrementalMode={incrementalMode}
            incrementalReusedQuotes={incrementalReusedQuotes}
            incrementalFetchedQuotes={incrementalFetchedQuotes}
            dataStatus={estimateDataStatus}
            searchQuery={searchQuery}
            suggestions={suggestions}
            searchLoading={searchLoading}
            onSearchChange={setSearchQuery}
            onPickSuggestion={handlePickSuggestion}
            autoRefreshEnabled={Boolean(settings.display.auto_refresh_enabled)}
            onRefresh={() => refresh()}
            onToggleAutoRefresh={handleToggleAutoRefresh}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={logout}
            marketDataHint={marketDataHint}
          />

          <Content className="page-shell" style={{ width: '100%' }}>
            {activeTab === 'home' && (
        <>
          <SummaryCards rows={rows} loading={loading} />
          <ReturnsChart user={user} />
          <BenchmarkComparison user={user} />
          <DataStatusBanner title="首页数据口径" dataStatus={estimateDataStatus} />
          {reportDataQuality && reportDataQuality.total_funds > 0 && (
            <div className="data-quality-bar">
              <span className="quality-label">📊 数据质量</span>
              <span className="quality-item">
                覆盖率 {reportDataQuality.coverage_pct}%
                <span className="quality-detail">({reportDataQuality.ok_funds}/{reportDataQuality.total_funds})</span>
              </span>
              {reportDataQuality.failed_funds > 0 && (
                <span className="quality-item warning">失败 {reportDataQuality.failed_funds}</span>
              )}
              {reportDataQuality.missing_funds > 0 && (
                <span className="quality-item warning">缺失 {reportDataQuality.missing_funds}</span>
              )}
              {reportDataQuality.low_confidence_count > 0 && (
                <span className="quality-item info">低置信度 {reportDataQuality.low_confidence_count}</span>
              )}
            </div>
          )}

          <PortfolioReturnsPanel user={user} lastRefresh={lastRefresh} />
          <BenchmarkComparisonPanel user={user} lastRefresh={lastRefresh} />
          <DiagnosticsPanel user={user} />
          
          <section className="panel home-main">
            <div className="section-head">
              <h2>今日待办</h2>
              <span>优先处理这 3 项</span>
            </div>
            <div className="todo-grid">
              <article className="todo-card">
                <h3>主操作</h3>
                <p>进入交易页完成买入、定投、赎回或转换。</p>
                <button type="button" className="primary" onClick={() => handleOpenTradeEntry('home_todo_primary')}>去交易</button>
              </article>
              <article className="todo-card">
                <h3>持仓巡检</h3>
                <p>检查当日收益异常基金，确认是否执行动作。</p>
                <button type="button" className="ghost" onClick={() => setActiveTab('holdings')}>查看持仓</button>
              </article>
              <article className="todo-card">
                <h3>提醒中心</h3>
                <p>
                  {dcaFailedPlans.length > 0
                    ? `有 ${dcaFailedPlans.length} 个定投计划扣款失败，建议优先处理。`
                    : '暂无定投失败待办，保持计划执行即可。'}
                </p>
                <button type="button" className="ghost" onClick={() => setActiveTab(dcaFailedPlans.length > 0 ? 'trade' : 'profile')}>
                  {dcaFailedPlans.length > 0 ? '去处理定投' : '去我的'}
                </button>
              </article>
            </div>
            {searchQuery.trim() && filteredRows.length === 0 && (
              <div className="chart-empty">未匹配到基金：请尝试代码、名称或拼音。</div>
            )}
          </section>
          <section className="panel home-main">
            <div className="section-head">
              <h2>持仓速览</h2>
              <button type="button" className="ghost" onClick={() => setActiveTab('holdings')}>查看全部持仓</button>
            </div>

            <div className="watch-list">
              <article className="watch-item watch-item-head">
                <div>
                  <h3>国内 / 港股</h3>
                  <p>按市值排序（前4）</p>
                </div>
              </article>
              {homeDomesticPreview.length === 0 && <div className="chart-empty">暂无国内 / 港股持仓</div>}
              {homeDomesticPreview.map((row) => (
                <article key={`home-domestic-${row.fund_id}`} className="watch-item">
                  <div>
                    <h3>{row.name}</h3>
                    <p>{row.fund_id} · 市值 {Number(row.market_value_cny || 0).toFixed(2)}</p>
                  </div>
                  <div className="plan-actions">
                    <span className={`watch-profit ${classBySign(row.day_profit_cny)}`}>
                      {formatPercent(row.estimate_pct)}
                    </span>
                    <button type="button" className="ghost" onClick={() => openHoldingFromHome(row.fund_id)}>详情</button>
                  </div>
                </article>
              ))}
            </div>

            <div className="watch-list">
              <article className="watch-item watch-item-head">
                <div>
                  <h3>美股 / 海外</h3>
                  <p>按市值排序（前4）</p>
                </div>
              </article>
              {homeOverseasPreview.length === 0 && <div className="chart-empty">暂无美股 / 海外持仓</div>}
              {homeOverseasPreview.map((row) => (
                <article key={`home-overseas-${row.fund_id}`} className="watch-item">
                  <div>
                    <h3>{row.name}</h3>
                    <p>{row.fund_id} · 市值 {Number(row.market_value_cny || 0).toFixed(2)}</p>
                  </div>
                  <div className="plan-actions">
                    <span className={`watch-profit ${classBySign(row.day_profit_cny)}`}>
                      {formatPercent(row.estimate_pct)}
                    </span>
                    <button type="button" className="ghost" onClick={() => openHoldingFromHome(row.fund_id)}>详情</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'watch' && (
        <section className="panel holdings-main">
          <div className="section-head">
            <h2>基金中心</h2>
            <span>数据库搜索与独立详情</span>
          </div>
          <DataStatusBanner title="基金页口径" dataStatus={fundCenterDataStatus} />

          <div style={{ marginBottom: 16 }}>
            <Input.Search
              placeholder="搜索基金（代码/名称/拼音/别名）"
              allowClear
              enterButton="搜索"
              size="large"
              value={fundCenterQuery}
              onChange={(event) => setFundCenterQuery(event.target.value)}
              onSearch={() => {}}
            />
          </div>
          {fundCenterLoading && <div className="chart-empty">基金搜索中...</div>}
          {fundCenterError && <div className="chart-empty">{fundCenterError}</div>}
          {!fundCenterLoading && !fundCenterError && fundCenterQuery.trim() && fundCenterItems.length === 0 && (
            <div className="chart-empty">未匹配到基金，请更换关键词。</div>
          )}
          {fundCenterItems.length > 0 && (
            <div className="watch-list">
              {fundCenterItems.map((item) => {
                const picked = String(item.fund_id || '') === String(fundCenterSelectedId || '')
                const aliasHits = Array.isArray(item.alias_hits) ? item.alias_hits.filter(Boolean) : []
                return (
                  <article key={`fund-center-${item.fund_id}`} className="watch-item">
                    <div>
                      <h3>{item.name || '--'}</h3>
                      <p>
                        {item.fund_id} · {item.status || 'active'}
                        {aliasHits.length > 0 ? ` · 命中别名 ${aliasHits.slice(0, 2).join('/')}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={picked ? 'primary' : 'ghost'}
                      onClick={() => handlePickFundCenter(item)}
                    >
                      {picked ? '已选择' : '查看详情'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          {fundCenterDetailLoading && <div className="chart-empty">正在加载基金详情...</div>}
          {fundCenterDetailError && <div className="chart-empty">{fundCenterDetailError}</div>}
          {fundCenterDetail && (
            <div className="trade-result">
              <strong>{fundCenterDetail.name || '--'}（{fundCenterDetail.fund_id || '--'}）</strong>
              <p>状态：{fundCenterDetail.status || 'active'}</p>
              <p>最新净值：{fundCenterNavLatest?.unit_nav !== null && fundCenterNavLatest?.unit_nav !== undefined ? formatMoney(fundCenterNavLatest.unit_nav, 4) : '--'}</p>
              <p>估算净值：{fundCenterNavLatest?.estimate_nav !== null && fundCenterNavLatest?.estimate_nav !== undefined ? formatMoney(fundCenterNavLatest.estimate_nav, 4) : '--'}</p>
              <p>数据时间：{fundCenterNavLatest?.asof ? formatDateTime(fundCenterNavLatest.asof) : '--'}</p>
              <p>
                交易双态：待确认 {Number(fundCenterTxSummary.pending_count || 0)} ｜ 已确认 {Number(fundCenterTxSummary.confirmed_count || 0)}
              </p>
              <p>最近交易：{fundCenterTxSummary.last_occurred_at ? formatDateTime(fundCenterTxSummary.last_occurred_at) : '--'}</p>
            </div>
          )}
          {fundCenterDetail && (
            <div className="trade-grid">
              <button
                type="button"
                className="primary"
                onClick={handleFundCenterSyncPending}
                disabled={fundCenterSyncLoading || fundCenterDetailLoading}
              >
                {fundCenterSyncLoading ? '对账中...' : '对账当前基金 pending'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void refreshFundCenterTransactionStatus(fundCenterSelectedId)}
                disabled={fundCenterSyncLoading || fundCenterDetailLoading}
              >
                刷新交易状态
              </button>
            </div>
          )}
          {fundCenterSyncError && <div className="chart-empty">{fundCenterSyncError}</div>}
          {fundCenterSyncResult && (
            <div className="trade-result">
              <strong>当前基金对账完成</strong>
              <p>待处理：{Number(fundCenterSyncResult.total_pending || 0)}</p>
              <p>已补全：{Number(fundCenterSyncResult.synced || 0)}</p>
              <p>跳过：{Number(fundCenterSyncResult.skipped || 0)}</p>
              <p>异常：{Number(fundCenterSyncResult.errors || 0)}</p>
            </div>
          )}

          {fundCenterNavHistory.length > 0 && (
            <>
              <div className="section-head trade-head">
                <h3>净值历史（近60条）</h3>
                <span>{`共 ${fundCenterNavHistory.length} 条`}</span>
              </div>
              <div className="record-list">
                {[...fundCenterNavHistory].reverse().map((item) => (
                  <article key={`fund-nav-${item.trade_date}-${item.asof}`} className="record-item">
                    <div>
                      <h4>{item.trade_date}</h4>
                      <p>{item.confirm_state || '--'} · {item.source || '--'}</p>
                    </div>
                    <div className="record-side">
                      <strong>{item.unit_nav !== null && item.unit_nav !== undefined ? formatMoney(item.unit_nav, 4) : '--'}</strong>
                      <span className="record-pending">
                        估算 {item.estimate_nav !== null && item.estimate_nav !== undefined ? formatMoney(item.estimate_nav, 4) : '--'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="section-head trade-head">
            <h3>自选观察</h3>
            <span>按当日收益波动排序</span>
          </div>
          <div className="watch-list">
            {topMovers.length === 0 && <div className="chart-empty">暂无可展示的基金</div>}
            {topMovers.map((row) => (
              <article key={row.fund_id} className="watch-item">
                <div>
                  <h3>{row.name}</h3>
                  <p>{row.fund_id}</p>
                </div>
                <div className={`watch-profit ${classBySign(row.day_profit_cny)}`}>
                  {formatPercent(row.estimate_pct)}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'trade' && (
        <section className="panel holdings-main">
          <div className="section-head">
            <h2>交易入口</h2>
            <span>买入 / 定投 / 赎回 / 转换</span>
          </div>
          <DataStatusBanner title="执行记录口径" dataStatus={actionDataStatus} />

          <div className="trade-grid">
            {TRADE_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={tradeType === item.key ? 'primary' : 'ghost'}
                onClick={() => {
                  setTradeType(item.key)
                  setTradeSubmitError('')
                  setTradeSubmitResult(null)
                  recordMetric('交易类型切换', { trade_type: item.key })
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form className="trade-form" onSubmit={handleTradeSubmit}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>基金代码（可选）</div>
              <Input
                value={tradeFundCode}
                onChange={(event) => setTradeFundCode(event.target.value)}
                placeholder="例如 016453"
                maxLength={16}
              />
            </div>
            {tradeFundSuggestLoading && <div className="chart-empty">基金补全加载中...</div>}
            {!tradeFundSuggestLoading && tradeFundSuggestions.length > 0 && (
              <div className="watch-list">
                {tradeFundSuggestions.slice(0, 5).map((item) => (
                  <article key={`trade-suggest-${item.fund_id}`} className="watch-item">
                    <div>
                      <h3>{item.name || '--'}</h3>
                      <p>{item.fund_id}</p>
                    </div>
                    <Button size="small" onClick={() => handlePickTradeSuggestion(item)}>
                      选用
                    </Button>
                  </article>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>金额</div>
              <InputNumber
                style={{ width: '100%' }}
                min={0.01}
                step={0.01}
                value={tradeAmount}
                onChange={(value) => setTradeAmount(value)}
                placeholder="请输入金额"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>发生时间</div>
              <DatePicker
                showTime
                style={{ width: '100%' }}
                value={tradeOccurredAt ? dayjs(tradeOccurredAt) : null}
                onChange={(date) => setTradeOccurredAt(date ? date.format('YYYY-MM-DDTHH:mm') : '')}
                format="YYYY-MM-DD HH:mm"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <Checkbox checked={tradeDone} onChange={(e) => setTradeDone(e.target.checked)}>
                提交后标记为已执行
              </Checkbox>
            </div>
            <Button type="primary" htmlType="submit" loading={tradeSubmitting} block size="large">
              {tradeSubmitting ? '提交中...' : `提交${TRADE_TYPES.find((item) => item.key === tradeType)?.label || '交易'}`}
            </Button>
          </form>

          {tradeSubmitError && <div className="chart-empty">{tradeSubmitError}</div>}
          {tradeSubmitResult && (
            <div className="trade-result">
              <strong>交易提交成功</strong>
              <p>动作：{tradeSubmitResult.action_key}</p>
              <p>金额：{Number(tradeSubmitResult.amount || 0).toFixed(2)}</p>
              <p>状态：{tradeSubmitResult.done ? '已执行' : '未执行'}</p>
              <p>发生时间：{formatDateTime(tradeSubmitResult.occurred_at || tradeSubmitResult.ts)}</p>
            </div>
          )}
          <p className="trade-tip">已打通买入/定投/赎回/转换入口，提交后写入执行记录并在下方列表回显。</p>

          <div className="sip-plans-section">
            <SIPPlanManager user={user} />
          </div>

          <section className="trade-lifecycle">
            <div className="section-head trade-head">
              <h3>交易生命周期</h3>
              <span>买入（pending）{'->'} 确认（confirmed）{'->'} 计入收益</span>
            </div>
            <div className="lifecycle-steps">
              <article className={`lifecycle-step ${lifecycleStepClass(transactionLifecycle.step, 1)}`}>
                <span className="lifecycle-index">1</span>
                <h4>已记录交易</h4>
                <p>待确认 {Number(transactionSummary.pending_count || 0)} 笔</p>
              </article>
              <article className={`lifecycle-step ${lifecycleStepClass(transactionLifecycle.step, 2)}`}>
                <span className="lifecycle-index">2</span>
                <h4>确认净值与份额</h4>
                <p>已确认 {Number(transactionSummary.confirmed_count || 0)} 笔</p>
              </article>
              <article className={`lifecycle-step ${lifecycleStepClass(transactionLifecycle.step, 3)}`}>
                <span className="lifecycle-index">3</span>
                <h4>计入收益口径</h4>
                <p>总计 {Number(transactionSummary.total_count || 0)} 笔</p>
              </article>
            </div>
            <p className="trade-tip">{transactionLifecycle.note}</p>
          </section>

          <div className="section-head trade-head">
            <h3>交易流水（pending / confirmed）</h3>
            <span>
              {transactionLoading
                ? '加载中...'
                : `总计 ${Number(transactionSummary.total_count || 0)} ｜ 待确认 ${Number(transactionSummary.pending_count || 0)} ｜ 已确认 ${Number(transactionSummary.confirmed_count || 0)}`}
            </span>
          </div>
          <DataStatusBanner title="交易流水口径" dataStatus={transactionDataStatus} />
          <div className="trade-grid">
            <button
              type="button"
              className={transactionFilterStatus === 'all' ? 'primary' : 'ghost'}
              onClick={() => setTransactionFilterStatus('all')}
            >
              全部流水
            </button>
            <button
              type="button"
              className={transactionFilterStatus === 'pending' ? 'primary' : 'ghost'}
              onClick={() => setTransactionFilterStatus('pending')}
            >
              仅看 pending
            </button>
            <button
              type="button"
              className={transactionFilterStatus === 'confirmed' ? 'primary' : 'ghost'}
              onClick={() => setTransactionFilterStatus('confirmed')}
            >
              仅看 confirmed
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSyncPending}
              disabled={syncPendingLoading || transactionLoading}
            >
              {syncPendingLoading ? '对账中...' : '对账 pending'}
            </button>
          </div>
          <div className="trade-grid trade-grid-single">
            <button
              type="button"
              className="ghost"
              onClick={() => void loadTransactionList(transactionFilterStatus)}
              disabled={transactionLoading}
            >
              刷新交易流水
            </button>
          </div>
          {syncPendingError && <div className="chart-empty">{syncPendingError}</div>}
          {syncPendingResult && (
            <div className="trade-result">
              <strong>pending 对账已执行</strong>
              <p>待处理：{Number(syncPendingResult.total_pending || 0)}</p>
              <p>已补全：{Number(syncPendingResult.synced || 0)}</p>
              <p>跳过：{Number(syncPendingResult.skipped || 0)}</p>
              <p>异常：{Number(syncPendingResult.errors || 0)}</p>
            </div>
          )}
          {transactionError && <div className="chart-empty">{transactionError}</div>}
          {!transactionError && !transactionLoading && transactionLogs.length === 0 && (
            <div className="chart-empty">当前筛选条件下暂无交易流水</div>
          )}
          {transactionLogs.length > 0 && (
            <Table
              dataSource={transactionLogs.map((item) => ({ ...item, key: `${item.id}-${item.idempotency_key}` }))}
              columns={[
                {
                  title: '基金',
                  dataIndex: 'fund_name',
                  key: 'fund_name',
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <span>{record.fund_name || record.fund_id || '--'}</span>
                      <Tag color={record.action === 'buy' ? 'blue' : record.action === 'redeem' ? 'red' : record.action === 'dividend' ? 'green' : 'default'}>
                        {transactionActionLabel(record.action)}
                      </Tag>
                    </Space>
                  ),
                  width: 180
                },
                {
                  title: '时间',
                  dataIndex: 'occurred_at',
                  key: 'occurred_at',
                  render: (text) => formatDateTime(text),
                  sorter: (a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')),
                  width: 180
                },
                {
                  title: '金额',
                  dataIndex: 'amount_cny',
                  key: 'amount_cny',
                  align: 'right',
                  render: (value) => <strong>{Number(value || 0).toFixed(2)}</strong>,
                  width: 100
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  filters: [
                    { text: '待确认', value: 'pending' },
                    { text: '已确认', value: 'confirmed' }
                  ],
                  onFilter: (value, record) => String(record.status || '') === value,
                  render: (status) => (
                    <Tag color={status === 'confirmed' ? 'success' : 'warning'}>
                      {status === 'confirmed' ? '已确认' : '待确认'}
                    </Tag>
                  ),
                  width: 100
                },
                {
                  title: '确认信息',
                  dataIndex: 'confirm_info',
                  key: 'confirm_info',
                  render: (_, record) => {
                    if (String(record.status || '') !== 'confirmed') return '--'
                    return (
                      <Space direction="vertical" size={0}>
                        <span>净值: {Number(record.nav || 0).toFixed(4)}</span>
                        <span>份额: {Number(record.shares || 0).toFixed(2)}</span>
                      </Space>
                    )
                  },
                  width: 150
                },
                {
                  title: '操作',
                  key: 'action',
                  fixed: 'right',
                  width: 140,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="编辑交易">
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<EditOutlined />}
                          onClick={() => beginEditTransaction(record)}
                          disabled={transactionPatchLoading}
                        >
                          编辑
                        </Button>
                      </Tooltip>
                      <Tooltip title="查看审计记录">
                        <Button 
                          type="link" 
                          size="small" 
                          onClick={() => void loadTransactionAudit(record.id)}
                          disabled={transactionAuditLoading}
                        >
                          审计
                        </Button>
                      </Tooltip>
                    </Space>
                  )
                }
              ]}
              pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
              size="small"
              scroll={{ x: 1000 }}
              bordered
              loading={transactionLoading}
            />
          )}
          {editingTransactionId > 0 && (
            <section className="trade-lifecycle">
              <div className="section-head trade-head">
                <h3>交易手工修正</h3>
                <span>交易 ID：{editingTransactionId}</span>
              </div>
              <form className="trade-form" onSubmit={handlePatchTransaction}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>发生时间</div>
                  <DatePicker
                    showTime
                    style={{ width: '100%' }}
                    value={editingTransactionForm.occurred_at ? dayjs(editingTransactionForm.occurred_at) : null}
                    onChange={(date) =>
                      setEditingTransactionForm((prev) => ({ ...prev, occurred_at: date ? date.format('YYYY-MM-DDTHH:mm') : '' }))
                    }
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>状态</div>
                  <Select
                    style={{ width: '100%' }}
                    value={editingTransactionForm.status}
                    onChange={(value) =>
                      setEditingTransactionForm((prev) => ({
                        ...prev,
                        status: value,
                        confirmed_at:
                          value === 'confirmed'
                            ? prev.confirmed_at || nowForDateTimeInput()
                            : '',
                        nav: value === 'confirmed' ? prev.nav : ''
                      }))
                    }
                    options={[
                      { value: 'pending', label: 'pending' },
                      { value: 'confirmed', label: 'confirmed' }
                    ]}
                  />
                </div>
                {editingTransactionForm.status === 'confirmed' && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ marginBottom: 4 }}>确认时间</div>
                      <DatePicker
                        showTime
                        style={{ width: '100%' }}
                        value={editingTransactionForm.confirmed_at ? dayjs(editingTransactionForm.confirmed_at) : null}
                        onChange={(date) =>
                          setEditingTransactionForm((prev) => ({ ...prev, confirmed_at: date ? date.format('YYYY-MM-DDTHH:mm') : '' }))
                        }
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ marginBottom: 4 }}>净值</div>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0.0001}
                        step={0.0001}
                        value={editingTransactionForm.nav}
                        onChange={(value) =>
                          setEditingTransactionForm((prev) => ({ ...prev, nav: value }))
                        }
                      />
                    </div>
                  </>
                )}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>备注（可选）</div>
                  <Input
                    value={editingTransactionForm.note}
                    onChange={(event) => setEditingTransactionForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="例如：手工修正净值来源"
                    maxLength={120}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>审计说明（建议填写）</div>
                  <Input
                    value={editingTransactionForm.audit_note}
                    onChange={(event) =>
                      setEditingTransactionForm((prev) => ({ ...prev, audit_note: event.target.value }))
                    }
                    placeholder="例如：回填券商结算数据"
                    maxLength={120}
                  />
                </div>
                <div className="trade-grid trade-grid-single">
                  <Button type="primary" htmlType="submit" loading={transactionPatchLoading} block>
                    {transactionPatchLoading ? '提交中...' : '保存修正'}
                  </Button>
                  <Button type="default" onClick={cancelEditTransaction} disabled={transactionPatchLoading} block>
                    取消编辑
                  </Button>
                </div>
              </form>
              {transactionPatchError && <div className="chart-empty">{transactionPatchError}</div>}
              {transactionPatchResult && (
                <div className="trade-result">
                  <strong>交易修正已保存</strong>
                  <p>状态：{String(transactionPatchResult.status || '') === 'confirmed' ? '已确认' : '待确认'}</p>
                  <p>发生时间：{formatDateTime(transactionPatchResult.occurred_at)}</p>
                  <p>确认时间：{formatDateTime(transactionPatchResult.confirmed_at)}</p>
                </div>
              )}
            </section>
          )}
          {transactionAuditTargetId > 0 && (
            <section className="trade-lifecycle">
              <div className="section-head trade-head">
                <h3>交易审计链路</h3>
                <span>交易 ID：{transactionAuditTargetId}</span>
              </div>
              {transactionAuditLoading && <div className="chart-empty">审计记录加载中...</div>}
              {!transactionAuditLoading && transactionAuditError && <div className="chart-empty">{transactionAuditError}</div>}
              {!transactionAuditLoading && !transactionAuditError && transactionAuditItems.length === 0 && (
                <div className="chart-empty">当前交易暂无审计记录。</div>
              )}
              {!transactionAuditLoading && !transactionAuditError && transactionAuditItems.length > 0 && (
                <div className="record-list">
                  {transactionAuditItems.map((logItem) => (
                    <article key={`tx-audit-${logItem.id}`} className="record-item">
                      <div>
                        <h4>操作 {logItem.action || '--'}</h4>
                        <p>执行人 {logItem.actor_username || logItem.actor_user_id || 'system'} ｜ 时间 {formatDateTime(logItem.created_at)}</p>
                        <p>{logItem.note || '无备注'}</p>
                      </div>
                      <div className="record-side">
                        <strong>{logItem.entity_id || '--'}</strong>
                        <span className="record-pending">{logItem.entity_type || 'fund_transaction'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="section-head trade-head">
            <h3>定投多计划</h3>
            <span>{`共 ${dcaPlans.length} 个计划，失败待办 ${dcaFailedPlans.length} 个`}</span>
          </div>
          <form className="trade-form dca-plan-form" onSubmit={handleCreatePlan}>
            <label>
              计划名称
              <input
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="例如：纳指周定投"
                maxLength={40}
              />
            </label>
            <label>
              基金代码（可选）
              <input
                value={planFundCode}
                onChange={(event) => setPlanFundCode(event.target.value)}
                placeholder="例如 016533"
                maxLength={16}
              />
            </label>
            <label>
              每期金额
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={planAmount}
                onChange={(event) => setPlanAmount(event.target.value)}
                placeholder="请输入金额"
              />
            </label>
            <label>
              扣款频率
              <select value={planSchedule} onChange={(event) => setPlanSchedule(event.target.value)}>
                <option value="weekly">每周</option>
                <option value="biweekly">双周</option>
                <option value="monthly">每月</option>
              </select>
            </label>
            <button type="submit" className="primary" disabled={planSubmitting}>
              {planSubmitting ? '保存中...' : '新增计划'}
            </button>
          </form>
          {planError && <div className="chart-empty">{planError}</div>}
          {dcaPlans.length === 0 && <div className="chart-empty">暂无定投计划，请先新增。</div>}
          {dcaPlans.length > 0 && (
            <Table
              dataSource={dcaPlans.map((plan) => ({ ...plan, key: plan.id }))}
              columns={[
                {
                  title: '计划名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text) => <strong>{text}</strong>,
                  width: 150
                },
                {
                  title: '基金代码',
                  dataIndex: 'fund_id',
                  key: 'fund_id',
                  render: (text) => text || '--',
                  width: 100
                },
                {
                  title: '每期金额',
                  dataIndex: 'amount',
                  key: 'amount',
                  align: 'right',
                  render: (value) => Number(value || 0).toFixed(2),
                  width: 100
                },
                {
                  title: '频率',
                  dataIndex: 'schedule',
                  key: 'schedule',
                  render: (text) => getDcaScheduleLabel(text),
                  width: 100
                },
                {
                  title: '下次执行',
                  dataIndex: 'next_run',
                  key: 'next_run',
                  render: (_, record) => {
                    const failed = dcaStatusMap[String(record.id)] === 'failed'
                    const lastRunAt = dcaLastRunAtMap[String(record.id)]
                    const nextRunDate = record.paused ? null : computeNextRunDate({ schedule: record.schedule, lastRunAt })
                    const untilDays = nextRunDate ? daysUntil(nextRunDate) : null
                    if (record.paused) {
                      return <Tag color="default">已暂停</Tag>
                    }
                    if (failed) {
                      return <Tag color="error">失败待办</Tag>
                    }
                    if (nextRunDate) {
                      const nextRunText = `${formatDate(nextRunDate)}（距今 ${untilDays ?? '--'} 天）`
                      return <Tooltip title={`距今 ${untilDays ?? '--'} 天`}>{nextRunText}</Tooltip>
                    }
                    return '--'
                  },
                  width: 180
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (_, record) => {
                    const failed = dcaStatusMap[String(record.id)] === 'failed'
                    if (record.paused) {
                      return <Tag color="default">已暂停</Tag>
                    }
                    if (failed) {
                      return <Tag color="error">失败待办</Tag>
                    }
                    return <Tag color="success">状态正常</Tag>
                  },
                  width: 100
                },
                {
                  title: '操作',
                  key: 'action',
                  fixed: 'right',
                  width: 220,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="标记已执行">
                        <Button 
                          type="link" 
                          size="small" 
                          onClick={() => handlePlanAction(record, true)}
                        >
                          补扣
                        </Button>
                      </Tooltip>
                      <Tooltip title="记录失败">
                        <Button 
                          type="link" 
                          size="small" 
                          danger
                          onClick={() => handlePlanAction(record, false)}
                        >
                          失败
                        </Button>
                      </Tooltip>
                      <Tooltip title={record.paused ? '恢复计划' : '暂停计划'}>
                        <Button 
                          type="link" 
                          size="small" 
                          onClick={() => handleTogglePlan(record.id)}
                        >
                          {record.paused ? '恢复' : '暂停'}
                        </Button>
                      </Tooltip>
                    </Space>
                  )
                }
              ]}
              pagination={false}
              size="small"
              scroll={{ x: 1000 }}
              bordered
            />
          )}

          <div className="section-head trade-head">
            <h3>交易记录（近7天）</h3>
            <span>{actionLoading ? '加载中...' : `共 ${actionLogs.length} 条`}</span>
          </div>
          {actionError && <div className="chart-empty">{actionError}</div>}
          {!actionError && actionLogs.length === 0 && !actionLoading && (
            <div className="chart-empty">近 7 天暂无交易记录</div>
          )}
          {actionLogs.length > 0 && (
            <div className="record-list">
              {actionLogs.map((item) => (
                <article key={`${item.date}-${item.action_key}-${item.ts}`} className="record-item">
                  <div>
                    <h4>{item.action_key}</h4>
                    <p>{formatDateTime(item.occurred_at || item.ts)}</p>
                  </div>
                  <div className="record-side">
                    <strong>{Number(item.amount || 0).toFixed(2)}</strong>
                    <span className={item.done ? 'record-done' : 'record-pending'}>
                      {item.done ? '已执行' : '未执行'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'holdings' && (
        <>
          <section className="panel holdings-main">
            <div className="section-head">
              <h2>全部持仓总览</h2>
              <span>支持排序、编辑与波形联动</span>
            </div>
            <DataStatusBanner title="持仓页口径" dataStatus={estimateDataStatus} />
            <RiskStatusBar risk={riskOverview} onOpenRiskCenter={handleJumpToRiskCenter} />

            <section className="panel holdings-create-panel">
              <div className="section-head">
                <h3>新增持仓（自动补全）</h3>
                <span>支持基金代码联想并自动回填名称与市场标签</span>
              </div>
              <form className="trade-form holdings-create-form" onSubmit={handleSubmitHoldingCreate}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>基金代码</div>
                  <Input
                    value={holdingCreateForm.fund_id}
                    onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, fund_id: event.target.value }))}
                    placeholder="例如 016453"
                    maxLength={16}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>基金名称</div>
                  <Input
                    value={holdingCreateForm.name}
                    onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="例如 纳斯达克100ETF联接"
                    maxLength={60}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>市场分组</div>
                  <Select
                    style={{ width: '100%' }}
                    value={holdingCreateForm.market_group}
                    onChange={(value) => {
                      const nextGroup = String(value || 'cn_hk')
                      setHoldingCreateForm((prev) => ({
                        ...prev,
                        market_group: nextGroup,
                        bucket: defaultBucketByMarketGroup(nextGroup)
                      }))
                    }}
                    options={[
                      { value: 'cn_hk', label: 'A股/港股（cn_hk）' },
                      { value: 'us_overseas', label: '美股/海外（us_overseas）' }
                    ]}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>持仓分组</div>
                  <Input
                    value={holdingCreateForm.bucket}
                    onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, bucket: event.target.value }))}
                    placeholder="例如 core / overseas / growth"
                    maxLength={32}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>标签（可选）</div>
                  <Input
                    value={holdingCreateForm.tags_text}
                    onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, tags_text: event.target.value }))}
                    placeholder="例如 QDII,指数,科技"
                    maxLength={80}
                  />
                </div>
                <Button type="primary" htmlType="submit" loading={holdingCreateSubmitting} block>
                  {holdingCreateSubmitting ? '提交中...' : '新增/覆盖持仓'}
                </Button>
              </form>

              {holdingCreateSuggestLoading && <div className="chart-empty">基金联想加载中...</div>}
              {!holdingCreateSuggestLoading && holdingCreateSuggestions.length > 0 && (
                <div className="watch-list holdings-create-suggest-list">
                  {holdingCreateSuggestions.slice(0, 6).map((item) => (
                    <article key={`holding-create-suggest-${item.fund_id}`} className="watch-item">
                      <div>
                        <h3>{item.name || '--'}</h3>
                        <p>{item.fund_id} · {marketGroupLabel(item.market_group)}</p>
                      </div>
                      <button type="button" className="ghost" onClick={() => handlePickHoldingCreateSuggestion(item)}>
                        选用
                      </button>
                    </article>
                  ))}
                </div>
              )}
              {holdingCreateError && <div className="chart-empty">{holdingCreateError}</div>}
              {holdingCreateResult && (
                <div className="trade-result">
                  <strong>持仓{holdingCreateResult.action}成功</strong>
                  <p>基金：{holdingCreateResult.name || '--'}（{holdingCreateResult.fund_id || '--'}）</p>
                  <p>市场：{marketGroupLabel(holdingCreateResult.market_group)} ｜ 分组：{holdingCreateResult.bucket || '--'}</p>
                </div>
              )}
              {holdingAutoFillError && <div className="chart-empty">{holdingAutoFillError}</div>}
              {holdingAutoFillResult && (
                <div className="trade-result">
                  <strong>持仓自动补全完成</strong>
                  <p>基金：{holdingAutoFillResult.name || '--'}（{holdingAutoFillResult.fund_id || '--'}）</p>
                  <p>市场：{marketGroupLabel(holdingAutoFillResult.market_group)} ｜ 分组：{holdingAutoFillResult.bucket || '--'}</p>
                  <p>
                    {Array.isArray(holdingAutoFillResult.fields) && holdingAutoFillResult.fields.length > 0
                      ? `已回填字段：${holdingAutoFillResult.fields.join(' / ')}`
                      : '当前字段已是最新，无需回填'}
                  </p>
                </div>
              )}
            </section>

            <HoldingsTable
              title="国内股 / 港股"
              rows={domestic}
              dateLabel={dateLabel}
              sortState={sortState}
              onSort={handleSortByKey}
              selectedFundId={currentFund?.fund_id || ''}
              onSelectFund={setSelectedFundId}
              sparklineMap={sparklineMap}
              onSaveHolding={saveHolding}
              onOpenAudit={handleOpenHoldingAudit}
              onAutoFillHolding={handleAutoFillHolding}
              autoFillLoadingFundId={holdingAutoFillLoadingFundId}
            />

            <HoldingsTable
              title="美股 / 海外"
              rows={overseas}
              dateLabel={dateLabel}
              sortState={sortState}
              onSort={handleSortByKey}
              selectedFundId={currentFund?.fund_id || ''}
              onSelectFund={setSelectedFundId}
              sparklineMap={sparklineMap}
              onSaveHolding={saveHolding}
              onOpenAudit={handleOpenHoldingAudit}
              onAutoFillHolding={handleAutoFillHolding}
              autoFillLoadingFundId={holdingAutoFillLoadingFundId}
            />

            <section className="panel audit-panel">
              <div className="section-head trade-head">
                <h3>持仓变更审计</h3>
                <span>
                  {holdingAuditFundId
                    ? `${holdingAuditFundId} · ${holdingAuditItems.length} 条`
                    : '在持仓表点击“审计”查看历史'}
                </span>
              </div>
              {holdingAuditLoading && <div className="chart-empty">审计记录加载中...</div>}
              {!holdingAuditLoading && !holdingAuditFundId && (
                <div className="chart-empty">尚未选择基金，请在持仓行操作列点击“审计”。</div>
              )}
              {!holdingAuditLoading && holdingAuditError && <div className="chart-empty">{holdingAuditError}</div>}
              {!holdingAuditLoading && holdingAuditFundId && !holdingAuditError && holdingAuditItems.length === 0 && (
                <div className="chart-empty">当前基金暂无审计记录。</div>
              )}
              {!holdingAuditLoading && !holdingAuditError && holdingAuditItems.length > 0 && (
                <div className="record-list">
                  {holdingAuditItems.map((item) => {
                    const changedFields = parseChangedFields(item.note)
                    return (
                      <article key={`holding-audit-${item.id}`} className="record-item">
                        <div>
                          <h4>{holdingAuditActionLabel(item.action)}</h4>
                          <p>
                            执行人 {item.actor_username || item.actor_user_id || 'system'} ｜ 时间 {formatDateTime(item.created_at)}
                          </p>
                          {changedFields.length > 0 && (
                            <p>变更字段：{changedFields.join(' / ')}</p>
                          )}
                        </div>
                        <div className="record-side">
                          <strong>{item.entity_id || '--'}</strong>
                          <span className="record-pending">{item.note || '无备注'}</span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </section>

          <FundDetailPanel
            fund={currentFund}
            rows={filteredRows}
            dateLabel={dateLabel}
            chartDataStatus={fundDetailChartDataStatus}
          />
          <div ref={riskCenterRef}>
            <RiskCenter risk={riskOverview} />
          </div>
        </>
      )}

      {activeTab === 'profile' && (
        <section className="panel holdings-main">
          <div className="section-head">
            <h2>我的</h2>
            <span>账号资料与偏好设置</span>
          </div>
          <div className="todo-grid">
            <article className="todo-card">
              <h3>当前账号</h3>
              <p>{user?.username || '--'}</p>
            </article>
            <article className="todo-card">
              <h3>自动刷新</h3>
              <p>{settings.display.auto_refresh_enabled ? '已开启' : '已关闭'}</p>
              <button type="button" className="ghost" onClick={handleToggleAutoRefresh}>
                切换自动刷新
              </button>
            </article>
            <article className="todo-card">
              <h3>更多设置</h3>
              <p>飞书和邮件配置入口已预留</p>
              <button type="button" className="primary" onClick={() => setSettingsOpen(true)}>打开设置</button>
            </article>
            <article className="todo-card">
              <h3>系统状态页</h3>
              <p>查看版本号、最近同步任务和数据快照状态。</p>
              <button type="button" className="ghost" onClick={openSystemStatusView}>打开状态页</button>
            </article>
          </div>

          {profileView === 'system-status' && (
            <>
              <div className="section-head trade-head">
                <h3>系统状态</h3>
                <span>后端自省快照（/api/system/status）</span>
              </div>
              <div className="trade-grid">
                <button type="button" className="primary" onClick={loadSystemStatus} disabled={systemStatusLoading}>
                  {systemStatusLoading ? '刷新中...' : '刷新状态'}
                </button>
                <button type="button" className="ghost" onClick={openProfileOverview}>返回我的概览</button>
              </div>
              {systemStatusError && <div className="chart-empty">{systemStatusError}</div>}
              {!systemStatusError && !systemStatusData && !systemStatusLoading && (
                <div className="chart-empty">暂无系统状态数据</div>
              )}
              {systemStatusData && (
                <>
                  <div className="trade-result">
                    <strong>{systemStatusData.service || '--'}</strong>
                    <p>版本：{systemStatusData.version || '--'}</p>
                    <p>Commit：{systemStatusData.commit || '--'}</p>
                    <p>线上参考版本：{systemStatusData.release?.online_reference?.version || '--'}</p>
                    <p>线上参考 Commit：{systemStatusData.release?.online_reference?.commit || '--'}</p>
                    <p>
                      与线上对照：
                      {{
                        same: '一致',
                        ahead: '当前分支领先线上',
                        behind: '当前分支落后线上',
                        diverged: '分叉（需人工确认）',
                        unknown: '未知',
                      }[systemStatusData.release?.compare_with_online?.status] || '未知'}
                      （ahead {Number(systemStatusData.release?.compare_with_online?.ahead || 0)} / behind {Number(systemStatusData.release?.compare_with_online?.behind || 0)}）
                    </p>
                    <p>服务器时间：{formatDateTime(systemStatusData.server_time)}</p>
                    <p>Python：{systemStatusData.python_version || '--'}</p>
                  </div>
                  <div className="record-list">
                    <article className="record-item">
                      <div>
                        <h4>估值快照</h4>
                        <p>{systemStatusData.snapshot?.estimate_snapshot?.available ? '可用' : '暂无数据'}</p>
                      </div>
                      <div className="record-side">
                        <strong>{formatDateTime(systemStatusData.snapshot?.estimate_snapshot?.asof)}</strong>
                        <span className="record-pending">
                          更新于 {formatDateTime(systemStatusData.snapshot?.estimate_snapshot?.updated_at)}
                        </span>
                      </div>
                    </article>
                    <article className="record-item">
                      <div>
                        <h4>基金数据</h4>
                        <p>目录活跃数：{Number(systemStatusData.snapshot?.fund_catalog?.active_count || 0)}</p>
                      </div>
                      <div className="record-side">
                        <strong>净值记录 {Number(systemStatusData.snapshot?.fund_nav_daily?.record_count || 0)}</strong>
                        <span className="record-pending">
                          最近净值时间 {formatDateTime(systemStatusData.snapshot?.fund_nav_daily?.latest?.asof)}
                        </span>
                      </div>
                    </article>
                    <article className="record-item">
                      <div>
                        <h4>最近同步任务</h4>
                        <p>
                          {systemStatusData.snapshot?.fund_sync_job?.job_id
                            ? `任务 ${systemStatusData.snapshot.fund_sync_job.job_id}`
                            : '暂无同步任务记录'}
                        </p>
                      </div>
                      <div className="record-side">
                        <strong>{systemStatusData.snapshot?.fund_sync_job?.status || '--'}</strong>
                        <span className="record-pending">
                          完成时间 {formatDateTime(systemStatusData.snapshot?.fund_sync_job?.finished_at)}
                        </span>
                      </div>
                    </article>
                    <article className="record-item">
                      <div>
                        <h4>Pending 对账能力</h4>
                        <p>{systemStatusData.snapshot?.transactions_sync_pending?.note || '--'}</p>
                        <p>
                          当前 pending {Number(systemStatusData.snapshot?.transactions_sync_pending?.pending_count_current || 0)}
                          ｜ confirmed {Number(systemStatusData.snapshot?.transactions_sync_pending?.confirmed_count_current || 0)}
                        </p>
                      </div>
                      <div className="record-side">
                        <strong>
                          {systemStatusData.snapshot?.transactions_sync_pending?.available ? '已可用' : '未启用'}
                        </strong>
                        <span className="record-pending">
                          最近执行 {formatDateTime(systemStatusData.snapshot?.transactions_sync_pending?.last_run_at)}
                        </span>
                        <span className="record-pending">
                          最近确认 {formatDateTime(systemStatusData.snapshot?.transactions_sync_pending?.latest_confirmed_at)}
                        </span>
                        <span className="record-pending">
                          已对账记录 {Number(systemStatusData.snapshot?.transactions_sync_pending?.synced_total || 0)}
                          （基金 {Number(systemStatusData.snapshot?.transactions_sync_pending?.synced_fund_count || 0)}）
                        </span>
                      </div>
                    </article>
                  </div>
                </>
              )}
            </>
          )}

          <div className="section-head trade-head">
            <h3>消息中心</h3>
            <span>交易 / 提醒 / 系统</span>
          </div>
          <div className="message-list">
            {messageItems.map((item) => (
              <article key={`${item.title}-${item.actionTab}`} className={`message-item message-${item.type}`}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.content}</p>
                </div>
                <button type="button" className="ghost" onClick={() => setActiveTab(item.actionTab)}>
                  {item.actionLabel}
                </button>
              </article>
              ))}
          </div>

          <div className="section-head trade-head">
            <h3>组件状态样例页</h3>
            <span>默认 / 悬浮 / 禁用 / 加载 / 错误</span>
          </div>
          <StateShowcase />

          <div className="section-head trade-head">
            <h3>提醒规则中心</h3>
            <span>{`阈值规则 ${reminderRules.length} 条，已触发 ${reminderRuleStates.filter((item) => item.hit).length} 条`}</span>
          </div>
          <form className="trade-form reminder-form" onSubmit={handleCreateRule}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>规则名称</div>
              <Input
                value={ruleName}
                onChange={(event) => setRuleName(event.target.value)}
                placeholder="例如：纳指回撤提醒"
                maxLength={40}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>基金代码（可选）</div>
              <Input
                value={ruleFundCode}
                onChange={(event) => setRuleFundCode(event.target.value)}
                placeholder="留空表示全持仓"
                maxLength={16}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>触发条件</div>
              <Select
                style={{ width: '100%' }}
                value={ruleOperator}
                onChange={(value) => setRuleOperator(value)}
                options={[
                  { value: '<=', label: '小于等于阈值' },
                  { value: '>=', label: '大于等于阈值' }
                ]}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>阈值（%）</div>
              <InputNumber
                style={{ width: '100%' }}
                step={0.01}
                value={ruleThreshold}
                onChange={(value) => setRuleThreshold(value)}
                placeholder="例如 -1.5"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>静默期（小时）</div>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={1}
                value={ruleSilentHours}
                onChange={(value) => setRuleSilentHours(value)}
              />
            </div>
            <Button type="primary" htmlType="submit" loading={ruleSubmitting} block>
              {ruleSubmitting ? '保存中...' : '新增提醒'}
            </Button>
          </form>
          {ruleError && <div className="chart-empty">{ruleError}</div>}
          {reminderRuleStates.length === 0 && <div className="chart-empty">暂无提醒规则，请先新增阈值规则。</div>}
          {reminderRuleStates.length > 0 && (
            <div className="plan-list">
              {reminderRuleStates.map((rule) => (
                <article key={rule.id} className="plan-item">
                  <div>
                    <h4>{rule.name}</h4>
                    <p>
                      作用范围：{rule.fund_id || '全持仓'}（{rule.scopeCount}） ｜ 规则：估值 {rule.operator} {Number(rule.threshold).toFixed(2)}%
                    </p>
                    <p>
                      触发说明：{rule.reason_template} ｜ 当前值：{rule.currentValue == null ? '--' : `${Number(rule.currentValue).toFixed(2)}%`} ｜ 静默期：{rule.silent_hours} 小时
                    </p>
                  </div>
                  <div className="plan-actions">
                    <span className={rule.hit ? 'record-pending' : 'record-done'}>
                      {rule.hit ? '已触发' : '未触发'}
                    </span>
                    <button type="button" className="ghost" onClick={() => handleToggleRule(rule.id)}>
                      {rule.enabled ? '暂停' : '启用'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

          </Content>

          <BottomTabs active={activeTab} onChange={handleTabChange} />

          <SettingsDrawer
            open={settingsOpen}
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onSave={async (draft) => saveSettingsPatch(draft)}
            onUpdateFeishuWebhook={async (webhookUrl) => updateFeishuWebhookCredential(webhookUrl)}
            onUpdateTelegramCredential={async (botToken, chatId) => updateTelegramCredential(botToken, chatId)}
            onSendFeishuTestMessage={async () => sendFeishuTestMessage()}
            onSendTelegramTestMessage={async () => sendTelegramTestMessage()}
          />
        </Layout>
      </Layout>
    </ErrorBoundary>
  )
}

export default App
