import { useEffect, useMemo, useState } from 'react'
import { fetchEstimate, fetchMe, loginUser, logoutUser, registerUser, setStoredToken, getStoredToken } from './api.js'

const 日内时刻 = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00']

const 状态样式映射 = {
  info: '状态提示 信息',
  success: '状态提示 成功',
  warning: '状态提示 警告',
  error: '状态提示 错误'
}

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

  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      return
    }

    ;(async () => {
      try {
        const me = await fetchMe()
        setUser(me.user)
        setStatus({ type: 'success', message: `欢迎回来，${me.user.username}` })
        await 刷新数据()
      } catch {
        setStoredToken('')
        setUser(null)
        setStatus({ type: 'warning', message: '会话已失效，请重新登录' })
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

      const normalized = payload.funds
        .map((item) => {
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
        .sort((a, b) => b.market_value_cny - a.market_value_cny)

      setRows(normalized)
      setLastRefresh(格式化时间())
      if (!selectedFundId || !normalized.some((row) => row.fund_id === selectedFundId)) {
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
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(keyword) || row.fund_id.toLowerCase().includes(keyword))
  }, [rows, search])

  const 国内持仓 = useMemo(
    () => filteredRows.filter((row) => row.market_group !== 'us_overseas'),
    [filteredRows]
  )
  const 美股持仓 = useMemo(
    () => filteredRows.filter((row) => row.market_group === 'us_overseas'),
    [filteredRows]
  )

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

  return (
    <div className="页面">
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
          <div className="说明">每个用户拥有独立持仓快照、动作记录与日报数据。</div>
        </div>

        {!user ? (
          <div className="认证区">
            <div className="认证模式">
              <button type="button" className={authMode === 'login' ? '' : '次按钮'} onClick={() => setAuthMode('login')}>
                登录
              </button>
              <button type="button" className={authMode === 'register' ? '' : '次按钮'} onClick={() => setAuthMode('register')}>
                注册
              </button>
            </div>
            <input
              type="text"
              placeholder="用户名（至少 3 位）"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <input
              type="password"
              placeholder="密码（至少 6 位）"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="button" onClick={提交认证} disabled={authLoading}>
              {authLoading ? '处理中...' : authMode === 'register' ? '注册并登录' : '立即登录'}
            </button>
          </div>
        ) : (
          <div className="登录态区">
            <div className="登录态文案">当前用户：{user.username}</div>
            <div className="登录态操作">
              <button type="button" onClick={刷新数据}>刷新数据</button>
              <button type="button" className="次按钮" onClick={退出登录}>退出登录</button>
            </div>
          </div>
        )}

        <div className={状态样式映射[status.type] || 状态样式映射.info}>状态：{status.message}</div>
        <div className="刷新时间">上次刷新：{lastRefresh}</div>
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
        {渲染表格('国内与港股（优先展示）', 国内持仓)}
        {渲染表格('美股与海外（QDII）', 美股持仓)}
      </section>
    </div>
  )
}

export default App