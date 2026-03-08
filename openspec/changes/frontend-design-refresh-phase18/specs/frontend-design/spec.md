## ADDED Requirements

### Requirement: 基金详情持仓区应先展示持仓快照
`FundDetailPage` 的持仓详情区 MUST 在细项指标前展示持仓快照摘要。

#### Scenario: 用户查看持仓详情
- **GIVEN** 基金详情页已加载
- **WHEN** 用户查看右侧持仓区
- **THEN** 页面应先展示持仓快照
- **AND** 再展示明细指标与数据状态

### Requirement: 基金详情最新净值区应先展示估值快照
`FundDetailPage` 的最新净值区 MUST 在双栏对照前展示估值快照摘要。

#### Scenario: 用户查看最新净值
- **GIVEN** 最新净值数据存在
- **WHEN** 用户进入最新净值区
- **THEN** 页面应先展示估值快照
- **AND** 再展示单位净值与估算净值的双栏对照

### Requirement: 基金详情右栏升级后应保持现有行为稳定
`FundDetailPage` 右栏视觉升级后 MUST 保持现有详情页回归测试继续通过。

#### Scenario: 现有详情页测试运行
- **GIVEN** 详情页右栏已升级
- **WHEN** 测试运行
- **THEN** 页面应继续渲染基金详情、返回按钮和核心指标
