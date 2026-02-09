import { useEffect, useMemo, useState } from 'react'
import { fetchBenchmarkComparison, fetchBenchmarks } from '../api.js'
import { classBySign, formatPercent } from '../utils/format.js'
import { DataStatusBanner } from './DataStatusBanner.jsx'

function asPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toOptionalNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeBenchmarks(benchmarks) {
  const source = asPlainObject(benchmarks)
  return Object.entries(source).map(([benchmarkId, info]) => {
    const payload = asPlainObject(info)
    return {
      id: String(benchmarkId || '').trim(),
      name: String(payload.name || benchmarkId || '').trim() || '--',
      code: String(payload.code || '').trim(),
      description: String(payload.description || '').trim()
    }
  })
}

function buildRows({ benchmarks, comparison, portfolioReturn, dataStatus }) {
  const list = normalizeBenchmarks(benchmarks)
  const comparisonMap = asPlainObject(comparison)
  const status = String(dataStatus?.status || 'estimating').toLowerCase()
  const statusConfirmed = status === 'confirmed'

  return list.map((benchmark) => {
    const result = asPlainObject(comparisonMap[benchmark.id])
    const benchmarkKnownByFlag = typeof result.benchmark_known === 'boolean' ? result.benchmark_known : null
    const benchmarkReturn = toOptionalNumber(result.benchmark_return)
    const benchmarkKnown = benchmarkKnownByFlag !== null ? benchmarkKnownByFlag : benchmarkReturn !== null
    const canJudge = benchmarkKnown && statusConfirmed
    const excessReturn = canJudge ? toOptionalNumber(result.excess_return) : null
    const outperform = canJudge && typeof result.outperform === 'boolean' ? result.outperform : null

    let judgementLabel = 'unknown'
    let judgementClass = 'status-info'
    if (canJudge && outperform === true) {
      judgementLabel = '跑赢'
      judgementClass = 'status-success'
    } else if (canJudge && outperform === false) {
      judgementLabel = '跑输'
      judgementClass = 'status-warning'
    }

    return {
      ...benchmark,
      portfolioReturn: toNumber(result.portfolio_return, portfolioReturn),
      benchmarkReturn,
      excessReturn,
      canJudge,
      judgementLabel,
      judgementClass
    }
  })
}

export function BenchmarkComparisonPanel({ user, lastRefresh }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [benchmarks, setBenchmarks] = useState({})
  const [comparison, setComparison] = useState({})
  const [portfolioReturn, setPortfolioReturn] = useState(0)
  const [dataStatus, setDataStatus] = useState({
    status: 'estimating',
    asof: '',
    note: '暂无基准对比数据'
  })

  useEffect(() => {
    if (!user) return

    let alive = true
    setLoading(true)
    setError('')

    Promise.all([fetchBenchmarks(), fetchBenchmarkComparison()])
      .then(([listPayload, comparisonPayload]) => {
        if (!alive) return
        const listBenchmarks = asPlainObject(listPayload?.benchmarks)
        const comparisonBenchmarks = asPlainObject(comparisonPayload?.benchmarks)
        setBenchmarks({
          ...listBenchmarks,
          ...comparisonBenchmarks
        })
        setComparison(asPlainObject(comparisonPayload?.comparison))
        setPortfolioReturn(toNumber(comparisonPayload?.portfolio_return, 0))
        setDataStatus({
          status: String(comparisonPayload?.data_status?.status || 'estimating').toLowerCase(),
          asof: String(comparisonPayload?.data_status?.asof || '').trim(),
          note: String(comparisonPayload?.data_status?.note || '暂无基准对比口径说明').trim()
        })
      })
      .catch((err) => {
        if (!alive) return
        setError(String(err?.message || '基准对比加载失败'))
        setBenchmarks({})
        setComparison({})
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [user, lastRefresh])

  const rows = useMemo(
    () =>
      buildRows({
        benchmarks,
        comparison,
        portfolioReturn,
        dataStatus
      }),
    [benchmarks, comparison, portfolioReturn, dataStatus]
  )

  return (
    <section className="panel home-main" data-testid="benchmark-comparison-panel">
      <div className="section-head">
        <div>
          <h2>基准对比</h2>
          <span>只展示结果，unknown 时不做跑赢/跑输判断</span>
        </div>
      </div>

      <DataStatusBanner title="基准对比口径" dataStatus={dataStatus} />

      {loading && <div className="chart-empty">正在加载基准对比...</div>}
      {!loading && error && <div className="chart-empty">{error}</div>}
      {!loading && !error && rows.length === 0 && <div className="chart-empty">暂无可用基准</div>}

      {!loading && !error && rows.length > 0 && (
        <div className="benchmark-list" data-testid="benchmark-comparison-list">
          {rows.map((row) => (
            <article key={row.id} className="benchmark-item">
              <div className="benchmark-title">
                <div>
                  <h3>
                    {row.name}
                    <span className="benchmark-code">{row.code || row.id}</span>
                  </h3>
                  {row.description && <p>{row.description}</p>}
                </div>
                <span className={`status-pill ${row.judgementClass}`}>{row.judgementLabel}</span>
              </div>

              <div className="metric-grid benchmark-metrics">
                <article className="metric-item">
                  <h4>组合收益率</h4>
                  <strong className={`metric-main ${classBySign(row.portfolioReturn)}`}>
                    {formatPercent(row.portfolioReturn)}
                  </strong>
                </article>

                <article className="metric-item">
                  <h4>{row.name} 收益率</h4>
                  <strong className={`metric-main ${classBySign(row.benchmarkReturn)}`}>
                    {row.benchmarkReturn === null ? 'unknown' : formatPercent(row.benchmarkReturn)}
                  </strong>
                </article>

                <article className="metric-item">
                  <h4>超额收益</h4>
                  <strong className={`metric-main ${classBySign(row.excessReturn)}`}>
                    {row.excessReturn === null ? '--' : formatPercent(row.excessReturn)}
                  </strong>
                </article>
              </div>

              {!row.canJudge && <p className="chart-hint">基准数据未就绪，当前仅展示组合收益率。</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
