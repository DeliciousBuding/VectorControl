## ADDED Requirements

### Requirement: 持仓表应在明细前展示摘要与操作层
`HoldingsTable` MUST 在表格前展示清晰的摘要层和工具栏，而不只是标题和一组按钮。

#### Scenario: 用户进入持仓表
- **GIVEN** 用户查看持仓表
- **WHEN** 页面完成渲染
- **THEN** 页面应展示标题、说明文案与当前视图摘要
- **AND** 页面应展示与表格操作相关的工具栏

### Requirement: 持仓表行反馈应保持一致
`HoldingsTable` MUST 为 hover、选中与编辑态挂接稳定的行级 class，使交互反馈与视觉样式保持一致。

#### Scenario: 用户浏览或编辑行
- **GIVEN** 用户在持仓表中悬停、选中或编辑某一行
- **WHEN** 表格渲染对应状态
- **THEN** 页面应展示对应的行级反馈

### Requirement: 持仓表视觉升级后应保持原有交互
`HoldingsTable` 视觉升级后 MUST 保持行点击、编辑保存、空仓过滤与列设置等既有交互可用。

#### Scenario: 用户继续使用持仓表
- **GIVEN** 持仓表已升级
- **WHEN** 用户继续筛选、编辑或点击持仓
- **THEN** 原有交互逻辑和回归测试应继续通过
