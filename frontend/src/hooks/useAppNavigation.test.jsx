import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppNavigation } from './useAppNavigation.js'

describe('useAppNavigation', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('hydrates watch route from location and notifies fund center selection', async () => {
    const onFundCenterRoute = vi.fn()
    window.history.pushState({}, '', '/funds/013491')

    const { result } = renderHook(() => useAppNavigation({ onFundCenterRoute }))

    await waitFor(() => {
      expect(result.current.activeTab).toBe('watch')
    })

    expect(result.current.currentView).toBe('home')
    expect(result.current.detailFundId).toBe('')
    expect(result.current.profileView).toBe('overview')
    expect(onFundCenterRoute).toHaveBeenCalledWith('013491')
  })

  it('navigates between fund detail and profile state without rewriting unrelated tab behavior', async () => {
    const { result } = renderHook(() => useAppNavigation({ onFundCenterRoute: vi.fn() }))

    act(() => {
      result.current.setActiveTab('watch')
    })

    act(() => {
      result.current.navigateToFundDetail('110006')
    })

    expect(window.location.pathname).toBe('/fund/110006')
    expect(result.current.currentView).toBe('fund-detail')
    expect(result.current.detailFundId).toBe('110006')
    expect(result.current.activeTab).toBe('watch')

    act(() => {
      result.current.navigateFromFundDetail()
    })

    expect(window.location.pathname).toBe('/')
    expect(result.current.currentView).toBe('home')
    expect(result.current.detailFundId).toBe('')
    expect(result.current.activeTab).toBe('watch')

    act(() => {
      result.current.openSystemStatusView()
    })

    expect(window.location.pathname).toBe('/system/status')
    expect(result.current.activeTab).toBe('profile')
    expect(result.current.profileView).toBe('system-status')

    act(() => {
      result.current.openProfileOverview()
    })

    expect(window.location.pathname).toBe('/')
    expect(result.current.activeTab).toBe('profile')
    expect(result.current.profileView).toBe('overview')
  })

  it('responds to browser popstate updates', async () => {
    const onFundCenterRoute = vi.fn()
    const { result } = renderHook(() => useAppNavigation({ onFundCenterRoute }))

    act(() => {
      window.history.pushState({}, '', '/system/status')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await waitFor(() => {
      expect(result.current.activeTab).toBe('profile')
    })
    expect(result.current.profileView).toBe('system-status')

    act(() => {
      window.history.pushState({}, '', '/funds/110006')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await waitFor(() => {
      expect(result.current.activeTab).toBe('watch')
    })
    expect(onFundCenterRoute).toHaveBeenLastCalledWith('110006')
  })
})
