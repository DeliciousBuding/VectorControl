## ADDED Requirements

### Requirement: 认证入口应先展示工作区上下文
`LoginPanel` MUST 在表单前展示工作区入口身份、说明文案与摘要卡。

#### Scenario: 用户打开登录入口
- **GIVEN** 页面渲染认证入口
- **WHEN** 用户进入登录页
- **THEN** 页面应先展示工作区入口说明与摘要卡
- **AND** 再展示模式切换与表单字段

### Requirement: 认证入口升级后应保持登录与注册提交流程不变
`LoginPanel` 视觉升级后 MUST 保持 `onSubmit` 的 `username/password/mode` 提交结构不变。

#### Scenario: 用户切换到注册态并提交
- **GIVEN** 认证入口已升级
- **WHEN** 用户切换到注册并提交表单
- **THEN** 页面应继续以 `{ username, password, mode }` 结构提交

### Requirement: 认证入口升级后应继续支持模式切换
`LoginPanel` MUST 保持登录 / 注册两种模式的切换能力。

#### Scenario: 用户切换认证模式
- **GIVEN** 用户正在使用认证入口
- **WHEN** 点击登录或注册切换按钮
- **THEN** 页面应更新标题与提交文案以匹配当前模式
