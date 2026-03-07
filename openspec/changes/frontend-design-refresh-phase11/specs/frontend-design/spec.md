## ADDED Requirements

### Requirement: 风险中枢应先展示风险快照摘要
`RiskCenter` MUST 在详细风险卡前展示清晰的区块身份、版本信息与摘要卡。

#### Scenario: 用户进入风险中枢
- **GIVEN** 用户查看风险中枢
- **WHEN** 页面完成渲染
- **THEN** 页面应展示区块标题、说明文案、模型版本和风险概览摘要

### Requirement: 风险中枢卡片应按风险语义分层
`RiskCenter` MUST 使用更清晰的指标卡与列表卡层级来表达不同类型的风险信息。

#### Scenario: 用户查看风险详情
- **GIVEN** 风险快照已可用
- **WHEN** 页面渲染集中度、相关性、压力测试与预警
- **THEN** 指标型信息应以指标卡展示
- **AND** 列表型信息应以列表卡展示

### Requirement: 风险中枢视觉升级后应保持原有数据契约
`RiskCenter` 视觉升级后 MUST 保持现有风险数据结构和空态行为不变。

#### Scenario: 风险快照不存在或已存在
- **GIVEN** 页面渲染风险中枢
- **WHEN** 传入空风险快照或有效风险快照
- **THEN** 空态和数据态都应继续可用
