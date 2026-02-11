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
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px 18px 56px'
    }}>
      <Card style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>用户登录</Title>
          <Text type="secondary" style={{ fontSize: 18, display: 'block', marginTop: 8 }}>
            登录后自动加载你的独立持仓与设置。
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Button
            type={mode === 'login' ? 'primary' : 'default'}
            onClick={() => switchMode('login')}
            style={{ flex: 1 }}
          >
            登录
          </Button>
          <Button
            type={mode === 'register' ? 'primary' : 'default'}
            onClick={() => switchMode('register')}
            style={{ flex: 1 }}
          >
            注册
          </Button>
        </div>

        <Form
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
            <div style={{ 
              color: '#b91c1c', 
              border: '1px solid #fecaca', 
              background: '#fef2f2', 
              borderRadius: 10, 
              padding: '9px 11px', 
              fontSize: 14,
              marginBottom: 12
            }}>
              {errorText}
            </div>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
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
