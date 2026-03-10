import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx'
import './index.css'

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.dataset.theme = 'light'
}

// 自动更新初始化（仅在 Capacitor 环境下生效）
if (typeof window !== 'undefined' && window.Capacitor) {
  import('./utils/autoUpdate').then(({ autoUpdate }) => {
    console.log('[VectorControl] Auto-update initialized')
  }).catch(() => {
    // 非 Capacitor 环境忽略
  })
}

const theme = {
  token: {
    colorPrimary: '#1f6b55',
    colorInfo: '#1f6b55',
    colorLink: '#1f6b55',
    colorSuccess: '#1d7a57',
    colorWarning: '#b68028',
    colorError: '#c94f3d',
    colorBgBase: '#fbf7ef',
    colorTextBase: '#11231b',
    colorBorder: '#d7d0c2',
    borderRadius: 18,
    fontFamily: "'Space Grotesk', 'Noto Sans SC', 'Segoe UI Variable', sans-serif",
  },
  components: {
    Button: { borderRadius: 16, controlHeight: 46 },
    Card: { borderRadius: 24 },
    Input: { borderRadius: 16, controlHeight: 48 },
  },
};

const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <ConfigProvider theme={theme} locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
