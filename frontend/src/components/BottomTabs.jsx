const TABS = [
  { key: 'home', label: '首页' },
  { key: 'watch', label: '自选' },
  { key: 'trade', label: '交易' },
  { key: 'holdings', label: '持仓' },
  { key: 'profile', label: '我的' }
]

export function BottomTabs({ active, onChange }) {
  return (
    <nav className="panel bottom-tabs" aria-label="主导航">
      {TABS.map((tab) => (
        <button
          type="button"
          key={tab.key}
          className={active === tab.key ? 'primary' : 'ghost'}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

