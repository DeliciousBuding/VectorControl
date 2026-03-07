## 为什么

`ROADMAP.md` 里仍有一条未关闭的消息通道增强项：Telegram `chat_id` 自动发现。

当前设置中心要求用户同时填写 `bot_token` 与 `chat_id`，这会让 Telegram 绑定流程停留在“先自己找 chat_id，再粘贴回系统”的手工模式。仓库已经具备 Telegram 发送与测试消息能力，缺少的只是一个最小 inbound webhook 闭环。

## 变更内容

1. 为 Telegram 增加独立 secret 驱动的 inbound webhook 接收入口。
2. 允许只保存 `bot_token`，由 inbound update 自动回写 `chat_id`。
3. 在设置中心提供最小自动发现入口与提示。
4. 同步更新 `docs/接口契约.md`、`docs/部署与运行.md`、`ROADMAP.md` 与 `docs/最新进度.md`。

## 影响

- 用户不再需要手工查询并粘贴 Telegram `chat_id`。
- Telegram 绑定链路从“手工外查”收敛为“保存 bot_token -> 设置 webhook -> 向 bot 发消息 -> 系统自动回写”。
- 生产部署需要开放当前 HTTP/HTTPS 基线下的公开 webhook 路径，但不改变现有 SSH / 网络拓扑。
