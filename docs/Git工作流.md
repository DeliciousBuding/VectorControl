# Git 工作流（VectorControl）

## 1. 当前执行模式
- 当前模式：三 Agent 并行开发（总控 Agent + 前端 Agent1 + 后端 Agent1）。
- 主分支：
  - `dev`：集成分支（仅总控 Agent 合并）
  - `main`：发布分支（仅总控 Agent 发布）

## 2. Worktree 初始化（强制）

在 `<local>` 根目录执行：

```powershell
git -C <local>\VectorControl worktree add <local>\VectorControl-frontend-agent1 -b feat/frontend-agent1-<topic> dev
git -C <local>\VectorControl worktree add <local>\VectorControl-backend-agent1 -b feat/backend-agent1-<topic> dev
```

目录职责：

- `<local>\VectorControl`：总控 Agent（集成/发布）
- `<local>\VectorControl-frontend-agent1`：前端 Agent1
- `<local>\VectorControl-backend-agent1`：后端 Agent1
- `<local>\AGENT`：跨 worktree 共享规范、进度与通讯（唯一沟通真源）

## 3. 子 Agent 开发流程（前端/后端）

1. 在自己的 worktree 和分支开发，不得改主仓。
2. 每轮只做 1 个最小闭环（功能或修复）。
3. 本地验证：
   - 前端 Agent：`npm --prefix frontend run build`
   - 后端 Agent：`python -m compileall backend/app` + 相关 pytest
4. 更新进度文档（强制）：
   - 前端：`<local>\AGENT\frontend_agent1_progress.md`
   - 后端：`<local>\AGENT\backend_agent1_progress.md`
5. 在 `<local>\AGENT\agent_comms.md` 留交接记录（已完成/待对接/阻塞）。
6. 立即提交并推送本分支（小步快跑，单主题 commit）。

## 4. 总控 Agent 集成流程

1. 读取三份进度文档与通讯文档，确认可集成项。
   - `<local>\AGENT\controller_progress.md`
   - `<local>\AGENT\frontend_agent1_progress.md`
   - `<local>\AGENT\backend_agent1_progress.md`
   - `<local>\AGENT\agent_comms.md`
2. 拉取前后端分支，进行冲突处理与联调。
3. 合并到 `dev` 前统一执行：
   - `python scripts/check_release_preflight.py`
   - 必要 smoke tests
4. 同步更新：
   - `ROADMAP.md`
   - `docs/最新进度.md`
   - 相关契约文档
5. 合并入 `dev` 并推送。

## 5. 进度文档写入规范（强制）

- 每条记录格式建议：
  - `时间 | Agent | 分支 | 任务 | 结果 | 下一步 | 关联提交`
- 要求：
  - 不允许“只改代码不写进度”
  - 不允许“只写完成，不写阻塞和待对接”
  - 总控 Agent 以文档为准做任务编排与冲突仲裁

## 6. main 发布文档检查清单（强制）

- 发布说明必须包含 `新增/修复/优化/文档` 四段，不可省略 `文档`。
- 文档巡检覆盖清单（固定）：
  - `README.md`
  - `ROADMAP.md`
  - `docs/架构说明.md`
  - `docs/开发规范.md`
  - `docs/接口契约.md`
  - `docs/交易流水YAML导入规范.md`
  - `docs/P0线上故障排查SOP.md`
  - `docs/状态解释验收样例.md`
  - `docs/最新进度.md`
  - `docs/Git工作流.md`
  - `docs/部署与运行.md`
- `文档` 段至少写明：
  - 本次核对过的文档范围
  - 已更新的文档与核心变更点
  - 是否存在延后更新项（如有，必须写入 `ROADMAP.md`）
- `.githooks/commit-msg` 已对发布提交启用强校验：`文档` 段缺少“检查范围 / 更新结论 / 延后项”任一项都会失败。
- 若文档与代码不一致，禁止发布到 `main`。
- 本地若未启用 hooks，执行：`git config core.hooksPath .githooks`。
- 建议在仓库分支保护中将 `Docs Gate` 设为必需状态检查。
- 发布提交标题格式：`发布: vX.Y.Z - 一句话摘要`，且正文必须包含 `新增/修复/优化/文档` 四段。
- 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。
- `main` 推送后云端自动执行：`.github/workflows/release-consistency.yml`。
- 发布后验收留档使用：`docs/Gate-D验收证据模板.md`。

## 7. 分支保护治理附录（当前阶段后置）

说明：当前敏捷阶段该部分不作为迭代阻塞条件，仅用于后续治理回补。

1. 准备管理员 Token（`GITHUB_TOKEN`，需具备仓库管理权限）。
   - PowerShell：`$env:GITHUB_TOKEN="<token>"`
   - Bash：`export GITHUB_TOKEN="<token>"`
   - 或使用 GitHub CLI：`gh auth login`（脚本会自动尝试 `gh auth token` 回退）
2. 检查当前分支保护：
   - `python scripts/branch_protection.py --mode check --required-contexts "Docs Gate / docs-gate" --main-required-contexts "Release Consistency / verify-release"`
3. 一键应用分支保护（`dev/main`）：
   - `python scripts/branch_protection.py --mode apply --required-contexts "Docs Gate / docs-gate" --main-required-contexts "Release Consistency / verify-release"`
4. 再次检查确认：
   - `python scripts/branch_protection.py --mode check --required-contexts "Docs Gate / docs-gate" --main-required-contexts "Release Consistency / verify-release"`
5. （可选）仅对 `main` 额外检查发布一致性状态检查：
   - `python scripts/branch_protection.py --mode check --branches main --required-contexts "Docs Gate / docs-gate" --main-required-contexts "Release Consistency / verify-release"`

默认基线（脚本内置）：
- 分支：`dev`、`main`
- 必需状态检查：`Docs Gate / docs-gate`
- `main` 额外状态检查：`Release Consistency / verify-release`（通过 `--main-required-contexts` 指定）
- `required_status_checks.strict=true`
- `required_approving_review_count>=1`
- `enforce_admins=true`

## 8. 敏捷开发模式（当前阶段）

- 当前阶段采用多 Agent 敏捷节奏：分支保护治理项后置，不阻塞当轮功能闭环。
- 当轮优先级：线上可用性故障 > 核心交易链路 > 治理回补。
- 迭代节奏强制要求“小步快跑”：每完成一个小功能/小修复/小文档闭环即提交一次 commit。
- commit 粒度要求：每个 commit 必须做到“单主题、可回滚、可验收”，避免超大提交导致回归定位困难。
- 每轮交付最小标准：
  - 至少完成 1 个可验收闭环（问题修复或功能闭环）
  - 同步更新 `ROADMAP.md` 与 `docs/最新进度.md`
  - 通过 `python scripts/check_release_preflight.py`

## 9. 合并门槛
- Gate-A：按 `docs/部署与运行.md` 可复现。
- Gate-B：接口契约未破坏（`docs/接口契约.md`）。
- Gate-C：外部源失败可降级，页面不崩。
- Gate-D：VPS 部署闭环可验收（HTTPS、容器状态、安全边界）。

## 10. 提交边界
- 功能提交只改本次主题相关文件。
- 文档提交可跨目录，但需同步更新 ROADMAP。
- 严禁提交 `__pycache__`、数据库文件、依赖目录。
- 合并前必须 `git status --short` 干净，避免夹带。
