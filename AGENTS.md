# AGENTS.md（VectorControl 仓库级执行规范）

本文件是本仓库自动化 Agent 的最高执行规范（仅次于用户当轮明确指令）。
优先级：`用户当轮指令 > AGENTS.md > ROADMAP.md > docs/*`

## 1. 分支与发布（强制）

- `dev`：开发集成分支（仅总控 Agent 有权执行最终合并）
- `main`：唯一发布分支（仅接收可上线版本）
- 禁止在 `main` 直接开发功能
- 多 Agent 开发时，子 Agent 只能在自己的功能分支开发并推送，不得直接改 `dev/main`
- 分支命名规则：
  - 前端 Agent：`feat/frontend-agent1-<topic>`
  - 后端 Agent：`feat/backend-agent1-<topic>`
  - 总控集成：`dev`（只由总控 Agent 执行合并、冲突处理、统一验收）
- 分支保护治理目标：远端仓库 `dev/main` 启用分支保护（`Docs Gate` / `Release Consistency`）。
- 当前敏捷阶段：分支保护治理后置，不阻塞当轮 `dev` 迭代与本地测试；回补任务以 `ROADMAP.md` 为准。
- 分支保护检查/应用脚本：`python scripts/branch_protection.py --mode check|apply --required-contexts "Docs Gate / docs-gate" --main-required-contexts "Release Consistency / verify-release"`（治理回补时执行）

## 1.1 多 Agent 角色（强制）

- 总控 Agent：任务拆分、标准下发、集成验收、冲突仲裁、`dev/main` 发布
- 前端 Agent1：仅负责前端与交互相关实现（`frontend/*` + 必要前端文档）
- 后端 Agent1：仅负责后端与数据相关实现（`backend/*` + 必要后端文档）
- 共享角色规范文件（必须遵守，位于 `<local>\AGENT`）：
  - `<local>\AGENT\AGENTS_CONTROLLER.md`
  - `<local>\AGENT\AGENTS_FRONTEND_AGENT1.md`
  - `<local>\AGENT\AGENTS_BACKEND_AGENT1.md`

## 1.2 Worktree 目录（强制）

- 总控 Agent：`<local>\VectorControl`（主仓）
- 前端 Agent1：`<local>\VectorControl-frontend-agent1`
- 后端 Agent1：`<local>\VectorControl-backend-agent1`
- 子 Agent 不得在主仓目录直接开发。

## 1.3 进度与通讯（强制）

- 每个 Agent 必须维护自己的进度文档（共享目录 `<local>\AGENT`）：
  - `<local>\AGENT\controller_progress.md`
  - `<local>\AGENT\frontend_agent1_progress.md`
  - `<local>\AGENT\backend_agent1_progress.md`
- 跨 Agent 依赖、阻塞、交接必须写入共享通讯文档：
  - `<local>\AGENT\agent_comms.md`
- 规则：
  - 每完成 1 个小闭环并准备提交前，先更新对应进度文档。
  - 每次 push 后，必须在 `agent_comms.md` 留一条“已完成/待对接”记录。
  - 总控 Agent 合并前，必须先读取三份进度文档 + 通讯文档再决策。

## 2. 版本号规则（强制）

- 每次发布到 `main` 必须带版本号
- 版本号格式：`vMAJOR.MINOR.PATCH`（例如 `v1.0.3`）
- 发布动作必须包含：
  - 创建并推送对应 Tag
  - 在提交信息或发布说明中明确版本号

## 3. main 发布说明规则（强制）

- 任何带版本号的 `main` 发布提交，不得只写“合并 dev”
- 必须明确写出本次改进内容，至少包含三项：
  - `新增`：新增了什么能力
  - `修复`：修复了什么问题
  - `优化`：优化了什么体验或性能
- 推荐提交格式：
  - 标题：`发布: vX.Y.Z - 一句话摘要`
  - 正文：
    - `新增: ...`
    - `修复: ...`
    - `优化: ...`
    - `文档: ...`
