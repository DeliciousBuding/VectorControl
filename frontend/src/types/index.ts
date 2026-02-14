// ============================================
// VectorControl TypeScript 类型定义
// ============================================

/** 基金代码 */
export type FundId = string;

/** 货币金额 (CNY) */
export type Money = number;

/** 百分比值 (如: 5.25 表示 5.25%) */
export type Percentage = number;

/** 日期字符串 (ISO 8601) */
export type DateString = string;

/** 请求ID */
export type RequestId = string;

/** 排序方向 */
export type SortOrder = 'asc' | 'desc';

/** 确认状态 */
export type ConfirmState = 'confirmed' | 'partial' | 'estimating';

/** 市场分组 */
export type MarketGroup = 'cn_hk' | 'us' | 'other';

/** 数据源 */
export type DataSource = string;

/** 基金状态 */
export type FundStatus = 'ok' | 'failed';

/** 交易类型 */
export type TransactionType = 'buy' | 'sell' | 'dca' | 'redeem' | 'convert' | 'dividend';

/** 交易状态 */
export type TransactionStatus = 'pending' | 'confirmed' | 'cancelled';

/** 定投计划周期 */
export type DcaSchedule = 'weekly' | 'biweekly' | 'monthly';

/** 状态类型 */
export type StatusType = 'info' | 'success' | 'warning' | 'error';

// ============================================
// API 响应类型
// ============================================

/** 标准API响应 */
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  detail?: string;
  requestId?: RequestId;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 覆盖率统计 */
export interface CoverageStats {
  total: number;
  ok: number;
  failed: number;
}

// ============================================
// 用户相关类型
// ============================================

