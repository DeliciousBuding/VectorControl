import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { fetchBenchmarkComparison } from '../api.js'
import { classBySign, formatPercent } from '../utils/format.js'
import { Spin, Alert } from 'antd'

// 基准名称映射
const BENCHMARK_NAMES = {
  hs300: '沪深300',
  zz500: '中证500',
  cyb50: '创业板50'
}

// 基准颜色映射
const BENCHMARK_COLORS = {
  hs300: '#5470c6',
  zz500: '#91cc75',
  cyb50: '#fac858'
}

export function BenchmarkComparison({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState('30d') // 默认 30 天

  useEffect(() => {
    if (!user) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchBenchmarkComparison()
      .then((payload) => {
        setData(payload)
      })
      .catch((err) => {
        setError(err.message || '加载失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user])

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">基准对比</h3>
        </div>
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="加载中..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded text-red-600 text-center">
        {error}
      </div>
    )
  }

  if (!data || !data.comparison) {
    return null
  }

  const { portfolio_return, comparison, best_benchmark } = data

  // ECharts 多折线图配置
  const getOption = () => {
    const series = [
      {
        name: '组合收益',
        type: 'line',
        data: data.portfolio_history || [],
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#722ed1',
          width: 3
        },
        itemStyle: {
          color: '#722ed1'
        }
      }
    ]

    // 添加各基准线
    Object.entries(comparison).forEach(([benchId, comp]) => {
      if (comp.history && comp.history.length > 0) {
        series.push({
          name: BENCHMARK_NAMES[benchId] || benchId,
          type: 'line',
          data: comp.history,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: BENCHMARK_COLORS[benchId] || '#999',
            width: 2,
            type: comp.excess_return > 0 ? 'solid' : 'dashed'
          },
          itemStyle: {
            color: BENCHMARK_COLORS[benchId] || '#999'
          }
        })
      }
    })

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
          let result = `${params[0]?.axisValue || ''}<br/>`
          params.forEach(param => {
            if (param.value !== undefined) {
              const color = param.color
              const marker = `<span style=\"display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${color};\"></span>`
              result += `${marker}${param.seriesName}: ${formatPercent(param.value)}<br/>`
            }
          })
          return result
        }
      },
      legend: {
        data: ['组合收益', ...Object.keys(comparison).map(k => BENCHMARK_NAMES[k] || k)],
        bottom: 0,
        textStyle: {
          fontSize: 12
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.dates || [],
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
          bottom: 25
        }
      ],
      series: series
    }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">基准对比</h3>
        <span className="text-xs text-gray-500">
          你的收益: <span className={`font-medium ${classBySign(portfolio_return)}`}>{formatPercent(portfolio_return)}</span>
        </span>
      </div>
      
      <div style={{ height: '250px' }}>
        <ReactECharts 
          option={getOption()} 
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>

      {/* 基准对比摘要卡片 */}
      <div className="grid grid-cols-3 gap-3 mt-3" style={{ marginTop: '12px' }}>
        {Object.entries(comparison).map(([benchId, comp]) => {
          const isBest = benchId === best_benchmark
          return (
            <div
              key={benchId}
              className={`p-3 rounded border ${
                isBest ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="text-xs text-gray-600 mb-1">
                {BENCHMARK_NAMES[benchId] || benchId}
                {isBest && <span className="ml-1 text-blue-600">★</span>}
              </div>
              <div className={`text-lg font-bold ${classBySign(comp.excess_return)}`}>
                {comp.excess_return >= 0 ? '+' : ''}{formatPercent(comp.excess_return)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {comp.outperform ? '跑赢' : '跑输'}基准
              </div>
            </div>
          )
        })}
      </div>

      {data?.data_status?.note && (
        <div className="text-xs text-gray-500 mt-3 text-center">
          {data.data_status.note}
        </div>
      )}
    </div>
  )
}
