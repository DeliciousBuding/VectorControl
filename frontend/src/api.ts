/**
 * API 接口层 - TypeScript 版本
 * @module api
 */

import type {
  User,
  AuthPayload,
  LoginCredentials,
  AppSettings,
  FundRow,
  RawFundData,
  SIPPlan,
  SIPPlanPayload,
  Transaction,
  TransactionFilter,
  Holding,
  HoldingUpdatePayload,
  RiskOverview,
  Benchmark,
  NavHistoryPoint,
  FundDetail,
  CumulativeReturnsPoint,
  ReturnsHistoryPoint,
  EstimateDataStatus
} from './types';

const SESSION_TOKEN_KEY = 'vectorcontrol_session_token';
export const AUTH_EVENT_EXPIRY = 'vectorcontrol_auth_expiry';
const AUTH_EXPIRY_EXCLUDED_PATHS = new Set(['/api/auth/login', '/api/auth/register']);
const EMPTY_TRANSACTION_SUMMARY = {
  total_count: 0,
  pending_count: 0,
  confirmed_count: 0,
  last_occurred_at: ''
};

/** API 错误接口 */
export interface ApiError extends Error {
  status?: number;
  path?: string;
  requestId?: string;
  request_id?: string;
}

/** Fetch 选项接口 */
interface FetchOptions extends RequestInit {
  body?: unknown;
}

/** 估值响应接口 */
export interface EstimateResponse {
  funds: RawFundData[];
  as_of: string;
  asof: string;
  updated_at: string;
  confirm_state: string;
  coverage: { total: number; ok: number; failed: number };
  cache_hit: boolean;
  incremental_mode: string;
  incremental_reused_quotes: number;
  incremental_fetched_quotes: number;
  data_status: EstimateDataStatus;
  risk_overview: RiskOverview | null;
}

export interface TransactionSummary {
  total_count: number;
  pending_count: number;
  confirmed_count: number;
  last_occurred_at: string;
}

export interface FundDetailPagePayload {
  fund: Record<string, unknown> | null;
  latest: Record<string, unknown> | null;
  history: Record<string, unknown>[];
  transactions: Transaction[];
  transactionSummary: TransactionSummary;
  dataStatus: EstimateDataStatus;
}

/** 读取请求ID */
function readRequestId(headers: Headers): string {
  if (!headers || typeof headers.get !== 'function') return '';
  return String(
    headers.get('x-request-id') ||
    headers.get('X-Request-ID') ||
    ''
  ).trim();
}

/** 将请求ID附加到消息 */
function withRequestId(message: string, requestId: string): string {
  const base = String(message || '').trim();
  const trace = String(requestId || '').trim();
  if (!trace) return base;
  if (base.includes(trace)) return base;
  return `${base}（请求ID: ${trace}）`;
}

function notifyAuthExpiry(detail: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT_EXPIRY, { detail }));
}

function attachAuthExpiry(error: ApiError, response: Response, payload: unknown): ApiError {
  const status = Number(response?.status || error?.status || 0);
  const path = String(error?.path || '').trim();
  if (status !== 401 || !path || AUTH_EXPIRY_EXCLUDED_PATHS.has(path)) {
    return error;
  }

  const detailPayload = payload as { detail?: string; message?: string } | null;
  const detail = {
    path,
    status,
    requestId: String(error?.requestId || error?.request_id || '').trim(),
    reason: String(detailPayload?.detail || detailPayload?.message || error?.message || '').trim()
  };

  (error as ApiError & { authExpired?: boolean }).authExpired = true;
  notifyAuthExpiry(detail);
  return error;
}

function clampDays(days: number | string | undefined, fallback = 30): number {
  return Math.max(1, Math.min(Number(days) || fallback, 365));
}

