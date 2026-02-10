import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { fetchCumulativeReturns } from '../api.js'
import { classBySign, formatPercent } from '../utils/format.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

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
      <div className="p-4 bg-gray-50 rounded text-center text-gray-500">
        请先登录查看收益曲线
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-48 bg-gray-100 rounded"></div>
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

  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded text-center text-gray-500">
        暂无历史收益数据
      </div>
    )
  }

  const lastReturn = data.values[data.values.length - 1] || 0
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: '累计收益率',
        data: data.values,
        borderColor: lastReturn >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: lastReturn >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: '基准线 (0%)',
        data: Array(data.values.length).fill(0),
        borderColor: 'rgb(156, 163, 175)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            if (context.datasetIndex === 0) {
              return `收益率: ${formatPercent(context.parsed.y)}`
            }
            return null
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => `${value.toFixed(1)}%`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-700">收益曲线</h3>
          <span className={`text-lg font-bold ${classBySign(lastReturn)}`}>
            {formatPercent(lastReturn)}
          </span>
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => setDays(Number(range.key))}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                days === Number(range.key)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: '200px' }}>
        <Line data={chartData} options={options} />
      </div>
      {data?.data_status?.note && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          {data.data_status.note}
        </div>
      )}
    </div>
  )
}
