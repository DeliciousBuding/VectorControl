import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomTabs } from './BottomTabs.jsx'

describe('BottomTabs', () => {
  it('渲染共享导航项并回传切换事件', () => {
    const onChange = vi.fn()
    render(<BottomTabs active="holdings" onChange={onChange} />)

    const activeTab = screen.getByRole('button', {
      name: /持仓.*巡检持仓、审计变更并进入风险中心/
    })

    expect(activeTab).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: /首页.*总览收益、数据质量与当天优先事项/ }))
    expect(onChange).toHaveBeenCalledWith('home')
  })
})