function toQueryString(params: Record<string, unknown> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

function buildFundDetailPayload(payload: Record<string, unknown> = {}, fundId = ''): FundDetailPagePayload {
  const fund = payload?.fund && typeof payload.fund === 'object' ? payload.fund as Record<string, unknown> : {};
  const holding = payload?.holding && typeof payload.holding === 'object' ? payload.holding as Record<string, unknown> : {};
  const latest = payload?.latest && typeof payload.latest === 'object' ? payload.latest as Record<string, unknown> : null;
  const history = Array.isArray(payload?.history) ? payload.history as Record<string, unknown>[] : [];
  const mergedFund = {
    ...fund,
    ...holding,
    fund_id: String(fund?.fund_id || holding?.fund_id || fundId || '').trim(),
    name: String(fund?.name || holding?.name || fundId || '').trim(),
    market_group: String(holding?.market_group || fund?.market_group || 'cn_hk').trim()
  };
  return {
    fund: mergedFund,
    latest,
    history,
    transactions: Array.isArray(payload?.transactions) ? payload.transactions as Transaction[] : [],
    transactionSummary:
      payload?.transaction_summary && typeof payload.transaction_summary === 'object'
        ? { ...EMPTY_TRANSACTION_SUMMARY, ...(payload.transaction_summary as Partial<TransactionSummary>) }
        : { ...EMPTY_TRANSACTION_SUMMARY },
    dataStatus:
      payload?.data_status && typeof payload.data_status === 'object'
        ? payload.data_status as EstimateDataStatus
        : { status: 'estimating', asof: '', note: '基金详情已加载' }
  };
}

export function getFundDetailEmptyState(): FundDetailPagePayload {
  return {
    fund: null,
    latest: null,
    history: [],
    transactions: [],
    transactionSummary: { ...EMPTY_TRANSACTION_SUMMARY },
    dataStatus: { status: 'estimating', asof: '', note: '基金详情待加载' }
  };
}

/** 获取存储的Token */
export function getStoredToken(): string {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** 设置存储的Token */
export function setStoredToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // 忽略浏览器存储异常
  }
}

/**
 * 基础API请求函数
 * @param path - 请求路径
 * @param options - 请求选项
 * @returns 响应数据
 */
export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers as Record<string, string>);
  headers.set('Accept', 'application/json');

  const token = getStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | null = options.body as BodyInit;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      body
    });
  } catch {
    throw new Error('网络请求失败，请检查连接状态');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text };
    }
  }

  if (!response.ok) {
    const requestId = readRequestId(response.headers);
    const errorPayload = payload as { detail?: string; message?: string; error?: string };
    const message = errorPayload?.detail || errorPayload?.message || errorPayload?.error || `请求失败（${response.status}）`;
    const error: ApiError = new Error(withRequestId(message, requestId));
    error.status = response.status;
    error.path = path;
    error.requestId = requestId;
    error.request_id = requestId;
    throw attachAuthExpiry(error, response, payload);
  }

  return payload as T;
}

/**
 * 带fallback的API请求
 * @param paths - 请求路径数组
 * @param options - 请求选项
 * @returns 响应数据
 */
async function apiFetchWithFallback<T>(paths: string[], options: FetchOptions = {}): Promise<T> {
  const candidates = Array.isArray(paths) ? paths : [paths];
  let lastError: Error | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index];
    try {
      return await apiFetch<T>(path, options);
    } catch (error) {
      lastError = error as Error;
      const apiError = error as ApiError;
      if (apiError?.status !== 404 || index === candidates.length - 1) {
        throw error;
      }
    }
  }
  throw lastError || new Error('请求失败');
}

// ============================================
// Auth APIs
// ============================================

export function registerUser(payload: LoginCredentials): Promise<AuthPayload> {
  return apiFetch<AuthPayload>('/api/auth/register', { method: 'POST', body: payload });
}

export function loginUser(payload: LoginCredentials): Promise<AuthPayload> {
  return apiFetch<AuthPayload>('/api/auth/login', { method: 'POST', body: payload });
}

export function fetchMe(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/api/auth/me');
}

export function logoutUser(): Promise<void> {
  return apiFetch<void>('/api/auth/logout', { method: 'POST' });
}

// ============================================
// Settings APIs
// ============================================

export function fetchSettings(): Promise<{ settings: AppSettings }> {
  return apiFetch<{ settings: AppSettings }>('/api/settings');
}

export function saveSettings(payload: { settings: AppSettings }): Promise<void> {
  return apiFetch<void>('/api/settings', { method: 'PUT', body: payload });
}