- 提交信息自动校验：
  - `.githooks/commit-msg` 会执行 `python scripts/check_release_message.py <msg_file>`
  - 发布提交（标题以 `发布:` 开头）必须通过版本号与四段内容校验
  - 其中 `文档:` 段必须包含三类信息：`检查范围`、`更新结论`、`延后项（无则写“无”）`
- 发布后一致性校验：
  - `python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`
  - 校验提交标题版本号、`新增/修复/优化/文档` 四段、Tag 与远端一致性

## 3.1 main 文档门禁（强制）

- 每次更新 `main` 前，必须完成文档全量检查与必要完善，范围至少包含：
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
- 文档检查要求：
  - 与本次代码改动一致，不允许“代码已变更、文档未同步”
  - 删除或标记过期描述，避免出现多个冲突口径
  - 保持 `UTF-8 无 BOM`
  - 发布前执行：`python scripts/check_docs_gate.py`（含核心文档、发布模板、文档范围一致性、`.githooks/*` 与 `.github/workflows/*` 门禁文件校验）
  - push 前执行：`.githooks/pre-push`（`python scripts/check_docs_gate.py --strict`）
  - PR 到 `dev/main` 时执行：`.github/workflows/docs-gate.yml`
- `main` 发布说明中必须增加 `文档:` 小节，写明本次检查与更新结论（例如：`文档: 已完成全量巡检并同步 API 与 ROADMAP`）。

## 4. main 推送后默认动作（强制）

- `main` 有新发布后，默认执行 VPS 更新与验证流程：
  1. SSH 登录 VPS
  2. 拉取 `origin/main`
  3. 执行更新脚本
  4. 执行发布一致性校验脚本（`check_main_release.py`）
  5. 执行 Gate-D 验收脚本
  6. 输出访问地址和验收结果

## 5. VPS 测试账号与数据（强制）

- 每次 `main` 发布后，VPS 必须保证可用测试账号与样例数据
- 默认测试账号：`admin`
- 密码必须高强度，不允许弱口令
- 必须保证测试账号可看到持仓数据（真实持仓或明确样例）

## 6. 开发铁律

- 所有文档、注释、提交信息使用中文
- 所有文本文件统一为 `UTF-8 无 BOM`
- 关键文档更新时间统一写成 `更新时间：YYYY-MM-DD HH:MM:SS`，且必须为真实系统时间，不得追加说明文本
- 改动遵循“最小闭环”，禁止顺手大改
- 必须执行“小步快跑”提交策略：每实现 1 个小功能、1 个可验证修复或 1 组同主题文档更新，立即提交 1 次 commit；禁止长时间堆积未提交改动
- 单个 commit 必须可解释、可回滚、可验收，提交信息需直接说明该小步闭环完成了什么
- 每个 Agent 在每次 commit 前必须更新自己的进度文档；未更新进度文档视为未完成交付
- 总控 Agent 合并前必须核对 `<local>\AGENT\*.md` 与实际代码改动一致
- 提交前必须通过：
  - 前端：`npm run build`
  - 后端：`python -m compileall app`
- 代码改动必须同步更新文档和 `ROADMAP.md`
- 发布前统一执行：`python scripts/check_release_preflight.py`（文档门禁严格模式 + 后端 compileall + 前端 build）

## 7. Gate 约束

- Gate-A：新环境 5 分钟可复现基础闭环
- Gate-B：接口契约稳定且联调通过
- Gate-C：外部数据源失败可降级且可解释
- Gate-D：VPS 部署闭环（Compose + Nginx + HTTPS/HTTP 最小闭环 + 验收脚本）

## 8. 禁止行为

- 禁止未授权破坏性命令（如 `git reset --hard`、全仓 `git clean -fdx`）
- 禁止无关重构、无关美化、无关依赖升级
- 禁止未验收就宣称“完成”

## 9. 停止条件

- 当轮目标完成且验收通过：输出“本轮完成，等待下一指令”并停止
- 若遇阻塞：输出阻塞点与下一步最小动作后停止
