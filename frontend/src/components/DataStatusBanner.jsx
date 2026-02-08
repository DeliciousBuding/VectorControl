import { formatDateTime } from '../utils/format.js'

function statusText(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'confirmed') return '已确认'
  if (key === 'partial') return '部分可用'
  return '估算中'
}

export function DataStatusBanner({ title = '数据口径', dataStatus }) {
  if (!dataStatus || typeof dataStatus !== 'object') return null

  const status = String(dataStatus.status || 'estimating').toLowerCase()
  const asof = String(dataStatus.asof || '').trim()
  const note = String(dataStatus.note || '').trim()

  return (
    <div className={`data-status-banner data-status-${status}`} title={note || '暂无说明'}>
      <strong>{title}：{statusText(status)}</strong>
      <span>时点：{asof ? formatDateTime(asof) : '--'}</span>
      <span>{note || '暂无口径说明'}</span>
    </div>
  )
}
