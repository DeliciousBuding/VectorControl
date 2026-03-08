## ADDED Requirements

### Requirement: 基金详情走势区应先展示性能快照
`FundDetailPage` 的净值走势区 MUST 在图表前展示当前单位净值、估算偏差与可见区间摘要。

#### Scenario: 用户查看基金走势
- **GIVEN** 基金详情页已加载
- **WHEN** 用户进入净值走势区
- **THEN** 页面应先展示性能快照卡
- **AND** 再展示图表和时间区间切换

### Requirement: 基金详情交易区应先展示执行快照
`FundDetailPage` 的交易记录区 MUST 在表格前展示总记录、已确认和待确认状态摘要。

#### Scenario: 用户查看交易记录
- **GIVEN** 基金详情页已加载交易数据
- **WHEN** 用户进入交易记录区
- **THEN** 页面应先展示交易执行快照
- **AND** 再展示交易表格

### Requirement: 基金详情二级区块升级后应保持现有行为稳定
`FundDetailPage` 视觉升级后 MUST 保持返回、图表区间切换与交易表格行为稳定。

#### Scenario: 现有详情页测试继续运行
- **GIVEN** 基金详情页已完成视觉升级
- **WHEN** 现有前端测试运行
- **THEN** 详情页应继续支持返回按钮和原有数据渲染逻辑
