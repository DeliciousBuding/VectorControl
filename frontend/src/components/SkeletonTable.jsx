/**
 * SkeletonTable - 表格骨架屏组件
 * 
 * @description 用于表格加载状态的骨架屏，支持自定义列数、行数和列宽
 * @author 庄方宜
 * @version 2026-02-14
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 表格骨架屏组件
 * @param {Object} props
 * @param {number} props.rows - 行数
 * @param {number} props.columns - 列数
 * @param {boolean} props.hasHeader - 是否显示表头
 * @param {Array<number>} props.columnWidths - 每列宽度百分比数组
 * @param {string} props.className - 自定义类名
 * @param {Object} props.style - 自定义样式
 * @param {boolean} props.compact - 紧凑模式
 */
const SkeletonTable = ({
  rows = 6,
  columns = 6,
  hasHeader = true,
  columnWidths = [],
  className = '',
  style = {},
  compact = false,
}) => {
  // 生成默认列宽分布
  const getColumnWidth = (colIndex) => {
    if (columnWidths[colIndex] !== undefined) {
      return `${columnWidths[colIndex]}%`;
    }
    // 默认分布：第一列较宽，其余均匀
    if (colIndex === 0) return '25%';
    return `${75 / (columns - 1)}%`;
  };

  return (
    <div 
      className={`vc-skeleton-table ${compact ? 'vc-skeleton-table--compact' : ''} ${className}`}
      style={style}
      role="status"
      aria-label="表格加载中"
    >
      {/* 表头 */}
      {hasHeader && (
        <div className="vc-skeleton-table__header" aria-hidden="true">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={`header-${colIndex}`}
              className="vc-skeleton-table__cell vc-skeleton-table__cell--header"
              style={{ width: getColumnWidth(colIndex) }}
            />
          ))}
        </div>
      )}
      
      {/* 表格行 */}
      <div className="vc-skeleton-table__body" aria-hidden="true">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`}
            className="vc-skeleton-table__row"
            style={{ animationDelay: `${rowIndex * 0.05}s` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="vc-skeleton-table__cell"
                style={{ width: getColumnWidth(colIndex) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

SkeletonTable.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
  hasHeader: PropTypes.bool,
  columnWidths: PropTypes.arrayOf(PropTypes.number),
  className: PropTypes.string,
  style: PropTypes.object,
  compact: PropTypes.bool,
};

/**
 * 带标题的表格骨架屏
 * @param {Object} props
 * @param {string} props.titleWidth - 标题占位宽度
 * @param {Object} props.tableProps - 表格骨架屏属性
 * @param {boolean} props.hasAction - 是否显示操作按钮占位
 */
export const SkeletonTableWithHeader = ({
  titleWidth = 30,
  tableProps = {},
  hasAction = true,
  className = '',
}) => {
  return (
    <div className={`vc-skeleton-table-wrapper ${className}`} role="status" aria-label="表格区域加载中">
      <div className="vc-skeleton-table__toolbar" aria-hidden="true">
        <div 
          className="vc-skeleton-table__toolbar-title"
          style={{ width: `${titleWidth}%` }}
        />
        {hasAction && (
          <div className="vc-skeleton-table__toolbar-action" />
        )}
      </div>
      <SkeletonTable {...tableProps} />
    </div>
  );
};

SkeletonTableWithHeader.propTypes = {
  titleWidth: PropTypes.number,
  tableProps: PropTypes.object,
  hasAction: PropTypes.bool,
  className: PropTypes.string,
};

export default SkeletonTable;
