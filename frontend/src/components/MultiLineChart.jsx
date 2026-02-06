export function MultiLineChart({
  data = [],
  lines = [],
  width = 860,
  height = 290,
  dashedKeys = [],
  yLabel = '收益率(%)'
}) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div className="chart-empty">暂无图表数据</div>
  }

  const padding = { top: 16, right: 16, bottom: 36, left: 46 }
  const keys = lines.map((line) => line.key)
  const values = []
  for (const row of data) {
    for (const key of keys) {
      const value = Number(row[key])
      if (Number.isFinite(value)) values.push(value)
    }
  }
  if (values.length === 0) {
    return <div className="chart-empty">暂无图表数据</div>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const gap = Math.max(max - min, 0.2)

  const xAt = (index) => padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right)
  const yAt = (value) => {
    return height - padding.bottom - ((value - min) / gap) * (height - padding.top - padding.bottom)
  }

  const ticksY = 5
  const yLines = Array.from({ length: ticksY }, (_, i) => {
    const rate = i / (ticksY - 1)
    const value = max - rate * gap
    return {
      y: yAt(value),
      value
    }
  })

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={yLabel}>
        {yLines.map((tick) => (
          <g key={tick.value}>
            <line x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="chart-y-label">
              {tick.value.toFixed(2)}
            </text>
          </g>
        ))}

        {lines.map((line) => {
          const path = data
            .map((row, index) => {
              const value = Number(row[line.key])
              const x = xAt(index)
              const y = yAt(Number.isFinite(value) ? value : 0)
              return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
            })
            .join(' ')

          return (
            <path
              key={line.key}
              d={path}
              fill="none"
              stroke={line.color}
              strokeWidth={line.width || 2}
              strokeDasharray={dashedKeys.includes(line.key) ? '6 4' : undefined}
              strokeLinecap="round"
            />
          )
        })}

        {data.map((row, index) => {
          const x = xAt(index)
          const show = index % Math.ceil(data.length / 6) === 0 || index === data.length - 1
          if (!show) return null
          return (
            <text key={`${row.label}-${index}`} x={x} y={height - 12} textAnchor="middle" className="chart-x-label">
              {row.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
