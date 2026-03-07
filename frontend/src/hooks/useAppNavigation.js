import { useCallback, useEffect, useState } from 'react'
import { buildTabPath, createRouteState } from '../utils/searchRouting.js'

export function useAppNavigation({ onFundCenterRoute } = {}) {
  const [activeTab, setActiveTab] = useState('home')
  const [currentView, setCurrentView] = useState('home')
  const [detailFundId, setDetailFundId] = useState('')
  const [profileView, setProfileView] = useState('overview')

  const applyRouteState = useCallback((pathname) => {
    const nextRoute = createRouteState(pathname)
    setCurrentView(nextRoute.view)
    setDetailFundId(nextRoute.detailFundId)
    setActiveTab((prev) => (nextRoute.activeTab === 'home' ? prev : nextRoute.activeTab))
    setProfileView(nextRoute.profileView)
    if (nextRoute.fundCenterSelectedId) {
      onFundCenterRoute?.(nextRoute.fundCenterSelectedId)
    }
    return nextRoute
  }, [onFundCenterRoute])

  const navigate = useCallback((nextPath) => {
    const targetPath = String(nextPath || '/').trim() || '/'
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
    return applyRouteState(targetPath)
  }, [applyRouteState])

  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey)
    setCurrentView('home')
    if (tabKey !== 'profile') {
      setProfileView('overview')
    }
    navigate(buildTabPath(tabKey, window.location.pathname))
  }, [navigate])

  const navigateToFundDetail = useCallback((fundId) => {
    const nextPath = `/fund/${encodeURIComponent(fundId)}`
    navigate(nextPath)
    setCurrentView('fund-detail')
    setDetailFundId(fundId)
  }, [navigate])

  const navigateFromFundDetail = useCallback(() => {
    navigate('/')
    setCurrentView('home')
    setDetailFundId('')
  }, [navigate])

  const openSystemStatusView = useCallback(() => {
    setActiveTab('profile')
    setProfileView('system-status')
    navigate('/system/status')
  }, [navigate])

  const openProfileOverview = useCallback(() => {
    setProfileView('overview')
    navigate('/')
  }, [navigate])

  useEffect(() => {
    const handlePopState = () => {
      applyRouteState(window.location.pathname)
    }

    handlePopState()
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [applyRouteState])

  return {
    activeTab,
    currentView,
    detailFundId,
    profileView,
    setActiveTab,
    navigate,
    handleTabChange,
    navigateToFundDetail,
    navigateFromFundDetail,
    openSystemStatusView,
    openProfileOverview
  }
}
