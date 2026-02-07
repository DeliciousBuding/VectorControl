import { useMemo, useState } from 'react'

function normalizeAuthMessage(raw) {
  const message = String(raw || '').trim()
  if (!message) return '登录失败，请稍后重试'
  if (message.includes('账号不存在')) return '账号不存在，请先注册'
  if (message.includes('密码错误')) return '密码错误，请重新输入'
  if (message.includes('用户名或密码错误')) return '账号或密码错误，请重新输入'
  if (message.includes('用户名已存在')) return '账号已存在，请直接登录'
  if (message.includes('请求过于频繁')) return message
  return message
}

export function LoginPanel({ loading, onSubmit }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const submitLabel = useMemo(() => {
    if (loading) return '提交中...'
    return mode === 'login' ? '立即登录' : '立即注册'
  }, [loading, mode])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setErrorText('')
    setSuccessText('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const cleanUsername = username.trim()
    const cleanPassword = password.trim()

    setErrorText('')
    setSuccessText('')

    if (!cleanUsername) {
      setErrorText('请输入用户名')
      return
    }
    if (!cleanPassword) {
      setErrorText('请输入密码')
      return
    }

    try {
      await onSubmit({ username: cleanUsername, password: cleanPassword, mode })
      setPassword('')
      setSuccessText(mode === 'login' ? '登录成功' : '注册成功，已自动登录')
    } catch (error) {
      setErrorText(normalizeAuthMessage(error?.message))
    }
  }

  return (
    <section className="panel login-panel">
      <h2>用户登录</h2>
      <p>登录后自动加载你的独立持仓与设置。</p>
      <div className="auth-mode">
        <button
          type="button"
          className={mode === 'login' ? 'primary' : 'ghost'}
          onClick={() => switchMode('login')}
        >
          登录
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'primary' : 'ghost'}
          onClick={() => switchMode('register')}
        >
          注册
        </button>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label>
          用户名
          <input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (errorText) setErrorText('')
              if (successText) setSuccessText('')
            }}
            placeholder="请输入用户名"
            autoComplete="username"
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errorText) setErrorText('')
              if (successText) setSuccessText('')
            }}
            placeholder="请输入密码"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {errorText && <div className="auth-message auth-message-error">{errorText}</div>}
        {successText && <div className="auth-message auth-message-success">{successText}</div>}
        <button type="submit" disabled={loading} className="primary">
          {submitLabel}
        </button>
      </form>
    </section>
  )
}