export interface User {
  id: string;
  username: string;
  createdAt: DateString;
  updatedAt: DateString;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// ============================================
// 设置相关类型
// ============================================

export interface DisplaySettings {
  auto_refresh_enabled: boolean;
  auto_refresh_seconds: number;
  auto_refresh_visible_only: boolean;
}

export interface FeishuSettings {
  enabled: boolean;
  webhook_url: string;
  advice_time: string;
  report_time: string;
  timeout_seconds: number;
  retry_times: number;
  template: string;
}

export interface TelegramSettings {
  enabled: boolean;
  bot_token: string;
  chat_id: string;
  parse_mode: string;
  disable_web_page_preview: boolean;
  timeout_seconds: number;
  retry_times: number;
}

export interface EmailSettings {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  sender: string;
  recipients: string;
  use_tls: boolean;
}

export interface NotificationSettings {
  feishu: FeishuSettings;
  telegram: TelegramSettings;
  email: EmailSettings;
}

export interface NetworkBenchmarkSettings {
  default_profile: string;
  timeout_seconds: number;
  last_run_at: DateString;
  last_result: unknown | null;
}

export interface AppSettings {
  display: DisplaySettings;
  notifications: NotificationSettings;
  network_benchmark: NetworkBenchmarkSettings;
}

// ============================================
// 基金数据类型
// ============================================

/** 原始基金数据 (API返回) */
export interface RawFundData {
  fund_id: FundId;
  name: string;
  bucket?: string;
  market_value_cny: Money;
  cost_basis_cny: Money;
  shares: number;
  start_date: DateString;
  holding_profit_cny?: Money;
  holding_profit_rate?: Percentage;
  day_profit_cny?: Money;
  yesterday_profit_cny?: Money;
  estimate_pct?: Percentage | null;
  latest_nav?: number | null;
  source?: DataSource;
  status?: FundStatus;
  reason?: string;
  as_of?: DateString;
  asof?: DateString;
  updated_at?: DateString;
  confirm_state?: ConfirmState;
  yesterday_profit_source?: string;
  market_group?: MarketGroup;
  tags?: string[];
}

/** 规范化后的基金数据 */
export interface FundRow {
  fund_id: FundId;
  name: string;
  bucket: string;
  market_value_cny: Money;
  cost_basis_cny: Money;
  shares: number;
  start_date: DateString;
  holding_profit_cny: Money;
  holding_profit_rate: Percentage;
  day_profit_cny: Money | null;
  yesterday_profit_cny: Money | null;
  estimate_pct: Percentage | null;
  latest_nav: number | null;
  source: DataSource;
  status: FundStatus;
  reason: string;
  as_of: DateString;
  updated_at: DateString;
  confirm_state: ConfirmState;
  yesterday_profit_source: string;
  market_group: MarketGroup;
  holding_days: number | '--';
  tags: string[];
}

/** 基金详情 */
export interface FundDetail {
  fund_id: FundId;
  name: string;
  category: string;
  manager: string;
  company: string;
  inception_date: DateString;
  description?: string;
}

/** 基金净值历史 */
export interface NavHistoryPoint {
  date: DateString;
  nav: number;
  acc_nav: number;
  change_pct?: Percentage;
}

// ============================================
// 持仓相关类型
// ============================================

export interface Holding {
  fund_id: FundId;
  shares: number;
  cost_basis_cny: Money;
  market_value_cny: Money;
  start_date: DateString;
  created_at: DateString;
  updated_at: DateString;
}

export interface HoldingUpdatePayload {
  shares?: number;
  cost_basis_cny?: Money;
  market_value_cny?: Money;
  start_date?: DateString;
}

export interface HoldingAuditEntry {
  id: string;
  fund_id: FundId;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: DateString;
  changed_by?: string;
}

// ============================================
// 交易相关类型
// ============================================

export interface Transaction {
  id: string;
  fund_id: FundId;
  type: TransactionType;
  status: TransactionStatus;
  shares: number;
  amount_cny: Money;
  nav: number;
  fee_cny: Money;
  transaction_date: DateString;
  confirmed_date?: DateString;
  created_at: DateString;
  updated_at: DateString;
}

export interface TransactionFilter {
  status?: TransactionStatus;
  from?: DateString;
  to?: DateString;
  fundId?: FundId;
  limit?: number;
}

// ============================================
// SIP 定投计划类型
// ============================================

export interface SIPPlan {
  id: string;
  fund_id: FundId;
  fund_name: string;
  amount_cny: Money;
  schedule: DcaSchedule;
  enabled: boolean;
  last_run_at?: DateString;
  next_run_at?: DateString;
  created_at: DateString;
  updated_at: DateString;
}

export interface SIPPlanPayload {
  fund_id: FundId;
  amount_cny: Money;
  schedule: DcaSchedule;
  enabled?: boolean;
}

// ============================================
// 风险评估类型
// ============================================

export interface RiskOverview {
  total_exposure_cny: Money;
  concentration_risk: {
    top_holding_pct: Percentage;
    top_sector_pct: Percentage;
  };
  volatility_metrics: {
    daily_volatility: Percentage;
    max_drawdown: Percentage;
  };
  alerts: RiskAlert[];
}

export interface RiskAlert {
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  fund_id?: FundId;
  created_at: DateString;
}

// ============================================
// 图表数据类型
// ============================================

export interface CumulativeReturnsPoint {
  date: DateString;
  value: number;
  benchmark_value?: number;
}

export interface ReturnsHistoryPoint {
  date: DateString;
  daily_return: Percentage;
  cumulative_return: Percentage;
}

export interface Benchmark {
  id: string;
  name: string;
  code: string;
  category: string;
}

// ============================================
// 状态管理类型
// ============================================

export interface AppStatus {
  type: StatusType;
  message: string;
}

export interface EstimateDataStatus {
  status: 'estimating' | 'confirmed' | 'error';
  asof: DateString;
  note: string;
}

// ============================================
// 排序相关类型
// ============================================

export type SortColumn = 
  | 'name' 
  | 'market_value_cny' 
  | 'day_profit_cny' 
  | 'holding_profit_cny' 
  | 'holding_profit_rate' 
  | 'estimate_pct' 
  | 'holding_days';

export interface SorterState {
  key: SortColumn | '';
  order: SortOrder | '';
}

// ============================================
// 组件 Props 类型
// ============================================

export interface HoldingsTableProps {
  title: string;
  rows: FundRow[];
  dateLabel: string;
  sortState: SorterState;
  onSort: (key: SortColumn) => void;
  selectedFundId: FundId | null;
  onSelectFund: (fundId: FundId) => void;
  sparklineMap: Record<FundId, number[]>;
  onSaveHolding: (fundId: FundId, payload: HoldingUpdatePayload) => Promise<boolean>;
  onOpenAudit: (fundId: FundId) => void;
  onAutoFillHolding: (row: FundRow) => void;
  autoFillLoadingFundId: FundId | null;
  loading?: boolean;
}

export interface SummaryCardsProps {
  rows: FundRow[];
  loading?: boolean;
}

export interface ReturnsChartProps {
  user: User | null;
}

export interface BenchmarkComparisonProps {
  user: User | null;
}

export interface SettingsDrawerProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (draft: AppSettings) => Promise<void>;
  onUpdateFeishuWebhook: (webhookUrl: string) => Promise<boolean>;
  onUpdateTelegramCredential: (botToken: string, chatId: string) => Promise<boolean>;
  onSendFeishuTestMessage: () => Promise<unknown>;
  onSendTelegramTestMessage: () => Promise<unknown>;
}
