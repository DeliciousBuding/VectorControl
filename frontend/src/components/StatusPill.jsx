export function StatusPill({ status }) {
  const level = status?.type || 'info'
  const text = status?.message || '等待操作'
  return <span className={`status-pill status-${level}`}>状态：{text}</span>
}
