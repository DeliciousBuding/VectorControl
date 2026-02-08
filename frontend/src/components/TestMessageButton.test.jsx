import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TestMessageButton } from './TestMessageButton.jsx'

describe('TestMessageButton', () => {
  it('成功场景展示 trace_id', async () => {
    const onToast = vi.fn()
    const onSend = vi.fn().mockResolvedValue({ ok: true, sent: true, trace_id: 't100' })

    render(
      <TestMessageButton
        label="飞书"
        onSend={onSend}
        onToast={onToast}
        dataTestId="btn"
      />
    )

    fireEvent.click(screen.getByTestId('btn'))

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1)
    })
    expect(onToast).toHaveBeenCalledWith({
      type: 'success',
      message: expect.stringContaining('trace_id: t100')
    })
  })

  it('失败场景展示 category 与 message', async () => {
    const onToast = vi.fn()
    const onSend = vi.fn().mockResolvedValue({
      ok: false,
      sent: false,
      trace_id: 't200',
      error: { category: 'provider_error', message: 'invalid chat' }
    })

    render(
      <TestMessageButton
        label="Telegram"
        onSend={onSend}
        onToast={onToast}
        dataTestId="btn"
      />
    )

    fireEvent.click(screen.getByTestId('btn'))

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1)
    })
    expect(onToast.mock.calls[0][0]?.message || '').toContain('provider_error')
    expect(onToast.mock.calls[0][0]?.message || '').toContain('invalid chat')
    expect(onToast.mock.calls[0][0]?.message || '').toContain('trace_id: t200')
  })
})

