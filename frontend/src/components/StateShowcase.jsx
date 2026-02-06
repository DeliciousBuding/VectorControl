import { useMemo } from 'react'

export function StateShowcase() {
  const skeletonRows = useMemo(() => [1, 2, 3], [])
  return (
    <section className="panel state-showcase">
      <div className="state-grid">
        <article className="state-card">
          <h4>按钮状态</h4>
          <div className="state-actions">
            <button type="button" className="primary">默认</button>
            <button type="button" className="primary demo-hover">悬浮预览</button>
            <button type="button" className="primary" disabled>禁用</button>
            <button type="button" className="primary" disabled>加载中...</button>
          </div>
        </article>

        <article className="state-card">
          <h4>输入与错误态</h4>
          <label className="state-field">
            正常输入
            <input value="示例值" readOnly />
          </label>
          <label className="state-field">
            错误输入
            <input className="state-input-error" value="错误示例" readOnly />
            <span className="state-error-text">请输入合法阈值</span>
          </label>
        </article>

        <article className="state-card">
          <h4>空状态与提示</h4>
          <div className="chart-empty">暂无数据，请先新增或刷新。</div>
          <div className="state-tags">
            <span className="status-pill status-info">估算中</span>
            <span className="status-pill status-success">已更新</span>
            <span className="status-pill status-warning">数据不完整</span>
          </div>
        </article>

        <article className="state-card">
          <h4>骨架屏样例</h4>
          <div className="state-skeleton">
            {skeletonRows.map((item) => (
              <div key={item} className="skeleton-line state-skeleton-line" />
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
