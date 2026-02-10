# Telegram 通道配置与排障
> 最后更新: 2026-02-10 18:23:39 (UTC+8)

本文件用于 VectorControl 的 Telegram 通道接入、配置与常见故障排查。

安全红线：
- Bot Token 属于最高敏感凭据，禁止写入代码仓库、`agent_comms/progress`、截图、日志与录屏。
- 若怀疑泄露，立刻在 BotFather 旋转（revoke/rotate）token，并更新系统配置。
- 避免把真实 token 直接粘贴到共享终端/命令历史；建议用临时环境变量或密码管理器临时取用。

## 1. 你需要准备什么

- 一个 Telegram Bot（通过 BotFather 创建）
- 一个接收消息的对话（私聊或群组）
- 两个关键信息：
  - `bot_token`
  - `chat_id`

## 2. 如何获取 chat_id（最常见卡点）

### 2.1 私聊场景

1. 用你的账号打开与 Bot 的私聊窗口，发送任意消息（例如：`/start` 或 “hello”）。
2. 在本机运行一次 `getUpdates`，查看返回里的 `message.chat.id`。

示例（PowerShell）：
```powershell
$token = "<BOT_TOKEN>"
Invoke-RestMethod "https://api.telegram.org/bot$token/getUpdates"
```

### 2.2 群组场景

1. 把 Bot 拉进群。
2. 在群里 @Bot 并发送一条消息。
3. 同样通过 `getUpdates` 查 `message.chat.id`。

注意：
- 群组 `chat_id` 通常是负数（例如 `-100xxxxxxxxxx`）。
- 如果 `getUpdates` 一直为空，可能是：
  - 你在其他地方给该 token 配了 webhook（需要先 `deleteWebhook`）
  - Bot 没有收到消息（未被 @、权限不够、隐私模式限制）

可选：删除 webhook（如果你确定当前要用轮询/手动查询 updates）
```powershell
$token = "<BOT_TOKEN>"
Invoke-RestMethod "https://api.telegram.org/bot$token/deleteWebhook?drop_pending_updates=true"
```

## 3. VectorControl 侧如何配置

本项目把 Telegram 凭据更新拆成独立接口，避免通过 `PUT /api/settings` 全量回传敏感字段。

### 3.1 更新凭据（推荐流程）

接口：
- `PUT /api/settings/notifications/telegram/credential`

入参：
- `bot_token`
- `chat_id`

出参特性：
- 响应不回显 `bot_token` 明文（只回显非敏感字段与 configured 状态）。

示例（PowerShell）：
```powershell
$base = "http://127.0.0.1:21345"
$token = "<LOGIN_BEARER_TOKEN>"

Invoke-RestMethod "$base/api/settings/notifications/telegram/credential" `
  -Method Put `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{ bot_token = "<BOT_TOKEN>"; chat_id = "<CHAT_ID>" } | ConvertTo-Json)
```

### 3.2 开启 Telegram 通道

在设置中将 `settings.notifications.telegram.enabled=true`。

说明：
- `bot_token/chat_id` 建议只通过 3.1 的凭据接口更新。
- `parse_mode` 当前建议使用 `HTML` 或留空（留空会当纯文本）。
- `timeout_seconds/retry_times` 用于发送超时与重试（防抖与容灾）。

## 4. 如何验证是否发送成功

当前后端发送成功会在日志中记录：
- logger：`vectorcontrol.notifier.telegram`
- 关键字段：`trace_id`、`attempt`、`provider_message_id`

如果发送失败，会记录 `trace_id` 与失败原因（HTTP 状态码、error_code、description）。

## 5. 常见错误与排查

### 5.1 `401 Unauthorized` / `Unauthorized`
- 原因：token 错误或已被撤销/轮换
- 处理：在 BotFather 重新获取 token，并通过凭据接口更新

### 5.2 `400 Bad Request: chat not found`
- 原因：chat_id 错误、Bot 未加入群、或者群里没触发消息被 Bot 接收
- 处理：按第 2 节重新获取 chat_id，确保 bot 收到消息

### 5.3 `403 Forbidden: bot was blocked by the user`
- 原因：用户把 bot 拉黑
- 处理：解除拉黑或换 chat_id

### 5.4 发送超时/偶发失败
- 原因：网络抖动或 Telegram 侧短时异常
- 处理：提高 `timeout_seconds`、适度增加 `retry_times`，并观察日志里的 trace_id

## 6. 安全轮换 bot_token（推荐流程）

当你怀疑泄露、或需要定期轮换时，推荐按以下步骤执行：

1. 在 BotFather 撤销/轮换 token（revoke/rotate）。
2. 立即通过后端独立凭据接口更新（响应不会回显 bot_token 明文）：
   - `PUT /api/settings/notifications/telegram/credential`
3. 确认：
   - `settings.notifications.telegram.enabled=true`
   - `chat_id` 可用（参考第 2 节）
4. 触发一次最小发送验证（建议从业务链路触发，或在本地环境进行一次可控测试）。

提醒：
- 任何真实 bot_token 禁止写入仓库、`agent_comms/progress`、截图与录屏。
- 若你之前在终端里直接粘贴过真实 token，建议同步清理 shell 历史或更换终端会话。
