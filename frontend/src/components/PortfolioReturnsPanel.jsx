import { useEffect, useMemo, useState } from 'react'
import { fetchPortfolioReturnsHistory } from '../api.js'
import { classBySign, formatPercent, formatSignedMoney } from '../utils/format.js'
import { MultiLineChart } from './MultiLineChart.jsx'

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function shortDateLabel(yyyyMmDd) {
  const text = String(yyyyMmDd || '').trim()
  if (text.length >= 10 && text.includes('-')) return text.slice(5, 10)
  return text || '--'
}

export function PortfolioReturnsPanel({ user, lastRefresh }) {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!user) return

    let alive = true
    setLoading(true)
    setError('')

    fetchPortfolioReturnsHistory(days)
      .then((payload) => {
        if (!alive) return
        const data = Array.isArray(payload?.data) ? payload.data : []
        const normalized = data
          .map((row) => ({
            date: String(row?.date || '').trim(),
            asof: String(row?.asof || '').trim(),
            total_return: toNumber(row?.total_return, 0),
            day_profit: toNumber(row?.day_profit, 0)
          }))
          .filter((row) => Boolean(row.date))
        setHistory(normalized)
      })
      .catch((err) => {
        if (!alive) return
        setError(String(err?.message || '收益曲线加载失败'))
        setHistory([])
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [user, lastRefresh, days])

  const chartData = useMemo(() => {
    return history.map((row) => ({
      label: shortDateLabel(row.date),
      total_return: row.total_return
    }))
  }, [history])

  const latestTotalReturn = history.length ? history[history.length - 1].total_return : 0
  const recent7 = useMemo(() => history.slice(-7).reverse(), [history])

  const daysOptions = [7, 30, 90]

  return (
    <section className="panel home-main" data-testid="portfolio-returns-panel">
      <div className="section-head">
        <div>
          <h2>组合收益曲线</h2>
          <span>最近 {days} 天（按估值快照）</span>
        </div>
        <div className="plan-actions">
          {daysOptions.map((item) => (
            <button
              key={item}
              type="button"
              className={days === item ? 'primary' : 'ghost'}
              onClick={() => setDays(item)}
              data-testid={`portfolio-returns-days-${item}`}
            >
              {item}天
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="chart-empty">正在加载收益曲线...</div>}
      {!loading && error && <div className="chart-empty">{error}</div>}
      {!loading && !error && history.length < 2 && (
        <div className="chart-empty">暂无可用历史数据（请先进行几次刷新）。</div>
      )}

      {!loading && !error && history.length >= 2 && (
        <>
          <div className="chart-panel">
            <div className="chart-head">
              <h4>累计收益率</h4>
              <strong className={classBySign(latestTotalReturn)}>{formatPercent(latestTotalReturn)}</strong>
            </div>
            <p className="chart-hint">曲线最后一点为当前累计收益率（%）。</p>
            <MultiLineChart
              data={chartData}
              lines={[{ key: 'total_return', color: 'var(--color-accent)', width: 2.4 }]}
              yLabel="累计收益率(%)"
            />
          </div>

          <div className="chart-panel">
            <div className="chart-head">
              <h4>最近 7 天日收益</h4>
              <span className="chart-hint">单位：CNY</span>
            </div>
            {recent7.length === 0 ? (
              <div className="chart-empty">暂无日收益数据。</div>
            ) : (
              <div className="watch-list" data-testid="portfolio-returns-day-profit-list">
                {recent7.map((row) => (
                  <article key={`day-profit-${row.date}`} className="watch-item">
                    <div>
                      <h3>{shortDateLabel(row.date)}</h3>
                      <p>{row.date}</p>
                    </div>
                    <div className="plan-actions">
                      <span className={`watch-profit ${classBySign(row.day_profit)}`}>
                        {formatSignedMoney(row.day_profit, 2)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
