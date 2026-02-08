import { useMemo, useState } from 'react'
import { toGuidedError } from '../utils/errorFeedback.js'

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
      setErrorText(toGuidedError(error, mode === 'login' ? 'auth_login' : 'auth_register', '登录失败'))
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
