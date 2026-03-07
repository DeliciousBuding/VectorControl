## 为什么

通知通道的 `test_message` 结果模型已经在后端、前端和 `docs/接口契约.md` 中收敛为统一结构，但 `ROADMAP.md` 仍保留为待办，缺少对应 OpenSpec 入口。

需要把这条工作从“已实现未关单”推进到“有 change、有契约、有路线图状态”的闭环。

## 变更内容

1. 建立通知动作结果模型的 OpenSpec change 骨架。
2. 确认 Telegram / 飞书 `test_message` 与 `GET /api/settings/notifications/status` 的 SSOT 口径。
3. 同步更新 `ROADMAP.md` 与 `docs/最新进度.md`。

## 影响

- 让通知动作返回结构具备统一事实源。
- 让前端继续只依赖统一模型渲染提示，而不做 provider 特判。
