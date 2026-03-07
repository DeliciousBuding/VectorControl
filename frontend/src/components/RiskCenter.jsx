import { memo } from 'react'
import { SurfaceState } from './SurfaceState.jsx'

export const RiskCenter = memo(function RiskCenter({ risk }) {
  const overviewCards = [
    {
      key: 'concentration',
      label: 'Top1',
      value: risk ? `${risk.concentration?.top1_weight_pct ?? '--'}%` : '--',
      hint: '组合第一大持仓占比'
    },
    {
      key: 'correlation',
      label: '相关性样本',
      value: risk ? String(risk.correlation?.points ?? 0) : '--',
      hint: '用于计算相关性的样本点'
    },
    {
      key: 'alerts',
      label: '结构预警',
      value: risk ? String(Array.isArray(risk.overlap_warnings) ? risk.overlap_warnings.length : 0) : '--',
      hint: '当前识别到的重叠风险条目'
    }
  ]
  const stressScenarios = Array.isArray(risk?.stress_test?.scenarios) ? risk.stress_test.scenarios : []
  const overlapWarnings = Array.isArray(risk?.overlap_warnings) ? risk.overlap_warnings : []

  return (
    <section className="panel risk-panel risk-panel--refined">
      <div className="section-head section-head--rich risk-panel__head">
        <div className="section-head__copy">
          <span className="risk-panel__eyebrow">Risk Workbench</span>
          <h3>风险中枢</h3>
          <p className="section-description">把集中度、相关性、压力测试和结构性预警放在同一层级里，先看摘要，再读细节。</p>
        </div>
        <div className="risk-panel__aside">
          <span>模型版本</span>
          <strong>{risk ? risk.version || 'risk-v0' : '暂无数据'}</strong>
          <p>{risk ? '当前已生成最新风险快照。' : '刷新持仓与估值后，这里会展示最新风险快照。'}</p>
        </div>
      </div>

      <div className="risk-overview" aria-label="风险概览">
        {overviewCards.map((card) => (
          <article key={card.key} className="risk-overview__card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.hint}</p>
          </article>
        ))}
      </div>

      {!risk && (
        <SurfaceState
          tone="empty"
          title="风险中枢尚未就绪"
          description="请先刷新持仓与估值数据，再查看集中度、相关性和压力测试。"
          hint="完成一次刷新后，这里会自动展示风险摘要。"
          compact
        />
      )}

      {risk && (
        <div className="risk-grid">
          <article className="risk-card risk-card--metric">
            <span className="risk-card__eyebrow">Concentration</span>
            <h4>集中度</h4>
            <div className="risk-card__metrics">
              <div>
                <span>Top1</span>
                <strong>{risk.concentration?.top1_weight_pct ?? '--'}%</strong>
              </div>
              <div>
                <span>Top3</span>
                <strong>{risk.concentration?.top3_weight_pct ?? '--'}%</strong>
              </div>
              <div>
                <span>HHI</span>
                <strong>{risk.concentration?.hhi ?? '--'}</strong>
              </div>
            </div>
          </article>

          <article className="risk-card risk-card--metric">
            <span className="risk-card__eyebrow">Correlation</span>
            <h4>相关性概览</h4>
            <div className="risk-card__metrics">
              <div>
                <span>状态</span>
                <strong>{risk.correlation?.status === 'ok' ? '可用' : '数据不足'}</strong>
              </div>
              <div>
                <span>样本点</span>
                <strong>{risk.correlation?.points ?? 0}</strong>
              </div>
            </div>
            <p>{risk.correlation?.note || '暂无说明'}</p>
          </article>

          <article className="risk-card">
            <span className="risk-card__eyebrow">Stress Test</span>
            <h4>压力测试</h4>
            {stressScenarios.length > 0 ? (
              <ul className="risk-list">
                {stressScenarios.map((item) => (
                  <li key={item.scenario}>
                    <span>{item.scenario}</span>
                    <strong>{item.projected_drawdown_pct}%</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无压力测试数据</p>
            )}
          </article>

          <article className="risk-card">
            <span className="risk-card__eyebrow">Overlap Alerts</span>
            <h4>重叠预警</h4>
            {overlapWarnings.length > 0 ? (
              <ul className="risk-list">
                {overlapWarnings.map((item) => (
                  <li key={item}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无结构性预警</p>
            )}
          </article>
        </div>
      )}
    </section>
  )
})
