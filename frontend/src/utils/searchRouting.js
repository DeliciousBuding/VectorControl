function decodePathSegment(segment) {
  try {
    return decodeURIComponent(String(segment || '')).trim()
  } catch {
    return String(segment || '').trim()
  }
}

export function isFundInHoldings(rows, fundId) {
  const target = String(fundId || '').trim()
  if (!target) return false
  if (!Array.isArray(rows)) return false
  return rows.some((row) => String(row?.fund_id || '').trim() === target)
}

export function resolveGlobalSearchTarget(rows, fundId) {
  return isFundInHoldings(rows, fundId) ? 'holdings' : 'fund_center'
}

export function createRouteState(pathname) {
  const path = String(pathname || '/')
  const fundDetailMatch = path.match(/^\/fund\/([^/]+)$/)
  if (fundDetailMatch) {
    return {
      view: 'fund-detail',
      activeTab: 'home',
      profileView: 'overview',
      detailFundId: decodePathSegment(fundDetailMatch[1]),
      fundCenterSelectedId: ''
    }
  }

  const fundCenterMatch = path.match(/^\/funds\/([^/]+)$/)
  if (fundCenterMatch) {
    return {
      view: 'home',
      activeTab: 'watch',
      profileView: 'overview',
      detailFundId: '',
      fundCenterSelectedId: decodePathSegment(fundCenterMatch[1])
    }
  }

  if (/^\/system\/status\/?$/.test(path)) {
    return {
      view: 'home',
      activeTab: 'profile',
      profileView: 'system-status',
      detailFundId: '',
      fundCenterSelectedId: ''
    }
  }

  return {
    view: 'home',
    activeTab: 'home',
    profileView: 'overview',
    detailFundId: '',
    fundCenterSelectedId: ''
  }
}

export function buildTabPath(tabKey, pathname = '/') {
  const currentPath = String(pathname || '/')
  if (tabKey === 'profile' && /^\/system\/status\/?$/.test(currentPath)) {
    return '/system/status'
  }
  if (tabKey === 'watch' && currentPath.startsWith('/funds/')) {
    return currentPath
  }
  return '/'
}
