import { useEffect, useState } from 'react'
import {
  fetchSIPPlans,
  createSIPPlan,
  updateSIPPlan,
  deleteSIPPlan,
  executeSIPPlan
} from '../api.js'
import { formatMoney, formatDate } from '../utils/format.js'
import { SurfaceState } from './SurfaceState.jsx'

const FREQUENCY_LABELS = {
  weekly: '每周',
  biweekly: '双周',
  monthly: '每月'
}

const DAY_LABELS_WEEKLY = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const EMPTY_FORM_DATA = {
  fund_id: '',
  fund_name: '',
  amount: '',
  frequency: 'monthly',
  day: 1,
  note: ''
}

function getScheduleLabel(plan) {
  const dayLabel = plan.frequency === 'weekly'
    ? DAY_LABELS_WEEKLY[Number(plan.day || 1) - 1]
    : `${plan.day}号`
  return `${FREQUENCY_LABELS[plan.frequency] || plan.frequency} · ${dayLabel}`
}

export function SIPPlanManager({ user }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM_DATA)

  useEffect(() => {
    if (!user) {
      setPlans([])
      return
    }

    setLoading(true)
    setError(null)

    fetchSIPPlans(false)
      .then((payload) => {
        setPlans(payload.plans || [])
      })
      .catch((err) => {
        setError(err.message || '加载失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user])

  const activePlans = plans.filter((plan) => plan.enabled).length
  const pausedPlans = plans.filter((plan) => !plan.enabled).length
  const scheduledPlans = plans.filter((plan) => plan.next_date).length
  const overviewCards = [
    {
      key: 'active',
      label: '执行中',
      value: activePlans,
      hint: '继续按计划自动执行'
    },
    {
      key: 'paused',
      label: '已暂停',
      value: pausedPlans,
      hint: '需要人工恢复或调整'
    },
    {
      key: 'scheduled',
      label: '已排期',
      value: scheduledPlans,
      hint: '已生成下一次执行日期'
    }
  ]

  const resetForm = () => {
    setShowForm(false)
    setEditingPlan(null)
    setFormData(EMPTY_FORM_DATA)
  }

  const openCreateForm = () => {
    setShowForm(true)
    setEditingPlan(null)
    setFormData(EMPTY_FORM_DATA)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    try {
      const payload = {
        fund_id: formData.fund_id,
        fund_name: formData.fund_name,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        day: parseInt(formData.day, 10),
        note: formData.note
      }

      if (editingPlan) {
        await updateSIPPlan(editingPlan.id, payload)
      } else {
        await createSIPPlan(payload)
      }

      const updated = await fetchSIPPlans(false)
      setPlans(updated.plans || [])
      resetForm()
    } catch (err) {
      setError(err.message || '保存失败')
    }
  }

  const handleEdit = (plan) => {
    setEditingPlan(plan)
    setFormData({
      fund_id: plan.fund_id,
      fund_name: plan.fund_name || '',
      amount: String(plan.amount),
      frequency: plan.frequency,
      day: plan.day,
      note: plan.note || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (planId) => {
    if (!confirm('确定要删除这个定投计划吗？')) {
      return
    }

    try {
      await deleteSIPPlan(planId)
      const updated = await fetchSIPPlans(false)
      setPlans(updated.plans || [])
    } catch (err) {
      setError(err.message || '删除失败')
    }
  }

  const handleExecute = async (planId) => {
    try {
      await executeSIPPlan(planId)
      const updated = await fetchSIPPlans(false)
      setPlans(updated.plans || [])
    } catch (err) {
      setError(err.message || '标记失败')
    }
  }

  const handleToggle = async (plan) => {
    try {
      await updateSIPPlan(plan.id, { enabled: !plan.enabled })
      const updated = await fetchSIPPlans(false)
      setPlans(updated.plans || [])
    } catch (err) {
      setError(err.message || '更新失败')
    }
  }

  if (!user) {
    return (
      <SurfaceState
        tone="info"
        compact
        title="登录后管理定投计划"
        description="定投自动化会在登录态下展示当前计划、执行节奏与人工干预入口。"
      />
    )
  }

  return (
    <section className="sip-manager" aria-label="定投计划管理">
      <header className="sip-manager__header">
        <div className="sip-manager__copy">
          <span className="sip-manager__eyebrow">Automation</span>
          <h3>定投自动化</h3>
          <p>把周期计划、执行状态和人工干预动作收敛到同一上下文，减少碎片化管理。</p>
        </div>
        <button
          type="button"
          className="sip-manager__toggle"
          onClick={() => {
            if (showForm || editingPlan) {
              resetForm()
              return
            }
            openCreateForm()
          }}
        >
          {showForm || editingPlan ? '收起表单' : '新建计划'}
        </button>
      </header>

      <div className="sip-manager__overview" aria-label="定投计划概览">
        {overviewCards.map((card) => (
          <article key={card.key} className="sip-manager__overview-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.hint}</p>
          </article>
        ))}
      </div>

      {error && (
        <SurfaceState
          tone="error"
          compact
          title="定投计划操作失败"
          description={error}
          hint="请稍后重试，或检查计划字段是否完整。"
        />
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="sip-manager-form">
          <div className="sip-manager-form__head">
            <div>
              <span>{editingPlan ? 'Edit Plan' : 'Create Plan'}</span>
              <h4>{editingPlan ? '编辑定投计划' : '新增定投计划'}</h4>
            </div>
            <p>先确定基金、金额与执行频率，再补备注，保持计划定义清晰可追溯。</p>
          </div>

          <div className="sip-manager-form__grid sip-manager-form__grid--double">
            <label className="sip-field">
              <span>基金代码 *</span>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                placeholder="000001"
                value={formData.fund_id}
                onChange={(event) => setFormData({ ...formData, fund_id: event.target.value })}
              />
            </label>
            <label className="sip-field">
              <span>基金名称</span>
              <input
                type="text"
                placeholder="沪深300ETF"
                value={formData.fund_name}
                onChange={(event) => setFormData({ ...formData, fund_name: event.target.value })}
              />
            </label>
          </div>

          <div className="sip-manager-form__grid sip-manager-form__grid--triple">
            <label className="sip-field">
              <span>金额（元）*</span>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="1000"
                value={formData.amount}
                onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
              />
            </label>
            <label className="sip-field">
              <span>频率</span>
              <select
                value={formData.frequency}
                onChange={(event) => setFormData({ ...formData, frequency: event.target.value })}
              >
                <option value="weekly">每周</option>
                <option value="biweekly">双周</option>
                <option value="monthly">每月</option>
              </select>
            </label>
            <label className="sip-field">
              <span>{formData.frequency === 'weekly' ? '周几' : '几号'}</span>
              <select
                value={formData.day}
                onChange={(event) => setFormData({ ...formData, day: parseInt(event.target.value, 10) })}
              >
                {formData.frequency === 'weekly'
                  ? DAY_LABELS_WEEKLY.map((label, index) => (
                      <option key={index + 1} value={index + 1}>
                        {label}
                      </option>
                    ))
                  : Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}号
                      </option>
                    ))}
              </select>
            </label>
          </div>

          <label className="sip-field">
            <span>备注</span>
            <input
              type="text"
              placeholder="备注信息（可选）"
              value={formData.note}
              onChange={(event) => setFormData({ ...formData, note: event.target.value })}
            />
          </label>

          <div className="sip-manager-form__actions">
            <button type="submit" className="sip-button sip-button--primary">
              {editingPlan ? '保存修改' : '创建计划'}
            </button>
            <button type="button" className="sip-button sip-button--secondary" onClick={resetForm}>
              取消
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <SurfaceState
          tone="loading"
          compact
          title="定投计划加载中"
          description="正在同步计划列表与下一次执行信息。"
        />
      ) : plans.length === 0 ? (
        <SurfaceState
          tone="empty"
          compact
          title="当前暂无定投计划"
          description="可以先创建一个计划，把固定频率、金额和备注收进自动化执行流。"
        >
          <button type="button" className="sip-button sip-button--primary" onClick={openCreateForm}>
            新建首个计划
          </button>
        </SurfaceState>
      ) : (
        <div className="sip-plan-list">
          {plans.map((plan) => (
            <article key={plan.id} className={`sip-plan-card ${plan.enabled ? '' : 'sip-plan-card--paused'}`.trim()}>
              <div className="sip-plan-card__main">
                <div className="sip-plan-card__title-row">
                  <div>
                    <h4>{plan.fund_name || plan.fund_id}</h4>
                    <p>{plan.fund_name ? plan.fund_id : '未填写基金名称'}</p>
                  </div>
                  <span className={`sip-plan-card__status ${plan.enabled ? '' : 'sip-plan-card__status--paused'}`.trim()}>
                    {plan.enabled ? '执行中' : '已暂停'}
                  </span>
                </div>

                <div className="sip-plan-card__meta">
                  <article>
                    <span>每期金额</span>
                    <strong>{formatMoney(plan.amount)} 元</strong>
                  </article>
                  <article>
                    <span>执行频率</span>
                    <strong>{getScheduleLabel(plan)}</strong>
                  </article>
                  <article>
                    <span>下次执行</span>
                    <strong>{plan.next_date ? formatDate(plan.next_date) : '待排期'}</strong>
                  </article>
                </div>

                {plan.note ? <p className="sip-plan-card__note">{plan.note}</p> : null}
              </div>

              <div className="sip-plan-card__actions">
                <button type="button" className="sip-button sip-button--ghost" onClick={() => handleExecute(plan.id)}>
                  标记已执行
                </button>
                <button type="button" className="sip-button sip-button--ghost" onClick={() => handleEdit(plan)}>
                  编辑
                </button>
                <button type="button" className="sip-button sip-button--ghost" onClick={() => handleToggle(plan)}>
                  {plan.enabled ? '暂停' : '启用'}
                </button>
                <button type="button" className="sip-button sip-button--danger" onClick={() => handleDelete(plan.id)}>
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
