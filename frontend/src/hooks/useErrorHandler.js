/**
 * @fileoverview 统一错误处理 Hook
 * @description 提供错误格式化、分类、用户友好消息和错误上报功能
 * @author 庄方宜
 * @version 1.0.0
 */

import { useCallback, useState, useRef } from 'react';
import { toGuidedError } from '../utils/errorFeedback.js';

/**
 * @typedef {Object} ErrorInfo
 * @property {string} message - 错误消息
 * @property {string} type - 错误类型
 * @property {number} [status] - HTTP 状态码
 * @property {string} [scene] - 错误场景
 * @property {Date} timestamp - 错误发生时间
 * @property {Error} [original] - 原始错误对象
 */

/**
 * @typedef {'network'|'business'|'system'|'validation'|'auth'|'unknown'} ErrorCategory
 */

/**
 * 错误分类枚举
 * @readonly
 * @enum {ErrorCategory}
 */
export const ErrorCategory = {
  NETWORK: 'network',
  BUSINESS: 'business',
  SYSTEM: 'system',
  VALIDATION: 'validation',
  AUTH: 'auth',
  UNKNOWN: 'unknown'
};

/**
 * HTTP 状态码分类映射
 * @readonly
 */
const STATUS_CODE_MAP = {
  400: ErrorCategory.VALIDATION,
  401: ErrorCategory.AUTH,
  403: ErrorCategory.AUTH,
  404: ErrorCategory.BUSINESS,
  409: ErrorCategory.BUSINESS,
  422: ErrorCategory.VALIDATION,
  429: ErrorCategory.BUSINESS,
  500: ErrorCategory.SYSTEM,
  502: ErrorCategory.SYSTEM,
  503: ErrorCategory.SYSTEM,
  504: ErrorCategory.SYSTEM
};

/**
 * 网络错误关键词
 * @readonly
 */
const NETWORK_KEYWORDS = [
  '网络请求失败',
  'network error',
  'timeout',
  'failed to fetch',
  'networkerror',
  'abort',
  'offline'
];

/**
 * 根据错误特征分类错误
 * @param {Error|Object} error - 原始错误
 * @param {number} [status] - HTTP 状态码
 * @returns {ErrorCategory} 错误分类
 */