export function updateFeishuWebhookCredential(payload: { webhook_url: string }): Promise<void> {
  return apiFetch<void>('/api/settings/notifications/feishu/webhook', { method: 'PUT', body: payload });
}

export function updateTelegramCredential(payload: { bot_token: string; chat_id: string }): Promise<void> {
  return apiFetch<void>('/api/settings/notifications/telegram/credential', { method: 'PUT', body: payload });
}

export function issueTelegramDiscoverySecret(payload: { rotate?: boolean } = {}): Promise<unknown> {
  return apiFetch<unknown>('/api/settings/notifications/telegram/discovery/secret', { method: 'POST', body: payload });
}

export function sendTelegramTestMessage(): Promise<unknown> {
  return apiFetch<unknown>('/api/settings/notifications/telegram/test_message', { method: 'POST' });
}

export function sendFeishuTestMessage(): Promise<unknown> {
  return apiFetch<unknown>('/api/settings/notifications/feishu/test_message', { method: 'POST' });
}

export function fetchNotificationsStatus(): Promise<unknown> {
  return apiFetch<unknown>('/api/settings/notifications/status');
}

export function testAllNotifications(): Promise<unknown> {
  return apiFetch<unknown>('/api/settings/notifications/test_all', { method: 'POST' });
}

export function fetchSettingsAuditLogs(limit = 20): Promise<unknown> {
  return apiFetch<unknown>(`/api/settings/audit_logs?limit=${encodeURIComponent(String(limit))}`);
}

export function fetchNetworkBenchmarkLatest(): Promise<unknown> {
  return apiFetchWithFallback<unknown>([
    '/api/settings/network-benchmark/latest',
    '/api/settings/network_benchmark/latest'
  ]);
}

export function runNetworkBenchmark(payload: unknown): Promise<unknown> {
  return apiFetchWithFallback<unknown>(
    ['/api/settings/network-benchmark/run', '/api/settings/network_benchmark/run'],
    { method: 'POST', body: payload }
  );
}

// ============================================
// System APIs
// ============================================

export function fetchSystemStatus(): Promise<unknown> {
  return apiFetch<unknown>('/api/system/status');
}

export function fetchHealthz(): Promise<unknown> {
  return apiFetchWithFallback<unknown>(['/api/healthz', '/api/health']);
}

export function fetchConfig(): Promise<unknown> {
  return apiFetch<unknown>('/api/config');
}

// ============================================
// Portfolio APIs
// ============================================

export function fetchPortfolioCumulativeReturns(days = 30): Promise<{ data: CumulativeReturnsPoint[] }> {
  return apiFetch<{ data: CumulativeReturnsPoint[] }>(`/api/charts/cumulative_returns${toQueryString({ days: clampDays(days) })}`);
}

export function fetchPortfolioReturnsHistory(days = 30): Promise<{ data: ReturnsHistoryPoint[] }> {
  return apiFetch<{ data: ReturnsHistoryPoint[] }>(`/api/charts/returns_history${toQueryString({ days: clampDays(days) })}`);
}

// ============================================
// Estimate APIs
// ============================================

export function fetchEstimate(options: { forceRefresh?: boolean; preferCached?: boolean } = {}): Promise<EstimateResponse> {
  return apiFetch<EstimateResponse>(`/api/estimate${toQueryString({
    force_refresh: options.forceRefresh !== undefined ? (options.forceRefresh ? '1' : '0') : undefined,
    prefer_cached: options.preferCached !== undefined ? (options.preferCached ? '1' : '0') : undefined
  })}`);
}

export function fetchRiskOverview(): Promise<RiskOverview> {
  return apiFetch<RiskOverview>('/api/risk/overview');
}

export function fetchAdvice(): Promise<unknown> {
  return apiFetch<unknown>('/api/advice');
}

// ============================================
// Action APIs
// ============================================

export function fetchActions(date = ''): Promise<unknown> {
  return apiFetch<unknown>(`/api/actions${toQueryString({ date })}`);
}

export function saveAction(payload: unknown): Promise<unknown> {
  return apiFetch<unknown>('/api/actions', { method: 'POST', body: payload });
}

// ============================================
// Transaction APIs
// ============================================

