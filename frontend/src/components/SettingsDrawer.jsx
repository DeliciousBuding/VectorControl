import { useEffect, useState } from 'react'

export function SettingsDrawer({ open, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(settings)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  if (!open) return null

  const save = async () => {
    await onSave(draft)
    onClose()
  }

  return (
    <div className="settings-mask" onClick={onClose}>
      <section className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>设置中心</h3>
          <button type="button" className="ghost" onClick={onClose}>关闭</button>
        </header>

        <div className="settings-group">
          <h4>自动刷新</h4>
          <label>
            <span>是否开启</span>
            <input
              type="checkbox"
              checked={Boolean(draft?.display?.auto_refresh_enabled)}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_enabled: e.target.checked }
              }))}
            />
          </label>
          <label>
            <span>刷新间隔（秒）</span>
            <input
              type="number"
              min={15}
              max={600}
              value={draft?.display?.auto_refresh_seconds ?? 60}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_seconds: Number(e.target.value) || 60 }
              }))}
            />
          </label>
          <label>
            <span>页面不可见时暂停</span>
            <input
              type="checkbox"
              checked={Boolean(draft?.display?.auto_refresh_visible_only)}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                display: { ...prev.display, auto_refresh_visible_only: e.target.checked }
              }))}
            />
          </label>
        </div>

        <div className="settings-group">
          <h4>飞书机器人（预留）</h4>
          <label>
            <span>启用</span>
            <input
              type="checkbox"
              checked={Boolean(draft?.notifications?.feishu?.enabled)}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, enabled: e.target.checked }
                }
              }))}
            />
          </label>
          <label>
            <span>Webhook 地址</span>
            <input
              value={draft?.notifications?.feishu?.webhook_url || ''}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  feishu: { ...prev.notifications.feishu, webhook_url: e.target.value }
                }
              }))}
              placeholder="填入飞书机器人 Webhook"
            />
          </label>
        </div>

        <div className="settings-group">
          <h4>邮件推送（预留）</h4>
          <label>
            <span>启用</span>
            <input
              type="checkbox"
              checked={Boolean(draft?.notifications?.email?.enabled)}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email: { ...prev.notifications.email, enabled: e.target.checked }
                }
              }))}
            />
          </label>
          <label>
            <span>收件人</span>
            <input
              value={draft?.notifications?.email?.recipients || ''}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email: { ...prev.notifications.email, recipients: e.target.value }
                }
              }))}
              placeholder="多个邮箱使用逗号分隔"
            />
          </label>
        </div>

        <footer>
          <button type="button" className="primary" onClick={save}>保存设置</button>
        </footer>
      </section>
    </div>
  )
}
