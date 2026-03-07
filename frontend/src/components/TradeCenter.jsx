import { lazy, Suspense } from 'react'
import dayjs from 'dayjs'
import Button from 'antd/es/button'
import Checkbox from 'antd/es/checkbox'
import DatePicker from 'antd/es/date-picker'
import Input from 'antd/es/input'
import InputNumber from 'antd/es/input-number'
import Select from 'antd/es/select'
import Space from 'antd/es/space'
import Spin from 'antd/es/spin'
import Table from 'antd/es/table'
import Tag from 'antd/es/tag'
import Tooltip from 'antd/es/tooltip'
import { EditOutlined } from '@ant-design/icons'
import { DataStatusBanner } from './DataStatusBanner.jsx'
import { computeNextRunDate, daysUntil, getDcaScheduleLabel } from '../utils/dca.js'

const SIPPlanManager = lazy(() => import('./SIPPlanManager.jsx').then(m => ({ default: m.SIPPlanManager })))

const TRADE_TYPES = [
  { key: 'buy', label: '买入' },
  { key: 'dca', label: '定投' },
  { key: 'redeem', label: '赎回' },
  { key: 'convert', label: '转换' },
  { key: 'dividend', label: '分红' }
]

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

function lifecycleStepClass(currentStep, targetStep) {
  if (currentStep > targetStep) return 'done'
  if (currentStep == targetStep) return 'active'
  return 'todo'
}

export function TradeCenter({
  user,
  actionDataStatus,
  tradeType,
  setTradeType,
  setTradeSubmitError,
  setTradeSubmitResult,
  recordMetric,
  tradeFundCode,
  setTradeFundCode,
  tradeFundSuggestLoading,
  tradeFundSuggestions,
  handlePickTradeSuggestion,
  tradeAmount,
  setTradeAmount,
  tradeOccurredAt,
  setTradeOccurredAt,
  tradeDone,
  setTradeDone,
  tradeSubmitting,
  handleTradeSubmit,
  tradeSubmitError,
  tradeSubmitResult,
  formatDateTime,
  actionLoading,
  actionError,
  actionLogs,
  transactionLifecycle,
  transactionSummary,
  transactionLoading,
  transactionDataStatus,
  transactionFilterStatus,
  setTransactionFilterStatus,
  handleSyncPending,
  syncPendingLoading,
  loadTransactionList,
  syncPendingError,
  syncPendingResult,
  transactionError,
  transactionLogs,
  beginEditTransaction,
  transactionPatchLoading,
  loadTransactionAudit,
  transactionAuditLoading,
  editingTransactionId,
  editingTransactionForm,
  setEditingTransactionForm,
  nowForDateTimeInput,
  handlePatchTransaction,
  cancelEditTransaction,
  transactionPatchError,
  transactionPatchResult,
  transactionAuditTargetId,
  transactionAuditError,
  transactionAuditItems,
  dcaPlans,
  dcaFailedPlans,
  planName,
  setPlanName,
  planFundCode,
  setPlanFundCode,
  planAmount,
  setPlanAmount,
  planSchedule,
  setPlanSchedule,
  planSubmitting,
  handleCreatePlan,
  planError,
  dcaStatusMap,
  dcaLastRunAtMap,
  handlePlanAction,
  handleTogglePlan,
  formatDate
}) {
  return (
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
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {[1000, 5000, 10000, 50000].map((amount) => (
                  <Button
                    key={amount}
                    size="small"
                    type={tradeAmount === amount ? 'primary' : 'default'}
                    onClick={() => {
                      setTradeAmount(amount)
                      recordMetric('快捷金额点击', { amount })
                    }}
                    style={{ flex: 1 }}
                  >
                    {amount >= 10000 ? `${amount / 10000}万` : amount}
                  </Button>
                ))}
              </div>
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
            <Suspense fallback={<Spin tip="加载定投计划..." />}>
              <SIPPlanManager user={user} />
            </Suspense>
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
  )
}
