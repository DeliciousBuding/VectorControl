import { useEffect, useMemo, useState } from 'react'
import {
  fetchEstimate,
  fetchMe,
  fetchSettings,
  loginUser,
  logoutUser,
  registerUser,
  saveSettings,
  setStoredToken,
  getStoredToken
} from './api.js'

const 日内时刻 = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00']

const 默认设置 = {
  display: {
    font_scale: 'large',
    filter_mode: 'all',
    sort_mode: 'market_value_desc',
    group_order: 'cn_first',
    auto_select_fund: true
  },
  notifications: {
    feishu: {
      enabled: false,
      webhook_url: '',
      advice_time: '14:50',
      report_time: '15:10'
    },
    email: {
      enabled: false,
      smtp_host: '',
      smtp_port: 587,
      sender: '',
      recipients: '',
      use_tls: true
    }
  }
}

const 状态样式映射 = {
  info: '状态提示 信息',
  success: '状态提示 成功',
  warning: '状态提示 警告',
  error: '状态提示 错误'
}

const 过滤项 = [
  { key: 'all', label: '全部' },
  { key: 'up', label: '仅上涨' },
  { key: 'down', label: '仅下跌' },
  { key: 'abnormal', label: '仅异常' }
]

const 排序项 = [
  { key: 'market_value_desc', label: '按市值（高到低）' },
  { key: 'day_profit_desc', label: '按今日收益（高到低）' },
  { key: 'holding_profit_desc', label: '按持有收益（高到低）' },
  { key: 'estimate_desc', label: '按涨跌幅（高到低）' },
  { key: 'name_asc', label: '按名称（A-Z）' }
]

const 格式化时间 = () => new Date().toLocaleString('zh-CN', { hour12: false })

const 数值化 = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const 金额格式化 = (value) => {
  const num = 数值化(value)
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const 百分比格式化 = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  const num = Number(value)
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

const 收益格式化 = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  const num = Number(value)
  return `${num > 0 ? '+' : ''}${金额格式化(num)}`
}

const 计算种子 = (text) => {
  const raw = String(text || '')
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 33 + raw.charCodeAt(i)) % 100000
  }
  return hash / 1201
}

const 合并对象 = (base, incoming) => {
  if (!incoming || typeof incoming !== 'object') return base
  const result = { ...base }
  Object.entries(incoming).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object') {
      result[key] = 合并对象(result[key], value)
    } else {
      result[key] = value
    }
  })
  return result
}

const 构造波形 = (基准涨跌幅, seed = 1, 幅度 = 0.3) => {
  const base = Number.isFinite(Number(基准涨跌幅)) ? Number(基准涨跌幅) : 0
  const raw = 日内时刻.map((label, index) => {
    const progress = index / (日内时刻.length - 1)
    const drift = (progress - 0.5) * base * 0.36
    const swing = Math.sin((index + 1) * 1.17 + seed) * 幅度
    const swing2 = Math.cos((index + 1) * 0.68 + seed * 0.61) * 幅度 * 0.52
    return { label, value: base * 0.6 + drift + swing + swing2 }
  })

  const tail = raw[raw.length - 1]?.value ?? 0
  const delta = base - tail
  return raw.map((point, index) => {
    const progress = index / (raw.length - 1)
    return {
      label: point.label,
      value: Number((point.value + delta * progress).toFixed(3))
    }
  })
}

