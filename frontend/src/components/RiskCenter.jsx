import { memo } from 'react'
import { SurfaceState } from './SurfaceState.jsx'

export const RiskCenter = memo(function RiskCenter({ risk }) {
  return (
    <section className="panel risk-panel">
      <div className="section-head">
        <h3>风险中枢（置底）</h3>
        <span>{risk ? `版本：${risk.version || 'risk-v0'}` : '暂无数据'}</span>
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
          <article className="risk-card">
            <h4>集中度</h4>
            <p>Top1：{risk.concentration?.top1_weight_pct ?? '--'}%</p>
            <p>Top3：{risk.concentration?.top3_weight_pct ?? '--'}%</p>
            <p>HHI：{risk.concentration?.hhi ?? '--'}</p>
          </article>

          <article className="risk-card">
            <h4>相关性概览</h4>
            <p>状态：{risk.correlation?.status === 'ok' ? '可用' : '数据不足'}</p>
            <p>样本点：{risk.correlation?.points ?? 0}</p>
            <p>{risk.correlation?.note || '暂无说明'}</p>
          </article>

          <article className="risk-card">
            <h4>压力测试</h4>
            {Array.isArray(risk.stress_test?.scenarios) && risk.stress_test.scenarios.length > 0 ? (
              <ul>
                {risk.stress_test.scenarios.map((item) => (
                  <li key={item.scenario}>{item.scenario}：{item.projected_drawdown_pct}%</li>
                ))}
              </ul>
            ) : (
              <p>暂无压力测试数据</p>
            )}
          </article>

          <article className="risk-card">
            <h4>重叠预警</h4>
            {Array.isArray(risk.overlap_warnings) && risk.overlap_warnings.length > 0 ? (
              <ul>
                {risk.overlap_warnings.map((item) => (
                  <li key={item}>{item}</li>
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
