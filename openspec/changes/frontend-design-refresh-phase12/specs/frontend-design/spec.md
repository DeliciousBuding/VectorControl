## ADDED Requirements

### Requirement: 设置中心诊断区应先展示当前状态摘要
`SettingsDrawer` 的系统状态与通知诊断区 MUST 在动作按钮前先展示当前状态摘要。

#### Scenario: 用户打开设置中心诊断区
- **GIVEN** 用户进入设置中心
- **WHEN** 查看系统状态或通知诊断区
- **THEN** 页面应展示对应的状态摘要与说明文案
- **AND** 再展示加载、复制或测试动作

### Requirement: 设置中心诊断区升级后应保持现有测试锚点稳定
`SettingsDrawer` 诊断区视觉升级后 MUST 保持现有 `data-testid` 与交互逻辑不变。

#### Scenario: 现有诊断测试继续运行
- **GIVEN** 设置中心诊断区已升级
- **WHEN** 现有前端测试运行
- **THEN** 现有 `system-status-panel`、`diagnostic-load-btn`、`diagnostic-copy-bundle-btn` 等锚点应继续可用

### Requirement: 设置中心诊断区应采用统一的工具条语言
`SettingsDrawer` 的系统状态与通知诊断动作 MUST 使用统一、克制的工具条布局。

#### Scenario: 用户查看诊断动作
- **GIVEN** 页面渲染系统状态与通知诊断动作
- **WHEN** 用户准备加载、复制或测试
- **THEN** 页面应展示统一的工具条式操作布局
