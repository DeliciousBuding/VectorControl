import { useMemo, useState } from 'react'
import { SortToggle } from './SortToggle.jsx'
import { SparklineMini } from './SparklineMini.jsx'
import { classBySign, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

function DualValue({ top, bottom, topClass = '', bottomClass = '' }) {
  return (
    <div className="dual-value">
      <div className={`main ${topClass}`}>{top}</div>
      <div className={`sub ${bottomClass}`}>{bottom}</div>
    </div>
  )
}

export function HoldingsTable({
  title,
  rows,
  dateLabel,
  sortState,
  onSort,
  selectedFundId,
  onSelectFund,
  sparklineMap,
  onSaveHolding
}) {
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState({})
  const totalMarket = useMemo(() => rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0), [rows])
  const dateSuffix = dateLabel && dateLabel !== '--' ? `(${dateLabel})` : ''

  const beginEdit = (row) => {
    setEditingId(row.fund_id)
    setDraft({
      market_value_cny: row.market_value_cny,
      shares: row.shares,
      cost_basis_cny: row.cost_basis_cny,
      start_date: row.start_date ? String(row.start_date).slice(0, 10) : ''
    })
  }

  const cancelEdit = () => {
    setEditingId('')
    setDraft({})
  }

  const submitEdit = async (fundId) => {
    const ok = await onSaveHolding(fundId, {
      market_value_cny: Number(draft.market_value_cny),
      shares: Number(draft.shares),
      cost_basis_cny: Number(draft.cost_basis_cny),
      start_date: draft.start_date
    })
    if (ok) {
      cancelEdit()
    }
  }

  const sortCell = (label, key) => {
    const active = sortState.key === key
    return (
      <button type="button" className={`th-button ${active ? 'is-active' : ''}`} onClick={() => onSort(key)}>
        <span>{label}</span>
        <SortToggle active={active} order={active ? sortState.order : ''} />
      </button>
    )
  }

  return (
    <section className="holdings-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span>{rows.length} 只基金</span>
      </div>
      <div className="table-wrap">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>{sortCell('基金', 'name')}</th>
              <th>走势</th>
              <th className="align-right">{sortCell('持有金额', 'market_value_cny')}</th>
              <th className="align-right">持有份额</th>
              <th className="align-right">持仓占比</th>
              <th className="align-right">{sortCell(`持有收益${dateSuffix}`, 'holding_profit_cny')}</th>
              <th className="align-right">持仓成本</th>
              <th className="align-right">{sortCell(`当日收益${dateSuffix}`, 'day_profit_cny')}</th>
              <th className="align-right">昨日收益</th>
              <th className="align-right">最新净值</th>
              <th className="align-right">{sortCell('持有天数', 'holding_days')}</th>
              <th className="align-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="empty-row" colSpan={12}>暂无持仓数据</td>
              </tr>
            )}
            {rows.map((row) => {
              const selected = selectedFundId === row.fund_id
              const isEditing = editingId === row.fund_id
              const weight = totalMarket > 0 ? (row.market_value_cny / totalMarket) * 100 : 0
              const startDateText = row.start_date ? String(row.start_date).slice(0, 10) : '--'
              return (
                <tr key={row.fund_id} className={selected ? 'row-selected' : ''} onClick={() => onSelectFund(row.fund_id)}>
                  <td>
                    <div className="fund-name">{row.name}</div>
                    <div className="fund-sub">
                      <span className="fund-code">{row.fund_id}</span>
                      <span className={`badge ${row.status === 'ok' ? 'badge-wait' : 'badge-error'}`}>
                        {row.status === 'ok' ? '估算中' : '异常'}
                      </span>
                      <span>{formatMoney(row.market_value_cny)}</span>
                    </div>
                  </td>
                  <td>
                    <SparklineMini points={sparklineMap[row.fund_id] || []} />
                  </td>
                  <td className="align-right">
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={draft.market_value_cny}
                        onChange={(e) => setDraft((prev) => ({ ...prev, market_value_cny: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      formatMoney(row.market_value_cny)
                    )}
                  </td>
                  <td className="align-right">
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={draft.shares}
                        onChange={(e) => setDraft((prev) => ({ ...prev, shares: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      formatMoney(row.shares, 2)
                    )}
                  </td>
                  <td className="align-right">{formatPercent(weight)}</td>
                  <td className="align-right">
                    <DualValue
                      top={formatSignedMoney(row.holding_profit_cny)}
                      bottom={formatPercent(row.holding_profit_rate)}
                      topClass={classBySign(row.holding_profit_cny)}
                      bottomClass={classBySign(row.holding_profit_rate)}
                    />
                  </td>
                  <td className="align-right">
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={draft.cost_basis_cny}
                        onChange={(e) => setDraft((prev) => ({ ...prev, cost_basis_cny: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      formatMoney(row.cost_basis_cny)
                    )}
                  </td>
                  <td className="align-right">
                    <span className={classBySign(row.day_profit_cny)}>{formatSignedMoney(row.day_profit_cny)}</span>
                  </td>
                  <td className="align-right">
                    <span className={classBySign(row.yesterday_profit_cny)}>{formatSignedMoney(row.yesterday_profit_cny)}</span>
                  </td>
                  <td className="align-right">
                    <DualValue
                      top={formatPercent(row.estimate_pct)}
                      bottom={row.latest_nav ? row.latest_nav.toFixed(4) : '--'}
                      topClass={classBySign(row.estimate_pct)}
                    />
                  </td>
                  <td className="align-right">
                    {isEditing ? (
                      <input
                        type="date"
                        className="table-input"
                        value={draft.start_date}
                        onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <DualValue
                        top={row.holding_days === '--' ? '--' : `${row.holding_days}天`}
                        bottom={startDateText}
                      />
                    )}
                  </td>
                  <td className="align-right">
                    {!isEditing && (
                      <button type="button" className="text-btn" onClick={(e) => { e.stopPropagation(); beginEdit(row) }}>
                        编辑
                      </button>
                    )}
                    {isEditing && (
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="text-btn" onClick={() => submitEdit(row.fund_id)}>保存</button>
                        <button type="button" className="text-btn danger-text" onClick={cancelEdit}>取消</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
