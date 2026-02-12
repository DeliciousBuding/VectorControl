import { memo, useMemo, useState } from 'react'
import { Table, Tag, Tooltip, Button, Space, Badge } from 'antd'
import { 
  EditOutlined, 
  AuditOutlined, 
  SyncOutlined
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

  // 状态标签颜色映射
  const statusColorMap = {
    confirmed: 'success',
    partial: 'warning',
    estimating: 'processing'
  }

  // 状态文本映射
  const statusTextMap = {
    confirmed: '已更新',
    partial: '数据不完整',
    estimating: '估算中'
  }

  // 表格列定义
  const columns = [
    {
      title: '基金',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (_, record) => (
        <div>
          <div className="fund-name">{record.name}</div>
          <div className="fund-sub">
            <span className="fund-code">{record.fund_id}</span>
            <Tag color={statusColorMap[record.confirm_state] || 'default'}>
              {statusTextMap[record.confirm_state] || '--'}
            </Tag>
          </div>
        </div>
      ),
      width: 200
    },
    {
      title: '走势（近1月）',
      dataIndex: 'sparkline',
      key: 'sparkline',
      width: 120,
      render: (_, record) => (
        <SparklineMini points={sparklineMap[record.fund_id] || []} />
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
              style={{ width: '100px', textAlign: 'right' }}
              value={draft.market_value_cny}
              onChange={(e) => setDraft((prev) => ({ ...prev, market_value_cny: e.target.value }))}
            />
          )
        }
        return formatMoney(value)
      },
      width: 120
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
              style={{ width: '80px', textAlign: 'right' }}
              value={draft.shares}
              onChange={(e) => setDraft((prev) => ({ ...prev, shares: e.target.value }))}
            />
          )
        }
        return formatMoney(value, 2)
      },
      width: 100
    },
    {
      title: '持仓占比',
      dataIndex: 'weight',
      key: 'weight',
      align: 'right',
      render: (_, record) => {
        const weight = totalMarket > 0 ? (record.market_value_cny / totalMarket) * 100 : 0
        return formatPercent(weight)
      },
      width: 90
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
      width: 150
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
              style={{ width: '100px', textAlign: 'right' }}
              value={draft.cost_basis_cny}
              onChange={(e) => setDraft((prev) => ({ ...prev, cost_basis_cny: e.target.value }))}
            />
          )
        }
        return formatMoney(value)
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
        <span className={classBySign(record.day_profit_cny)}>
          {formatSignedMoney(record.day_profit_cny)}
        </span>
      ),
      width: 110
    },
    {
      title: '昨日收益',
      dataIndex: 'yesterday_profit_cny',
      key: 'yesterday_profit_cny',
      align: 'right',
      render: (_, record) => (
        <span className={classBySign(record.yesterday_profit_cny)}>
          {formatSignedMoney(record.yesterday_profit_cny)}
        </span>
      ),
      width: 100
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
      width: 120
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
              className="table-input"
              style={{ width: '120px', textAlign: 'right' }}
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
      width: 130
    },
    {
      title: '操作',
      key: 'action',
      align: 'right',
      fixed: 'right',
      width: 160,
      render: (_, record) => {
        const autoFilling = String(autoFillLoadingFundId || '') === String(record.fund_id)
        
        if (editingId === record.fund_id) {
          return (
            <Space>
              <Button type="link" size="small" onClick={() => submitEdit(record.fund_id)}>
                保存
              </Button>
              <Button type="link" size="small" danger onClick={cancelEdit}>
                取消
              </Button>
            </Space>
          )
        }

        return (
          <Space size="small">
            <Tooltip title="编辑持仓">
              <Button 
                type="link" 
                size="small" 
                icon={<EditOutlined />}
                onClick={() => beginEdit(record)}
              >
                编辑
              </Button>
            </Tooltip>
            <Tooltip title="自动补全基金信息">
              <Button 
                type="link" 
                size="small" 
                icon={autoFilling ? <SyncOutlined spin /> : <SyncOutlined />}
                loading={autoFilling}
                onClick={() => handleAutoFill(record)}
              >
                补全
              </Button>
            </Tooltip>
            <Tooltip title="查看持仓变更历史">
              <Button 
                type="link" 
                size="small" 
                icon={<AuditOutlined />}
                onClick={() => onOpenAudit?.(record.fund_id)}
              >
                审计
              </Button>
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
    return selectedFundId === record.fund_id ? 'row-selected' : ''
  }

  const onRowClick = (record) => {
    return {
      onClick: () => {
        if (editingId !== record.fund_id) {
          onSelectFund?.(record.fund_id)
        }
      }
    }
  }

  return (
    <section className="holdings-section">
      <div className="section-head">
        <h3>{title}</h3>
        <Badge count={rows.length} showZero style={{ backgroundColor: '#52c41a' }} />
      </div>
      <div className="table-wrap">
        <Table
          columns={columns}
          dataSource={rows.map((row) => ({ ...row, key: row.fund_id }))}
          pagination={false}
          size="small"
          scroll={{ x: 1500 }}
          bordered
          rowClassName={rowClassName}
          onRow={onRowClick}
          onChange={handleTableChange}
          locale={{
            emptyText: '暂无持仓数据'
          }}
        />
      </div>
    </section>
  )
})
