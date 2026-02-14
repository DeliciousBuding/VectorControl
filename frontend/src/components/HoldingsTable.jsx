import { memo, useMemo, useState } from 'react'
import { Table, Tag, Tooltip, Button, Space, Badge } from 'antd'
import { 
  EditOutlined, 
  AuditOutlined, 
  SyncOutlined,
  CheckOutlined,
  CloseOutlined,
  MoreOutlined
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

export const HoldingsTable = memo(function HoldingsTable({
  title,
  rows,
  dateLabel,
  sortState,
  onSort,
  selectedFundId,
  onSelectFund,
  sparklineMap,
  onSaveHolding,
  onOpenAudit,
  onAutoFillHolding,
  autoFillLoadingFundId
}) {
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState({})
  const [hoveredRowId, setHoveredRowId] = useState(null)
  
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

  // 状态标签配置
  const statusConfig = {
    confirmed: { color: 'success', text: '已更新', dot: true },
    partial: { color: 'warning', text: '数据不完整', dot: true },
    estimating: { color: 'processing', text: '估算中', dot: true }
  }

  // 表格列定义
  const columns = [
    {
      title: '基金',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      fixed: 'left',
      render: (_, record) => {
        const config = statusConfig[record.confirm_state] || { color: 'default', text: '--', dot: false }
        return (
          <div className="fund-cell">
            <div className="fund-name" title={record.name}>{record.name}</div>
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
    {
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
    {
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
    {
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
        return (
          <span className="numeric-value" title={formatMoney(value, 2)}>
            {formatMoney(value, 2)}
          </span>
        )
      },
      width: 100
    },
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
      title: '操作',
      key: 'action',
      align: 'center',
      fixed: 'right',
      width: 140,
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
            <Tooltip title="编辑持仓">
              <Button 
                type="text"
                size="small" 
                icon={<EditOutlined />}
                aria-label="编辑"
                onClick={(e) => {
                  e.stopPropagation()
                  beginEdit(record)
                }}
                className="action-btn action-btn-primary"
              />
            </Tooltip>
            <Tooltip title="自动补全">
              <Button 
                type="text"
                size="small" 
                icon={autoFilling ? <SyncOutlined spin /> : <SyncOutlined />}
                aria-label="同步"
                loading={autoFilling}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAutoFill(record)
                }}
                className="action-btn action-btn-secondary"
              />
            </Tooltip>
            <Tooltip title="审计历史">
              <Button 
                type="text"
                size="small" 
                icon={<AuditOutlined />}
                aria-label="审计"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenAudit?.(record.fund_id)
                }}
                className="action-btn action-btn-secondary"
              />
            </Tooltip>
          </Space>
        )
      }
    }
  ]

  // 排序处理
  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter.field && onSort) {
      const order = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : 'desc'
      onSort(sorter.field)
    }
  }

  // 行选择配置
  const rowClassName = (record) => {
    const classes = ['holdings-table-row']
    if (selectedFundId === record.fund_id) classes.push('row-selected')
    if (editingId === record.fund_id) classes.push('row-editing')
    return classes.join(' ')
  }

  const onRow = (record) => {
    const isSelected = selectedFundId === record.fund_id
    return {
      onClick: () => {
        if (editingId !== record.fund_id) {
          onSelectFund?.(record.fund_id)
        }
      },
      onMouseEnter: () => setHoveredRowId(record.fund_id),
      onMouseLeave: () => setHoveredRowId(null),
      role: 'row',
      'aria-selected': isSelected,
      tabIndex: 0,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (editingId !== record.fund_id) {
            onSelectFund?.(record.fund_id)
          }
        }
      }
    }
  }

  return (
    <section className="holdings-section" aria-labelledby="holdings-title">
      <div className="section-head">
        <h3 className="section-title" id="holdings-title">{title}</h3>
        <Badge 
          count={rows.length} 
          showZero 
          className="count-badge"
          aria-label={`共 ${rows.length} 条持仓记录`}
        />
      </div>
      <div 
        className="table-container" 
        role="region" 
        aria-label="持仓数据表格区域"
        aria-describedby="holdings-desc"
      >
        <div id="holdings-desc" className="sr-only">
          此表格显示基金持仓列表，包含基金名称、走势、持有金额、持有份额、占比、收益等信息。点击行可选中基金，点击编辑按钮可修改持仓数据。
        </div>
        <Table
          columns={columns}
          dataSource={rows.map((row) => ({ ...row, key: row.fund_id }))}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          bordered={false}
          rowClassName={rowClassName}
          onRow={onRow}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <div className="empty-state" role="status" aria-live="polite" aria-label="暂无持仓数据">
                <div className="empty-icon" aria-hidden="true">📊</div>
                <div className="empty-text">暂无持仓数据</div>
              </div>
            )
          }}
          className="holdings-table"
          role="table"
          aria-label="持仓列表"
          aria-rowcount={rows.length}
        />
      </div>
    </section>
  )
})
