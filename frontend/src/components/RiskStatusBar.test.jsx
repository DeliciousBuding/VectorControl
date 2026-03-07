import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RiskStatusBar } from './RiskStatusBar.jsx'

describe('RiskStatusBar', () => {
  it('无风险数据时渲染空快照', () => {
    render(<RiskStatusBar risk={null} onOpenRiskCenter={vi.fn()} />)

    expect(screen.getByText('暂无风险数据，请先刷新')).toBeInTheDocument()
    expect(screen.getByText('Risk Snapshot')).toBeInTheDocument()
  })

  it('有风险数据时展示三类风险并支持跳转', () => {
    const onOpenRiskCenter = vi.fn()

    render(
      <RiskStatusBar
        risk={{
          concentration: { top1_weight_pct: 21.3, top3_weight_pct: 56.8 },
          stress_test: { worst_drawdown_pct: -9.2 },
          overlap_warnings: ['港股科技重叠']
        }}
        onOpenRiskCenter={onOpenRiskCenter}
      />
    )

    expect(screen.getByLabelText('风险状态条')).toBeInTheDocument()
    expect(screen.getByText(/Top1 21.30%/)).toBeInTheDocument()
    expect(screen.queryByText('无结构预警')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看风险详情' }))
    expect(onOpenRiskCenter).toHaveBeenCalledTimes(1)
  })
})
