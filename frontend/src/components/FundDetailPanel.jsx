import { useMemo, useState } from 'react'
import { MultiLineChart } from './MultiLineChart.jsx'
import { RANGE_OPTIONS, buildFundSeries, buildPortfolioSeries } from '../utils/chart.js'
import { classBySign, formatDate, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

function Metric({ label, main, sub, mainClass = '', subClass = '' }) {
  return (
    <article className="metric-item">
      <h4>{label}</h4>
      <div className={`metric-main ${mainClass}`}>{main}</div>
      {sub !== undefined && <div className={`metric-sub ${subClass}`}>{sub}</div>}
    </article>
  )
}

export function FundDetailPanel({ fund, rows }) {
  const [range, setRange] = useState('day')
  const dateLabel = formatDate(new Date())

  const fundSeries = useMemo(() => (fund ? buildFundSeries(fund, range) : []), [fund, range])
  const portfolioSeries = useMemo(() => buildPortfolioSeries(rows, range), [rows, range])

  if (!fund) {
    return (
      <section className="panel detail-panel">
        <h3>基金详情</h3>
        <div className="chart-empty">请在持仓列表中选择一只基金</div>
      </section>
    )
  }

  const benchmarkName = fund.market_group === 'us_overseas' ? '纳指100' : '沪深300'

  return (
    <section className="panel detail-panel">
      <div className="detail-head">
        <div>
          <h3>{fund.name}</h3>
          <p>{fund.fund_id} · 数据口径日期：{dateLabel}</p>
        </div>
        <div className="range-tabs">
          {RANGE_OPTIONS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={range === item.key ? 'primary' : 'ghost'}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="当日涨幅" main={formatPercent(fund.estimate_pct)} mainClass={classBySign(fund.estimate_pct)} />
        <Metric label="持有金额" main={formatMoney(fund.market_value_cny)} />
        <Metric label="持有份额" main={formatMoney(fund.shares, 2)} />
        <Metric label="持仓占比" main={formatPercent((fund.market_value_cny / Math.max(1, rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0))) * 100)} />
        <Metric label={`持有收益 (${dateLabel})`} main={formatSignedMoney(fund.holding_profit_cny)} sub={formatPercent(fund.holding_profit_rate)} mainClass={classBySign(fund.holding_profit_cny)} subClass={classBySign(fund.holding_profit_rate)} />
        <Metric label="持仓成本" main={formatMoney(fund.cost_basis_cny)} />
        <Metric label={`当日收益 (${dateLabel})`} main={formatSignedMoney(fund.day_profit_cny)} mainClass={classBySign(fund.day_profit_cny)} />
        <Metric label="昨日收益" main={formatSignedMoney(fund.yesterday_profit_cny)} mainClass={classBySign(fund.yesterday_profit_cny)} />
        <Metric label="持有天数" main={fund.holding_days === '--' ? '--' : `${fund.holding_days}天`} />
      </div>

      <div className="chart-panel">
        <h4>当日波形图（中轴虚线=0%）</h4>
        <MultiLineChart
          data={fundSeries}
          lines={[
            { key: 'fund', color: '#2563eb', width: 2.4 },
            { key: 'zero', color: '#64748b', width: 1.2 }
          ]}
          dashedKeys={['zero']}
          yLabel="当日收益率"
        />
      </div>

      <div className="chart-panel">
        <h4>业绩走势（本基金 / {benchmarkName} / 我的收益 / 成本线）</h4>
        <MultiLineChart
          data={fundSeries}
          lines={[
            { key: 'fund', color: '#dc2626', width: 2.2 },
            { key: 'benchmark', color: '#2563eb', width: 2 },
            { key: 'userProfit', color: '#0f766e', width: 2 },
            { key: 'zero', color: '#64748b', width: 1.2 }
          ]}
          dashedKeys={['zero']}
          yLabel="收益率曲线"
        />
      </div>

      <div className="chart-panel">
        <h4>总持仓波形图（虚线=成本线）</h4>
        <MultiLineChart
          data={portfolioSeries}
          lines={[
            { key: 'value', color: '#2563eb', width: 2.4 },
            { key: 'cost', color: '#64748b', width: 1.2 }
          ]}
          dashedKeys={['cost']}
          yLabel="总持仓曲线"
        />
      </div>
    </section>
  )
}
