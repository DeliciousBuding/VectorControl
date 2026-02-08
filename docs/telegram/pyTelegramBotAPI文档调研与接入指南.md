# pyTelegramBotAPI 文档调研与接入指南

更新时间：2026-02-08 14:22:30

本文为官方资料的本地整理版（中文），用于 VectorControl 后续接入 Telegram Bot 通道。  
目标是“可落地接入”，不是逐字镜像第三方文档。

## 1. 官方来源（已抓取）

- 仓库主页：<https://github.com/eternnoir/pyTelegramBotAPI>
- 官方文档（最新）：<https://pytba.readthedocs.io/en/latest/>
- Quick start：<https://pytba.readthedocs.io/en/latest/quick_start.html>
- 安装说明：<https://pytba.readthedocs.io/en/latest/install.html>
- TeleBot（同步）：<https://pytba.readthedocs.io/en/latest/sync_version/index.html>
- AsyncTeleBot（异步）：<https://pytba.readthedocs.io/en/latest/async_version/index.html>
- Callback data factory：<https://pytba.readthedocs.io/en/latest/calldata.html>
- Utils：<https://pytba.readthedocs.io/en/latest/util.html>
- Formatting：<https://pytba.readthedocs.io/en/latest/formatting.html>
- Telegram Bot API 官方：<https://core.telegram.org/bots/api>

## 2. 关键信息速记

- `pyTelegramBotAPI` 同时支持同步和异步两套客户端：
  - 同步：`telebot.TeleBot`
  - 异步：`telebot.async_telebot.AsyncTeleBot`
- 安装方式（官方推荐）：
  - `pip install pyTelegramBotAPI`
- 长轮询入口：
  - 同步：`bot.infinity_polling(...)` / `bot.polling(...)`
  - 异步：`await bot.infinity_polling(...)` / `await bot.polling(...)`
- Webhook 入口：
  - `set_webhook(...)`、`remove_webhook()`（或 Telegram 官方 `deleteWebhook`）
- 常见实用参数：
  - `skip_pending`
  - `allowed_updates`
  - `drop_pending_updates`
  - `secret_token`

## 3. Polling 与 Webhook（接入口径）

### 3.1 Polling（本地开发优先）

适合本地快速调试，不需要公网证书与回调地址。

建议默认参数口径：

- `skip_pending=True`：避免服务重启后批量处理过期消息。
- `allowed_updates=[...]`：仅订阅本系统需要的更新类型（如 `message`、`callback_query`）。

### 3.2 Webhook（生产环境推荐）

适合线上服务，消息实时性更好，资源更可控。

建议默认参数口径：

- `drop_pending_updates=True`：上线切换时丢弃历史堆积消息。
- `secret_token=<随机串>`：服务端校验 `X-Telegram-Bot-Api-Secret-Token`。
- 定期检查 `getWebhookInfo`，并记录 `last_error_message` 到可观测日志。

## 4. VectorControl 接入建议（A/B/C + X）

按当前架构应放在 `C2 通知执行` + `X 安全治理`：

1. 新增消息通道抽象（统一飞书/Telegram）：
   - `NotifierChannel` 接口：`send_text()`、`send_report()`、`send_alert()`
   - 通道实现：`FeishuNotifier`、`TelegramNotifier`
2. 配置层新增 Telegram 字段（默认关闭）：
   - `enabled`
   - `bot_token`
   - `chat_id`
   - `parse_mode`
   - `webhook_secret_token`（可选）
3. 安全边界：
   - Token 只放后端环境变量或服务端加密存储，不入前端、不入日志。
   - 输出日志时只记录通道状态和响应码，不打印消息明文中的敏感信息。
4. 失败处理：
   - 限流重试（指数退避）
   - 失败落审计表并可重放

## 5. pyTelegramBotAPI 对本项目最有用的能力

1. `telebot.util.antiflood`
- 用于循环发送时自动重试，减少 `TooManyRequests` 冲击。

2. `telebot.util.smart_split` / `split_string`
- Telegram 单条文本有限制，复盘长文本应先切片发送。

3. `telebot.util.quick_markup`
- 快速构建 InlineKeyboard，适合“确认执行/查看详情”按钮。

4. `telebot.callback_data.CallbackData`
- 结构化 `callback_data`，便于审计和回放按钮动作。

5. `telebot.formatting`（如 `hbold` / `hlink` / `escape_html`）
- 降低消息格式错误率，减少手写 HTML/MarkdownV2 转义问题。

## 6. 与 Telegram Bot API 的直接对应关系

- 轮询：`getUpdates`
  - 使用 `offset=last_update_id+1` 确认已消费更新。
- Webhook：`setWebhook` / `deleteWebhook` / `getWebhookInfo`
  - `secret_token` 用于请求来源校验。
  - `drop_pending_updates` 用于切换期清队列。
- `Update.update_id` 用于幂等去重。

## 7. 本地最小 PoC（建议）

第一阶段只做“单向推送”，不做指令回调：

1. 新增后端模块：`backend/app/notifier/telegram_bot.py`
2. 提供方法：
   - `send_plain_text(chat_id: str, text: str) -> dict`
3. 在 `POST /api/report/daily` 之后增加可选发送逻辑（配置开启时触发）
4. 记录发送结果到现有日志/审计链路

第二阶段再做“按钮回调 + webhook 入站处理”。

## 8. 落地注意事项

- 不要在本地与线上同时启动同一 token 的 polling 实例。
- 生产模式优先 webhook，避免多实例轮询冲突。
- 切换到本地 Bot API Server 时，先 `bot.log_out()` 再切换 `apihelper.API_URL`。
- 对于交易类通知，默认只推送摘要，不直接推送敏感持仓明细。

## 9. 后续文档建议

完成 Telegram 第一阶段后，新增：

- `docs/telegram/Telegram通道配置与排障.md`
- `docs/telegram/消息模板清单.md`
- `docs/telegram/Gate-通知通道验收样例.md`

