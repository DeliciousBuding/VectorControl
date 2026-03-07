import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiagnosticsPanel } from './DiagnosticsPanel.jsx'
import { apiFetch } from '../api.js'

vi.mock('../api.js', () => ({
  apiFetch: vi.fn()
}))

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('PROD', false)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(true) },
      configurable: true
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('开发环境下展示摘要头部与空态提示', () => {
    render(<DiagnosticsPanel />)

    expect(screen.getByLabelText('开发诊断面板')).toBeInTheDocument()
    expect(screen.getByText('Developer Snapshot')).toBeInTheDocument()
    expect(screen.getByText(/尚未拉取诊断文本/)).toBeInTheDocument()
  })

  it('可拉取并复制诊断文本', async () => {
    apiFetch.mockResolvedValue({
      diagnostic_text: 'DB Path: backend/data/app.db'
    })

    render(<DiagnosticsPanel />)

    fireEvent.click(screen.getByTestId('diagnostics-refresh-btn'))

    expect(await screen.findByTestId('diagnostics-content')).toHaveTextContent('DB Path: backend/data/app.db')

    fireEvent.click(screen.getByTestId('diagnostics-copy-btn'))

    await waitFor(() => {
      expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('DB Path: backend/data/app.db')
    })
    expect(screen.getByTestId('diagnostics-copy-btn')).toHaveTextContent('已复制')
  })

  it('生产环境下不渲染 dev-only 诊断面板', () => {
    vi.stubEnv('PROD', true)

    const { container } = render(<DiagnosticsPanel />)

    expect(container).toBeEmptyDOMElement()
  })
})
