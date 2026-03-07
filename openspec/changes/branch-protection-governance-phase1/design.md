## 上下文

当前远端状态（执行前）：

- `dev` 未受保护；
- `main` 未受保护；
- `Docs Gate` 工作流已对 `pull_request -> dev/main` 生效；
- `Release Consistency` 工作流已存在且 required check context 可直接被远端保护引用。

## 目标 / 非目标

**目标：**
1. 恢复 GitHub 远端 required status checks；
2. 将治理状态回写到文档与路线图。

**非目标：**
1. 本轮不重构 GitHub Actions 结构；
2. 本轮不新增新的 required check；
3. 本轮不引入仓库外的分支保护脚本。

## 方案

1. 使用 GitHub REST API 对远端分支保护做最小恢复：
   - `dev` 仅要求 `Docs Gate / docs-gate`
   - `main` 要求 `Docs Gate / docs-gate` 与 `Release Consistency / verify-release`
2. 将恢复结果写入 `docs/最新进度.md`、`ROADMAP.md` 与治理文档。

## 验证策略

1. 使用 GitHub API 读取 `dev` / `main` branch protection，确认 contexts 生效；
2. 运行 `python scripts/check_release_preflight.py`；
3. 提交并记录远端返回结果。
