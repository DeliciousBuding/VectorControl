import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx'
import './index.css'

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
    colorPrimary: '#315efb',
    colorInfo: '#315efb',
    colorLink: '#315efb',
    colorSuccess: '#0f9f6e',
    colorWarning: '#c27b18',
    colorError: '#dc4c4c',
    borderRadius: 14,
    fontFamily: "'Segoe UI Variable', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    Button: { borderRadius: 12 },
    Card: { borderRadius: 18 },
    Input: { borderRadius: 12 },
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