function categorizeError(error, status = 0) {
  const message = String(error?.message || '').toLowerCase();

  // 优先根据状态码判断
  if (status && STATUS_CODE_MAP[status]) {
    return STATUS_CODE_MAP[status];
  }

  // 根据错误消息关键词判断
  if (NETWORK_KEYWORDS.some(kw => message.includes(kw.toLowerCase()))) {
    return ErrorCategory.NETWORK;
  }

  // 认证相关
  if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('登录')) {
    return ErrorCategory.AUTH;
  }

  // 验证相关
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return ErrorCategory.VALIDATION;
  }

  // 系统错误
  if (status >= 500) {
    return ErrorCategory.SYSTEM;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * 格式化错误为结构化信息
 * @param {Error|Object} error - 原始错误
 * @param {Object} options - 格式化选项
 * @param {string} [options.scene='generic'] - 错误场景
 * @param {string} [options.fallback='操作失败'] - 默认错误消息
 * @returns {ErrorInfo} 格式化后的错误信息
 */
export function formatError(error, options = {}) {
  const { scene = 'generic', fallback = '操作失败' } = options;

  const status = Number(error?.status || error?.response?.status || 0);
  const category = categorizeError(error, status);
  const guidedMessage = toGuidedError(error, scene, fallback);

  return {
    message: guidedMessage,
    type: category,
    status,
    scene,
    timestamp: new Date(),
    original: error instanceof Error ? error : new Error(String(error))
  };
}

/**
 * 判断错误是否可重试
 * @param {ErrorInfo} errorInfo - 格式化后的错误信息
 * @returns {boolean} 是否可重试
 */
export function isRetryableError(errorInfo) {
  const { type, status } = errorInfo;

  // 网络错误通常可以重试
  if (type === ErrorCategory.NETWORK) {
    return true;
  }

  // 特定状态码可以重试
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (retryableStatusCodes.includes(status)) {
    return true;
  }

  return false;
}

/**
 * 默认错误上报函数（可替换为实际的上报服务）
 * @param {ErrorInfo} errorInfo - 错误信息
 * @param {Object} [context] - 额外上下文
 */
const defaultReporter = (errorInfo, context = {}) => {
  // 生产环境上报到监控服务
  if (process.env.NODE_ENV === 'production') {
    // 示例：发送到 Sentry/LogRocket 等监控服务
    console.error('[Error Report]', {
      ...errorInfo,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }
};

/**
 * 统一错误处理 Hook
 * @param {Object} [options] - 配置选项
 * @param {Function} [options.onError] - 错误回调
 * @param {Function} [options.reporter] - 错误上报函数
 * @param {boolean} [options.autoReport=true] - 是否自动上报
 * @returns {Object} 错误处理方法和状态
 *
 * @example
 * const { error, handleError, clearError, wrapAsync } = useErrorHandler({
 *   scene: 'data_fetch',
 *   onError: (err) => showToast(err.message)
 * });
 */
export function useErrorHandler(options = {}) {
  const {
    onError,
    reporter = defaultReporter,
    autoReport = true
  } = options;

  const [error, setError] = useState(null);
  const errorHistoryRef = useRef([]);
  const maxHistorySize = 50;

  /**
   * 处理错误
   * @param {Error|Object} err - 原始错误
   * @param {Object} [context] - 额外上下文
   * @param {string} [context.scene] - 错误场景
   * @param {string} [context.fallback] - 默认消息
   */
  const handleError = useCallback((err, context = {}) => {
    const errorInfo = formatError(err, {
      scene: context.scene || options.scene || 'generic',
      fallback: context.fallback || '操作失败'
    });

    setError(errorInfo);

    // 添加到历史记录
    errorHistoryRef.current = [
      errorInfo,
      ...errorHistoryRef.current.slice(0, maxHistorySize - 1)
    ];

    // 自动上报
    if (autoReport) {
      reporter(errorInfo, context);
    }

    // 执行回调
    if (onError) {
      onError(errorInfo);
    }

    return errorInfo;
  }, [onError, reporter, autoReport, options.scene]);

  /**
   * 清除当前错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 包装异步函数，自动处理错误
   * @param {Function} asyncFn - 异步函数
   * @param {Object} [context] - 执行上下文
   * @returns {Function} 包装后的函数
   */
  const wrapAsync = useCallback((asyncFn, context = {}) => {
    return async (...args) => {
      try {
        clearError();
        return await asyncFn(...args);
      } catch (err) {
        handleError(err, context);
        throw err;
      }
    };
  }, [handleError, clearError]);

  /**
   * 获取错误历史
   * @param {number} [limit=10] - 返回数量限制
   * @returns {ErrorInfo[]} 错误历史列表
   */
  const getErrorHistory = useCallback((limit = 10) => {
    return errorHistoryRef.current.slice(0, limit);
  }, []);

  /**
   * 清除错误历史
   */
  const clearHistory = useCallback(() => {
    errorHistoryRef.current = [];
  }, []);

  /**
   * 获取用户友好的错误消息
   * @returns {string} 错误消息
   */
  const getUserMessage = useCallback(() => {
    if (!error) return '';
    return error.message;
  }, [error]);

  /**
   * 检查当前错误是否可重试
   * @returns {boolean}
   */
  const canRetry = useCallback(() => {
    if (!error) return false;
    return isRetryableError(error);
  }, [error]);

  return {
    // 状态
    error,
    hasError: error !== null,
    errorType: error?.type || null,
    errorStatus: error?.status || 0,

    // 操作方法
    handleError,
    clearError,
    wrapAsync,

    // 历史记录
    getErrorHistory,
    clearHistory,

    // 辅助方法
    getUserMessage,
    canRetry,
    isRetryable: canRetry()
  };
}

export default useErrorHandler;
