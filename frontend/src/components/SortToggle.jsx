export function SortToggle({ active, order }) {
  const upClass = active && order === 'asc' ? 'triangle up active' : 'triangle up'
  const downClass = active && order === 'desc' ? 'triangle down active' : 'triangle down'

  return (
    <span className="sort-toggle" aria-hidden="true">
      <span className={upClass} />
      <span className={downClass} />
    </span>
  )
}
