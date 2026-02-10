import { useEffect, useState } from 'react'
import { fetchBenchmarkComparison } from '../api.js'
import { classBySign, formatPercent } from '../utils/format.js'

export function BenchmarkComparison({ user }) {
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
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 rounded text-red-600 text-sm text-center">
        {error}
      </div>
    )
  }

  if (!data || !data.comparison) {
    return null
  }

  const { portfolio_return, comparison, best_benchmark } = data

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">基准对比</h3>
        <span className="text-xs text-gray-500">
          你的收益: <span className={`font-medium ${classBySign(portfolio_return)}`}>{formatPercent(portfolio_return)}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(comparison).map(([benchId, comp]) => {
          const isBest = benchId === best_benchmark
          const benchNames = {
            hs300: '沪深300',
            zz500: '中证500',
            cyb50: '创业板50',
          }

          return (
            <div
              key={benchId}
              className={`p-3 rounded border ${
                isBest ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="text-xs text-gray-600 mb-1">
                {benchNames[benchId] || benchId}
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
