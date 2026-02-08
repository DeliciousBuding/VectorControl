import { memo, useMemo, useState } from 'react'
import { MultiLineChart } from './MultiLineChart.jsx'
import { RANGE_OPTIONS, buildFundSeries, buildPortfolioSeries } from '../utils/chart.js'
import { classBySign, formatDateTime, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

function Metric({ label, main, sub, mainClass = '', subClass = '' }) {
  return (
    <article className="metric-item">
      <h4>{label}</h4>
      <div className={`metric-main ${mainClass}`}>{main}</div>
      {sub !== undefined && <div className={`metric-sub ${subClass}`}>{sub}</div>}
    </article>
  )
}

function pickColor(value, up = 'var(--chart-up)', down = 'var(--chart-down)') {
  return Number(value) >= 0 ? up : down
}

function lastValue(data, key) {
  if (!Array.isArray(data) || data.length === 0) return 0
  const target = Number(data[data.length - 1]?.[key])
  return Number.isFinite(target) ? target : 0
}

function statusLabel(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'confirmed') return '已确认'
  if (key === 'partial') return '部分可用'
  return '估算中'
}

function statusNote(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'confirmed') return '图表按确认口径计算，可直接用于复盘。'
  if (key === 'partial') return '图表含缺口或混合口径，请结合交易状态核对。'
  return '图表含估算值，收盘后可能回补。'
}

export const FundDetailPanel = memo(function FundDetailPanel({ fund, rows, dateLabel, chartDataStatus }) {
  const [range, setRange] = useState('1m')
  const [showExtendedLines, setShowExtendedLines] = useState(false)
  const rangeOptions = useMemo(() => RANGE_OPTIONS.filter((item) => item.key !== 'day'), [])

  const daySeries = useMemo(() => (fund ? buildFundSeries(fund, 'day') : []), [fund])
  const trendSeries = useMemo(() => (fund ? buildFundSeries(fund, range) : []), [fund, range])
  const portfolioSeries = useMemo(() => buildPortfolioSeries(rows, range), [rows, range])
  const navSeries = useMemo(() => {
    if (!fund || !Array.isArray(trendSeries) || trendSeries.length === 0) return []

    const latestNav = Number(fund?.latest_nav || 0)
    const shares = Number(fund?.shares || 0)
    const costBasis = Number(fund?.cost_basis_cny || 0)
    const costNav = shares > 0 ? costBasis / shares : 0
    const lastPct = Number(trendSeries[trendSeries.length - 1]?.fund || 0)
    const denominator = 1 + lastPct / 100
    let navBase = latestNav > 0 && Math.abs(denominator) > 1e-9 ? latestNav / denominator : 0
    if (!Number.isFinite(navBase) || navBase <= 0) {
      navBase = latestNav > 0 ? latestNav : costNav > 0 ? costNav : 1
    }
    const stableCostNav = costNav > 0 ? costNav : navBase

    return trendSeries.map((item) => {
      const pct = Number(item?.fund || 0)
      const nav = navBase * (1 + pct / 100)
      return {
        label: item.label,
        nav: Number(nav.toFixed(4)),
        costNav: Number(stableCostNav.toFixed(4))
      }
    })
  }, [fund, trendSeries])

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
  const chartStatus = String(chartDataStatus?.status || fund.confirm_state || 'estimating').toLowerCase()
  const chartAsof = String(chartDataStatus?.asof || fund.as_of || '').trim()
  const chartNote = String(chartDataStatus?.note || '').trim()
  const chartStatusLine = `当前口径：${statusLabel(chartStatus)} ｜ 时点：${chartAsof ? formatDateTime(chartAsof) : '--'} ｜ ${chartNote || statusNote(chartStatus)}`

  const trendLines = [
    { key: 'fund', color: pickColor(lastValue(trendSeries, 'fund')), width: 2.2 },
    { key: 'zero', color: 'var(--chart-neutral)', width: 1.2 }
  ]
  if (showExtendedLines) {
    trendLines.splice(1, 0, {
      key: 'benchmark',
      color: pickColor(lastValue(trendSeries, 'benchmark'), 'var(--chart-benchmark-up)', 'var(--chart-benchmark-down)'),
      width: 2
    })
    trendLines.splice(2, 0, {
      key: 'userProfit',
      color: pickColor(lastValue(trendSeries, 'userProfit'), 'var(--chart-user-up)', 'var(--chart-user-down)'),
      width: 2
    })
  }

  return (
    <section className="panel detail-panel">
      <div className="detail-head">
        <div>
          <h3>{fund.name}</h3>
          <p>
            {fund.fund_id} | 数据日期：{dateLabel} | 确认状态：{confirmText}
          </p>
          <p>
            基金时点：{fund.as_of || '--'} | 拉取时间：{fund.updated_at || '--'}
          </p>
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
          sub={fund.start_date ? `起始日期：${String(fund.start_date).slice(0, 10)}` : '起始日期：-'}
        />
      </div>

      <div className="chart-panel">
        <h4>当日波形（0% 为基准虚线，与列表小波形同口径）</h4>
        <p className="chart-hint">{chartStatusLine}</p>
        <MultiLineChart
          data={daySeries}
          lines={[
            { key: 'fund', color: pickColor(lastValue(daySeries, 'fund')), width: 2.4 },
            { key: 'zero', color: 'var(--chart-neutral)', width: 1.2 }
          ]}
          dashedKeys={['zero']}
          yLabel="当日收益率曲线"
        />
      </div>

      <div className="chart-panel">
        <div className="chart-head">
          <h4>业绩走势（默认含 0% 基准虚线）</h4>
          <button type="button" className={showExtendedLines ? 'primary' : 'ghost'} onClick={() => setShowExtendedLines((prev) => !prev)}>
            {showExtendedLines ? '隐藏扩展线组' : '显示扩展线组'}
          </button>
        </div>
        <p className="chart-hint">
          {showExtendedLines ? `已启用扩展：基金线 + 0% 基准线 + ${benchmarkName} + 我的收益` : '默认线组：基金线 + 0% 基准虚线'}
        </p>
        <p className="chart-hint">{chartStatusLine}</p>
        <MultiLineChart data={trendSeries} lines={trendLines} dashedKeys={['zero']} yLabel="收益率曲线" />
      </div>

      <div className="chart-panel">
        <h4>净值参考图（成本线虚线）</h4>
        <p className="chart-hint">口径：基金估值轨迹与持仓成本单价对照，辅助止盈/解套判断。</p>
        <p className="chart-hint">{chartStatusLine}</p>
        <MultiLineChart
          data={navSeries}
          lines={[
            { key: 'nav', color: pickColor(lastValue(navSeries, 'nav')), width: 2.4 },
            { key: 'costNav', color: 'var(--chart-neutral)', width: 1.2 }
          ]}
          dashedKeys={['costNav']}
          yLabel="净值参考曲线"
        />
      </div>

      <div className="chart-panel">
        <h4>组合持仓波形（成本线虚线）</h4>
        <p className="chart-hint">{chartStatusLine}</p>
        <MultiLineChart
          data={portfolioSeries}
          lines={[
            { key: 'value', color: pickColor(portfolioMove), width: 2.4 },
            { key: 'cost', color: 'var(--chart-neutral)', width: 1.2 }
          ]}
          dashedKeys={['cost']}
          yLabel="组合持仓曲线"
        />
      </div>
    </section>
  )
})
