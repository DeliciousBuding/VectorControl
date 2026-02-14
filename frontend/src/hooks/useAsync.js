/**
 * @fileoverview 异步操作状态管理 Hook
 * @description 提供统一的异步操作状态管理、自动错误处理和重试机制
 * @author 庄方宜
 * @version 1.0.0
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useErrorHandler, formatError, isRetryableError } from './useErrorHandler.js';

/**
 * @typedef {Object} AsyncState
 * @property {any} data - 请求返回的数据
 * @property {boolean} loading - 是否加载中
 * @property {boolean} idle - 是否空闲（未开始）
 * @property {boolean} success - 是否成功
 * @property {boolean} error - 是否出错
 * @property {string} errorMessage - 错误消息
 * @property {number} executeCount - 执行次数
 * @property {number} retryCount - 重试次数
 * @property {Date} [lastExecutedAt] - 最后执行时间
 */

/**
 * @typedef {Object} AsyncOptions
 * @property {string} [scene='generic'] - 操作场景
 * @property {string} [fallbackMessage='操作失败'] - 默认错误消息
 * @property {boolean} [autoExecute=false] - 是否自动执行
 * @property {boolean} [manual=false] - 是否手动模式（不自动执行）
 * @property {any[]} [deps=[]] - 自动执行的依赖项
 * @property {boolean} [resetOnExecute=true] - 执行时是否重置状态
 * @property {Function} [onSuccess] - 成功回调
 * @property {Function} [onError] - 错误回调
 * @property {Function} [onFinally] - 最终回调
 * @property {boolean} [immediate=false] - 立即执行（已废弃，使用 autoExecute）
 */

/**
 * @typedef {Object} RetryOptions
 * @property {number} [count=0] - 重试次数
 * @property {number} [delay=1000] - 重试延迟（毫秒）
 * @property {number} [backoff=2] - 退避倍数
 * @property {number} [maxDelay=30000] - 最大延迟
 * @property {Function} [shouldRetry] - 自定义重试判断函数
 * @property {Function} [onRetry] - 重试回调
 */

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 计算退避延迟
 * @param {number} baseDelay - 基础延迟
 * @param {number} attempt - 尝试次数
 * @param {number} backoff - 退避倍数
 * @param {number} maxDelay - 最大延迟
 * @returns {number} 计算后的延迟
 */
const calculateBackoff = (baseDelay, attempt, backoff, maxDelay) => {
  const calculated = baseDelay * Math.pow(backoff, attempt);
  return Math.min(calculated, maxDelay);
};

/**
 * 异步操作状态管理 Hook
 * @param {Function} asyncFn - 异步函数
 * @param {AsyncOptions} [options={}] - 配置选项
 * @returns {Object} 异步操作状态和控制器
 *
 * @example
 * // 基础用法
 * const { data, loading, error, execute } = useAsync(fetchUserData, {
 *   scene: 'user_fetch'
 * });
 *
 * // 自动执行
 * const { data, loading } = useAsync(fetchData, {
 *   autoExecute: true,
 *   deps: [userId]
 * });
 *
 * // 带重试
 * const { execute, retry } = useAsync(unstableApi, {
 *   retry: { count: 3, delay: 1000 }
 * });
 */
