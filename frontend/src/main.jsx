import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx'
import './index.css'

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
