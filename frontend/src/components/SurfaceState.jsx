import {
  LoadingOutlined,
  InboxOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

const STATE_ICON_MAP = {
  loading: LoadingOutlined,
  empty: InboxOutlined,
  error: WarningOutlined,
  info: InfoCircleOutlined
}

const STATE_EYEBROW_MAP = {
  loading: '正在准备',
  empty: '暂无数据',
  error: '需要处理',
  info: '状态说明'
}

export function SurfaceState({
  tone = 'empty',
  title,
  description = '',
  hint = '',
  compact = false,
  children = null
}) {
  const Icon = STATE_ICON_MAP[tone] || InfoCircleOutlined
  const eyebrow = STATE_EYEBROW_MAP[tone] || STATE_EYEBROW_MAP.info

  return (
    <section
      className={`surface-state surface-state--${tone} ${compact ? 'surface-state--compact' : ''}`.trim()}
      aria-label={title || eyebrow}
    >
      <div className="surface-state__icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="surface-state__copy">
        <span className="surface-state__eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {hint ? <span className="surface-state__hint">{hint}</span> : null}
      </div>
      {children ? <div className="surface-state__actions">{children}</div> : null}
    </section>
  )
}
