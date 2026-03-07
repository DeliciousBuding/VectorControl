## ADDED Requirements

### Requirement: 首页应提供统一的工作台概览区
首页 MUST 在首屏顶部提供统一概览区，用于承载关键指标、同步状态与数据质量摘要，而不是将这些信息分散在多个无层级的独立块中。

#### Scenario: 用户进入首页
- **GIVEN** 用户已进入首页
- **WHEN** 首页完成渲染
- **THEN** 用户应先看到统一概览区
- **AND** 概览区应同时包含摘要卡、数据口径横幅与数据质量摘要

### Requirement: 数据口径信息应结构化展示
首页与相关面板中的数据口径提示 MUST 使用结构化块展示状态、时点与说明，确保用户可以快速扫描，而不是只看到一段长文本。

#### Scenario: 数据口径已返回
- **GIVEN** 前端拿到 `dataStatus`
- **WHEN** 组件渲染
- **THEN** 页面应同时展示状态、时点与说明
- **AND** 状态应具备清晰的视觉语义

### Requirement: 收益监控面板应强化标题与摘要层级
首页收益监控面板 MUST 明确区分标题区、最新时点、摘要区与图表区，避免所有信息落在同一层级。

#### Scenario: 收益历史足够
- **GIVEN** 收益历史记录不少于 2 条
- **WHEN** 页面渲染收益面板
- **THEN** 用户应同时看到标题区、最新时点、摘要指标与图表区域

### Requirement: 首页视觉升级不得破坏现有前端闭环
首页视觉升级完成后 MUST 保持前端测试、build 与 analyze 通过。

#### Scenario: 设计升级完成
- **GIVEN** 首页工作台升级代码已落地
- **WHEN** 执行 `npm --prefix frontend run test:run`、`npm --prefix frontend run build` 与 `npm --prefix frontend run analyze`
- **THEN** 三项命令都应通过
