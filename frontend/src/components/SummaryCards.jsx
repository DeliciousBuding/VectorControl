import { classBySign, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

export function SummaryCards({ rows = [] }) {
  const totalMarket = rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0)
  const totalCost = rows.reduce((sum, item) => sum + Number(item.cost_basis_cny || 0), 0)
  const totalHolding = rows.reduce((sum, item) => sum + Number(item.holding_profit_cny || 0), 0)
  const totalDay = rows.reduce((sum, item) => sum + Number(item.day_profit_cny || 0), 0)
  const holdingRate = totalCost > 0 ? (totalHolding / totalCost) * 100 : 0

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
}
