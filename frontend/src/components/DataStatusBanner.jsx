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
  const label = statusText(status)

  return (
    <div className={`data-status-banner data-status-${status}`} title={note || '暂无说明'}>
      <div className="data-status-banner__lead">
        <span className="data-status-banner__eyebrow">数据口径</span>
        <strong>{title}</strong>
        <span className="data-status-banner__status">{label}</span>
      </div>
      <div className="data-status-banner__meta">
        <span className="data-status-banner__chip">
          <em>状态</em>
          <b>{label}</b>
        </span>
        <span className="data-status-banner__chip">
          <em>时点</em>
          <b>{asof ? formatDateTime(asof) : '--'}</b>
        </span>
        <span className="data-status-banner__chip data-status-banner__chip--note">
          <em>说明</em>
          <b>{note || '暂无口径说明'}</b>
        </span>
      </div>
    </div>
  )
}
