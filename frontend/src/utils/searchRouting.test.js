import { describe, expect, it } from 'vitest'
import { buildTabPath, createRouteState, isFundInHoldings, resolveGlobalSearchTarget } from './searchRouting.js'

describe('searchRouting', () => {
  it('returns holdings when fund exists in rows', () => {
    const rows = [{ fund_id: '110006' }, { fund_id: '013491' }]
    expect(isFundInHoldings(rows, '110006')).toBe(true)
    expect(resolveGlobalSearchTarget(rows, '110006')).toBe('holdings')
  })

  it('returns fund_center when fund not in holdings', () => {
    const rows = [{ fund_id: '110006' }, { fund_id: '013491' }]
    expect(isFundInHoldings(rows, '990001')).toBe(false)
    expect(resolveGlobalSearchTarget(rows, '990001')).toBe('fund_center')
  })

  it('handles empty inputs safely', () => {
    expect(isFundInHoldings(null, '110006')).toBe(false)
    expect(isFundInHoldings([], '')).toBe(false)
    expect(resolveGlobalSearchTarget([], '110006')).toBe('fund_center')
  })

  it('parses fund detail, fund center and system status paths', () => {
    expect(createRouteState('/fund/110006')).toMatchObject({
      view: 'fund-detail',
      activeTab: 'home',
      detailFundId: '110006'
    })
    expect(createRouteState('/funds/013491')).toMatchObject({
      view: 'home',
      activeTab: 'watch',
      fundCenterSelectedId: '013491'
    })
    expect(createRouteState('/system/status')).toMatchObject({
      view: 'home',
      activeTab: 'profile',
      profileView: 'system-status'
    })
  })

  it('builds safe tab fallback paths', () => {
    expect(buildTabPath('watch', '/funds/110006')).toBe('/funds/110006')
    expect(buildTabPath('profile', '/system/status')).toBe('/system/status')
    expect(buildTabPath('home', '/fund/110006')).toBe('/')
  })
})

