export function SparklineMini({ points = [] }) {
  if (!Array.isArray(points) || points.length < 2) {
    return <div className="sparkline-empty">--</div>
  }

  const width = 96
  const height = 30
  const padding = 2
  const values = points.map((item) => Number(item.value || 0))
  const min = Math.min(...values, -0.2)
  const max = Math.max(...values, 0.2)
  const gap = Math.max(max - min, 0.25)

  const xAt = (index) => padding + (index / (points.length - 1)) * (width - padding * 2)
  const yAt = (value) => height - padding - ((value - min) / gap) * (height - padding * 2)

  const path = points
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(1)} ${yAt(item.value).toFixed(1)}`)
    .join(' ')
  const last = values[values.length - 1]
  const color = last >= 0 ? '#dc2626' : '#0f766e'
  const zeroY = yAt(0)

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="基金走势缩略图">
      <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeDasharray="3 2" strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
