import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SurfaceState } from './SurfaceState.jsx'

describe('SurfaceState', () => {
  it('渲染标题、说明和提示文案', () => {
    render(
      <SurfaceState
        tone="error"
        title="加载失败"
        description="接口暂时不可用"
        hint="请稍后重试"
      />
    )

    expect(screen.getByLabelText('加载失败')).toBeInTheDocument()
    expect(screen.getByText('需要处理')).toBeInTheDocument()
    expect(screen.getByText('接口暂时不可用')).toBeInTheDocument()
    expect(screen.getByText('请稍后重试')).toBeInTheDocument()
  })
})
