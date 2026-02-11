import { useCallback, useState } from 'react'

/**
 * Dev-only diagnostics panel for debugging
 * Only rendered in development mode
 */
export function DiagnosticsPanel({ user }) {
  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchDiagnostics = useCallback(async () => {
    if (!user?.token) return
    setLoading(true)
    try {
      const res = await fetch('/api/system/diagnostics', {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      const data = await res.json()
      setDiag(data)
    } catch (e) {
      console.error('Failed to fetch diagnostics:', e)
    } finally {
      setLoading(false)
    }
  }, [user?.token])

  const copyToClipboard = useCallback(async () => {
    if (!diag?.diagnostic_text) return
    try {
      await navigator.clipboard.writeText(diag.diagnostic_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }, [diag?.diagnostic_text])

  // Only show in development
  if (import.meta.env?.PROD) {
    return null
  }

  return (
    <div className="diagnostics-panel">
      <div className="diag-header">
        <h3>🔧 Diagnostics (dev-only)</h3>
        <div className="diag-actions">
          <button type="button" onClick={fetchDiagnostics} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {diag && (
            <button type="button" onClick={copyToClipboard}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>
      {diag && (
        <pre className="diag-content">{diag.diagnostic_text}</pre>
      )}
    </div>
  )
}
