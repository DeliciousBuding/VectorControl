import {
  HomeOutlined,
  FundOutlined,
  TransactionOutlined,
  PieChartOutlined,
  UserOutlined
} from '@ant-design/icons'

export const NAV_ITEMS = [
  {
    key: 'home',
    icon: HomeOutlined,
    label: '首页',
    shortLabel: '首页',
    section: 'workspace',
    description: '总览收益、数据质量与当天优先事项'
  },
  {
    key: 'watch',
    icon: FundOutlined,
    label: '自选',
    shortLabel: '自选',
    section: 'workspace',
    description: '搜索基金、查看独立详情与净值历史'
  },
  {
    key: 'trade',
    icon: TransactionOutlined,
    label: '交易',
    shortLabel: '交易',
    section: 'workspace',
    description: '处理买入、卖出、定投和流水执行记录'
  },
  {
    key: 'holdings',
    icon: PieChartOutlined,
    label: '持仓',
    shortLabel: '持仓',
    section: 'workspace',
    description: '巡检持仓、审计变更并进入风险中心'
  },
  {
    key: 'profile',
    icon: UserOutlined,
    label: '我的',
    shortLabel: '我的',
    section: 'account',
    description: '查看账户资料、设置中心与系统状态'
  }
]

export const NAV_SECTIONS = [
  { key: 'workspace', label: '工作台' },
  { key: 'account', label: '账户' }
]

export function findNavItem(activeKey) {
  return NAV_ITEMS.find((item) => item.key === activeKey) || NAV_ITEMS[0]
}
