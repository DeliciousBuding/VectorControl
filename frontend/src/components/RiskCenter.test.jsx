import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RiskCenter } from './RiskCenter.jsx'

describe('RiskCenter', () => {
  it('在无风险数据时展示统一空态', () => {
    render(<RiskCenter risk={null} />)

    expect(screen.getByRole('heading', { level: 3, name: '风险中枢' })).toBeInTheDocument()
    expect(screen.getByText('风险中枢尚未就绪')).toBeInTheDocument()
    expect(screen.getByLabelText('风险概览')).toBeInTheDocument()
  })

  it('在有风险数据时展示概览与风险卡', () => {
    render(
      <RiskCenter
        risk={{
          version: 'risk-v2',
          concentration: { top1_weight_pct: 24.5, top3_weight_pct: 58.2, hhi: 1333 },
          correlation: { status: 'ok', points: 120, note: '样本充足' },
          stress_test: {
            scenarios: [
              { scenario: '权益下跌 10%', projected_drawdown_pct: -8.1 }
            ]
          },
          overlap_warnings: ['港股科技重仓重叠']
        }}
      />
    )

    const overview = screen.getByLabelText('风险概览')
    expect(within(overview).getByText('Top1')).toBeInTheDocument()
    expect(within(overview).getByText('24.5%')).toBeInTheDocument()
    expect(screen.getByText('权益下跌 10%')).toBeInTheDocument()
    expect(screen.getByText('港股科技重仓重叠')).toBeInTheDocument()
  })
})
