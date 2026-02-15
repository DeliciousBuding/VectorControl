import { useEffect, useMemo, useState } from 'react'
import { Button, Spin, Card, Row, Col, Tag, Table, Statistic } from 'antd'
import { ArrowLeftOutlined, LineChartOutlined, HistoryOutlined, WalletOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import { MultiLineChart } from '../components/MultiLineChart.jsx'
import { fetchFundFullDetail, fetchTransactions } from '../api.js'
import { classBySign, formatMoney, formatPercent, formatSignedMoney, formatDateTime, formatDate } from '../utils/format.js'

function CompactMetric({ label, value, prefix = '', suffix = '', className = '' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 600 }} className={className}>
        {prefix}{value}{suffix}
      </div>
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
  const [txLoading, setTxLoading] = useState(false)

  // 加载基金详情
  useEffect(() => {
    if (!fundId) return
    
    let active = true
    setLoading(true)
    setError('')
    
    ;(async () => {
      try {
        const fullRes = await fetchFundFullDetail(fundId, 90)
        
        if (!active) return
        
        const fund = fullRes?.fund || {}
        const holding = fullRes?.holding || {}
        const mergedFundData = {
          ...fund,
          ...holding,
          fund_id: fundId,
          name: fund.name || holding.name || fundId
        }
        
        setFundData(mergedFundData)
        setNavLatest(fullRes?.latest || null)
        setNavHistory(Array.isArray(fullRes?.history) ? fullRes.history : [])
        setLoading(false)
        
        // 异步加载交易记录
        setTxLoading(true)
        fetchTransactions({ fundId, status: 'all', limit: 20 })
          .then(txRes => {
            if (active) {
              setTxList(txRes?.items || [])
              setTxSummary(txRes?.summary || { total_count: 0, pending_count: 0, confirmed_count: 0 })
            }
          })
          .finally(() => {
            if (active) setTxLoading(false)
          })
      } catch (err) {
        if (!active) return
        setError(err?.message || '加载基金详情失败')
        setLoading(false)
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
      date: item.trade_date.slice(5),
      nav: item.unit_nav || item.estimate_nav || 0,
      estimate: item.estimate_nav || null,
      confirmState: item.confirm_state
    }))
  }, [navHistory, range])

  const handleBack = () => {
    if (onBack) onBack()
  }

  const txColumns = [
    { title: '日期', dataIndex: 'occurred_at', key: 'occurred_at', width: 100, render: v => v ? formatDate(v).slice(5) : '--' },
    { title: '类型', dataIndex: 'action', key: 'action', width: 60, render: v => ({ buy: '买', sell: '卖', sip: '定投', dividend: '分红' }[v] || v) },
    { title: '金额', dataIndex: 'amount_cny', key: 'amount_cny', width: 90, align: 'right', render: v => formatMoney(v) },
    { title: '份额', dataIndex: 'shares', key: 'shares', width: 80, align: 'right', render: v => v ? formatMoney(v, 1) : '--' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 70, render: v => (
      <Tag color={v === 'confirmed' ? 'green' : 'orange'} size="small">{v === 'confirmed' ? '已确认' : '待确认'}</Tag>
    )},
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
    { key: '1m', label: '1月' },
    { key: '3m', label: '3月' },
    { key: '6m', label: '6月' },
    { key: '1y', label: '1年' }
  ]

  const dayChangeClass = classBySign(fundData.day_change_pct || 0)
  const holdingChangeClass = classBySign(fundData.holding_profit_rate || 0)
  const TrendIcon = fundData.day_change_pct >= 0 ? RiseOutlined : FallOutlined

  return (
    <div className="panel fund-detail-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* 紧凑头部 */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={handleBack}>返回</Button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>{fundData.name}</span>
          <span style={{ color: 'var(--muted)', fontSize: '12px', marginLeft: '8px' }}>{fundData.fund_id}</span>
        </div>
        <Tag color={fundData.market_group === 'us_overseas' ? 'blue' : 'green'} size="small">
          {fundData.market_group === 'us_overseas' ? '美股/海外' : 'A股/港股'}
        </Tag>
      </div>

      {/* 核心数据卡片 - 紧凑布局 */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col xs={12} sm={6}>
            <Statistic 
              title="当前市值" 
              value={fundData.market_value_cny || 0} 
              precision={2} 
              prefix="¥"
              valueStyle={{ fontSize: '18px', color: '#1890ff' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic 
              title="持有收益" 
              value={fundData.holding_profit_cny || 0} 
              precision={2} 
              prefix={fundData.holding_profit_cny >= 0 ? '+' : ''}
              valueStyle={{ fontSize: '18px', color: fundData.holding_profit_cny >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic 
              title="持有收益率" 
              value={(fundData.holding_profit_rate || 0) * 100} 
              precision={2} 
              suffix="%"
              valueStyle={{ fontSize: '18px', color: fundData.holding_profit_rate >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendIcon style={{ fontSize: '20px', color: fundData.day_change_pct >= 0 ? '#52c41a' : '#ff4d4f' }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>当日涨跌</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: fundData.day_change_pct >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {fundData.day_change_pct >= 0 ? '+' : ''}{formatPercent(fundData.day_change_pct)}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 左右布局：左侧图表，右侧数据 */}
      <Row gutter={[16, 16]}>
        {/* 左侧：图表 */}
        <Col xs={24} lg={14}>
          <Card 
            size="small"
            title={<span style={{ fontSize: '13px' }}><LineChartOutlined /> 净值走势</span>}
            extra={
              <div style={{ display: 'flex', gap: '2px' }}>
                {rangeOptions.map(item => (
                  <Button
                    key={item.key}
                    type={range === item.key ? 'primary' : 'text'}
                    size="small"
                    onClick={() => setRange(item.key)}
                    style={{ padding: '0 8px', fontSize: '12px' }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            }
          >
            <div style={{ height: '220px' }}>
              {chartSeries.length > 0 ? (
                <MultiLineChart
                  data={chartSeries}
                  lines={[
                    { key: 'nav', color: '#4361ee', width: 1.5 },
                    { key: 'estimate', color: '#ffa94d', width: 1 }
                  ]}
                  xKey="date"
                  yLabel="净值"
                />
              ) : (
                <div className="chart-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  暂无图表数据
                </div>
              )}
            </div>
          </Card>

          {/* 交易记录 */}
          <Card 
            size="small" 
            title={<span style={{ fontSize: '13px' }}><HistoryOutlined /> 交易记录 ({txSummary.total_count})</span>}
            style={{ marginTop: '16px' }}
          >
            {txLoading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Table
                dataSource={txList}
                columns={txColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5, hideOnSinglePage: true, size: 'small' }}
                scroll={{ x: 'max-content' }}
              />
            )}
          </Card>
        </Col>

        {/* 右侧：详细数据 */}
        <Col xs={24} lg={10}>
          <Card size="small" title={<span style={{ fontSize: '13px' }}><WalletOutlined /> 持仓详情</span>}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <CompactMetric label="持有份额" value={Number(fundData.shares) ? formatMoney(fundData.shares, 2) : '--'} />
              </Col>
              <Col span={12}>
                <CompactMetric label="持仓成本" value={formatMoney(fundData.cost_basis_cny)} />
              </Col>
              <Col span={12}>
                <CompactMetric 
                  label="成本单价" 
                  value={fundData.cost_basis_cny && fundData.shares ? formatMoney(fundData.cost_basis_cny / fundData.shares, 4) : '--'} 
                />
              </Col>
              <Col span={12}>
                <CompactMetric label="最新净值" value={navLatest?.unit_nav ? formatMoney(navLatest.unit_nav, 4) : '--'} />
              </Col>
              <Col span={12}>
                <CompactMetric 
                  label="估算净值" 
                  value={navLatest?.estimate_nav ? formatMoney(navLatest.estimate_nav, 4) : '--'}
                  className={navLatest?.estimate_nav && navLatest?.unit_nav ? (navLatest.estimate_nav > navLatest.unit_nav ? 'positive' : 'negative') : ''}
                />
              </Col>
              <Col span={12}>
                <CompactMetric label="持有天数" value={fundData.holding_days ? `${fundData.holding_days}天` : '--'} />
              </Col>
              <Col span={12}>
                <CompactMetric label="建仓日期" value={fundData.start_date ? formatDate(fundData.start_date) : '--'} />
              </Col>
              <Col span={12}>
                <CompactMetric label="当日收益" value={formatSignedMoney(fundData.day_profit_cny)} className={dayChangeClass} />
              </Col>
            </Row>

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>数据状态</div>
              <div style={{ fontSize: '12px' }}>
                <Tag color={fundData.confirm_state === 'confirmed' ? 'green' : fundData.confirm_state === 'partial' ? 'orange' : 'default'} size="small">
                  {fundData.confirm_state === 'confirmed' ? '已确认' : fundData.confirm_state === 'partial' ? '部分可用' : '估算中'}
                </Tag>
                <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>
                  {fundData.as_of ? formatDateTime(fundData.as_of) : '--'}
                </span>
              </div>
            </div>
          </Card>

          {/* 最新净值 */}
          {navLatest && (
            <Card size="small" style={{ marginTop: '16px' }}>
              <Row>
                <Col span={12} style={{ textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>单位净值</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#52c41a' }}>
                    {navLatest.unit_nav ? formatMoney(navLatest.unit_nav, 4) : '--'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{navLatest.trade_date}</div>
                </Col>
                <Col span={12} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>估算净值</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#faad14' }}>
                    {navLatest.estimate_nav ? formatMoney(navLatest.estimate_nav, 4) : '--'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{navLatest.asof ? formatDateTime(navLatest.asof) : '--'}</div>
                </Col>
              </Row>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
