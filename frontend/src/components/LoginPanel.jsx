import { useState } from 'react'

export function LoginPanel({ loading, onSubmit }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!username.trim() || !password.trim()) return
    await onSubmit({ username: username.trim(), password: password.trim(), mode })
    setPassword('')
  }

  return (
    <section className="panel login-panel">
      <h2>用户登录</h2>
      <p>登录后自动加载你的独立持仓与设置。</p>
      <div className="auth-mode">
        <button
          type="button"
          className={mode === 'login' ? 'primary' : 'ghost'}
          onClick={() => setMode('login')}
        >
          登录
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'primary' : 'ghost'}
          onClick={() => setMode('register')}
        >
          注册
        </button>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label>
          用户名
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" />
        </label>
        <button type="submit" disabled={loading} className="primary">
          {loading ? '提交中...' : mode === 'login' ? '立即登录' : '立即注册'}
        </button>
      </form>
    </section>
  )
}
