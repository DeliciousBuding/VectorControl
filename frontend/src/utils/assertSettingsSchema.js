/**
 * Settings Schema Assertion (dev-only)
 *
 * Validates settings object structure in development mode.
 * Prevents unknown keys and sensitive plaintext payloads.
 */

const SENSITIVE_KEYS = ['webhook_url', 'bot_token', 'chat_id', 'smtp_password', 'password', 'secret', 'api_key', 'token']

const KNOWN_TOP_LEVEL_KEYS = ['display', 'notifications', 'network_benchmark']

const KNOWN_DISPLAY_KEYS = [
  'auto_refresh_enabled',
  'auto_refresh_seconds',
  'auto_refresh_visible_only',
]

const KNOWN_NOTIFICATION_CHANNELS = ['feishu', 'telegram', 'email']

const KNOWN_FEISHU_KEYS = [
  'enabled',
  'webhook_url',
  'advice_time',
  'report_time',
  'timeout_seconds',
  'retry_times',
  'template',
  'last_test_summary',
  'last_test_history',
]

const KNOWN_TELEGRAM_KEYS = [
  'enabled',
  'bot_token',
  'chat_id',
  'parse_mode',
  'disable_web_page_preview',
  'timeout_seconds',
  'retry_times',
  'last_test_summary',
  'last_test_history',
]

const KNOWN_EMAIL_KEYS = ['enabled', 'recipients', 'last_test_summary', 'last_test_history']

const KNOWN_NETWORK_BENCHMARK_KEYS = ['default_profile', 'timeout_seconds', 'last_run_at', 'last_result']

/**
 * Assert settings schema in development mode
 * @param {object} settings - Settings object to validate
 * @param {string} context - Context string for error messages
 * @returns {{valid: boolean, warnings: string[], errors: string[]}}
 */
export function assertSettingsSchema(settings, context = 'unknown') {
  if (import.meta.env?.PROD) {
    // Skip in production
    return { valid: true, warnings: [], errors: [] }
  }

  const warnings = []
  const errors = []

  if (!settings || typeof settings !== 'object') {
    errors.push(`[${context}] Settings must be a non-null object`)
    return { valid: false, warnings, errors }
  }

  // Check top-level keys
  for (const key of Object.keys(settings)) {
    if (!KNOWN_TOP_LEVEL_KEYS.includes(key)) {
      warnings.push(`[${context}] Unknown top-level key: ${key}`)
    }
  }

  // Check display
  if (settings.display && typeof settings.display === 'object') {
    for (const key of Object.keys(settings.display)) {
      if (!KNOWN_DISPLAY_KEYS.includes(key)) {
        warnings.push(`[${context}] Unknown display key: ${key}`)
      }
    }
  }

  // Check notifications
  if (settings.notifications && typeof settings.notifications === 'object') {
    for (const channel of Object.keys(settings.notifications)) {
      if (!KNOWN_NOTIFICATION_CHANNELS.includes(channel)) {
        warnings.push(`[${context}] Unknown notifications channel: ${channel}`)
        continue
      }

      const channelConfig = settings.notifications[channel]
      if (!channelConfig || typeof channelConfig !== 'object') continue

      let knownKeys = []
      if (channel === 'feishu') knownKeys = KNOWN_FEISHU_KEYS
      else if (channel === 'telegram') knownKeys = KNOWN_TELEGRAM_KEYS
      else if (channel === 'email') knownKeys = KNOWN_EMAIL_KEYS

      for (const key of Object.keys(channelConfig)) {
        if (!knownKeys.includes(key)) {
          warnings.push(`[${context}] Unknown notifications.${channel} key: ${key}`)
        }

        // Check for sensitive plaintext (should be <REDACTED> or empty after save)
        if (SENSITIVE_KEYS.includes(key)) {
          const value = String(channelConfig[key] || '')
          if (value && value !== '<REDACTED>' && value.length > 0) {
            // In development, this is expected when user inputs credentials
            // Only warn if it looks like a saved value with real data
            if (value.startsWith('http') || value.startsWith('sk-') || value.length > 20) {
              warnings.push(
                `[${context}] Sensitive data in notifications.${channel}.${key} should be redacted after save`
              )
            }
          }
        }
      }
    }
  }

  // Check network_benchmark
  if (settings.network_benchmark && typeof settings.network_benchmark === 'object') {
    for (const key of Object.keys(settings.network_benchmark)) {
      if (!KNOWN_NETWORK_BENCHMARK_KEYS.includes(key)) {
        warnings.push(`[${context}] Unknown network_benchmark key: ${key}`)
      }
    }
  }

  // Log warnings in development
  if (warnings.length > 0) {
    console.group(`[Settings Schema] ${context}`)
    warnings.forEach((w) => console.warn(w))
    console.groupEnd()
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  }
}

export default assertSettingsSchema
