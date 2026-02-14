/**
 * SkeletonCard - 卡片骨架屏组件
 * 
 * @description 用于卡片加载状态的骨架屏，支持标题、数值、副文本等多种形态
 * @author 庄方宜
 * @version 2026-02-14
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 卡片骨架屏组件
 * @param {Object} props
 * @param {boolean} props.hasIcon - 是否显示图标占位
 * @param {boolean} props.hasTitle - 是否显示标题占位
 * @param {boolean} props.hasSubtitle - 是否显示副标题占位
 * @param {number} props.titleWidth - 标题宽度百分比 (0-100)
 * @param {number} props.valueWidth - 数值宽度百分比 (0-100)
 * @param {number} props.subtitleWidth - 副标题宽度百分比 (0-100)
 * @param {string} props.className - 自定义类名
 * @param {Object} props.style - 自定义样式
 */
const SkeletonCard = ({
  hasIcon = true,
  hasTitle = true,
  hasSubtitle = true,
  titleWidth = 45,
  valueWidth = 70,
  subtitleWidth = 40,
  className = '',
  style = {},
}) => {
  return (
    <div 
      className={`vc-skeleton-card ${className}`}
      style={style}
      role="status"
      aria-label="加载中"
    >
      {hasIcon && (
        <div className="vc-skeleton-card__icon" aria-hidden="true" />
      )}
      
      {hasTitle && (
        <div 
          className="vc-skeleton-card__title"
          style={{ width: `${titleWidth}%` }}
          aria-hidden="true"
        />
      )}
      
      <div 
        className="vc-skeleton-card__value"
        style={{ width: `${valueWidth}%` }}
        aria-hidden="true"
      />
      
      {hasSubtitle && (
        <div 
          className="vc-skeleton-card__subtitle"
          style={{ width: `${subtitleWidth}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

SkeletonCard.propTypes = {
  hasIcon: PropTypes.bool,
  hasTitle: PropTypes.bool,
  hasSubtitle: PropTypes.bool,
  titleWidth: PropTypes.number,
  valueWidth: PropTypes.number,
  subtitleWidth: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * 卡片组骨架屏 - 用于展示多个卡片的加载状态
 * @param {Object} props
 * @param {number} props.count - 卡片数量
 * @param {number} props.columns - 列数（响应式）
 * @param {Object} props.cardProps - 传递给每个卡片的属性
 * @param {string} props.className - 自定义类名
 */
export const SkeletonCardGroup = ({
  count = 4,
  columns = 4,
  cardProps = {},
  className = '',
}) => {
  return (
    <div 
      className={`vc-skeleton-card-group vc-skeleton-card-group--${columns}col ${className}`}
      role="status"
      aria-label="卡片加载中"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} {...cardProps} />
      ))}
    </div>
  );
};

SkeletonCardGroup.propTypes = {
  count: PropTypes.number,
  columns: PropTypes.number,
  cardProps: PropTypes.object,
  className: PropTypes.string,
};

export default SkeletonCard;
