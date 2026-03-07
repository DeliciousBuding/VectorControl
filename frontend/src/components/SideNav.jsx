import { useState, useEffect, useCallback } from 'react'
import { 
  HomeOutlined, 
  FundOutlined, 
  TransactionOutlined, 
  PieChartOutlined, 
  UserOutlined,
  MenuOutlined,
  CloseOutlined
} from '@ant-design/icons'

// 导航项配置
const NAV_ITEMS = [
  { key: 'home', icon: HomeOutlined, label: '首页' },
  { key: 'watch', icon: FundOutlined, label: '自选' },
  { key: 'trade', icon: TransactionOutlined, label: '交易' },
  { key: 'holdings', icon: PieChartOutlined, label: '持仓' },
  { key: 'profile', icon: UserOutlined, label: '我的' }
]

// 品牌 Logo 组件
function BrandLogo({ collapsed = false }) {
  return (
    <div className="sidenav-brand">
      <div className="sidenav-brand-logo">
        <span className="sidenav-brand-text">VC</span>
      </div>
      {!collapsed && (
        <span className="sidenav-brand-name">VectorControl</span>
      )}
    </div>
  )
}

// 自定义导航项组件
function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon
  
  return (
    <div
      className={`sidenav-item ${isActive ? 'sidenav-item--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="sidenav-item__indicator" />
      <div className="sidenav-item__icon">
        <Icon />
      </div>
      <span className="sidenav-item__label">{item.label}</span>
    </div>
  )
}

// 桌面端侧边栏
function DesktopSider({ active, onChange }) {
  return (
    <aside className="sidenav-desktop" style={{ width: 240 }}>
      <BrandLogo />
      <nav className="sidenav-nav">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            isActive={active === item.key}
            onClick={() => onChange(item.key)}
          />
        ))}
      </nav>
    </aside>
  )
}

// 移动端抽屉导航
function MobileDrawer({ active, onChange, visible, onClose }) {
  const handleItemClick = useCallback((key) => {
    onChange(key)
    onClose()
  }, [onChange, onClose])

  return (
    <>
      {/* 遮罩层动画 */}
      <div 
        className={`sidenav-overlay ${visible ? 'sidenav-overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* 抽屉主体 */}
      <aside className={`sidenav-mobile ${visible ? 'sidenav-mobile--open' : ''}`}>
        <div className="sidenav-mobile__header">
          <BrandLogo />
          <button 
            className="sidenav-mobile__close"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <CloseOutlined />
          </button>
        </div>
        <nav className="sidenav-nav sidenav-nav--mobile">
          {NAV_ITEMS.map((item, index) => (
            <div
              key={item.key}
              className={`sidenav-item ${active === item.key ? 'sidenav-item--active' : ''}`}
              onClick={() => handleItemClick(item.key)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="sidenav-item__indicator" />
              <div className="sidenav-item__icon">
                <item.icon />
              </div>
              <span className="sidenav-item__label">{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

// 移动端顶部栏
function MobileHeader({ onMenuClick }) {
  return (
    <header className="sidenav-mobile-header">
      <div className="sidenav-mobile-header__brand">
        <div className="sidenav-brand-logo sidenav-brand-logo--small">
          <span className="sidenav-brand-text">VC</span>
        </div>
        <span className="sidenav-brand-name sidenav-brand-name--small">VectorControl</span>
      </div>
      <button 
        className="sidenav-mobile-header__menu-btn"
        onClick={onMenuClick}
        aria-label="打开菜单"
      >
        <MenuOutlined />
      </button>
    </header>
  )
}

// 主组件
export function SideNav({ active, onChange }) {
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 检测屏幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ESC 键关闭抽屉
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [drawerOpen])

  // 阻止抽屉打开时背景滚动
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  if (isMobile) {
    return (
      <>
        <MobileHeader onMenuClick={() => setDrawerOpen(true)} />
        <MobileDrawer
          active={active}
          onChange={onChange}
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </>
    )
  }

  return <DesktopSider active={active} onChange={onChange} />
}

// 为了保持向后兼容，导出原始的简单版本
export function SideNavLegacy({ active, onChange }) {
  return <DesktopSider active={active} onChange={onChange} />
}
