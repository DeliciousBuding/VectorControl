## ADDED Requirements

### Requirement: 风险状态条应先展示风险快照上下文
`RiskStatusBar` MUST 在跳转动作前展示风险快照身份、说明文案与三类风险摘要。

#### Scenario: 用户在首页查看风险入口
- **GIVEN** 用户进入首页并可见风险状态条
- **WHEN** 页面渲染风险入口
- **THEN** 页面应先展示 `Risk Snapshot` 文案与快照说明
- **AND** 再展示集中度、回撤预估和结构预警三类摘要

### Requirement: 风险状态条升级后应保持原有跳转行为
`RiskStatusBar` 视觉升级后 MUST 保持进入风险详情的交互行为不变。

#### Scenario: 用户点击查看风险详情
- **GIVEN** 风险状态条已完成视觉升级
- **WHEN** 用户点击 `查看风险详情`
- **THEN** 页面应继续触发原有 `onOpenRiskCenter` 行为

### Requirement: 风险状态条空态应保持快照式表达
`RiskStatusBar` 在缺少风险数据时 MUST 继续提供统一的快照式空态说明。

#### Scenario: 页面尚无风险数据
- **GIVEN** 首页未取得有效风险数据
- **WHEN** 页面渲染风险状态条
- **THEN** 页面应展示空态快照说明
- **AND** 文案应明确刷新后会出现集中度、回撤预估与结构预警
