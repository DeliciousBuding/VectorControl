## ADDED Requirements

### Requirement: 登录成功后首页不得因收益序列初始化报错而白屏
`App.jsx` MUST 在用户登录后成功渲染首页，不得因 `buildFundSeries` 未定义导致运行时异常。

#### Scenario: 用户登录成功进入首页
- **GIVEN** 用户已成功通过认证
- **WHEN** 首页开始构建收益序列数据
- **THEN** 页面应成功渲染收益面板
- **AND** 不应抛出 `buildFundSeries is not defined`
