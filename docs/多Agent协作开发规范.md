# 多 Agent 协作开发规范（总控 + 前端1 + 后端1）

更新时间：2026-02-08 14:24:14

## 1. 协作目标

- 在不牺牲质量的前提下提升并行开发效率。
- 保持职责清晰：前端改前端、后端改后端、总控做集成与发布。
- 通过文档化进度与通讯，避免“信息只在聊天里”。

## 2. 角色定义

- 总控 Agent
  - 任务拆分与优先级管理
  - 审阅子 Agent 进度
  - 集成、验收、发布
- 前端 Agent1
  - 负责 `frontend/*` 与前端相关文档
  - 禁止改后端核心逻辑
- 后端 Agent1
  - 负责 `backend/*` 与后端相关文档
  - 禁止改前端核心交互

## 3. Worktree 与分支

- 主仓（总控）：`<local>\VectorControl`
- 前端 worktree：`<local>\VectorControl-frontend-agent1`
- 后端 worktree：`<local>\VectorControl-backend-agent1`

分支规则：

- 前端：`feat/frontend-agent1-<topic>`
- 后端：`feat/backend-agent1-<topic>`
- 总控集成：`dev`

## 4. 强制进度文档

每个 Agent 必须维护自己的进度文件：

- `docs/agent-progress/controller_progress.md`
- `docs/agent-progress/frontend_agent1_progress.md`
- `docs/agent-progress/backend_agent1_progress.md`

跨 Agent 交接与阻塞统一写入：

- `docs/agent-progress/agent_comms.md`

## 5. 写入时机（强制）

- 每完成 1 个小闭环并准备 commit 前：更新本 Agent 进度文档。
- 每次 push 后：在 `agent_comms.md` 增加一条交接记录。
- 遇阻塞时：必须记录“阻塞点 + 需要谁处理 + 最小下一步”。

## 6. 记录模板

进度记录模板：

```text
YYYY-MM-DD HH:MM:SS | Agent | 分支 | 任务 | 结果 | 下一步 | 提交
```

通讯记录模板：

```text
YYYY-MM-DD HH:MM:SS | from -> to | 主题 | 需要协助/交接内容 | 关联文件/接口 | 状态
```

## 7. 总控集成流程

1. 读取三份进度文档与通讯文档。
2. 确认子分支已通过各自最低验证。
3. 合并到 `dev` 后执行统一预检：
   - `python scripts/check_release_preflight.py`
4. 更新 `ROADMAP.md` 与 `docs/最新进度.md`。
5. 保留冲突与决策记录（写入 `controller_progress.md`）。

## 8. 质量底线

- 所有文本文件 `UTF-8 无 BOM`。
- 单个 commit 必须单主题、可回滚、可验收。
- 禁止未测试直接宣称完成。
- 禁止跨职责大范围改动。
