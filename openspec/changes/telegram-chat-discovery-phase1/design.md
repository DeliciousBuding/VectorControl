## 上下文

当前仓库已具备：

- Telegram 发送器与 `POST /api/settings/notifications/telegram/test_message`；
- 设置中心 Telegram 凭据配置入口；
- `GET /api/settings/notifications/status` 诊断视图；
- 当前生产 HTTP 基线已在 `prod` 通过 Gate-D。

缺口在于：用户必须自己提供 `chat_id`，而系统尚无接收 Telegram update 并自动绑定 `chat_id` 的入口。

## 目标 / 非目标

**目标：**
1. 增加带独立 secret 的 Telegram inbound webhook；
2. 允许只保存 `bot_token`，在收到 update 后自动回写 `chat_id`；
3. 让设置中心能显示 webhook URL / 最近发现结果；
4. 补齐 smoke、契约与部署文档。

**非目标：**
1. 本轮不引入 Telegram 长轮询；
2. 本轮不改变现有消息发送模型；
3. 本轮不改 SSH 配置、域名拓扑或额外网关层。

## 方案

1. 在用户设置中为 Telegram 增加 `chat_auto_discovery_secret` 与最近发现摘要字段。
2. 新增授权接口生成/轮换 discovery secret，并按 `VC_SCHEME + VC_DOMAIN` 返回 webhook URL。
3. 新增公开 inbound route，按 secret 绑定用户并从 Telegram update 中提取 `chat.id`，成功后回写：
   - `notifications.telegram.chat_id`
   - 最近发现时间 / chat_id / chat 元信息
4. 设置中心增加“自动发现 chat_id”提示与按钮；诊断状态展示最近发现结果。

## 风险与缓解

1. **secret 泄露风险**：只在显式 discovery 接口返回 secret，不在 `GET /api/settings` 明文回显，并在审计日志中脱敏。
2. **公开入口误调用**：webhook 路径包含高熵 secret，未命中时返回未找到或未处理。
3. **部署口径不一致**：统一通过 `VC_SCHEME` / `VC_DOMAIN` 生成 webhook URL，并在 `docs/部署与运行.md` 写明配置步骤。

## 验证策略

1. 新增 Telegram discovery smoke：secret 生成、inbound 回写 chat_id、无效 secret 拒绝。
2. 回归现有 Telegram 凭据、测试消息与通知状态 smoke。
3. 前端跑 `npm --prefix frontend run test:run`。
4. 部署到 `prod` 后实测 webhook 路径与设置中心状态。
