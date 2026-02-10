# Git 工作流（VectorControl）
> 最后更新: 2026-02-10 17:55:40 (UTC+8)

## 1. 当前执行模式

- 当前模式：两人协作开发（总工程师 + 龙虾 bot）。
- 主分支：
  - `dev`：开发集成分支（总工程师负责）
  - `main`：发布分支（总工程师负责发布）
  - `bot`：龙虾机器人自动迭代分支（定期由总工程师评估合并到 dev）

## 2. 分支策略

仅保留三条分支，职责清晰：

| 分支 | 职责 | 谁负责 |
|------|------|--------|
| `main` | 生产环境部署（prod），仅接收可上线版本 | 总工程师 |
| `dev` | 开发与集成，所有功能在此开发和测试 | 总工程师 |
| `bot` | 龙虾机器人自动迭代，独立开发新功能 | 龙虾 bot |

## 3. 总工程师开发流程

1. 在 `dev` 分支直接开发，小步快跑。
2. 本地验证：
   - 前端：`npm --prefix frontend run build`
   - 后端：`python -m compileall backend/app`
3. 单 commit 单主题，提交信息直接说明完成了什么。
4. 定期评估 `bot` 分支的变更，合并有价值的内容到 `dev`：
   ```bash
   git fetch origin
   git diff --stat dev origin/bot
   git merge bot --no-ff -m "合并: 将 bot 分支变更集成到 dev"
   ```

## 4. bot 分支合并流程

1. 查看 bot 分支的新提交：`git log --oneline dev..origin/bot`
2. 查看文件级差异：`git diff --stat dev origin/bot`
3. 评估代码质量与冲突风险
4. 合并到 dev：`git merge bot --no-ff`
5. 解决冲突（如有）
6. 本地验证通过后提交

## 5. main 发布流程

1. 确认 `dev` 分支所有功能稳定可用
2. 发布前执行预检：`python scripts/check_release_preflight.py`
3. 确定版本号（`git tag --sort=-v:refname` 查看当前最新）
4. 合并到 main 并写发布说明：
   ```bash
   git checkout main
   git merge dev --no-ff -m "发布: vX.Y.Z - 一句话摘要

   新增: ...
   修复: ...
   优化: ...
   文档: 检查范围：...; 更新结论：...; 延后项：无"
   ```
5. 打 Tag：`git tag vX.Y.Z`
6. 推送：`git push origin main --tags`
7. 更新 bot 分支到最新：
   ```bash
   git checkout bot && git merge dev && git push origin bot
   ```

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
- 发布前执行：`python scripts/check_release_preflight.py`
- 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`

## 7. 合并门槛

- Gate-A：按 `docs/部署与运行.md` 可复现。
- Gate-B：接口契约未破坏（`docs/接口契约.md`）。
- Gate-C：外部源失败可降级，页面不崩。
- Gate-D：VPS 部署闭环可验收（HTTPS、容器状态、安全边界）。

## 8. 提交边界

- 功能提交只改本次主题相关文件。
- 文档提交可跨目录，但需同步更新 ROADMAP。
- 严禁提交 `__pycache__`、数据库文件、依赖目录。
- 合并前必须 `git status --short` 干净，避免夹带。
- 提交标题格式规范：
  - 普通提交格式：`前缀: 一句话说明`（支持 `:` / `：`，且冒号后必须有空格）。
  - 允许中文前缀：`功能`、`修复`、`优化`、`重构`、`文档`、`测试`、`构建`。
  - 禁止英文前缀：`feat`、`fix`、`docs`、`chore`、`refactor`、`test`、`style`、`perf`、`build`、`ci`、`revert`。
  - 发布提交格式：`发布: vX.Y.Z - 一句话摘要`，正文必须包含 `新增/修复/优化/文档` 四段。