export function fetchTransactions(options: TransactionFilter = {}): Promise<{ items: Transaction[]; summary: unknown; data_status?: EstimateDataStatus }> {
  return apiFetch<{ items: Transaction[]; summary: unknown; data_status?: EstimateDataStatus }>(`/api/transactions${toQueryString({
    status: options.status,
    from: options.from,
    to: options.to,
    fund_id: options.fundId,
    limit: options.limit
  })}`);
}

export function syncPendingTransactions(payload: { limit?: number; fund_id?: string } = {}): Promise<unknown> {
  return apiFetch<unknown>('/api/transactions/sync_pending', { method: 'POST', body: payload });
}

export function patchTransaction(transactionId: string | number, payload: unknown): Promise<{ transaction: Transaction }> {
  return apiFetch<{ transaction: Transaction }>(`/api/transactions/${encodeURIComponent(String(transactionId || '').trim())}`, {
    method: 'PATCH',
    body: payload
  });
}

export function fetchTransactionAudit(transactionId: string | number, limit = 20): Promise<{ items: unknown[] }> {
  const query = new URLSearchParams({
    limit: String(limit)
  });
  return apiFetch<{ items: unknown[] }>(
    `/api/transactions/${encodeURIComponent(String(transactionId || '').trim())}/audit?${query.toString()}`
  );
}

// ============================================
// Holding APIs
// ============================================

export function createHolding(payload: HoldingUpdatePayload): Promise<{ holding: Holding }> {
  return apiFetch<{ holding: Holding }>('/api/holdings', {
    method: 'POST',
    body: payload
  });
}

export function updateHolding(fundId: string, payload: HoldingUpdatePayload): Promise<{ holding: Holding }> {
  return apiFetch<{ holding: Holding }>(`/api/holdings/${encodeURIComponent(fundId)}`, {
    method: 'PATCH',
    body: payload
  });
}

export function fetchHoldingAudit(fundId: string, limit = 50): Promise<{ items: unknown[] }> {
  const query = new URLSearchParams({
    limit: String(limit)
  });
  return apiFetch<{ items: unknown[] }>(`/api/holdings/${encodeURIComponent(String(fundId || '').trim())}/audit?${query.toString()}`);
}

export function fetchHoldingDetail(fundId: string): Promise<{ fund_id: string; holding: RawFundData; data_status?: EstimateDataStatus }> {
  return apiFetch<{ fund_id: string; holding: RawFundData; data_status?: EstimateDataStatus }>(`/api/holdings/${encodeURIComponent(String(fundId || '').trim())}`);
}

// ============================================
// Report APIs
// ============================================

export function fetchDailyReport(date = ''): Promise<unknown> {
  return apiFetch<unknown>(`/api/report/daily${toQueryString({ date })}`);
}

// ============================================
// Fund APIs
// ============================================

export function fetchFundSuggest(keyword: string, limit = 8): Promise<{ items: FundDetail[]; data_status?: EstimateDataStatus }> {
  return apiFetch<{ items: FundDetail[]; data_status?: EstimateDataStatus }>(`/api/funds/suggest${toQueryString({ keyword, limit })}`);
}

export function searchFunds(q: string, limit = 10): Promise<{ items: FundDetail[] }> {
  return apiFetch<{ items: FundDetail[] }>(`/api/funds/search${toQueryString({ q, limit })}`);
}

export function fetchFundDetail(fundId: string): Promise<{ fund: FundDetail; data_status?: EstimateDataStatus }> {
  return apiFetch<{ fund: FundDetail; data_status?: EstimateDataStatus }>(`/api/funds/${encodeURIComponent(String(fundId || '').trim())}`);
}

export function fetchFundFullDetail(fundId: string, historyLimit = 90): Promise<Record<string, unknown>> {
  const cleanFundId = encodeURIComponent(String(fundId || '').trim());
  return apiFetch<Record<string, unknown>>(`/api/funds/${cleanFundId}/full${toQueryString({ history_limit: clampDays(historyLimit, 90) })}`);
}

