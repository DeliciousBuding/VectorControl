import Button from 'antd/es/button'
import Input from 'antd/es/input'
import InputNumber from 'antd/es/input-number'
import Select from 'antd/es/select'

export function ReminderRulesPanel({
  reminderRules,
  reminderRuleStates,
  handleCreateRule,
  ruleName,
  setRuleName,
  ruleFundCode,
  setRuleFundCode,
  ruleOperator,
  setRuleOperator,
  ruleThreshold,
  setRuleThreshold,
  ruleSilentHours,
  setRuleSilentHours,
  ruleSubmitting,
  ruleError,
  handleToggleRule
}) {
  return (
    <>
      <div className="section-head trade-head">
        <h3>提醒规则中心</h3>
        <span>{`阈值规则 ${reminderRules.length} 条，已触发 ${reminderRuleStates.filter((item) => item.hit).length} 条`}</span>
      </div>
      <form className="trade-form reminder-form" onSubmit={handleCreateRule}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>规则名称</div>
          <Input
            value={ruleName}
            onChange={(event) => setRuleName(event.target.value)}
            placeholder="例如：纳指回撤提醒"
            maxLength={40}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>基金代码（可选）</div>
          <Input
            value={ruleFundCode}
            onChange={(event) => setRuleFundCode(event.target.value)}
            placeholder="留空表示全持仓"
            maxLength={16}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>触发条件</div>
          <Select
            style={{ width: '100%' }}
            value={ruleOperator}
            onChange={(value) => setRuleOperator(value)}
            options={[
              { value: '<=', label: '小于等于阈值' },
              { value: '>=', label: '大于等于阈值' }
            ]}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>阈值（%）</div>
          <InputNumber
            style={{ width: '100%' }}
            step={0.01}
            value={ruleThreshold}
            onChange={(value) => setRuleThreshold(value)}
            placeholder="例如 -1.5"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>静默期（小时）</div>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={1}
            value={ruleSilentHours}
            onChange={(value) => setRuleSilentHours(value)}
          />
        </div>
        <Button type="primary" htmlType="submit" loading={ruleSubmitting} block>
          {ruleSubmitting ? '保存中...' : '新增提醒'}
        </Button>
      </form>
      {ruleError && <div className="chart-empty">{ruleError}</div>}
      {reminderRuleStates.length === 0 && <div className="chart-empty">暂无提醒规则，请先新增阈值规则。</div>}
      {reminderRuleStates.length > 0 && (
        <div className="plan-list">
          {reminderRuleStates.map((rule) => (
            <article key={rule.id} className="plan-item">
              <div>
                <h4>{rule.name}</h4>
                <p>
                  作用范围：{rule.fund_id || '全持仓'}（{rule.scopeCount}） ｜ 规则：估值 {rule.operator} {Number(rule.threshold).toFixed(2)}%
                </p>
                <p>
                  触发说明：{rule.reason_template} ｜ 当前值：{rule.currentValue == null ? '--' : `${Number(rule.currentValue).toFixed(2)}%`} ｜ 静默期：{rule.silent_hours} 小时
                </p>
              </div>
              <div className="plan-actions">
                <span className={rule.hit ? 'record-pending' : 'record-done'}>
                  {rule.hit ? '已触发' : '未触发'}
                </span>
                <button type="button" className="ghost" onClick={() => handleToggleRule(rule.id)}>
                  {rule.enabled ? '暂停' : '启用'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
