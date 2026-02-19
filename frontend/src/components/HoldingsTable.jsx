import { memo, useMemo, useState } from 'react'
import { Table, Tag, Tooltip, Button, Space, Badge, Checkbox, Dropdown, Pagination } from 'antd'
import {
  EditOutlined,
  AuditOutlined,
  SyncOutlined,
  CheckOutlined,
  CloseOutlined,
  MoreOutlined,
  SettingOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { SparklineMini } from './SparklineMini.jsx'
import { classBySign, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'

function DualValue({ top, bottom, topClass = '', bottomClass = '' }) {
  return (
    <div className="dual-value">
      <div className={`main ${topClass}`}>{top}</div>
      <div className={`sub ${bottomClass}`}>{bottom}</div>
    </div>
  )
}

// 默认列配置
const DEFAULT_VISIBLE_COLUMNS = [
  'name', 'sparkline', 'market_value_cny', 'shares', 'weight', 
  'holding_profit_cny', 'cost_basis_cny', 'day_profit_cny', 'action'
]

// 所有可用列定义
const ALL_COLUMNS = [
  { key: 'name', title: '基金', defaultVisible: true, fixed: 'left' },
  { key: 'sparkline', title: '走势', defaultVisible: true },
  { key: 'market_value_cny', title: '持有金额', defaultVisible: true },
  { key: 'shares', title: '持有份额', defaultVisible: true },
  { key: 'weight', title: '占比', defaultVisible: true },
  { key: 'holding_profit_cny', title: '持有收益', defaultVisible: true },
  { key: 'cost_basis_cny', title: '持仓成本', defaultVisible: true },
  { key: 'day_profit_cny', title: '当日收益', defaultVisible: true },
  { key: 'yesterday_profit_cny', title: '昨日收益', defaultVisible: false },
  { key: 'estimate_pct', title: '最新净值', defaultVisible: false },
  { key: 'holding_days', title: '持有天数', defaultVisible: false },
  { key: 'action', title: '操作', defaultVisible: true, fixed: 'right' }
]

export const HoldingsTable = memo(function HoldingsTable({
  title,
  rows,
  dateLabel,
  sortState,
  onSort,
  selectedFundId,
  onSelectFund,
  onNavigateToFund,
  sparklineMap,
  onSaveHolding,
  onOpenAudit,
  onAutoFillHolding,
  autoFillLoadingFundId,
  onQuickBuy,
  pagination = { pageSize: 20, showSizeChanger: true, showQuickJumper: true }
}) {
  const [editingId, setEditingId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(pagination.pageSize || 20)
  const [draft, setDraft] = useState({})
  const [hoveredRowId, setHoveredRowId] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    // 从localStorage读取用户偏好
    try {
      const saved = localStorage.getItem('holdings_table_columns')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_VISIBLE_COLUMNS
  })
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false)
  // 简洁模式 - 默认显示更少的列
  const [simpleMode, setSimpleMode] = useState(() => {
    try {
      const saved = localStorage.getItem('holdings_table_simple_mode')
      return saved !== 'false'
    } catch {}
    return true // 默认启用简洁模式
  })

  // 简洁模式列 - 只显示核心列
  const SIMPLE_COLUMNS = ['name', 'market_value_cny', 'holding_profit_cny', 'day_profit_cny', 'action']

  // 切换简洁/详细模式
  const toggleSimpleMode = () => {
    const newMode = !simpleMode
    setSimpleMode(newMode)
    try {
      localStorage.setItem('holdings_table_simple_mode', String(newMode))
    } catch {}
    // 简洁模式下自动切换到默认列
    if (newMode) {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    }
  }
  
  const totalMarket = useMemo(() => rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0), [rows])
  const dateSuffix = dateLabel && dateLabel !== '--' ? `(${dateLabel})` : ''

  const beginEdit = (row) => {
    setEditingId(row.fund_id)
    setDraft({
      market_value_cny: row.market_value_cny,
      shares: row.shares,
      cost_basis_cny: row.cost_basis_cny,
      start_date: row.start_date ? String(row.start_date).slice(0, 10) : ''
    })
  }

  const cancelEdit = () => {
    setEditingId('')
    setDraft({})
  }

  const submitEdit = async (fundId) => {
    const ok = await onSaveHolding(fundId, {
      market_value_cny: Number(draft.market_value_cny),
      shares: Number(draft.shares),
      cost_basis_cny: Number(draft.cost_basis_cny),
      start_date: draft.start_date
    })
    if (ok) {
      cancelEdit()
    }
  }

  const handleAutoFill = (row) => {
    if (onAutoFillHolding) {
      onAutoFillHolding(row)
    }
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => {
      const next = prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
      // 保存到localStorage
      try {
        localStorage.setItem('holdings_table_columns', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const resetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    try {
      localStorage.setItem('holdings_table_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
    } catch {}
  }

  // 状态标签配置
  const statusConfig = {
    confirmed: { color: 'success', text: '已更新', dot: true },
    partial: { color: 'warning', text: '数据不完整', dot: true },
    estimating: { color: 'processing', text: '估算中', dot: true }
  }

  // 列定义映射
  const columnDefinitions = {
    name: {
      title: '基金',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      fixed: 'left',
      render: (_, record) => {
        const config = statusConfig[record.confirm_state] || { color: 'default', text: '--', dot: false }
        return (
          <div className="fund-cell">
            <div 
              className="fund-name" 
              title={record.name}
              style={{ 
                cursor: onNavigateToFund ? 'pointer' : 'default',
                color: onNavigateToFund ? '#4361ee' : 'inherit',
                textDecoration: onNavigateToFund ? 'none' : 'inherit'
              }}
              onClick={(e) => {
                if (onNavigateToFund) {
                  e.stopPropagation()
                  onNavigateToFund(record.fund_id)
                }
              }}
              onMouseEnter={(e) => {
                if (onNavigateToFund) {
                  e.currentTarget.style.textDecoration = 'underline'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none'
              }}
            >
              {record.name}
            </div>
            <div className="fund-meta">
              <span className="fund-code">{record.fund_id}</span>
              <Tag 
                color={config.color}
                className={`status-tag status-${record.confirm_state}`}
              >
                {config.text}
              </Tag>
            </div>
          </div>
        )
      },
      width: 200
    },
    sparkline: {
      title: '走势',
      dataIndex: 'sparkline',
      key: 'sparkline',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div className="sparkline-cell">
          <SparklineMini points={sparklineMap[record.fund_id] || []} />
        </div>
      )
    },
    market_value_cny: {
      title: '持有金额',
      dataIndex: 'market_value_cny',
      key: 'market_value_cny',
      sorter: true,
      align: 'right',
      render: (value, record) => {
        if (editingId === record.fund_id) {
          return (
            <input
              className="table-input"
              type="number"
              value={draft.market_value_cny}
              onChange={(e) => setDraft((prev) => ({ ...prev, market_value_cny: e.target.value }))}
              placeholder="金额"
            />
          )
        }
        return (
          <span className="numeric-value" title={formatMoney(value)}>
            {formatMoney(value)}
          </span>
        )
      },
      width: 110
    },
    shares: {
      title: '持有份额',
      dataIndex: 'shares',
      key: 'shares',
      align: 'right',
      render: (value, record) => {
        if (editingId === record.fund_id) {
          return (
            <input
              className="table-input"
              type="number"
              value={draft.shares}
              onChange={(e) => setDraft((prev) => ({ ...prev, shares: e.target.value }))}
              placeholder="份额"
            />
          )
        }
        // 份额为0时显示"--"
        const displayValue = Number(value) === 0 ? '--' : formatMoney(value, 2)
        return (
          <span className="numeric-value" title={Number(value) === 0 ? '无份额' : formatMoney(value, 2)}>
            {displayValue}
          </span>
        )
      },
      width: 100
    },
    weight: {
      title: '占比',
      dataIndex: 'weight',
      key: 'weight',
      align: 'right',
      render: (_, record) => {
        const weight = totalMarket > 0 ? (record.market_value_cny / totalMarket) * 100 : 0
        return (
          <div className="weight-cell">
            <span className="weight-value">{formatPercent(weight)}</span>
            <div className="weight-bar">
              <div 
                className="weight-bar-fill" 
                style={{ width: `${Math.min(weight, 100)}%` }}
              />
            </div>
          </div>
        )
      },
      width: 80
    },
    holding_profit_cny: {
      title: `持有收益${dateSuffix}`,
      dataIndex: 'holding_profit_cny',
      key: 'holding_profit_cny',
      sorter: true,
      align: 'right',
      render: (_, record) => (
        <DualValue
          top={formatSignedMoney(record.holding_profit_cny)}
          bottom={formatPercent(record.holding_profit_rate)}
          topClass={classBySign(record.holding_profit_cny)}
          bottomClass={classBySign(record.holding_profit_rate)}
        />
      ),
      width: 120
    },
    cost_basis_cny: {
      title: '持仓成本',
      dataIndex: 'cost_basis_cny',
      key: 'cost_basis_cny',
      align: 'right',
      render: (value, record) => {
        if (editingId === record.fund_id) {
          return (
            <input
              className="table-input"
              type="number"
              value={draft.cost_basis_cny}
              onChange={(e) => setDraft((prev) => ({ ...prev, cost_basis_cny: e.target.value }))}
              placeholder="成本"
            />
          )
        }
        return (
          <span className="numeric-value" title={formatMoney(value)}>
            {formatMoney(value)}
          </span>
        )
      },
      width: 100
    },
    day_profit_cny: {
      title: `当日收益${dateSuffix}`,
      dataIndex: 'day_profit_cny',
      key: 'day_profit_cny',
      sorter: true,
      align: 'right',
      render: (_, record) => (
        <span className={`numeric-value ${classBySign(record.day_profit_cny)}`}>
          {formatSignedMoney(record.day_profit_cny)}
        </span>
      ),
      width: 100
    },
    yesterday_profit_cny: {
      title: '昨日收益',
      dataIndex: 'yesterday_profit_cny',
      key: 'yesterday_profit_cny',
      align: 'right',
      render: (_, record) => (
        <span className={`numeric-value ${classBySign(record.yesterday_profit_cny)}`}>
          {formatSignedMoney(record.yesterday_profit_cny)}
        </span>
      ),
      width: 90
    },
    estimate_pct: {
      title: '最新净值',
      dataIndex: 'estimate_pct',
      key: 'estimate_pct',
      align: 'right',
      render: (_, record) => (
        <Tooltip title={`净值: ${record.latest_nav ? record.latest_nav.toFixed(4) : '--'}`}>
          <DualValue
            top={formatPercent(record.estimate_pct)}
            bottom={record.latest_nav ? record.latest_nav.toFixed(4) : '--'}
            topClass={classBySign(record.estimate_pct)}
          />
        </Tooltip>
      ),
      width: 100
    },
    holding_days: {
      title: '持有天数',
      dataIndex: 'holding_days',
      key: 'holding_days',
      sorter: true,
      align: 'right',
      render: (_, record) => {
        const startDateText = record.start_date ? String(record.start_date).slice(0, 10) : '--'
        if (editingId === record.fund_id) {
          return (
            <input
              type="date"
              className="table-input date-input"
              value={draft.start_date}
              onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
            />
          )
        }
        return (
          <Tooltip title={`建仓日期: ${startDateText}`}>
            <DualValue
              top={record.holding_days === '--' ? '--' : `${record.holding_days}天`}
              bottom={startDateText}
            />
          </Tooltip>
        )
      },
      width: 110
    },
    action: {
      title: '操作',
      key: 'action',
      align: 'center',
      fixed: 'right',
      width: onQuickBuy ? 180 : 140,
      render: (_, record) => {
        const autoFilling = String(autoFillLoadingFundId || '') === String(record.fund_id)
        const isHovered = hoveredRowId === record.fund_id
        const isSelected = selectedFundId === record.fund_id

        if (editingId === record.fund_id) {
          return (
            <Space size="small" className="action-btns editing">
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                aria-label="保存"
                onClick={() => submitEdit(record.fund_id)}
                className="action-btn-save"
              >
                保存
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                aria-label="取消"
                onClick={cancelEdit}
                className="action-btn-cancel"
              >
                取消
              </Button>
            </Space>
          )
        }

        return (
          <Space size="small" className={`action-btns ${isHovered || isSelected ? 'visible' : ''}`}>
            {onQuickBuy && (
              <Tooltip title="快速买入">
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label="买入"
                  onClick={() => onQuickBuy(record)}
                  className="action-btn-buy"
                  style={{ background: 'var(--vc-brand-primary)', borderColor: 'var(--vc-brand-primary)' }}
                >
                  买入
                </Button>
              </Tooltip>
            )}
            <Tooltip title="编辑持仓">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label="编辑"
                onClick={() => beginEdit(record)}
                className="action-btn-edit"
              />
            </Tooltip>
            <Tooltip title="审计日志">
              <Button
                type="text"
                size="small"
                icon={<AuditOutlined />}
                aria-label="审计"
                onClick={() => onOpenAudit(record.fund_id)}
                className="action-btn-audit"
              />
            </Tooltip>
            <Tooltip title="自动补全">
              <Button
                type="text"
                size="small"
                icon={<SyncOutlined spin={autoFilling} />}
                aria-label="自动补全"
                onClick={() => handleAutoFill(record)}
                loading={autoFilling}
                className="action-btn-autofill"
              />
            </Tooltip>
          </Space>
        )
      }
    }
  }

  // 构建当前显示的列
  const columns = useMemo(() => {
    return visibleColumns
      .map(key => columnDefinitions[key])
      .filter(Boolean)
  }, [visibleColumns, dateSuffix, editingId, draft, totalMarket, hoveredRowId, selectedFundId, autoFillLoadingFundId])

  // 列选择器菜单
  const columnSelectorMenu = (
    <div style={{ padding: '12px', maxWidth: '200px' }}>
      <div style={{ marginBottom: '8px', fontWeight: 500, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
        选择显示列
      </div>
      {ALL_COLUMNS.map(col => (
        <div key={col.key} style={{ marginBottom: '4px' }}>
          <Checkbox
            checked={visibleColumns.includes(col.key)}
            onChange={() => toggleColumn(col.key)}
            disabled={col.key === 'name' || col.key === 'action'} // 基金和操作列必须显示
          >
            {col.title}
          </Checkbox>
        </div>
      ))}
      <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
        <Button size="small" onClick={resetColumns} block>重置默认</Button>
      </div>
    </div>
  )

  // 计算分页数据
  const paginatedRows = useMemo(() => {
    if (!pagination) return rows
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, currentPage, pageSize, pagination])

  // 分页变化处理
  const handlePageChange = (page, size) => {
    setCurrentPage(page)
    setPageSize(size)
  }

  return (
    <section className="panel holdings-section">
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{title}</h2>
          <span>此表格显示基金持仓列表，包含基金名称、走势、持有金额、持有份额、占比、收益等信息。点击行可选中基金，点击编辑按钮可修改持仓数据。</span>
        </div>
        <Space>
          {/* 简洁/详细模式切换 */}
          <Button
            size="small"
            type={simpleMode ? 'primary' : 'default'}
            onClick={toggleSimpleMode}
          >
            {simpleMode ? '简洁' : '详细'}
          </Button>
          {/* 列设置 - 仅在详细模式显示 */}
          {!simpleMode && (
            <Dropdown
              overlay={columnSelectorMenu}
              trigger={['click']}
              open={columnSelectorOpen}
              onOpenChange={setColumnSelectorOpen}
              placement="bottomRight"
            >
              <Button icon={<SettingOutlined />} size="small">
                列设置
              </Button>
            </Dropdown>
          )}
        </Space>
      </div>

      <Table
        rowKey="fund_id"
        dataSource={paginatedRows}
        columns={columns}
        pagination={pagination ? {
          current: currentPage,
          pageSize: pageSize,
          total: rows.length,
          onChange: handlePageChange,
          showSizeChanger: pagination.showSizeChanger,
          showQuickJumper: pagination.showQuickJumper,
          showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          size: 'small'
        } : false}
        size="small"
        scroll={{ x: 'max-content' }}
        rowClassName={(record) => {
          const isSelected = String(selectedFundId) === String(record.fund_id)
          return isSelected ? 'row-selected' : ''
        }}
        onRow={(record) => ({
          onClick: () => onSelectFund(record.fund_id),
          onMouseEnter: () => setHoveredRowId(record.fund_id),
          onMouseLeave: () => setHoveredRowId(null),
          style: { cursor: 'pointer' }
        })}
      />
    </section>
  )
})
