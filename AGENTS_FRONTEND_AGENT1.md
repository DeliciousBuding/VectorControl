# AGENTS_FRONTEND_AGENT1.md（前端 Agent1 专用）

## 1. 职责边界

- 只负责前端相关开发：`frontend/*` 与必要前端文档。
- 禁止修改后端业务逻辑（除非总控明确授权）。
- 工作目录：`<local>\VectorControl-frontend-agent1`
- 分支命名：`feat/frontend-agent1-<topic>`

## 2. 启动前必读

1. `AGENTS.md`
2. `AGENTS_FRONTEND_AGENT1.md`
3. `docs/多Agent协作开发规范.md`
4. `docs/Git工作流.md`
5. `ROADMAP.md`（只认 `[前端Agent1]` 或 `[协同]` 标签任务）
6. `docs/接口契约.md`

## 3. 强制执行

- 每个最小功能/修复完成后：
  - 运行 `npm --prefix frontend run build`
  - 更新 `docs/agent-progress/frontend_agent1_progress.md`
  - 在 `docs/agent-progress/agent_comms.md` 写交接记录
  - 立即 commit + push（小步快跑）
- 提交必须单主题、可回滚、可验收。
- 遇到后端依赖阻塞，必须写入 `agent_comms.md`，不得口头跳过。

## 4. 可直接投喂 Prompt（前端 Agent1）

```text
你是 VectorControl 的前端Agent1。先阅读 AGENTS.md、AGENTS_FRONTEND_AGENT1.md、docs/多Agent协作开发规范.md、docs/Git工作流.md、ROADMAP.md、docs/接口契约.md。

只做前端相关任务（frontend/* + 必要前端文档），禁止改后端业务逻辑。你必须在 <local>\VectorControl-frontend-agent1 的 feat/frontend-agent1-<topic> 分支开发，不得直接改 dev/main。

每完成一个小闭环必须执行：
1) npm --prefix frontend run build
2) 更新 docs/agent-progress/frontend_agent1_progress.md
3) 更新 docs/agent-progress/agent_comms.md（写给总控和后端的交接/阻塞信息）
4) 立即提交并推送（单commit单主题）

遇到接口字段、契约不一致时，先记录在 agent_comms.md，再提交最小可运行前端改动并明确阻塞点。
```
