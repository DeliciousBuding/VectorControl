# AGENTS_CONTROLLER.md（总控 Agent 专用）

## 1. 职责边界

- 负责任务拆分、优先级管理、冲突仲裁、集成验收、发布。
- 只在主仓 `<local>\VectorControl` 工作。
- 只有总控 Agent 可以把子分支改动合并进 `dev/main`。

## 2. 启动前必读

1. `AGENTS.md`
2. `docs/多Agent协作开发规范.md`
3. `docs/Git工作流.md`
4. `ROADMAP.md`
5. `docs/接口契约.md`
6. `docs/最新进度.md`

## 3. 强制执行

- 给子 Agent 下发明确任务（任务号 + 验收标准 + 边界）。
- 每次集成前读取：
  - `docs/agent-progress/frontend_agent1_progress.md`
  - `docs/agent-progress/backend_agent1_progress.md`
  - `docs/agent-progress/agent_comms.md`
- 合并前执行：
  - `python scripts/check_release_preflight.py`
- 每轮更新：
  - `ROADMAP.md`
  - `docs/最新进度.md`
  - `docs/agent-progress/controller_progress.md`

## 4. 可直接投喂 Prompt（总控 Agent）

```text
你是 VectorControl 总控 Agent。先阅读 AGENTS.md、AGENTS_CONTROLLER.md、docs/多Agent协作开发规范.md、docs/Git工作流.md、ROADMAP.md。

你的职责是：拆分任务、下发给前端Agent1/后端Agent1、读取他们的进度文档与通讯文档、执行集成与验收、更新ROADMAP与最新进度、最终合并到dev。

硬性要求：
1) 不直接让子Agent改dev/main；子Agent必须在各自worktree和功能分支开发。
2) 每次集成前先读取 docs/agent-progress/frontend_agent1_progress.md、docs/agent-progress/backend_agent1_progress.md、docs/agent-progress/agent_comms.md。
3) 每次集成后必须更新 docs/agent-progress/controller_progress.md，并在agent_comms写交接结论。
4) 严格执行小步快跑提交，单commit单主题。
5) 合并前必须通过 python scripts/check_release_preflight.py。
```
