# Git 工作流（VectorControl）

## 1. 当前执行模式
- 当前模式：总控单人开发（不并行分发）。
- 主分支：`dev`（开发集成）、`main`（稳定发布）。

## 2. 单人开发流程
1. 在 `dev` 上实现单一主题改动（一个最小闭环）。
2. 本地自测（后端 compile + 关键接口、前端 build）。
3. 立即提交该小步改动（中文 commit message），禁止把多个无关功能堆到一个 commit。
4. 同步更新文档（`README.md` + `docs/*.md` + `ROADMAP.md`）并勾选状态。
   - 文档更新时间统一格式：`更新时间：YYYY-MM-DD HH:MM:SS`，必须为真实系统时间。
5. `dev -> main` 前执行文档全量巡检（最少覆盖 `README.md`、`ROADMAP.md`、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`）。
6. 执行发布前一键预检：`python scripts/check_release_preflight.py`（默认包含文档门禁严格模式、后端 compileall、前端 build）。
7. 通过 Gate-A/B/C/D 后再合并 `dev -> main`。
8. push 前由 `.githooks/pre-push` 自动执行：`python scripts/check_docs_gate.py --strict`。
9. PR 到 `dev/main` 时由 `.github/workflows/docs-gate.yml` 执行云端门禁（严格模式 + diff-base）。
10. commit 时由 `.githooks/commit-msg` 自动执行：`python scripts/check_release_message.py`（发布提交强校验）。

## 2.1 main 发布文档检查清单（强制）

- 发布说明必须包含 `新增/修复/优化/文档` 四段，不可省略 `文档`。
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

## 2.2 分支保护治理附录（当前阶段后置）

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

## 2.3 敏捷开发模式（当前阶段）

- 当前阶段采用单人敏捷节奏：分支保护治理项后置，不阻塞当轮功能闭环。
- 当轮优先级：线上可用性故障 > 核心交易链路 > 治理回补。
- 迭代节奏强制要求“小步快跑”：每完成一个小功能/小修复/小文档闭环即提交一次 commit。
- commit 粒度要求：每个 commit 必须做到“单主题、可回滚、可验收”，避免超大提交导致回归定位困难。
- 每轮交付最小标准：
  - 至少完成 1 个可验收闭环（问题修复或功能闭环）
  - 同步更新 `ROADMAP.md` 与 `docs/最新进度.md`
  - 通过 `python scripts/check_release_preflight.py`

## 3. 合并门槛
- Gate-A：按 `docs/部署与运行.md` 可复现。
- Gate-B：接口契约未破坏（`docs/接口契约.md`）。
- Gate-C：外部源失败可降级，页面不崩。
- Gate-D：VPS 部署闭环可验收（HTTPS、容器状态、安全边界）。

## 4. 提交边界
- 功能提交只改本次主题相关文件。
- 文档提交可跨目录，但需同步更新 ROADMAP。
- 严禁提交 `__pycache__`、数据库文件、依赖目录。
- 合并前必须 `git status --short` 干净，避免夹带。

## 5. 未来恢复并行时
- 再启用 `backend-milestones` 与 `frontend-milestones`。
- 先后端再前端按顺序回合并 `dev`。
