## 为什么

线上 `https://vectorcontrol.tech/` 在登录成功后仍停留在登录页，Playwright 抓到前端运行时错误：`buildFundSeries is not defined`。这会导致登录后的首页初始化直接抛错，用户感知为“提交中”卡住或白屏。

## 变更内容

1. 补齐 `App.jsx` 对 `buildFundSeries` 的缺失导入，修复首页初始化时的运行时异常。
2. 补一个最小回归，覆盖“已登录时首页可渲染收益面板而不报错”。
3. 重新执行预检、远端部署与 Playwright 线上验收。

## 影响

- 修复登录后首页白屏 / 卡住问题。
- 不改变认证接口或收益面板业务逻辑。
