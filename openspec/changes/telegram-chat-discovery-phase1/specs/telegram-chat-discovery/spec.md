## 新增需求

### 需求: Telegram 必须支持 chat_id 自动发现
系统必须支持通过 Telegram inbound webhook 自动发现并回写 `chat_id`，避免用户手工查询。

#### 场景: 用户生成 discovery secret
- **当** 已登录用户调用 Telegram discovery secret 接口
- **那么** 系统返回独立 secret 对应的 webhook 路径
- **并且** 在已配置 `VC_SCHEME` 与 `VC_DOMAIN` 时返回完整 webhook URL

#### 场景: Telegram inbound update 命中有效 secret
- **当** Telegram 向公开 webhook 发送包含 `chat.id` 的 update
- **并且** 路径中的 discovery secret 命中某个用户
- **那么** 系统自动回写该用户的 `notifications.telegram.chat_id`
- **并且** 记录最近发现时间与 chat 摘要

#### 场景: 设置中心查看 Telegram 发现状态
- **当** 调用 `GET /api/settings/notifications/status`
- **那么** `telegram` 节点包含 discovery 摘要
- **并且** 前端可据此展示最近发现结果与引导信息
