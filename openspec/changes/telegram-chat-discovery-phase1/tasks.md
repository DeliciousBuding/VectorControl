## 1. OpenSpec 骨架

- [x] 1.1 建立 `telegram-chat-discovery-phase1` change 骨架
- [x] 1.2 新增 Telegram chat_id 自动发现 spec

## 2. 后端实现

- [x] 2.1 为 Telegram 设置增加 discovery secret 与最近发现摘要字段
- [x] 2.2 增加 secret 生成 / 轮换接口
- [x] 2.3 增加公开 inbound webhook 并自动回写 `chat_id`
- [x] 2.4 更新通知状态接口，暴露 discovery 摘要

## 3. 前端与文档

- [x] 3.1 设置中心增加 Telegram chat_id 自动发现入口与提示
- [x] 3.2 更新 `docs/接口契约.md`
- [x] 3.3 更新 `docs/部署与运行.md`
- [x] 3.4 更新 `docs/最新进度.md`、`ROADMAP.md`

## 4. 验证

- [x] 4.1 新增并通过 Telegram discovery smoke
- [x] 4.2 运行 `python scripts/check_release_preflight.py`
- [x] 4.3 运行 `npm --prefix frontend run test:run`
- [x] 4.4 部署到 `prod` 并验证 inbound webhook / 状态回写
