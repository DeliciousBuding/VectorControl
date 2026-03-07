## ADDED Requirements

### Requirement: 开发诊断面板应先展示当前状态摘要
`DiagnosticsPanel` MUST 在诊断文本前先展示开发环境身份、数据状态与复制状态摘要。

#### Scenario: 开发环境打开诊断面板
- **GIVEN** 当前处于开发环境
- **WHEN** 页面渲染 `DiagnosticsPanel`
- **THEN** 页面应先展示诊断面板头部与状态摘要卡
- **AND** 再展示空态提示或诊断文本内容

### Requirement: 开发诊断面板应保持复制与拉取行为可用
`DiagnosticsPanel` 视觉升级后 MUST 保持诊断拉取与复制文本行为可用。

#### Scenario: 用户在开发环境拉取并复制诊断文本
- **GIVEN** 面板已经渲染
- **WHEN** 用户点击同步诊断并复制文本
- **THEN** 页面应显示诊断文本
- **AND** 复制动作应继续调用剪贴板接口

### Requirement: 开发诊断面板在生产环境必须不渲染
`DiagnosticsPanel` MUST 在生产环境继续返回空渲染。

#### Scenario: 当前为生产环境
- **GIVEN** `import.meta.env.PROD` 为真
- **WHEN** 页面尝试渲染 `DiagnosticsPanel`
- **THEN** 页面不应输出任何诊断面板内容
