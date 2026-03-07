import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIPPlanManager } from './SIPPlanManager.jsx'
import {
  createSIPPlan,
  deleteSIPPlan,
  executeSIPPlan,
  fetchSIPPlans,
  updateSIPPlan
} from '../api.js'

vi.mock('../api.js', () => ({
  fetchSIPPlans: vi.fn(),
  createSIPPlan: vi.fn(),
  updateSIPPlan: vi.fn(),
  deleteSIPPlan: vi.fn(),
  executeSIPPlan: vi.fn()
}))

describe('SIPPlanManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSIPPlan).mockReset()
    vi.mocked(updateSIPPlan).mockReset()
    vi.mocked(deleteSIPPlan).mockReset()
    vi.mocked(executeSIPPlan).mockReset()
  })

  it('渲染定投自动化头部、概览和计划卡', async () => {
    vi.mocked(fetchSIPPlans).mockResolvedValue({
      plans: [
        {
          id: 1,
          fund_id: '000001',
          fund_name: '华夏成长',
          amount: 500,
          frequency: 'monthly',
          day: 15,
          enabled: true,
          next_date: '2026-03-15',
          note: '长期'
        },
        {
          id: 2,
          fund_id: '000002',
          fund_name: '纳指增强',
          amount: 300,
          frequency: 'weekly',
          day: 3,
          enabled: false,
          next_date: '',
          note: ''
        }
      ]
    })

    render(<SIPPlanManager user={{ id: 'u1' }} />)

    expect(await screen.findByRole('heading', { level: 3, name: '定投自动化' })).toBeInTheDocument()
    const overview = screen.getByLabelText('定投计划概览')
    expect(within(overview).getByText('执行中')).toBeInTheDocument()
    expect(within(overview).getByText('已暂停')).toBeInTheDocument()
    expect(await screen.findByText('华夏成长')).toBeInTheDocument()
    expect(screen.getByText('纳指增强')).toBeInTheDocument()
  })

  it('空态下可打开创建表单', async () => {
    vi.mocked(fetchSIPPlans).mockResolvedValue({ plans: [] })

    render(<SIPPlanManager user={{ id: 'u1' }} />)

    expect(await screen.findByText('当前暂无定投计划')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新建首个计划' }))

    expect(screen.getByRole('heading', { level: 4, name: '新增定投计划' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('000001')).toBeInTheDocument()
  })
})
