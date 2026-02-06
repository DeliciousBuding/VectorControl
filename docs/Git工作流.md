# Git 工作流（VectorControl）

## 1. 当前执行模式
- 当前模式：总控单人开发（不并行分发）。
- 主分支：`dev`（开发集成）、`main`（稳定发布）。

## 2. 单人开发流程
1. 在 `dev` 上实现单一主题改动。
2. 本地自测（后端 compile + 关键接口、前端 build）。
3. 中文 commit message。
4. 同步更新文档（`README.md` + `docs/*.md` + `ROADMAP.md`）并勾选状态。
5. 通过 Gate-A/B/C/D 后再合并 `dev -> main`。

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
