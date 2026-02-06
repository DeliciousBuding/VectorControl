import { useMemo, useState } from 'react'
import { MultiLineChart } from './MultiLineChart.jsx'
import { RANGE_OPTIONS, buildFundSeries, buildPortfolioSeries } from '../utils/chart.js'
import { classBySign, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

function Metric({ label, main, sub, mainClass = '', subClass = '' }) {
  return (
    <article className="metric-item">
      <h4>{label}</h4>
      <div className={`metric-main ${mainClass}`}>{main}</div>
      {sub !== undefined && <div className={`metric-sub ${subClass}`}>{sub}</div>}
    </article>
  )
}

function pickColor(value, up = '#dc2626', down = '#0f766e') {
  return Number(value) >= 0 ? up : down
}

function lastValue(data, key) {
  if (!Array.isArray(data) || data.length === 0) return 0
  const target = Number(data[data.length - 1]?.[key])
  return Number.isFinite(target) ? target : 0
}

export function FundDetailPanel({ fund, rows, dateLabel }) {
  const [range, setRange] = useState('1m')
  const rangeOptions = useMemo(() => RANGE_OPTIONS.filter((item) => item.key !== 'day'), [])

  const daySeries = useMemo(() => (fund ? buildFundSeries(fund, 'day') : []), [fund])
  const trendSeries = useMemo(() => (fund ? buildFundSeries(fund, range) : []), [fund, range])
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
  const confirmText = fund.confirm_state === 'confirmed' ? '已更新' : fund.confirm_state === 'partial' ? '数据不完整' : '估算中'
  const totalMarket = rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0)
  const holdingWeight = totalMarket > 0 ? (fund.market_value_cny / totalMarket) * 100 : 0
  const portfolioFirst = Number(portfolioSeries[0]?.value || 0)
  const portfolioLast = Number(portfolioSeries[portfolioSeries.length - 1]?.value || 0)
  const portfolioMove = portfolioLast - portfolioFirst

  return (
    <section className="panel detail-panel">
      <div className="detail-head">
        <div>
          <h3>{fund.name}</h3>
          <p>{fund.fund_id} · 数据日期：{dateLabel} · 确认状态：{confirmText}</p>
          <p>基金时点：{fund.as_of || '--'} · 拉取时间：{fund.updated_at || '--'}</p>
        </div>
        <div className="range-tabs">
          {rangeOptions.map((item) => (
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
        <Metric label="持仓占比" main={formatPercent(holdingWeight)} />
        <Metric label="持有收益" main={formatSignedMoney(fund.holding_profit_cny)} mainClass={classBySign(fund.holding_profit_cny)} />
        <Metric label="持有收益率" main={formatPercent(fund.holding_profit_rate)} mainClass={classBySign(fund.holding_profit_rate)} />
        <Metric label="持仓成本" main={formatMoney(fund.cost_basis_cny)} />
        <Metric label="当日收益" main={formatSignedMoney(fund.day_profit_cny)} mainClass={classBySign(fund.day_profit_cny)} />
        <Metric label="昨日收益" main={formatSignedMoney(fund.yesterday_profit_cny)} mainClass={classBySign(fund.yesterday_profit_cny)} />
        <Metric
          label="持有天数"
          main={fund.holding_days === '--' ? '--' : `${fund.holding_days}天`}
          sub={fund.start_date ? `起始日期：${String(fund.start_date).slice(0, 10)}` : '起始日期：--'}
        />
      </div>

      <div className="chart-panel">
        <h4>当日波形（0% 为基准虚线，与列表小波形同口径）</h4>
        <MultiLineChart
          data={daySeries}
          lines={[
            { key: 'fund', color: pickColor(lastValue(daySeries, 'fund'), '#dc2626', '#0f766e'), width: 2.4 },
            { key: 'zero', color: '#64748b', width: 1.2 }
          ]}
          dashedKeys={['zero']}
          yLabel="当日收益率曲线"
        />
      </div>

      <div className="chart-panel">
        <h4>业绩走势（本基金 / {benchmarkName} / 我的收益 / 成本线）</h4>
        <MultiLineChart
          data={trendSeries}
          lines={[
            { key: 'fund', color: pickColor(lastValue(trendSeries, 'fund'), '#dc2626', '#0f766e'), width: 2.2 },
            { key: 'benchmark', color: pickColor(lastValue(trendSeries, 'benchmark'), '#ef4444', '#14b8a6'), width: 2 },
            { key: 'userProfit', color: pickColor(lastValue(trendSeries, 'userProfit'), '#b91c1c', '#0d9488'), width: 2 },
            { key: 'costLine', color: '#64748b', width: 1.2 }
          ]}
          dashedKeys={['costLine']}
          yLabel="收益率曲线"
        />
      </div>

      <div className="chart-panel">
        <h4>组合持仓波形（成本线虚线）</h4>
        <MultiLineChart
          data={portfolioSeries}
          lines={[
            { key: 'value', color: pickColor(portfolioMove, '#dc2626', '#0f766e'), width: 2.4 },
            { key: 'cost', color: '#64748b', width: 1.2 }
          ]}
          dashedKeys={['cost']}
          yLabel="组合持仓曲线"
        />
      </div>
    </section>
  )
}
