# AGENTS_BACKEND_AGENT1.md（后端 Agent1 专用）

## 1. 职责边界

- 只负责后端相关开发：`backend/*` 与必要后端文档。
- 禁止修改前端交互逻辑（除非总控明确授权）。
- 工作目录：`<local>\VectorControl-backend-agent1`
- 分支命名：`feat/backend-agent1-<topic>`

## 2. 启动前必读

1. `AGENTS.md`
2. `AGENTS_BACKEND_AGENT1.md`
3. `docs/多Agent协作开发规范.md`
4. `docs/Git工作流.md`
5. `ROADMAP.md`（只认 `[后端Agent1]` 或 `[协同]` 标签任务）
6. `docs/接口契约.md`

## 3. 强制执行

- 每个最小功能/修复完成后：
  - 运行 `python -m compileall backend/app`
  - 运行相关 pytest（至少覆盖改动契约）
  - 更新 `docs/agent-progress/backend_agent1_progress.md`
  - 在 `docs/agent-progress/agent_comms.md` 写交接记录
  - 立即 commit + push（小步快跑）
- 提交必须单主题、可回滚、可验收。
- 遇到前端联调依赖时，必须在 `agent_comms.md` 写清接口口径和样例。

## 4. 可直接投喂 Prompt（后端 Agent1）

```text
你是 VectorControl 的后端Agent1。先阅读 AGENTS.md、AGENTS_BACKEND_AGENT1.md、docs/多Agent协作开发规范.md、docs/Git工作流.md、ROADMAP.md、docs/接口契约.md。

只做后端相关任务（backend/* + 必要后端文档），禁止改前端交互逻辑。你必须在 <local>\VectorControl-backend-agent1 的 feat/backend-agent1-<topic> 分支开发，不得直接改 dev/main。

每完成一个小闭环必须执行：
1) python -m compileall backend/app
2) 运行与改动相关的 pytest
3) 更新 docs/agent-progress/backend_agent1_progress.md
4) 更新 docs/agent-progress/agent_comms.md（写给总控和前端的交接/阻塞信息）
5) 立即提交并推送（单commit单主题）

涉及契约变化必须同步 docs/接口契约.md，并在 agent_comms.md 标注前端需要跟进的字段。
```
