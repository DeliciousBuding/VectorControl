import { memo, useMemo, useRef, useEffect, useState } from 'react'
import { classBySign, formatMoney, formatPercent, formatSignedMoney } from '../utils/format.js'
import {
  WalletOutlined,
  RiseOutlined,
  FallOutlined,
  HistoryOutlined,
  AppstoreOutlined
} from '@ant-design/icons'

/**
 * 数字动画钩子 - 实现数字变化时的平滑过渡动画
 * @param {number} targetValue - 目标数值
 * @param {number} duration - 动画持续时间(ms)
 * @returns {number} 当前动画值
 */
function useAnimatedNumber(targetValue, duration = 600) {
  const [displayValue, setDisplayValue] = useState(targetValue)
  const previousValueRef = useRef(targetValue)
  const animationRef = useRef(null)

  useEffect(() => {
    const startValue = previousValueRef.current
    const endValue = targetValue
    const startTime = performance.now()

    // 如果值没有变化，直接返回
    if (startValue === endValue) {
      return
    }

    // 取消之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 使用 easeOutCubic 缓动函数
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)
      const currentValue = startValue + (endValue - startValue) * easeOutCubic

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        previousValueRef.current = endValue
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [targetValue, duration])

  return displayValue
}

/**
 * 单个摘要卡片组件
 */
const SummaryCard = memo(function SummaryCard({
  icon: Icon,
  kicker,
  title,
  value,
  formattedValue,
  subValue,
  formattedSubValue,
  note,
  variant = 'neutral',
  isLoading = false
}) {
  // 根据变体获取样式类名
  const getVariantClass = () => {
    switch (variant) {
      case 'positive':
        return 'summary-card--positive'
      case 'negative':
        return 'summary-card--negative'
      default:
        return 'summary-card--neutral'
    }
  }

  // 根据变体获取图标颜色
  const getIconColor = () => {
    switch (variant) {
      case 'positive':
        return 'var(--color-success)'
      case 'negative':
        return 'var(--color-error)'
      default:
        return 'var(--color-text-tertiary)'
    }
  }

  if (isLoading) {
    return (
      <article className="panel summary-card summary-skeleton">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-main" />
        <div className="skeleton-line skeleton-sub" />
      </article>
    )
  }

  return (
    <article className={`panel summary-card ${getVariantClass()}`}>
      <div className="summary-card__header">
        <div className="summary-card__title-wrap">
          <span className="summary-card__kicker">{kicker}</span>
          <h3>{title}</h3>
        </div>
        <span className="summary-card__icon-shell">
          <Icon
            className="summary-icon"
            style={{ color: getIconColor() }}
          />
        </span>
      </div>
      <div className="summary-card__body">
        <strong className={variant !== 'neutral' ? classBySign(value) : ''}>
          {formattedValue}
        </strong>
        {subValue !== undefined && (
          <span className={classBySign(subValue)}>{formattedSubValue}</span>
        )}
        {note && <p className="summary-card__note">{note}</p>}
      </div>
    </article>
  )
})

/**
 * 带动画的数字显示组件
 */
const AnimatedNumber = memo(function AnimatedNumber({
  value,
  formatter,
  className = ''
}) {
  const animatedValue = useAnimatedNumber(value)
  return <span className={className}>{formatter(animatedValue)}</span>
})

export const SummaryCards = memo(function SummaryCards({ rows = [], loading = false }) {
  // 计算汇总数据
  const { totalMarket, totalCost, totalHolding, totalDay, holdingRate } = useMemo(() => {
    const nextTotalMarket = rows.reduce((sum, item) => sum + Number(item.market_value_cny || 0), 0)
    const nextTotalCost = rows.reduce((sum, item) => sum + Number(item.cost_basis_cny || 0), 0)
    const nextTotalHolding = rows.reduce((sum, item) => sum + Number(item.holding_profit_cny || 0), 0)
    const nextTotalDay = rows.reduce((sum, item) => sum + Number(item.day_profit_cny || 0), 0)
    const nextHoldingRate = nextTotalCost > 0 ? (nextTotalHolding / nextTotalCost) * 100 : 0
    return {
      totalMarket: nextTotalMarket,
      totalCost: nextTotalCost,
      totalHolding: nextTotalHolding,
      totalDay: nextTotalDay,
      holdingRate: nextHoldingRate
    }
  }, [rows])

  // 确定收益卡片的变体状态
  const dayVariant = totalDay > 0 ? 'positive' : totalDay < 0 ? 'negative' : 'neutral'
  const holdingVariant = totalHolding > 0 ? 'positive' : totalHolding < 0 ? 'negative' : 'neutral'

  // 骨架屏加载状态
  if (loading && rows.length === 0) {
    return (
      <section className="summary-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={`skeleton-${index}`} className="panel summary-card summary-skeleton">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-main" />
            <div className="skeleton-line skeleton-sub" />
          </article>
        ))}
      </section>
    )
  }

  return (
    <section className="summary-grid">
      {/* 总持仓市值卡片 */}
      <SummaryCard
        icon={WalletOutlined}
        kicker="资产总览"
        title="总持仓市值"
        value={totalMarket}
        formattedValue={formatMoney(totalMarket)}
        note="当前组合总敞口"
        variant="neutral"
      />

      {/* 当日收益卡片 - 根据正负显示不同颜色 */}
      <article className={`panel summary-card summary-card--${dayVariant}`}>
        <div className="summary-card__header">
          <div className="summary-card__title-wrap">
            <span className="summary-card__kicker">日内脉冲</span>
            <h3>当日收益</h3>
          </div>
          <span className="summary-card__icon-shell">
            {totalDay >= 0 ? (
              <RiseOutlined
                className="summary-icon summary-icon--animated"
                style={{ color: 'var(--color-success)' }}
              />
            ) : (
              <FallOutlined
                className="summary-icon summary-icon--animated"
                style={{ color: 'var(--color-error)' }}
              />
            )}
          </span>
        </div>
        <div className="summary-card__body">
          <strong className={classBySign(totalDay)}>
            <AnimatedNumber value={totalDay} formatter={formatSignedMoney} />
          </strong>
          <p className="summary-card__note">相对上一估值日</p>
        </div>
      </article>

      {/* 持有收益卡片 - 根据正负显示不同颜色 */}
      <article className={`panel summary-card summary-card--${holdingVariant}`}>
        <div className="summary-card__header">
          <div className="summary-card__title-wrap">
            <span className="summary-card__kicker">累计表现</span>
            <h3>持有收益</h3>
          </div>
          <span className="summary-card__icon-shell">
            <HistoryOutlined
              className="summary-icon"
              style={{
                color: holdingVariant === 'positive'
                  ? 'var(--color-success)'
                  : holdingVariant === 'negative'
                    ? 'var(--color-error)'
                    : 'var(--color-text-tertiary)'
              }}
            />
          </span>
        </div>
        <div className="summary-card__body">
          <strong className={classBySign(totalHolding)}>
            <AnimatedNumber value={totalHolding} formatter={formatSignedMoney} />
          </strong>
          <span className={classBySign(holdingRate)}>
            <AnimatedNumber value={holdingRate} formatter={formatPercent} />
          </span>
          <p className="summary-card__note">累计浮盈 / 浮亏</p>
        </div>
      </article>

      {/* 持仓数量卡片 */}
      <SummaryCard
        icon={AppstoreOutlined}
        kicker="持仓覆盖"
        title="持仓数量"
        value={rows.length}
        formattedValue={`${rows.length} 只`}
        note="纳入估值的基金数量"
        variant="neutral"
      />
    </section>
  )
})

export default SummaryCards
