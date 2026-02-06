export function SortToggle({ active, order, onToggle }) {
  const upClass = active && order === 'asc' ? 'triangle active' : 'triangle'
  const downClass = active && order === 'desc' ? 'triangle active' : 'triangle'

  return (
    <button type="button" className="sort-toggle" onClick={onToggle} aria-label="切换排序">
      <span className={`${upClass} up`} />
      <span className={`${downClass} down`} />
    </button>
  )
}
