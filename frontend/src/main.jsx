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
    colorPrimary: '#4361ee',
    colorInfo: '#4361ee',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Button: { borderRadius: 8 },
    Card: { borderRadius: 12 },
    Input: { borderRadius: 8 },
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
