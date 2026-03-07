import { useState, useEffect, useCallback } from 'react'
import { MenuOutlined, CloseOutlined } from '@ant-design/icons'
import { NAV_ITEMS, NAV_SECTIONS, findNavItem } from './navigationConfig.js'

// 品牌 Logo 组件
function BrandLogo({ collapsed = false }) {
  return (
    <div className="sidenav-brand">
      <div className="sidenav-brand-logo">
        <span className="sidenav-brand-text">VC</span>
      </div>
      {!collapsed && (
        <div className="sidenav-brand-copy">
          <span className="sidenav-brand-eyebrow">导航</span>
          <span className="sidenav-brand-name">VectorControl</span>
        </div>
      )}
    </div>
  )
}

// 自定义导航项组件
function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      className={`sidenav-item ${isActive ? 'sidenav-item--active' : ''}`}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="sidenav-item__indicator" />
      <div className="sidenav-item__icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="sidenav-item__content">
        <span className="sidenav-item__label">{item.label}</span>
        <span className="sidenav-item__hint">{item.description}</span>
      </div>
    </button>
  )
}

// 桌面端侧边栏
function DesktopSider({ active, onChange }) {
  const activeItem = findNavItem(active)
  return (
    <aside className="sidenav-desktop">
      <BrandLogo />
      <section className="sidenav-overview">
        <span className="sidenav-overview__eyebrow">当前工作区</span>
        <strong>{activeItem.label}</strong>
        <p>{activeItem.description}</p>
      </section>
      <nav className="sidenav-nav">
        {NAV_SECTIONS.map((section) => (
          <section key={section.key} className="sidenav-section">
            <span className="sidenav-section__label">{section.label}</span>
            <div className="sidenav-section__items">
              {NAV_ITEMS.filter((item) => item.section === section.key).map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  isActive={active === item.key}
                  onClick={() => onChange(item.key)}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>
      <footer className="sidenav-footer">
        <span className="sidenav-footer__label">导航体系</span>
        <p>统一工作台导航、分组层级与移动端入口。</p>
      </footer>
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
      <aside
        className={`sidenav-mobile ${visible ? 'sidenav-mobile--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="主导航菜单"
      >
        <div className="sidenav-mobile__header">
          <BrandLogo />
          <button
            type="button"
            className="sidenav-mobile__close"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <CloseOutlined />
          </button>
        </div>
        <nav className="sidenav-nav sidenav-nav--mobile">
          {NAV_SECTIONS.map((section) => (
            <section key={section.key} className="sidenav-section">
              <span className="sidenav-section__label">{section.label}</span>
              <div className="sidenav-section__items">
                {NAV_ITEMS.filter((item) => item.section === section.key).map((item, index) => (
                  <button
                    type="button"
                    key={item.key}
                    className={`sidenav-item ${active === item.key ? 'sidenav-item--active' : ''}`}
                    onClick={() => handleItemClick(item.key)}
                    style={{ animationDelay: `${index * 50}ms` }}
                    aria-current={active === item.key ? 'page' : undefined}
                  >
                    <div className="sidenav-item__indicator" />
                    <div className="sidenav-item__icon">
                      <item.icon aria-hidden="true" />
                    </div>
                    <div className="sidenav-item__content">
                      <span className="sidenav-item__label">{item.label}</span>
                      <span className="sidenav-item__hint">{item.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
    </>
  )
}

// 移动端顶部栏
function MobileHeader({ active, onMenuClick }) {
  const activeItem = findNavItem(active)
  return (
    <header className="sidenav-mobile-header">
      <div className="sidenav-mobile-header__brand">
        <div className="sidenav-brand-logo sidenav-brand-logo--small">
          <span className="sidenav-brand-text">VC</span>
        </div>
        <div className="sidenav-mobile-header__copy">
          <span className="sidenav-brand-name sidenav-brand-name--small">VectorControl</span>
          <span className="sidenav-mobile-header__active">{activeItem.label}</span>
        </div>
      </div>
      <button
        type="button"
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
        <MobileHeader active={active} onMenuClick={() => setDrawerOpen(true)} />
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