export function useAsync(asyncFn, options = {}) {
  const {
    scene = 'generic',
    fallbackMessage = '操作失败',
    autoExecute = false,
    manual = false,
    deps = [],
    resetOnExecute = true,
    onSuccess,
    onError,
    onFinally,
    retry: retryOptions = {}
  } = options;

  const {
    count: retryCount = 0,
    delay: retryDelay = 1000,
    backoff = 2,
    maxDelay = 30000,
    shouldRetry: customShouldRetry,
    onRetry
  } = retryOptions;

  // 内部状态
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [idle, setIdle] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [executeCount, setExecuteCount] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [lastExecutedAt, setLastExecutedAt] = useState(null);

  // Refs
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const retryTimerRef = useRef(null);

  // 错误处理
  const { handleError, clearError } = useErrorHandler({
    scene,
    onError: (err) => {
      if (onError) onError(err);
    }
  });

  // 清理函数
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setIdle(true);
    setSuccess(false);
    setErrorInfo(null);
    setRetryAttempt(0);
    clearError();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [clearError]);

  /**
   * 执行异步操作
   * @param {...any} args - 传递给异步函数的参数
   * @returns {Promise<any>} 执行结果
   */
  const execute = useCallback(async (...args) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (resetOnExecute) {
      setData(null);
      setSuccess(false);
      setErrorInfo(null);
      clearError();
    }

    setLoading(true);
    setIdle(false);
    setLastExecutedAt(new Date());

    const currentExecuteCount = executeCount + 1;
    setExecuteCount(currentExecuteCount);

    let lastError = null;

    // 重试循环
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      setRetryAttempt(attempt);

      try {
        // 检查是否已卸载
        if (!isMountedRef.current) {
          throw new Error('Component unmounted');
        }

        const result = await asyncFn(...args, {
          signal: abortControllerRef.current.signal
        });

        if (!isMountedRef.current) {
          return null;
        }

        setData(result);
        setSuccess(true);
        setLoading(false);
        setErrorInfo(null);

        if (onSuccess) {
          onSuccess(result);
        }

        return result;

      } catch (err) {
        lastError = err;

        // 用户取消，不重试
        if (err.name === 'AbortError') {
          if (isMountedRef.current) {
            setLoading(false);
          }
          throw err;
        }

        const formatted = formatError(err, { scene, fallback: fallbackMessage });

        // 判断是否重试
        const shouldRetryThis = customShouldRetry
          ? customShouldRetry(err, attempt)
          : isRetryableError(formatted);

        if (attempt < retryCount && shouldRetryThis) {
          if (onRetry) {
            onRetry(err, attempt + 1);
          }

          const waitTime = calculateBackoff(retryDelay, attempt, backoff, maxDelay);
          await delay(waitTime);
          continue;
        }

        // 不重试，设置错误状态
        if (isMountedRef.current) {
          setErrorInfo(formatted);
          setSuccess(false);
          setLoading(false);
          handleError(err);
        }

        if (onFinally) {
          onFinally();
        }

        throw err;
      }
    }

    // 所有重试都失败了
    if (isMountedRef.current) {
      setLoading(false);
    }

    throw lastError;

  }, [
    asyncFn, scene, fallbackMessage, resetOnExecute, retryCount, retryDelay,
    backoff, maxDelay, customShouldRetry, onRetry, onSuccess, onFinally,
    handleError, clearError, executeCount
  ]);

  /**
   * 手动重试
   * @param {...any} args - 传递给异步函数的参数
   * @returns {Promise<any>}
   */
  const retry = useCallback((...args) => {
    setRetryAttempt(0);
    return execute(...args);
  }, [execute]);

  /**
   * 取消当前操作
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    if (isMountedRef.current) {
      setLoading(false);
    }
  }, []);

  // 自动执行
  useEffect(() => {
    if (autoExecute && !manual) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    // 状态
    data,
    loading,
    idle,
    success,
    error: errorInfo !== null,
    errorInfo,
    errorMessage: errorInfo?.message || '',
    executeCount,
    retryCount: retryAttempt,
    lastExecutedAt,

    // 操作方法
    execute,
    retry,
    reset,
    cancel,

    // 辅助属性
    isIdle: idle,
    isLoading: loading,
    isSuccess: success,
    isError: errorInfo !== null,
    canRetry: errorInfo ? isRetryableError(errorInfo) : false
  };
}

/**
 * 并行执行多个异步操作的 Hook
 * @param {Array<{key: string, fn: Function}>} tasks - 任务列表
 * @param {Object} [options={}] - 配置选项
 * @returns {Object} 批量操作状态
 *
 * @example
 * const { results, loading, executeAll } = useAsyncBatch([
 *   { key: 'users', fn: fetchUsers },
 *   { key: 'orders', fn: fetchOrders }
 * ]);
 */
export function useAsyncBatch(tasks, options = {}) {
  const {
    scene = 'batch',
    onSuccess,
    onError,
    onFinally,
    parallel = true
  } = options;

  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 });

  const { handleError } = useErrorHandler({ scene });

  const executeAll = useCallback(async (argsMap = {}) => {
    setLoading(true);
    setSuccess(false);
    setError(null);
    setProgress({ completed: 0, total: tasks.length, failed: 0 });

    const newResults = {};
    let hasError = false;

    try {
      if (parallel) {
        // 并行执行
        const promises = tasks.map(async ({ key, fn }) => {
          try {
            const args = argsMap[key] || [];
            const result = await fn(...args);
            newResults[key] = { success: true, data: result };
            setProgress(p => ({ ...p, completed: p.completed + 1 }));
            return { key, success: true, result };
          } catch (err) {
            hasError = true;
            newResults[key] = { success: false, error: err };
            setProgress(p => ({ ...p, completed: p.completed + 1, failed: p.failed + 1 }));
            return { key, success: false, error: err };
          }
        });

        await Promise.all(promises);
      } else {
        // 串行执行
        for (const { key, fn } of tasks) {
          try {
            const args = argsMap[key] || [];
            const result = await fn(...args);
            newResults[key] = { success: true, data: result };
            setProgress(p => ({ ...p, completed: p.completed + 1 }));
          } catch (err) {
            hasError = true;
            newResults[key] = { success: false, error: err };
            setProgress(p => ({ ...p, completed: p.completed + 1, failed: p.failed + 1 }));
          }
        }
      }

      setResults(newResults);

      if (hasError) {
        const errorMsg = `${progress.failed} 个任务执行失败`;
        setError(new Error(errorMsg));
        if (onError) onError(newResults);
      } else {
        setSuccess(true);
        if (onSuccess) onSuccess(newResults);
      }

      return newResults;
    } catch (err) {
      handleError(err);
      setError(err);
      if (onError) onError(err);
      throw err;
    } finally {
      setLoading(false);
      if (onFinally) onFinally();
    }
  }, [tasks, parallel, scene, onSuccess, onError, onFinally, handleError, progress.failed]);

  const reset = useCallback(() => {
    setResults({});
    setLoading(false);
    setSuccess(false);
    setError(null);
    setProgress({ completed: 0, total: 0, failed: 0 });
  }, []);

  return {
    results,
    loading,
    success,
    error,
    progress,
    executeAll,
    reset
  };
}

export default useAsync;
