/**
 * SkeletonChart - 图表骨架屏组件
 * 
 * @description 用于图表加载状态的骨架屏，支持折线图、柱状图、饼图等多种形态
 * @author 庄方宜
 * @version 2026-02-14
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 图表骨架屏组件
 * @param {Object} props
 * @param {string} props.type - 图表类型: 'line' | 'bar' | 'pie' | 'area'
 * @param {number} props.height - 图表高度(px)
 * @param {boolean} props.hasHeader - 是否显示标题区域
 * @param {boolean} props.hasLegend - 是否显示图例区域
 * @param {number} props.dataPoints - 数据点数量（折线图/柱状图）
 * @param {string} props.className - 自定义类名
 * @param {Object} props.style - 自定义样式
 */
const SkeletonChart = ({
  type = 'line',
  height = 300,
  hasHeader = true,
  hasLegend = true,
  dataPoints = 12,
  className = '',
  style = {},
}) => {
  const renderChartContent = () => {
    switch (type) {
      case 'line':
      case 'area':
        return <LineChartSkeleton dataPoints={dataPoints} type={type} />;
      case 'bar':
        return <BarChartSkeleton dataPoints={dataPoints} />;
      case 'pie':
        return <PieChartSkeleton />;
      default:
        return <LineChartSkeleton dataPoints={dataPoints} type="line" />;
    }
  };

  return (
    <div 
      className={`vc-skeleton-chart ${className}`}
      style={{ ...style, '--chart-height': `${height}px` }}
      role="status"
      aria-label="图表加载中"
    >
      {/* 标题区域 */}
      {hasHeader && (
        <div className="vc-skeleton-chart__header" aria-hidden="true">
          <div className="vc-skeleton-chart__title" style={{ width: '35%' }} />
          <div className="vc-skeleton-chart__subtitle" style={{ width: '20%' }} />
        </div>
      )}
      
      {/* 图表主体 */}
      <div 
        className="vc-skeleton-chart__body"
        style={{ height: `${height}px` }}
        aria-hidden="true"
      >
        {renderChartContent()}
      </div>
      
      {/* 图例区域 */}
      {hasLegend && (
        <div className="vc-skeleton-chart__legend" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="vc-skeleton-chart__legend-item">
              <div className="vc-skeleton-chart__legend-color" />
              <div className="vc-skeleton-chart__legend-text" style={{ width: `${60 + index * 15}px` }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 折线图/面积图骨架
 */
const LineChartSkeleton = ({ dataPoints, type }) => {
  // 生成随机高度的数据点
  const points = Array.from({ length: dataPoints }).map((_, i) => {
    const baseHeight = 30 + Math.random() * 40;
    return {
      x: (i / (dataPoints - 1)) * 100,
      y: 100 - baseHeight,
    };
  });

  // 构建SVG路径
  const pathData = points.reduce((acc, point, i) => {
    return i === 0 
      ? `M ${point.x} ${point.y}` 
      : `${acc} L ${point.x} ${point.y}`;
  }, '');

  const areaPath = type === 'area' 
    ? `${pathData} L 100 100 L 0 100 Z` 
    : null;

  return (
    <svg 
      className="vc-skeleton-chart__svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* 网格线 */}
      <g className="vc-skeleton-chart__grid">
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} />
        ))}
      </g>
      
      {/* 面积填充 */}
      {type === 'area' && (
        <path 
          className="vc-skeleton-chart__area"
          d={areaPath}
        />
      )}
      
      {/* 折线 */}
      <path 
        className="vc-skeleton-chart__line"
        d={pathData}
        fill="none"
        strokeWidth="2"
      />
      
      {/* 数据点 */}
      {points.map((point, i) => (
        <circle
          key={i}
          className="vc-skeleton-chart__point"
          cx={point.x}
          cy={point.y}
          r="1.5"
        />
      ))}
    </svg>
  );
};

LineChartSkeleton.propTypes = {
  dataPoints: PropTypes.number.isRequired,
  type: PropTypes.string.isRequired,
};

/**
 * 柱状图骨架
 */
const BarChartSkeleton = ({ dataPoints }) => {
  const barWidth = 80 / dataPoints;
  const gap = 20 / dataPoints;

  return (
    <svg 
      className="vc-skeleton-chart__svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* 网格线 */}
      <g className="vc-skeleton-chart__grid">
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} />
        ))}
      </g>
      
      {/* 柱状条 */}
      {Array.from({ length: dataPoints }).map((_, i) => {
        const height = 20 + Math.random() * 60;
        const x = 10 + i * (barWidth + gap);
        return (
          <rect
            key={i}
            className="vc-skeleton-chart__bar"
            x={x}
            y={100 - height}
            width={barWidth}
            height={height}
            rx="1"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        );
      })}
    </svg>
  );
};

BarChartSkeleton.propTypes = {
  dataPoints: PropTypes.number.isRequired,
};

/**
 * 饼图骨架
 */
const PieChartSkeleton = () => {
  return (
    <div className="vc-skeleton-chart__pie-container">
      <svg 
        className="vc-skeleton-chart__pie"
        viewBox="0 0 100 100"
      >
        {/* 饼图切片 */}
        <circle
          className="vc-skeleton-chart__pie-segment vc-skeleton-chart__pie-segment--1"
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="20"
          strokeDasharray="62.8 188.4"
          transform="rotate(-90 50 50)"
        />
        <circle
          className="vc-skeleton-chart__pie-segment vc-skeleton-chart__pie-segment--2"
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="20"
          strokeDasharray="50.2 200.9"
          strokeDashoffset="-62.8"
          transform="rotate(-90 50 50)"
        />
        <circle
          className="vc-skeleton-chart__pie-segment vc-skeleton-chart__pie-segment--3"
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="20"
          strokeDasharray="37.7 213.5"
          strokeDashoffset="-113"
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
};

SkeletonChart.propTypes = {
  type: PropTypes.oneOf(['line', 'bar', 'pie', 'area']),
  height: PropTypes.number,
  hasHeader: PropTypes.bool,
  hasLegend: PropTypes.bool,
  dataPoints: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * 迷你图表骨架 - 用于小尺寸图表区域
 * @param {Object} props
 * @param {number} props.width - 宽度
 * @param {number} props.height - 高度
 * @param {string} props.type - 类型 'sparkline' | 'bar'
 */
export const SkeletonMiniChart = ({
  width = 120,
  height = 40,
  type = 'sparkline',
  className = '',
}) => {
  return (
    <div 
      className={`vc-skeleton-mini-chart vc-skeleton-mini-chart--${type} ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="迷你图表加载中"
    >
      {type === 'sparkline' ? (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none">
          <path
            className="vc-skeleton-mini-chart__path"
            d="M 0 30 Q 25 10, 50 25 T 100 15"
            fill="none"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <div className="vc-skeleton-mini-chart__bars" aria-hidden="true">
          {[60, 80, 45, 90, 70, 55, 75].map((h, i) => (
            <div
              key={i}
              className="vc-skeleton-mini-chart__bar"
              style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

SkeletonMiniChart.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  type: PropTypes.oneOf(['sparkline', 'bar']),
  className: PropTypes.string,
};

export default SkeletonChart;
