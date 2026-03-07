import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPanel } from './LoginPanel.jsx'

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn()
    }
  }
})

describe('LoginPanel', () => {
  it('默认展示登录态摘要与登录表单', () => {
    render(<LoginPanel loading={false} onSubmit={vi.fn()} />)

    expect(screen.getByText('Workspace Access')).toBeInTheDocument()
    expect(screen.getByText('进入 VectorControl')).toBeInTheDocument()
    const modeSwitch = screen.getByRole('tablist', { name: '登录模式切换' })
    expect(within(modeSwitch).getByRole('button', { name: /登\s*录/ })).toHaveClass('ant-btn-primary')
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument()
  })

  it('切换到注册态后更新标题并提交 register 模式', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<LoginPanel loading={false} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: /注\s*册/ }))

    expect(screen.getByText('创建你的工作区')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { target: { value: '  alice  ' } })
    fireEvent.change(screen.getByPlaceholderText('请输入密码（至少8位）'), { target: { value: '  password123  ' } })
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        username: 'alice',
        password: 'password123',
        mode: 'register'
      })
    })
  })
})
