import { Layout, Menu } from 'antd'
import { 
  HomeOutlined, 
  FundOutlined, 
  TransactionOutlined, 
  PieChartOutlined, 
  UserOutlined 
} from '@ant-design/icons'

const { Sider } = Layout

export function SideNav({ active, onChange }) {
  const items = [
    { key: 'home', icon: <HomeOutlined />, label: '首页' },
    { key: 'watch', icon: <FundOutlined />, label: '自选' },
    { key: 'trade', icon: <TransactionOutlined />, label: '交易' },
    { key: 'holdings', icon: <PieChartOutlined />, label: '持仓' },
    { key: 'profile', icon: <UserOutlined />, label: '我的' }
  ]

  return (
    <Sider 
      width={220}
      theme="light"
      style={{
        borderRight: '1px solid #e2e8f0',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 100
      }}
      className="desktop-sider"
    >
      <div className="brand-logo-area" style={{ height: 64, display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4f46e5, #3730a3)', borderRadius: 8, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>VC</div>
        <span style={{ marginLeft: 12, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>VectorControl</span>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[active]}
        onClick={({ key }) => onChange(key)}
        items={items}
        style={{ borderRight: 0 }}
      />
    </Sider>
  )
}
