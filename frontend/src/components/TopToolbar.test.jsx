import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TopToolbar } from './TopToolbar.jsx'

describe('TopToolbar', () => {
  it('渲染工作台标题、上下文条并可展开状态看板', async () => {
    render(
      <TopToolbar
        user={{ username: 'admin' }}
        status={{ type: 'success', message: 'ok' }}
        refreshing={false}
        lastRefresh="2026-03-08T02:10:00+08:00"
        asof="2026-03-08T02:05:00+08:00"
        confirmState="confirmed"
        coverage={{ ok: 3, total: 4 }}
        refreshElapsedMs={28}
        estimateCacheHit
        incrementalMode="snapshot_hit"
        incrementalReusedQuotes={3}
        incrementalFetchedQuotes={0}
        dataStatus={{ status: 'confirmed', note: '估值已确认' }}
        searchQuery=""
        suggestions={[]}
        searchLoading={false}
        onSearchChange={vi.fn()}
        onPickSuggestion={vi.fn()}
        autoRefreshEnabled
        onRefresh={vi.fn()}
        onToggleAutoRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onLogout={vi.fn()}
        marketDataHint="市场数据稳定"
      />
    )

    expect(screen.getByText('持仓决策台')).toBeInTheDocument()
    expect(screen.getByText(/覆盖率/)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '首页上下文' })).toBeInTheDocument()
    expect(screen.getByText('市场数据稳定')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /状态/ }))

    expect(await screen.findByText('系统状态看板')).toBeInTheDocument()
    fireEvent.click(screen.getByText('展开高级信息'))
    expect(await screen.findByText('计算指标')).toBeInTheDocument()
  })
})
