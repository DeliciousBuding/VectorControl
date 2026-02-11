import { Component } from 'react'

/**
 * Error Boundary to prevent white screen on errors
 * Catches JavaScript errors in child component tree
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || '未知错误'

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>出错了</h2>
            <p className="error-message">{errorMessage}</p>
            <p className="error-hint">应用遇到了意外错误，请尝试以下操作：</p>
            <div className="error-actions">
              <button type="button" className="primary" onClick={this.handleRetry}>
                重试
              </button>
              <button type="button" className="ghost" onClick={this.handleReload}>
                刷新页面
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>错误详情（开发模式）</summary>
                <pre>{this.state.error?.stack || '无堆栈信息'}</pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
