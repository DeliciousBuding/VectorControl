import { useEffect, useState } from 'react'
import {
  fetchSIPPlans,
  createSIPPlan,
  updateSIPPlan,
  deleteSIPPlan,
  executeSIPPlan,
} from '../api.js'
import { formatMoney, formatDate } from '../utils/format.js'

const FREQUENCY_LABELS = {
  weekly: '每周',
  biweekly: '双周',
  monthly: '每月',
}

const DAY_LABELS_WEEKLY = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function SIPPlanManager({ user }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    fund_id: '',
    fund_name: '',
    amount: '',
    frequency: 'monthly',
    day: 1,
    note: '',
  })

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      const payload = {
        fund_id: formData.fund_id,
        fund_name: formData.fund_name,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        day: parseInt(formData.day, 10),
        note: formData.note,
      }

      if (editingPlan) {
        await updateSIPPlan(editingPlan.id, payload)
      } else {
        await createSIPPlan(payload)
      }

      // Reload plans
      const updated = await fetchSIPPlans(false)
      setPlans(updated.plans || [])
      
      // Reset form
      setShowForm(false)
      setEditingPlan(null)
      setFormData({
        fund_id: '',
        fund_name: '',
        amount: '',
        frequency: 'monthly',
        day: 1,
        note: '',
      })
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
      note: plan.note || '',
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
      <div className="p-4 bg-gray-50 rounded text-center text-gray-500">
        请先登录管理定投计划
      </div>
    )
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">定投计划</h3>
        <button
          type="button"
          className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            setShowForm(!showForm)
            setEditingPlan(null)
            setFormData({
              fund_id: '',
              fund_name: '',
              amount: '',
              frequency: 'monthly',
              day: 1,
              note: '',
            })
          }}
        >
          {showForm ? '取消' : '+ 新建'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded text-red-600 text-sm mb-3">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">基金代码 *</label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                className="w-full px-2 py-1.5 text-sm border rounded"
                placeholder="000001"
                value={formData.fund_id}
                onChange={(e) => setFormData({ ...formData, fund_id: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">基金名称</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 text-sm border rounded"
                placeholder="沪深300ETF"
                value={formData.fund_name}
                onChange={(e) => setFormData({ ...formData, fund_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">金额 (元) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                className="w-full px-2 py-1.5 text-sm border rounded"
                placeholder="1000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">频率</label>
              <select
                className="w-full px-2 py-1.5 text-sm border rounded"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              >
                <option value="weekly">每周</option>
                <option value="biweekly">双周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {formData.frequency === 'weekly' ? '周几' : '几号'}
              </label>
              <select
                className="w-full px-2 py-1.5 text-sm border rounded"
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: parseInt(e.target.value, 10) })}
              >
                {formData.frequency === 'weekly' ? (
                  DAY_LABELS_WEEKLY.map((label, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {label}
                    </option>
                  ))
                ) : (
                  Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}号
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">备注</label>
            <input
              type="text"
              className="w-full px-2 py-1.5 text-sm border rounded"
              placeholder="备注信息（可选）"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {editingPlan ? '更新' : '创建'}
            </button>
            {editingPlan && (
              <button
                type="button"
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => {
                  setShowForm(false)
                  setEditingPlan(null)
                }}
              >
                取消
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          还没有定投计划，点击上方「+ 新建」创建
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`p-3 rounded border ${
                plan.enabled ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{plan.fund_id}</span>
                    {plan.fund_name && (
                      <span className="text-sm text-gray-600">{plan.fund_name}</span>
                    )}
                    {!plan.enabled && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-300 text-gray-600 rounded">
                        已暂停
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {formatMoney(plan.amount)} 元 / {FREQUENCY_LABELS[plan.frequency]}
                    {plan.frequency === 'weekly'
                      ? DAY_LABELS_WEEKLY[plan.day - 1]
                      : `${plan.day}号`}
                  </div>
                  {plan.next_date && (
                    <div className="mt-1 text-xs text-gray-500">
                      下次: {formatDate(plan.next_date)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    onClick={() => handleExecute(plan.id)}
                    title="标记已执行"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    onClick={() => handleEdit(plan)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    onClick={() => handleToggle(plan)}
                  >
                    {plan.enabled ? '暂停' : '启用'}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    onClick={() => handleDelete(plan.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
