import { useEffect, useMemo, useState } from 'react'
import { Button, Spin, Card, Row, Col, Tag, Table } from 'antd'
import { ArrowLeftOutlined, LineChartOutlined, HistoryOutlined, WalletOutlined } from '@ant-design/icons'
import { MultiLineChart } from '../components/MultiLineChart.jsx'
import { fetchFundDetail, fetchFundNavHistory, fetchTransactions, fetchFundNavLatest } from '../api.js'
import { buildFundSeries } from '../utils/chart.js'
import { classBySign, formatMoney, formatPercent, formatSignedMoney, formatDateTime, formatDate } from '../utils/format.js'

function Metric({ label, value, className = '', suffix = '' }) {
  return (
    <div className="metric-item" style={{ padding: '12px 0' }}>
      <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '4px' }}>{label}</div>
      <div className={`metric-main ${className}`} style={{ fontSize: '18px', fontWeight: 600 }}>
        {value}{suffix}
      </div>
    </div>
  )
}

function MiniMetric({ label, value, className = '' }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px' }}>
      <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 500 }} className={className}>{value}</div>
    </div>
  )
}

export function FundDetailPage({ fundId, onBack }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fundData, setFundData] = useState(null)
  const [navHistory, setNavHistory] = useState([])
  const [navLatest, setNavLatest] = useState(null)
  const [txList, setTxList] = useState([])
  const [txSummary, setTxSummary] = useState({ total_count: 0, pending_count: 0, confirmed_count: 0 })
  const [range, setRange] = useState('1m')

  useEffect(() => {
    if (!fundId) return
    
    let active = true
    setLoading(true)
    setError('')
    
    ;(async () => {
      try {
        const [detailRes, historyRes, latestRes, txRes] = await Promise.all([
          fetchFundDetail(fundId),
          fetchFundNavHistory(fundId, { limit: 90 }),
          fetchFundNavLatest(fundId),
          fetchTransactions({ fundId, status: 'all', limit: 50 })
        ])
        
        if (!active) return
        
        setFundData(detailRes?.fund || null)
        setNavHistory(Array.isArray(historyRes?.items) ? historyRes.items : [])
        setNavLatest(latestRes || null)
        setTxList(txRes?.items || [])
        setTxSummary(txRes?.summary || { total_count: 0, pending_count: 0, confirmed_count: 0 })
      } catch (err) {
        if (!active) return
        setError(err?.message || '加载基金详情失败')
      } finally {
        if (active) setLoading(false)
      }
    })()
    
    return () => { active = false }
  }, [fundId])

  // 构建图表数据
  const chartSeries = useMemo(() => {
    if (!fundData || !navHistory.length) return []
    
    const daysMap = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 }
    const days = daysMap[range] || 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    const filtered = navHistory.filter(item => new Date(item.trade_date) >= cutoff)
    
    return filtered.map(item => ({
      date: item.trade_date.slice(5), // MM-DD
      nav: item.unit_nav || item.estimate_nav || 0,
      estimate: item.estimate_nav || null,
      confirmState: item.confirm_state
    }))
  }, [navHistory, range])

  const handleBack = () => {
    if (onBack) {
      onBack()
    }
  }

  // 交易记录表格列
  const txColumns = [
    { title: '日期', dataIndex: 'occurred_at', key: 'occurred_at', width: 120, render: v => v ? formatDate(v) : '--' },
    { title: '类型', dataIndex: 'action', key: 'action', width: 80, render: v => {
      const map = { buy: '买入', sell: '卖出', sip: '定投', dividend: '分红' }
      return map[v] || v
    }},
    { title: '金额', dataIndex: 'amount_cny', key: 'amount_cny', width: 100, align: 'right', render: v => formatMoney(v) },
    { title: '份额', dataIndex: 'shares', key: 'shares', width: 100, align: 'right', render: v => v ? formatMoney(v, 2) : '--' },
    { title: '净值', dataIndex: 'nav', key: 'nav', width: 100, align: 'right', render: v => v ? formatMoney(v, 4) : '--' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => (
      <Tag color={v === 'confirmed' ? 'green' : v === 'pending' ? 'orange' : 'default'}>
        {v === 'confirmed' ? '已确认' : v === 'pending' ? '待确认' : v}
      </Tag>
    )},
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true }
  ]

  if (loading) {
    return (
      <div className="panel" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载基金详情..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="section-head" style={{ marginBottom: '20px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回</Button>
        </div>
        <div className="chart-empty" style={{ color: '#ff4d4f', padding: '40px' }}>{error}</div>
      </div>
    )
  }

  if (!fundData) {
    return (
      <div className="panel">
        <div className="section-head" style={{ marginBottom: '20px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回</Button>
        </div>
        <div className="chart-empty" style={{ padding: '40px' }}>基金不存在或暂无数据</div>
      </div>
    )
  }

  const rangeOptions = [
    { key: '1m', label: '近1月' },
    { key: '3m', label: '近3月' },
    { key: '6m', label: '近6月' },
    { key: '1y', label: '近1年' }
  ]

  // 计算涨跌幅颜色
  const dayChangeClass = classBySign(fundData.day_change_pct || 0)
  const holdingChangeClass = classBySign(fundData.holding_profit_rate || 0)

  return (
    <div className="panel fund-detail-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* 头部返回按钮 */}
      <div className="section-head" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回首页</Button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <WalletOutlined />
            {fundData.name}
            <span style={{ color: 'var(--muted)', fontSize: '14px', fontWeight: 'normal' }}>{fundData.fund_id}</span>
          </h1>
        </div>
        <Tag color={fundData.market_group === 'us_overseas' ? 'blue' : 'green'}>
          {fundData.market_group === 'us_overseas' ? '美股/海外' : 'A股/港股'}
        </Tag>
      </div>

      {/* 顶部关键指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <MiniMetric label="当前市值" value={formatMoney(fundData.market_value_cny)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <MiniMetric label="持有收益" value={formatSignedMoney(fundData.holding_profit_cny)} className={holdingChangeClass} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <MiniMetric label="当日收益" value={formatSignedMoney(fundData.day_profit_cny)} className={dayChangeClass} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <MiniMetric label="持有收益率" value={formatPercent(fundData.holding_profit_rate)} className={holdingChangeClass} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* 左侧：图表区域 */}
        <Col xs={24} lg={14}>
          <Card 
            title={<span><LineChartOutlined /> 净值走势</span>}
            extra={
              <div className="range-tabs" style={{ display: 'flex', gap: '4px' }}>
                {rangeOptions.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={range === item.key ? 'primary' : 'ghost'}
                    onClick={() => setRange(item.key)}
                    style={{ padding: '4px 12px', fontSize: '13px' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
          >
            <div style={{ height: '280px' }}>
              {chartSeries.length > 0 ? (
                <MultiLineChart
                  data={chartSeries}
                  lines={[
                    { key: 'nav', color: '#4361ee', width: 2 },
                    { key: 'estimate', color: '#ffa94d', width: 1.5 }
                  ]}
                  xKey="date"
                  yLabel="净值"
                />
              ) : (
                <div className="chart-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  暂无图表数据
                </div>
              )}
            </div>
          </Card>

          {/* 交易记录 */}
          <Card title={<span><HistoryOutlined /> 交易记录 ({txSummary.total_count})</span>} style={{ marginTop: '16px' }}>
            <Table
              dataSource={txList}
              columns={txColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>

        {/* 右侧：基金信息 */}
        <Col xs={24} lg={10}>
          <Card title="持仓详情">
            <Row gutter={[0, 0]}>
              <Col span={12}><Metric label="持有份额" value={formatMoney(fundData.shares, 2)} /></Col>
              <Col span={12}><Metric label="持仓成本" value={formatMoney(fundData.cost_basis_cny)} /></Col>
              <Col span={12}><Metric label="成本单价" value={fundData.cost_basis_cny && fundData.shares ? formatMoney(fundData.cost_basis_cny / fundData.shares, 4) : '--'} /></Col>
              <Col span={12}><Metric label="最新净值" value={navLatest?.unit_nav ? formatMoney(navLatest.unit_nav, 4) : '--'} /></Col>
              <Col span={12}>
                <Metric 
                  label="当日涨幅" 
                  value={formatPercent(fundData.day_change_pct)}
                  className={dayChangeClass}
                />
              </Col>
              <Col span={12}>
                <Metric 
                  label="估算净值" 
                  value={navLatest?.estimate_nav ? formatMoney(navLatest.estimate_nav, 4) : '--'}
                  className={navLatest?.estimate_nav && navLatest?.unit_nav ? (navLatest.estimate_nav > navLatest.unit_nav ? 'positive' : 'negative') : ''}
                />
              </Col>
              <Col span={12}><Metric label="持有天数" value={fundData.holding_days ? `${fundData.holding_days}天` : '--'} /></Col>
              <Col span={12}><Metric label="建仓日期" value={fundData.start_date ? formatDate(fundData.start_date) : '--'} /></Col>
            </Row>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '12px', fontWeight: 500 }}>交易状态</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Tag color="blue">总计 {txSummary.total_count}</Tag>
                {txSummary.pending_count > 0 && <Tag color="orange">待确认 {txSummary.pending_count}</Tag>}
                {txSummary.confirmed_count > 0 && <Tag color="green">已确认 {txSummary.confirmed_count}</Tag>}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>数据状态</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.8 }}>
                <div>确认状态: {fundData.confirm_state === 'confirmed' ? '✓ 已确认' : fundData.confirm_state === 'partial' ? '◐ 部分可用' : '○ 估算中'}</div>
                <div>数据时点: {fundData.as_of ? formatDateTime(fundData.as_of) : '--'}</div>
                {fundData.bucket && <div>分类: {fundData.bucket}</div>}
                {fundData.tags && fundData.tags.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    标签: {fundData.tags.map(tag => <Tag key={tag} size="small" style={{ marginRight: '4px' }}>{tag}</Tag>)}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* 最新净值 */}
          {navLatest && (
            <Card title="最新净值" style={{ marginTop: '16px' }} size="small">
              <Row>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>单位净值</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: navLatest.unit_nav ? '#52c41a' : 'inherit' }}>
                      {navLatest.unit_nav ? formatMoney(navLatest.unit_nav, 4) : '--'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {navLatest.trade_date}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>估算净值</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: navLatest.estimate_nav ? '#faad14' : 'inherit' }}>
                      {navLatest.estimate_nav ? formatMoney(navLatest.estimate_nav, 4) : '--'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {navLatest.asof ? formatDateTime(navLatest.asof) : '--'}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
