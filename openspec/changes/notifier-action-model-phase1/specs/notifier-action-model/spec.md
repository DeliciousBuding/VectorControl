## 新增需求

### 需求: 通知测试动作必须复用统一结果模型
通知通道的测试动作必须返回统一结构，避免前端按 provider 写特判逻辑。

#### 场景: 用户触发 Telegram 或飞书测试消息
- **当** 调用 `POST /api/settings/notifications/telegram/test_message` 或 `POST /api/settings/notifications/feishu/test_message`
- **那么** 响应复用 `NotifierActionResult`
- **并且** 失败时的错误详情复用 `NotifierActionError`

### 需求: 通知状态接口必须复用统一摘要字段
通知状态接口必须以统一摘要字段暴露最近测试结果，便于前端聚合渲染。

#### 场景: 设置中心读取通知诊断状态
- **当** 调用 `GET /api/settings/notifications/status`
- **那么** 每个通道都提供 `last_test_summary` 与 `last_test_history`
- **并且** 这些摘要字段与统一动作结果模型保持同一口径