const 波形图 = ({ data, color, areaColor }) => {
  if (!Array.isArray(data) || data.length < 2) {
    return <div className="图占位">暂无波形数据</div>
  }

  const width = 760
  const height = 220
  const padding = 18
  const values = data.map((d) => Number(d.value))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const gap = Math.max(max - min, 0.3)

  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((item.value - min) / gap) * (height - padding * 2)
    return { ...item, x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`

  return (
    <div className="图容器">
      <svg viewBox={`0 0 ${width} ${height}`} className="波形图" role="img" aria-label="收益波形图">
        <defs>
          <linearGradient id={`渐变-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaColor} stopOpacity="0.82" />
            <stop offset="100%" stopColor={areaColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#渐变-${color.replace('#', '')})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="图刻度">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [status, setStatus] = useState({ type: 'info', message: '请先登录' })
  const [lastRefresh, setLastRefresh] = useState('--')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [selectedFundId, setSelectedFundId] = useState('')

  const [settings, setSettings] = useState(默认设置)
  const [settingsDraft, setSettingsDraft] = useState(默认设置)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const [filterMode, setFilterMode] = useState('all')
  const [sortMode, setSortMode] = useState('market_value_desc')

  const 应用设置 = (nextSettings) => {
    setFilterMode(nextSettings.display.filter_mode || 'all')
    setSortMode(nextSettings.display.sort_mode || 'market_value_desc')
  }

  const 加载设置 = async () => {
    const payload = await fetchSettings()
    const merged = 合并对象(默认设置, payload?.settings || {})
    setSettings(merged)
    setSettingsDraft(merged)
    应用设置(merged)
    return merged
  }

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return

    ;(async () => {
      try {
        const me = await fetchMe()
        setUser(me.user)
        await 加载设置()
        setStatus({ type: 'success', message: `欢迎回来，${me.user.username}` })
        await 刷新数据()
      } catch {
        setStoredToken('')
        setUser(null)
        setStatus({ type: 'warning', message: '会话失效，请重新登录' })
      }
    })()
  }, [])

  const 提交认证 = async () => {
    if (!username.trim() || !password.trim()) {
      setStatus({ type: 'warning', message: '请输入用户名和密码' })
      return
    }

    setAuthLoading(true)
    try {
      const payload = { username: username.trim(), password: password.trim() }
      const response = authMode === 'register' ? await registerUser(payload) : await loginUser(payload)
      setStoredToken(response.token)
      setUser(response.user)
      setPassword('')
      await 加载设置()
      setStatus({ type: 'success', message: `${authMode === 'register' ? '注册' : '登录'}成功` })
      await 刷新数据()
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || '认证失败' })
    } finally {
      setAuthLoading(false)
    }
  }

  const 退出登录 = async () => {
    try {
      await logoutUser()
    } catch {
      // ignore
    }
    setStoredToken('')
    setUser(null)
    setRows([])
    setSelectedFundId('')
    setSettings(默认设置)
    setSettingsDraft(默认设置)
    setSettingsOpen(false)
    应用设置(默认设置)
    setStatus({ type: 'info', message: '已退出登录' })
  }

  const 刷新数据 = async () => {
    if (!user && !getStoredToken()) {
      setStatus({ type: 'warning', message: '请先登录后再刷新' })
      return
    }

    setStatus({ type: 'info', message: '正在拉取持仓估值...' })
    try {
      const payload = await fetchEstimate()
      if (!Array.isArray(payload?.funds)) {
        throw new Error('返回数据缺少持仓列表')
      }

      const normalized = payload.funds.map((item) => {
        const marketValue = 数值化(item.market_value_cny)
        const estimatePct =
          item.estimate_pct === null || item.estimate_pct === undefined
            ? null
            : Number(item.estimate_pct)

        return {
          fund_id: item.fund_id || '--',
          name: item.name || '未命名基金',
          market_value_cny: marketValue,
          cost_basis_cny: 数值化(item.cost_basis_cny),
          holding_profit_cny: Number.isFinite(Number(item.holding_profit_cny))
            ? Number(item.holding_profit_cny)
            : marketValue - 数值化(item.cost_basis_cny),
          estimate_pct: estimatePct,
          day_profit_cny: estimatePct === null ? null : (marketValue * estimatePct) / 100,
          source: item.source || '未知来源',
          status: item.status || 'failed',
          reason: item.reason || '',
          market_group: item.market_group || 'cn_hk'
        }
      })

      setRows(normalized)
      setLastRefresh(格式化时间())
      if ((settings.display.auto_select_fund ?? true) && (!selectedFundId || !normalized.some((row) => row.fund_id === selectedFundId))) {
        setSelectedFundId(normalized[0]?.fund_id || '')
      }

      const failed = normalized.filter((row) => row.status !== 'ok').length
      if (failed > 0) {
        setStatus({ type: 'warning', message: `刷新成功，但有 ${failed} 只基金估值异常` })
      } else {
        setStatus({ type: 'success', message: '刷新成功' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || '刷新失败' })
    }
  }

  const filteredRows = useMemo(() => {
    let result = [...rows]

    const keyword = search.trim().toLowerCase()
    if (keyword) {
      result = result.filter((row) => row.name.toLowerCase().includes(keyword) || row.fund_id.toLowerCase().includes(keyword))
    }

    if (filterMode === 'up') {
      result = result.filter((row) => Number(row.estimate_pct) > 0)
    } else if (filterMode === 'down') {
      result = result.filter((row) => Number(row.estimate_pct) < 0)
    } else if (filterMode === 'abnormal') {
      result = result.filter((row) => row.status !== 'ok')
    }

    const sortBy = sortMode || 'market_value_desc'
    result.sort((a, b) => {
      if (sortBy === 'market_value_desc') return b.market_value_cny - a.market_value_cny
      if (sortBy === 'day_profit_desc') return 数值化(b.day_profit_cny) - 数值化(a.day_profit_cny)
      if (sortBy === 'holding_profit_desc') return b.holding_profit_cny - a.holding_profit_cny
      if (sortBy === 'estimate_desc') return 数值化(b.estimate_pct, -999) - 数值化(a.estimate_pct, -999)
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'zh-Hans-CN')
      return 0
    })

    return result
  }, [rows, search, filterMode, sortMode])

  const 国内持仓 = useMemo(() => filteredRows.filter((row) => row.market_group !== 'us_overseas'), [filteredRows])
  const 美股持仓 = useMemo(() => filteredRows.filter((row) => row.market_group === 'us_overseas'), [filteredRows])

  const 汇总 = useMemo(() => {
    return {
      totalMarket: filteredRows.reduce((sum, row) => sum + row.market_value_cny, 0),
      totalDay: filteredRows.reduce((sum, row) => sum + (row.day_profit_cny ?? 0), 0),
      totalHold: filteredRows.reduce((sum, row) => sum + row.holding_profit_cny, 0),
      count: filteredRows.length
    }
  }, [filteredRows])

  const 总体涨跌幅 = useMemo(() => {
    const valid = filteredRows.filter((row) => row.estimate_pct !== null)
    if (!valid.length) return 0
    const totalWeight = valid.reduce((sum, row) => sum + row.market_value_cny, 0)
    if (totalWeight <= 0) return 0
    return valid.reduce((sum, row) => sum + row.market_value_cny * row.estimate_pct, 0) / totalWeight
  }, [filteredRows])

  const 当前基金 = useMemo(
    () => filteredRows.find((row) => row.fund_id === selectedFundId) || filteredRows[0] || null,
    [filteredRows, selectedFundId]
  )

  const 总波形 = useMemo(() => 构造波形(总体涨跌幅, 8.2, 0.24), [总体涨跌幅])
  const 单基金波形 = useMemo(() => {
    if (!当前基金) return []
    return 构造波形(当前基金.estimate_pct ?? 0, 计算种子(当前基金.fund_id), 0.32)
  }, [当前基金])

  const 设置展示字段 = (key, value) => {
    setSettingsDraft((prev) => ({
      ...prev,
      display: {
        ...prev.display,
        [key]: value
      }
    }))
  }

  const 设置飞书字段 = (key, value) => {
    setSettingsDraft((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        feishu: {
          ...prev.notifications.feishu,
          [key]: value
        }
      }
    }))
  }

  const 设置邮箱字段 = (key, value) => {
    setSettingsDraft((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        email: {
          ...prev.notifications.email,
          [key]: value
        }
      }
    }))
  }

  const 保存设置 = async () => {
    setSettingsSaving(true)
    try {
      const response = await saveSettings({ settings: settingsDraft })
      const merged = 合并对象(默认设置, response?.settings || settingsDraft)
      setSettings(merged)
      setSettingsDraft(merged)
      应用设置(merged)
      setStatus({ type: 'success', message: '设置已保存（按用户隔离）' })
      setSettingsOpen(false)
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || '设置保存失败' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const 渲染表格 = (title, data) => (
    <section className="持仓板块" key={title}>
      <div className="持仓板块头部">
        <h3>{title}</h3>
        <span>{data.length} 只基金</span>
      </div>
      <div className="表格滚动">
        <table className="持仓表格">
          <thead>
            <tr>
              <th>基金</th>
              <th>当前市值</th>
              <th>今日涨跌</th>
              <th>今日估算收益</th>
              <th>持有收益</th>
              <th>成本</th>
              <th>数据状态</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const dayClass = row.day_profit_cny > 0 ? '红色' : row.day_profit_cny < 0 ? '绿色' : ''
              const holdClass = row.holding_profit_cny > 0 ? '红色' : row.holding_profit_cny < 0 ? '绿色' : ''
              const pctClass = row.estimate_pct > 0 ? '红色' : row.estimate_pct < 0 ? '绿色' : ''

              return (
                <tr key={row.fund_id}>
                  <td>
                    <div className="基金名">{row.name}</div>
                    <div className="基金代码">代码：{row.fund_id}</div>
                  </td>
                  <td>{金额格式化(row.market_value_cny)}</td>
                  <td className={pctClass}>{百分比格式化(row.estimate_pct)}</td>
                  <td className={dayClass}>{收益格式化(row.day_profit_cny)}</td>
                  <td className={holdClass}>{收益格式化(row.holding_profit_cny)}</td>
                  <td>{金额格式化(row.cost_basis_cny)}</td>
                  <td>
                    {row.status === 'ok' ? (
                      <span className="状态正常">正常（{row.source}）</span>
                    ) : (
                      <span className="状态异常">异常：{row.reason || '估值缺失'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {!data.length && (
              <tr>
                <td colSpan={7} className="空行">
                  当前分类下暂无基金
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const 板块顺序 = settings.display.group_order === 'us_first'
    ? [
        { key: 'us', title: '美股与海外（QDII）', data: 美股持仓 },
        { key: 'cn', title: '国内与港股', data: 国内持仓 }
      ]
    : [
        { key: 'cn', title: '国内与港股（优先展示）', data: 国内持仓 },
        { key: 'us', title: '美股与海外（QDII）', data: 美股持仓 }
      ]

  return (
    <div className={`页面 字号-${settings.display.font_scale || 'large'}`}>
      <header className="顶部栏">
        <div>
          <div className="主标题">VectorControl</div>
          <div className="副标题">多用户持仓总览 · 手动刷新 · 波形分析</div>
        </div>
        <label className="搜索框">
          <span>搜索</span>
          <input
            type="text"
            placeholder="输入基金名称或代码"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!user}
          />
        </label>
      </header>

      <section className="控制区">
        <div className="控制左">
          <div className="标题">用户登录与数据隔离</div>
          <div className="说明">每个用户拥有独立持仓、快照、执行记录与个人设置。</div>
        </div>

        {!user ? (
          <div className="认证区">
            <div className="认证模式">
              <button type="button" className={authMode === 'login' ? '' : '次按钮'} onClick={() => setAuthMode('login')}>登录</button>
              <button type="button" className={authMode === 'register' ? '' : '次按钮'} onClick={() => setAuthMode('register')}>注册</button>
            </div>
            <input type="text" placeholder="用户名（至少 3 位）" value={username} onChange={(event) => setUsername(event.target.value)} />
            <input type="password" placeholder="密码（至少 6 位）" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" onClick={提交认证} disabled={authLoading}>{authLoading ? '处理中...' : authMode === 'register' ? '注册并登录' : '立即登录'}</button>
          </div>
        ) : (
          <div className="登录态区">
            <div className="登录态文案">当前用户：{user.username}</div>
            <div className="登录态操作">
              <button type="button" onClick={刷新数据}>刷新数据</button>
              <button type="button" className="次按钮" onClick={() => setSettingsOpen((v) => !v)}>{settingsOpen ? '收起设置' : '设置中心'}</button>
              <button type="button" className="次按钮" onClick={退出登录}>退出登录</button>
            </div>
          </div>
        )}

        <div className={状态样式映射[status.type] || 状态样式映射.info}>状态：{status.message}</div>
        <div className="刷新时间">上次刷新：{lastRefresh}</div>
      </section>

      {user && settingsOpen && (
        <section className="设置区">
          <div className="设置标题">个人设置（按用户隔离）</div>
          <div className="设置网格">
            <article className="设置卡">
              <h4>显示与交互</h4>
              <label>
                字体大小
                <select value={settingsDraft.display.font_scale} onChange={(e) => 设置展示字段('font_scale', e.target.value)}>
                  <option value="medium">中</option>
                  <option value="large">大</option>
                  <option value="xlarge">特大</option>
                </select>
              </label>
              <label>
                默认筛选
                <select value={settingsDraft.display.filter_mode} onChange={(e) => 设置展示字段('filter_mode', e.target.value)}>
                  {过滤项.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                默认排序
                <select value={settingsDraft.display.sort_mode} onChange={(e) => 设置展示字段('sort_mode', e.target.value)}>
                  {排序项.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                板块顺序
                <select value={settingsDraft.display.group_order} onChange={(e) => 设置展示字段('group_order', e.target.value)}>
                  <option value="cn_first">国内在上，美股在下</option>
                  <option value="us_first">美股在上，国内在下</option>
                </select>
              </label>
              <label className="复选">
                <input
                  type="checkbox"
                  checked={Boolean(settingsDraft.display.auto_select_fund)}
                  onChange={(e) => 设置展示字段('auto_select_fund', e.target.checked)}
                />
                刷新后自动定位到首只基金
              </label>
            </article>

            <article className="设置卡">
              <h4>飞书推送（预留）</h4>
              <label className="复选">
                <input
                  type="checkbox"
                  checked={Boolean(settingsDraft.notifications.feishu.enabled)}
                  onChange={(e) => 设置飞书字段('enabled', e.target.checked)}
                />
                启用飞书推送（后端调度接入后生效）
              </label>
              <label>
                Webhook 地址
                <input
                  type="text"
                  value={settingsDraft.notifications.feishu.webhook_url}
                  onChange={(e) => 设置飞书字段('webhook_url', e.target.value)}
                  placeholder="https://open.feishu.cn/..."
                />
              </label>
              <label>
                预判推送时间
                <input
                  type="time"
                  value={settingsDraft.notifications.feishu.advice_time}
                  onChange={(e) => 设置飞书字段('advice_time', e.target.value)}
                />
              </label>
              <label>
                复盘推送时间
                <input
                  type="time"
                  value={settingsDraft.notifications.feishu.report_time}
                  onChange={(e) => 设置飞书字段('report_time', e.target.value)}
                />
              </label>
            </article>

            <article className="设置卡">
              <h4>邮件推送（预留）</h4>
              <label className="复选">
                <input
                  type="checkbox"
                  checked={Boolean(settingsDraft.notifications.email.enabled)}
                  onChange={(e) => 设置邮箱字段('enabled', e.target.checked)}
                />
                启用邮件推送（后端发送器接入后生效）
              </label>
              <label>
                SMTP 主机
                <input type="text" value={settingsDraft.notifications.email.smtp_host} onChange={(e) => 设置邮箱字段('smtp_host', e.target.value)} placeholder="smtp.example.com" />
              </label>
              <label>
                SMTP 端口
                <input type="number" value={settingsDraft.notifications.email.smtp_port} onChange={(e) => 设置邮箱字段('smtp_port', Number(e.target.value) || 0)} />
              </label>
              <label>
                发件人
                <input type="text" value={settingsDraft.notifications.email.sender} onChange={(e) => 设置邮箱字段('sender', e.target.value)} placeholder="no-reply@example.com" />
              </label>
              <label>
                收件人（逗号分隔）
                <input type="text" value={settingsDraft.notifications.email.recipients} onChange={(e) => 设置邮箱字段('recipients', e.target.value)} placeholder="a@x.com,b@y.com" />
              </label>
              <label className="复选">
                <input type="checkbox" checked={Boolean(settingsDraft.notifications.email.use_tls)} onChange={(e) => 设置邮箱字段('use_tls', e.target.checked)} />
                使用 TLS
              </label>
            </article>
          </div>
          <div className="设置操作">
            <button type="button" onClick={保存设置} disabled={settingsSaving}>{settingsSaving ? '保存中...' : '保存设置'}</button>
            <button type="button" className="次按钮" onClick={() => { setSettingsDraft(settings); setSettingsOpen(false) }}>取消</button>
          </div>
        </section>
      )}

      <section className="工具区">
        <div className="过滤组">
          {过滤项.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filterMode === item.key ? '' : '次按钮'}
              onClick={() => setFilterMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="排序控件">
          排序方式
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            {排序项.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="摘要区">
        <article>
          <h4>总持仓市值</h4>
          <p>{金额格式化(汇总.totalMarket)}</p>
        </article>
        <article>
          <h4>今日估算收益</h4>
          <p className={汇总.totalDay > 0 ? '红色' : 汇总.totalDay < 0 ? '绿色' : ''}>{收益格式化(汇总.totalDay)}</p>
        </article>
        <article>
          <h4>持有累计收益</h4>
          <p className={汇总.totalHold > 0 ? '红色' : 汇总.totalHold < 0 ? '绿色' : ''}>{收益格式化(汇总.totalHold)}</p>
        </article>
        <article>
          <h4>持仓基金数量</h4>
          <p>{汇总.count} 只</p>
        </article>
      </section>

      <section className="图表区">
        <article className="图卡">
          <div className="图卡头">
            <h3>总持仓波形图（市值加权）</h3>
            <span>{百分比格式化(总体涨跌幅)}</span>
          </div>
          <波形图 data={总波形} color="#2563eb" areaColor="#93c5fd" />
        </article>
        <article className="图卡">
          <div className="图卡头">
            <h3>单基金波形图</h3>
            <select value={当前基金?.fund_id || ''} onChange={(event) => setSelectedFundId(event.target.value)}>
              {filteredRows.map((item) => (
                <option key={item.fund_id} value={item.fund_id}>
                  {item.name}（{item.fund_id}）
                </option>
              ))}
            </select>
          </div>
          <div className="单基金信息">
            <strong>{当前基金?.name || '暂无基金'}</strong>
            <span>{当前基金 ? `当前估算涨跌：${百分比格式化(当前基金.estimate_pct)}` : '--'}</span>
          </div>
          <波形图 data={单基金波形} color="#0f766e" areaColor="#99f6e4" />
        </article>
      </section>

      <section className="持仓总区">
        <div className="持仓标题">全部持仓基金与今日收益变化</div>
        {板块顺序.map((item) => 渲染表格(item.title, item.data))}
      </section>
    </div>
  )
}

export default App