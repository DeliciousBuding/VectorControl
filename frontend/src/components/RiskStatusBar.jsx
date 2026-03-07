function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatPct(value, digits = 2) {
  const n = toNumber(value, 0)
  return `${n.toFixed(digits)}%`
}

function concentrationLevel(top1, top3) {
  if (top1 >= 35 || top3 >= 75) {
    return { label: '偏高', className: 'risk-chip-warn' }
  }
  return { label: '正常', className: 'risk-chip-ok' }
}

function drawdownLevel(worstDrawdown) {
  if (worstDrawdown <= -18) {
    return { label: '高压', className: 'risk-chip-warn' }
  }
  if (worstDrawdown <= -12) {
    return { label: '注意', className: 'risk-chip-mid' }
  }
  return { label: '可控', className: 'risk-chip-ok' }
}

export function RiskStatusBar({ risk, onOpenRiskCenter }) {
  if (!risk || typeof risk !== 'object') {
    return (
      <section className="risk-status-bar risk-status-bar--empty">
        <div className="risk-status-bar__copy">
          <span className="risk-status-bar__eyebrow">Risk Snapshot</span>
          <strong>暂无风险数据，请先刷新</strong>
          <p>刷新持仓与估值后，这里会展示组合的集中度、回撤预估与结构预警。</p>
        </div>
      </section>
    )
  }

  const top1 = toNumber(risk?.concentration?.top1_weight_pct, 0)
  const top3 = toNumber(risk?.concentration?.top3_weight_pct, 0)
  const worstDrawdown = toNumber(risk?.stress_test?.worst_drawdown_pct, 0)
  const warningsCount = Array.isArray(risk?.overlap_warnings) ? risk.overlap_warnings.length : 0

  const concentration = concentrationLevel(top1, top3)
  const drawdown = drawdownLevel(worstDrawdown)
  const warningClass = warningsCount > 0 ? 'risk-chip-warn' : 'risk-chip-ok'
  const warningLabel = warningsCount > 0 ? `预警 ${warningsCount} 条` : '无结构预警'
  const overviewItems = [
    {
      key: 'concentration',
      label: '集中度',
      value: `Top1 ${formatPct(top1)} ｜ Top3 ${formatPct(top3)}`,
      chipClass: concentration.className,
      chipLabel: concentration.label
    },
    {
      key: 'drawdown',
      label: '回撤预估',
      value: formatPct(worstDrawdown),
      chipClass: drawdown.className,
      chipLabel: drawdown.label
    },
    {
      key: 'warnings',
      label: '结构预警',
      value: warningLabel,
      chipClass: warningClass,
      chipLabel: warningsCount > 0 ? '需关注' : '正常'
    }
  ]

  return (
    <section className="risk-status-bar" aria-label="风险状态条">
      <div className="risk-status-bar__copy">
        <span className="risk-status-bar__eyebrow">Risk Snapshot</span>
        <strong>组合风险快照</strong>
        <p>先看集中度、回撤预估与结构预警，再进入风险中枢查看完整细项。</p>
      </div>

      <div className="risk-status-bar__grid">
        {overviewItems.map((item) => (
          <article key={item.key} className="risk-status-item">
            <span className="risk-label">{item.label}</span>
            <strong>{item.value}</strong>
            <span className={`risk-chip ${item.chipClass}`}>{item.chipLabel}</span>
          </article>
        ))}
      </div>

      <button type="button" className="ghost risk-jump-btn" onClick={onOpenRiskCenter}>
        查看风险详情
      </button>
    </section>
  )
}
