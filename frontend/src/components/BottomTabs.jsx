import { NAV_ITEMS } from './navigationConfig.js'

export function BottomTabs({ active, onChange }) {
  return (
    <nav className="panel bottom-tabs" aria-label="主导航">
      {NAV_ITEMS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            type="button"
            key={tab.key}
            className={`bottom-tabs__item ${active === tab.key ? 'bottom-tabs__item--active' : ''}`}
            onClick={() => onChange(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            <span className="bottom-tabs__icon">
              <Icon aria-hidden="true" />
            </span>
            <span className="bottom-tabs__label">
              {tab.shortLabel}
              <span className="sr-only">{tab.description}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

