import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SideNav } from './SideNav.jsx'

describe('SideNav', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200
    })
  })

  it('渲染分组导航并高亮当前工作区', () => {
    const onChange = vi.fn()
    render(<SideNav active="trade" onChange={onChange} />)

    const overview = screen.getByText('当前工作区').closest('section')
    const activeButton = screen.getByRole('button', {
      name: /交易.*处理买入、卖出、定投和流水执行记录/
    })

    expect(screen.getByText('当前工作区')).toBeInTheDocument()
    expect(overview).toHaveTextContent('交易')
    expect(screen.getByText('工作台')).toBeInTheDocument()
    expect(screen.getByText('账户')).toBeInTheDocument()
    expect(activeButton).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: /首页.*总览收益/ }))
    expect(onChange).toHaveBeenCalledWith('home')
  })
})
