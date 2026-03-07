import { useMemo, useState } from 'react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { toGuidedError } from '../utils/errorFeedback.js'

const { Title, Text } = Typography

export function LoginPanel({ loading, onSubmit }) {
  const [form] = Form.useForm()
  const [mode, setMode] = useState('login')
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const submitLabel = useMemo(() => {
    if (loading) return '提交中...'
    return mode === 'login' ? '立即登录' : '立即注册'
  }, [loading, mode])
  const heroTitle = mode === 'login' ? '进入 VectorControl' : '创建你的工作区'
  const heroDescription = mode === 'login'
    ? '登录后自动恢复你的持仓、设置和风险工作台。'
    : '注册后立即创建独立账户空间，并自动进入控制台。'
  const overviewCards = [
    {
      key: 'workspace',
      label: '独立工作区',
      value: '持仓与设置隔离',
      hint: '每个账号都拥有独立的数据与配置上下文。'
    },
    {
      key: 'sync',
      label: '恢复体验',
      value: mode === 'login' ? '自动加载' : '自动开通',
      hint: mode === 'login' ? '登录后直接恢复你的最近使用状态。' : '注册成功后自动进入应用并完成初始化。'
    },
    {
      key: 'security',
      label: '会话安全',
      value: '最小暴露',
      hint: '认证错误会给出明确下一步，避免无反馈跳转。'
    }
  ]

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setErrorText('')
    setSuccessText('')
    form.resetFields()
  }

  const onFinish = async (values) => {
    const { username, password } = values
    setErrorText('')
    setSuccessText('')

    try {
      await onSubmit({ username: username.trim(), password: password.trim(), mode })
      message.success(mode === 'login' ? '登录成功' : '注册成功，已自动登录')
    } catch (error) {
      const errorMsg = toGuidedError(error, mode === 'login' ? 'auth_login' : 'auth_register', '登录失败')
      setErrorText(errorMsg)
      message.error(errorMsg)
    }
  }

  return (
    <div className="login-shell">
      <Card className="login-panel">
        <div className="login-panel__hero">
          <span className="login-panel__eyebrow">Workspace Access</span>
          <div className="login-panel__headline">
            <Title level={2}>{heroTitle}</Title>
            <Text>{heroDescription}</Text>
          </div>
          <section className="login-panel__overview" aria-label="认证入口概览">
            {overviewCards.map((card) => (
              <article key={card.key} className="login-panel__overview-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.hint}</p>
              </article>
            ))}
          </section>
        </div>

        <div className="login-panel__mode-switch" role="tablist" aria-label="登录模式切换">
          <Button
            type={mode === 'login' ? 'primary' : 'default'}
            onClick={() => switchMode('login')}
            className="login-panel__mode-btn"
          >
            登录
          </Button>
          <Button
            type={mode === 'register' ? 'primary' : 'default'}
            onClick={() => switchMode('register')}
            className="login-panel__mode-btn"
          >
            注册
          </Button>
        </div>

        <Form
          className="login-panel__form"
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 1, message: '用户名不能为空' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少需要8位字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码（至少8位）"
              size="large"
            />
          </Form.Item>

          {errorText && (
            <div className="auth-message auth-message-error">
              {errorText}
            </div>
          )}

          <Form.Item className="login-panel__submit">
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              size="large"
            >
              {submitLabel}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
