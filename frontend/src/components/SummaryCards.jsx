import { memo, useMemo } from 'react'
import { classBySign, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

export const SummaryCards = memo(function SummaryCards({ rows = [], loading = false }) {
  if (loading && rows.length === 0) {
    return (
      <section className="summary-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={`skeleton-${index}`} className="panel summary-card summary-skeleton">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-main" />
            <div className="skeleton-line skeleton-sub" />
          </article>
        ))}
      </section>
    )
  }

  const { totalMarket, totalCost, totalHolding, totalDay, holdingRate } = useMemo(() => {
    const nextTotalMarket = rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0)
    const nextTotalCost = rows.reduce((sum, item) => sum + Number(item.cost_basis_cny || 0), 0)
    const nextTotalHolding = rows.reduce((sum, item) => sum + Number(item.holding_profit_cny || 0), 0)
    const nextTotalDay = rows.reduce((sum, item) => sum + Number(item.day_profit_cny || 0), 0)
    const nextHoldingRate = nextTotalCost > 0 ? (nextTotalHolding / nextTotalCost) * 100 : 0
    return {
      totalMarket: nextTotalMarket,
      totalCost: nextTotalCost,
      totalHolding: nextTotalHolding,
      totalDay: nextTotalDay,
      holdingRate: nextHoldingRate
    }
  }, [rows])

  return (
    <section className="summary-grid">
      <article className="panel summary-card">
        <h3>总持仓市值</h3>
        <strong>{formatMoney(totalMarket)}</strong>
      </article>
      <article className="panel summary-card">
        <h3>当日收益</h3>
        <strong className={classBySign(totalDay)}>{formatSignedMoney(totalDay)}</strong>
      </article>
      <article className="panel summary-card">
        <h3>持有收益</h3>
        <strong className={classBySign(totalHolding)}>{formatSignedMoney(totalHolding)}</strong>
        <span className={classBySign(holdingRate)}>{formatPercent(holdingRate)}</span>
      </article>
      <article className="panel summary-card">
        <h3>持仓数量</h3>
        <strong>{rows.length} 只</strong>
      </article>
    </section>
  )
})