export async function fetchFundDetailPageData(fundId: string, options: { historyLimit?: number; transactionLimit?: number } = {}): Promise<FundDetailPagePayload> {
  const payload = await fetchFundFullDetail(fundId, options.historyLimit ?? 90);
  const txPayload = await fetchTransactions({
    fundId,
    status: 'all',
    limit: options.transactionLimit ?? 20
  }).catch(() => null);

  const detail = buildFundDetailPayload(payload, fundId);
  detail.transactions = Array.isArray(txPayload?.items) ? txPayload.items : [];
  detail.transactionSummary =
    txPayload?.summary && typeof txPayload.summary === 'object'
      ? { ...EMPTY_TRANSACTION_SUMMARY, ...(txPayload.summary as Partial<TransactionSummary>) }
      : { ...EMPTY_TRANSACTION_SUMMARY };

  if (txPayload?.data_status && typeof txPayload.data_status === 'object') {
    detail.dataStatus = txPayload.data_status as EstimateDataStatus;
  }

  return detail;
}

export function fetchFundNavLatest(fundId: string): Promise<{ latest: NavHistoryPoint; data_status?: EstimateDataStatus }> {
  return apiFetch<{ latest: NavHistoryPoint; data_status?: EstimateDataStatus }>(`/api/funds/${encodeURIComponent(String(fundId || '').trim())}/nav/latest`);
}

export function fetchFundNavHistory(fundId: string, options: { from?: string; to?: string; limit?: number } = {}): Promise<{ items: NavHistoryPoint[]; data_status?: EstimateDataStatus }> {
  return apiFetch<{ items: NavHistoryPoint[]; data_status?: EstimateDataStatus }>(`/api/funds/${encodeURIComponent(String(fundId || '').trim())}/nav/history${toQueryString({
    from: options.from,
    to: options.to,
    limit: options.limit
  })}`);
}

// ============================================
// Chart APIs
// ============================================

export function fetchCumulativeReturns(days = 30): Promise<{ data: CumulativeReturnsPoint[] }> {
  return apiFetch<{ data: CumulativeReturnsPoint[] }>(`/api/charts/cumulative_returns${toQueryString({ days: clampDays(days) })}`);
}

export function fetchReturnsHistory(days = 30): Promise<{ data: ReturnsHistoryPoint[] }> {
  return apiFetch<{ data: ReturnsHistoryPoint[] }>(`/api/charts/returns_history${toQueryString({ days: clampDays(days) })}`);
}

export function fetchHomeDashboard(returnsDays = 30): Promise<unknown> {
  return apiFetch<unknown>(`/api/charts/home_dashboard${toQueryString({ returns_days: clampDays(returnsDays) })}`);
}

// ============================================
// Benchmark APIs
// ============================================

export function fetchBenchmarks(): Promise<{ items: Benchmark[] }> {
  return apiFetch<{ items: Benchmark[] }>('/api/benchmark/list');
}

export function fetchBenchmarkComparison(): Promise<unknown> {
  return apiFetch<unknown>('/api/benchmark/comparison');
}

export function fetchBenchmarkList(): Promise<{ items: Benchmark[] }> {
  return apiFetch<{ items: Benchmark[] }>('/api/benchmark/list');
}

// ============================================
// SIP Plan APIs
// ============================================

export function fetchSIPPlans(enabledOnly = false): Promise<SIPPlan[]> {
  return apiFetch<SIPPlan[]>(`/api/sip${toQueryString({ enabled_only: enabledOnly })}`);
}

export function createSIPPlan(payload: SIPPlanPayload): Promise<SIPPlan> {
  return apiFetch<SIPPlan>('/api/sip', { method: 'POST', body: payload });
}

export function updateSIPPlan(planId: string, payload: Partial<SIPPlanPayload>): Promise<SIPPlan> {
  return apiFetch<SIPPlan>(`/api/sip/${encodeURIComponent(String(planId))}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteSIPPlan(planId: string): Promise<void> {
  return apiFetch<void>(`/api/sip/${encodeURIComponent(String(planId))}`, {
    method: 'DELETE'
  });
}

export function executeSIPPlan(planId: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/sip/${encodeURIComponent(String(planId))}/execute`, {
    method: 'POST'
  });
}

export function fetchUpcomingSIPPlans(days = 7): Promise<unknown> {
  return apiFetch<unknown>(`/api/sip/upcoming${toQueryString({ days: clampDays(days, 7) })}`);
}
