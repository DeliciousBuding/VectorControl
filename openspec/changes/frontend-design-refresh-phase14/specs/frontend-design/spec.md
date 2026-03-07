## ADDED Requirements

### Requirement: 设置中心网络测速区应先展示当前配置与记录状态
`SettingsDrawer` 的网络测速区 MUST 在操作按钮前展示当前测速配置、超时预算与最近记录状态摘要。

#### Scenario: 用户查看网络测速区
- **GIVEN** 用户打开设置中心
- **WHEN** 页面渲染网络测速区
- **THEN** 页面应先展示测速配置与最近记录状态摘要
- **AND** 再展示“加载最近记录 / 开始测速”等动作

### Requirement: 设置中心消息凭据区应先展示通道摘要
`SettingsDrawer` 的飞书与 Telegram 区 MUST 在凭据编辑前展示通道状态、凭据状态与发送模式摘要。

#### Scenario: 用户查看消息凭据区
- **GIVEN** 用户进入消息推送分区
- **WHEN** 页面渲染飞书或 Telegram 面板
- **THEN** 页面应先展示通道摘要
- **AND** 再展示参数编辑与凭据操作

### Requirement: 设置中心消息凭据升级后应保持现有测试锚点稳定
`SettingsDrawer` 的网络测速与消息凭据区升级后 MUST 保持现有 `benchmark-load-latest-btn`、`telegram-discovery-issue-btn`、`telegram-discovery-preview` 等锚点稳定。

#### Scenario: 现有设置中心测试继续运行
- **GIVEN** 设置中心正文已完成视觉升级
- **WHEN** 前端测试运行
- **THEN** 现有测试锚点与交互逻辑应继续可用
