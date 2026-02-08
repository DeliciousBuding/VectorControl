function cleanText(raw, fallback) {
  const text = String(raw || '').trim()
  if (!text) return String(fallback || '操作失败')
  return text
}

function withNextStep(message, nextStep) {
  const base = cleanText(message, '操作失败').replace(/[。；\s]+$/, '')
  const step = cleanText(nextStep, '请稍后重试')
  if (base.includes('下一步：')) return base
  return `${base}。下一步：${step}`
}

export function toGuidedError(error, scene = 'generic', fallback = '操作失败') {
  const status = Number(error?.status || 0)
  const raw = cleanText(error?.message, fallback)
  const networkFailed = raw.includes('网络请求失败')
  const rateLimited = status === 429 || raw.includes('请求过于频繁')

  if (scene === 'auth_login') {
    if (raw.includes('账号不存在')) return withNextStep('账号不存在', '先切到注册并创建账号')
    if (raw.includes('密码错误') || raw.includes('用户名或密码错误')) return withNextStep('账号或密码错误', '检查后重新输入')
    if (status === 401) return withNextStep('登录失败，身份校验未通过', '确认账号密码后重试')
    if (rateLimited) return withNextStep('登录请求过于频繁', '稍等 1 分钟后再试')
    if (networkFailed) return withNextStep('登录请求失败，网络不可达', '检查网络后重试')
    return withNextStep(raw, '确认账号密码后重试')
  }

  if (scene === 'auth_register') {
    if (raw.includes('用户名已存在')) return withNextStep('账号已存在', '直接切换到登录')
    if (rateLimited) return withNextStep('注册请求过于频繁', '稍等 1 分钟后再试')
    if (networkFailed) return withNextStep('注册请求失败，网络不可达', '检查网络后重试')
    return withNextStep(raw, '确认用户名和密码后重试')
  }

  if (scene === 'estimate_refresh') {
    if (status === 401) return withNextStep('登录状态已失效，无法刷新估值', '重新登录后再刷新')
    if (networkFailed) return withNextStep('估值刷新失败，网络不可达', '先到设置中心执行测速，再重试刷新')
    if (status >= 500) return withNextStep('估值服务暂时不可用', '稍后重试，若持续失败请检查后端日志')
    return withNextStep(raw, '点击刷新重试，必要时查看设置中心测速结果')
  }

  if (scene === 'settings_save') {
    if (status === 401) return withNextStep('登录状态已失效，设置未保存', '重新登录后再次保存')
    if (networkFailed) return withNextStep('设置保存失败，网络不可达', '检查网络后重试保存')
    return withNextStep(raw, '确认字段后重新点击保存')
  }

  if (scene === 'settings_benchmark_load' || scene === 'settings_benchmark_run') {
    if (status === 404) return withNextStep('测速接口不存在（404）', '把后端更新到最新版本并重启服务')
    if (status === 401) return withNextStep('登录状态已失效，无法测速', '重新登录后再测速')
    if (networkFailed) return withNextStep('测速请求失败，网络不可达', '检查网络后重试测速')
    return withNextStep(raw, '稍后重试，必要时检查后端服务状态')
  }

  if (scene === 'trade_submit') {
    if (status === 401) return withNextStep('登录状态已失效，交易提交失败', '重新登录后再次提交')
    if (networkFailed) return withNextStep('交易提交失败，网络不可达', '检查网络后重试提交')
    return withNextStep(raw, '检查基金代码、金额和发生时间后重试')
  }

  if (scene === 'trade_actions_load' || scene === 'trade_transactions_load') {
    if (status === 401) return withNextStep('登录状态已失效，交易记录加载失败', '重新登录后刷新')
    if (networkFailed) return withNextStep('交易记录加载失败，网络不可达', '检查网络后刷新页面')
    return withNextStep(raw, '稍后重试，必要时切换筛选条件重新加载')
  }

  if (scene === 'trade_sync_pending' || scene === 'fund_sync_pending') {
    if (status === 404) return withNextStep('对账接口不存在（404）', '把后端更新到最新版本并重启服务')
    if (status === 401) return withNextStep('登录状态已失效，无法执行对账', '重新登录后再执行')
    if (networkFailed) return withNextStep('pending 对账失败，网络不可达', '检查网络后重试对账')
    return withNextStep(raw, '确认存在 pending 交易后再次执行')
  }

  return withNextStep(raw, '稍后重试')
}
