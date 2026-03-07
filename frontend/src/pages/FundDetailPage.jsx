import { useEffect, useMemo, useState } from 'react'
import { Button, Spin, Card, Row, Col, Tag, Table } from 'antd'
import { ArrowLeftOutlined, LineChartOutlined, HistoryOutlined, WalletOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import { MultiLineChart } from '../components/MultiLineChart.jsx'
import { fetchFundDetailPageData } from '../api.js'
import { classBySign, formatMoney, formatPercent, formatSignedMoney, formatDateTime, formatDate } from '../utils/format.js'

function CompactMetric({ label, value, prefix = '', suffix = '', className = '' }) {
  return (
    <div className="fund-detail-compact-metric">
      <div className="fund-detail-compact-metric__label">{label}</div>
      <div className={`fund-detail-compact-metric__value ${className}`.trim()}>
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
        const detail = await fetchFundDetailPageData(fundId, { historyLimit: 90, transactionLimit: 20 })

        if (!active) return

        setFundData(detail.fund)
        setNavLatest(detail.latest)
        setNavHistory(detail.history)
        setTxList(detail.transactions)
        setTxSummary(detail.transactionSummary)
        setLoading(false)
        setTxLoading(false)
      } catch (err) {
        if (!active) return
        setError(err?.message || '加载基金详情失败')
        setLoading(false)
        setTxLoading(false)
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
        <Spin size="large" description="加载基金详情..." />
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
  const holdingProfitPrefix = (fundData.holding_profit_cny || 0) > 0 ? '+' : (fundData.holding_profit_cny || 0) < 0 ? '-' : ''
  const marketLabel = fundData.market_group === 'us_overseas' ? '美股/海外' : 'A股/港股'
  const confirmStateLabel = fundData.confirm_state === 'confirmed'
    ? '已确认'
    : fundData.confirm_state === 'partial'
      ? '部分可用'
      : '估算中'
  const confirmStateColor = fundData.confirm_state === 'confirmed'
    ? 'green'
    : fundData.confirm_state === 'partial'
      ? 'orange'
      : 'default'
  const overviewCards = [
    {
      key: 'marketValue',
      eyebrow: '当前市值',
      value: `¥${formatMoney(fundData.market_value_cny || 0)}`,
      description: fundData.as_of ? `数据时点 ${formatDateTime(fundData.as_of)}` : '等待最新估值同步',
      tone: 'primary'
    },
    {
      key: 'holdingProfit',
      eyebrow: '持有收益',
      value: `${holdingProfitPrefix}¥${formatMoney(Math.abs(fundData.holding_profit_cny || 0))}`,
      description: `持有收益率 ${formatPercent((fundData.holding_profit_rate || 0) * 100)}`,
      tone: holdingChangeClass === 'is-up' ? 'positive' : holdingChangeClass === 'is-down' ? 'negative' : 'neutral'
    },
    {
      key: 'dayChange',
      eyebrow: '当日涨跌',
      value: formatPercent(fundData.day_change_pct || 0),
      description: navLatest?.trade_date ? `最近净值日 ${formatDate(navLatest.trade_date)}` : '暂无最新净值日',
      tone: dayChangeClass === 'is-up' ? 'positive' : dayChangeClass === 'is-down' ? 'negative' : 'neutral',
      icon: TrendIcon
    }
  ]

  return (
    <div className="panel fund-detail-page">
      <header className="fund-detail-hero">
        <div className="fund-detail-hero__topline">
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回</Button>
          <span className="fund-detail-hero__eyebrow">基金详情</span>
        </div>
        <div className="fund-detail-hero__main">
          <div className="fund-detail-hero__copy">
            <div className="fund-detail-hero__title-row">
              <h2>{fundData.name}</h2>
              <span className="fund-detail-hero__code">{fundData.fund_id}</span>
            </div>
            <p>从净值走势、持仓收益、数据状态和最近交易记录统一查看单只基金的执行上下文。</p>
          </div>
          <div className="fund-detail-hero__meta">
            <Tag color={fundData.market_group === 'us_overseas' ? 'blue' : 'green'}>{marketLabel}</Tag>
            <Tag color={confirmStateColor}>{confirmStateLabel}</Tag>
          </div>
        </div>
      </header>

      <section className="fund-detail-overview" aria-label="基金详情概览">
        {overviewCards.map((card) => {
          const Icon = card.icon
          return (
            <article
              key={card.key}
              className={`fund-detail-overview-card fund-detail-overview-card--${card.tone}`}
            >
              <span className="fund-detail-overview-card__eyebrow">{card.eyebrow}</span>
              <strong>{card.value}</strong>
              <p>{card.description}</p>
              {Icon ? (
                <span className="fund-detail-overview-card__icon">
                  <Icon aria-hidden="true" />
                </span>
              ) : null}
            </article>
          )
        })}
      </section>

      <Row gutter={[16, 16]} className="fund-detail-layout">
        {/* 左侧：图表 */}
        <Col xs={24} lg={14}>
          <Card
            className="fund-detail-card"
            size="small"
            title={(
              <span className="fund-detail-card__title">
                <LineChartOutlined aria-hidden="true" /> 净值走势
              </span>
            )}
            extra={
              <div className="fund-detail-range">
                {rangeOptions.map(item => (
                  <Button
                    key={item.key}
                    type={range === item.key ? 'primary' : 'text'}
                    size="small"
                    onClick={() => setRange(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            }
          >
            <div className="fund-detail-chart">
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
                <div className="chart-empty fund-detail-empty">
                  暂无图表数据
                </div>
              )}
            </div>
          </Card>

          {/* 交易记录 */}
          <Card
            className="fund-detail-card fund-detail-card--spaced"
            size="small"
            title={(
              <span className="fund-detail-card__title">
                <HistoryOutlined aria-hidden="true" /> 交易记录 ({txSummary.total_count})
              </span>
            )}
          >
            {txLoading ? (
              <div className="fund-detail-loading">
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
          <Card
            className="fund-detail-card"
            size="small"
            title={(
              <span className="fund-detail-card__title">
                <WalletOutlined aria-hidden="true" /> 持仓详情
              </span>
            )}
          >
            <Row gutter={[16, 16]} className="fund-detail-metric-grid">
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
                  className={navLatest?.estimate_nav && navLatest?.unit_nav ? classBySign(navLatest.estimate_nav - navLatest.unit_nav) : ''}
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

            <div className="fund-detail-status">
              <div className="fund-detail-status__label">数据状态</div>
              <div className="fund-detail-status__content">
                <Tag color={confirmStateColor} size="small">
                  {confirmStateLabel}
                </Tag>
                <span className="fund-detail-status__time">
                  {fundData.as_of ? formatDateTime(fundData.as_of) : '--'}
                </span>
              </div>
            </div>
          </Card>

          {/* 最新净值 */}
          {navLatest && (
            <Card className="fund-detail-card fund-detail-card--spaced" size="small">
              <Row className="fund-detail-latest">
                <Col span={12} className="fund-detail-latest__col fund-detail-latest__col--divider">
                  <div className="fund-detail-latest__label">单位净值</div>
                  <div className="fund-detail-latest__value fund-detail-latest__value--confirmed">
                    {navLatest.unit_nav ? formatMoney(navLatest.unit_nav, 4) : '--'}
                  </div>
                  <div className="fund-detail-latest__time">{navLatest.trade_date}</div>
                </Col>
                <Col span={12} className="fund-detail-latest__col">
                  <div className="fund-detail-latest__label">估算净值</div>
                  <div className="fund-detail-latest__value fund-detail-latest__value--estimate">
                    {navLatest.estimate_nav ? formatMoney(navLatest.estimate_nav, 4) : '--'}
                  </div>
                  <div className="fund-detail-latest__time">{navLatest.asof ? formatDateTime(navLatest.asof) : '--'}</div>
                </Col>
              </Row>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
