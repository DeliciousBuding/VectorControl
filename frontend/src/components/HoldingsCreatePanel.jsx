import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Select from 'antd/es/select'

export function HoldingsCreatePanel({
  holdingCreateForm,
  setHoldingCreateForm,
  defaultBucketByMarketGroup,
  handleSubmitHoldingCreate,
  holdingCreateSubmitting,
  holdingCreateSuggestLoading,
  holdingCreateSuggestions,
  handlePickHoldingCreateSuggestion,
  holdingCreateError,
  holdingCreateResult,
  holdingAutoFillError,
  holdingAutoFillResult,
  marketGroupLabel
}) {
  return (
    <section className="panel holdings-create-panel">
      <div className="section-head">
        <h3>新增持仓（自动补全）</h3>
        <span>支持基金代码联想并自动回填名称与市场标签</span>
      </div>
      <form className="trade-form holdings-create-form" onSubmit={handleSubmitHoldingCreate}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>基金代码</div>
          <Input
            value={holdingCreateForm.fund_id}
            onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, fund_id: event.target.value }))}
            placeholder="例如 016453"
            maxLength={16}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>基金名称</div>
          <Input
            value={holdingCreateForm.name}
            onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="例如 纳斯达克100ETF联接"
            maxLength={60}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>市场分组</div>
          <Select
            style={{ width: '100%' }}
            value={holdingCreateForm.market_group}
            onChange={(value) => {
              const nextGroup = String(value || 'cn_hk')
              setHoldingCreateForm((prev) => ({
                ...prev,
                market_group: nextGroup,
                bucket: defaultBucketByMarketGroup(nextGroup)
              }))
            }}
            options={[
              { value: 'cn_hk', label: 'A股/港股（cn_hk）' },
              { value: 'us_overseas', label: '美股/海外（us_overseas）' }
            ]}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>持仓分组</div>
          <Input
            value={holdingCreateForm.bucket}
            onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, bucket: event.target.value }))}
            placeholder="例如 core / overseas / growth"
            maxLength={32}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>标签（可选）</div>
          <Input
            value={holdingCreateForm.tags_text}
            onChange={(event) => setHoldingCreateForm((prev) => ({ ...prev, tags_text: event.target.value }))}
            placeholder="例如 QDII,指数,科技"
            maxLength={80}
          />
        </div>
        <Button type="primary" htmlType="submit" loading={holdingCreateSubmitting} block>
          {holdingCreateSubmitting ? '提交中...' : '新增/覆盖持仓'}
        </Button>
      </form>

      {holdingCreateSuggestLoading && <div className="chart-empty">基金联想加载中...</div>}
      {!holdingCreateSuggestLoading && holdingCreateSuggestions.length > 0 && (
        <div className="watch-list holdings-create-suggest-list">
          {holdingCreateSuggestions.slice(0, 6).map((item) => (
            <article key={`holding-create-suggest-${item.fund_id}`} className="watch-item">
              <div>
                <h3>{item.name || '--'}</h3>
                <p>{item.fund_id} · {marketGroupLabel(item.market_group)}</p>
              </div>
              <button type="button" className="ghost" onClick={() => handlePickHoldingCreateSuggestion(item)}>
                选用
              </button>
            </article>
          ))}
        </div>
      )}
      {holdingCreateError && <div className="chart-empty">{holdingCreateError}</div>}
      {holdingCreateResult && (
        <div className="trade-result">
          <strong>持仓{holdingCreateResult.action}成功</strong>
          <p>基金：{holdingCreateResult.name || '--'}（{holdingCreateResult.fund_id || '--'}）</p>
          <p>市场：{marketGroupLabel(holdingCreateResult.market_group)} ｜ 分组：{holdingCreateResult.bucket || '--'}</p>
        </div>
      )}
      {holdingAutoFillError && <div className="chart-empty">{holdingAutoFillError}</div>}
      {holdingAutoFillResult && (
        <div className="trade-result">
          <strong>持仓自动补全完成</strong>
          <p>基金：{holdingAutoFillResult.name || '--'}（{holdingAutoFillResult.fund_id || '--'}）</p>
          <p>市场：{marketGroupLabel(holdingAutoFillResult.market_group)} ｜ 分组：{holdingAutoFillResult.bucket || '--'}</p>
          <p>
            {Array.isArray(holdingAutoFillResult.fields) && holdingAutoFillResult.fields.length > 0
              ? `已回填字段：${holdingAutoFillResult.fields.join(' / ')}`
              : '当前字段已是最新，无需回填'}
          </p>
        </div>
      )}
    </section>
  )
}
