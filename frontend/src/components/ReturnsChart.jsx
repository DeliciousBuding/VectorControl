import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { fetchCumulativeReturns } from '../api.js'
import { classBySign, formatPercent } from '../utils/format.js'
import { Segmented, Spin } from 'antd'

const TIME_RANGES = [
  { key: '7', label: '7天' },
  { key: '30', label: '30天' },
  { key: '90', label: '90天' },
  { key: '180', label: '全部' },
]

export function ReturnsChart({ user }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchCumulativeReturns(days)
      .then((payload) => {
        setData(payload)
      })
      .catch((err) => {
        setError(err.message || '加载失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user, days])

  if (!user) {
    return (
      <div className="panel home-main">
         <div className="chart-empty">请先登录查看收益曲线</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="panel home-main">
        <div className="section-head">
          <h2>收益曲线</h2>
        </div>
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="加载中..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel home-main">
        <div className="chart-empty">
           <p className="chart-error">{error}</p>
        </div>
      </div>
    )
  }

  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <div className="panel home-main">
        <div className="chart-empty">暂无历史收益数据</div>
      </div>
    )
  }

  const lastReturn = data.values[data.values.length - 1] || 0
  const isPositive = lastReturn >= 0
  
  // ECharts 配置
  const getOption = () => {
    const lineColor = isPositive ? '#52c41a' : '#ff4d4f'
    const areaColor = {
      type: 'linear',
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: isPositive ? 'rgba(82, 196, 26, 0.3)' : 'rgba(255, 77, 79, 0.3)' },
        { offset: 1, color: isPositive ? 'rgba(82, 196, 26, 0.05)' : 'rgba(255, 77, 79, 0.05)' }
      ]
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        },
        formatter: function(params) {
          const tooltipParams = params.find(p => p.seriesName === '累计收益率')
          if (tooltipParams) {
            return `${tooltipParams.axisValue}<br/>收益率: ${formatPercent(tooltipParams.value)}`
          }
          return ''
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.labels,
        axisLine: {
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        axisLabel: {
          color: '#666',
          formatter: (value) => {
            const date = new Date(value)
            return `${date.getMonth() + 1}/${date.getDate()}`
          },
          interval: 'auto'
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value) => `${value.toFixed(1)}%`,
          color: '#666'
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 0
        }
      ],
      series: [
        {
          name: '累计收益率',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: lineColor,
            width: 2
          },
          areaStyle: {
            color: areaColor
          },
          data: data.values,
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: 0,
                lineStyle: {
                  color: '#999',
                  type: 'dashed',
                  width: 1
                }
              }
            ]
          }
        }
      ]
    }
  }

  return (
    <div className="panel home-main">
      <div className="section-head">
        <div>
          <h2>收益曲线</h2>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
             累计: <span className={classBySign(lastReturn)}>{formatPercent(lastReturn)}</span>
          </span>
        </div>
        <div className="plan-actions">
          <Segmented
            options={TIME_RANGES.map(range => ({ label: range.label, value: Number(range.key) }))}
            value={days}
            onChange={(value) => setDays(value)}
          />
        </div>
      </div>

      <div style={{ height: '260px' }}>
        <ReactECharts 
          option={getOption()} 
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
      {data?.data_status?.note && (
        <div className="chart-hint" style={{ textAlign: 'center', marginTop: 8 }}>
          {data.data_status.note}
        </div>
      )}
    </div>
  )
}
