## 为什么

`ROADMAP.md` 目前仅剩一项未关闭：恢复 GitHub 远端分支保护中的必需检查留档。

仓库内工作流已具备：

- `Docs Gate / docs-gate`
- `Release Consistency / verify-release`

但 GitHub 远端的 `dev` / `main` 分支当前都未启用对应的 branch protection required checks，导致仓库声明与远端治理状态不一致。

## 变更内容

1. 在 GitHub 远端恢复：
   - `dev`：`Docs Gate / docs-gate`
   - `main`：`Docs Gate / docs-gate` + `Release Consistency / verify-release`
2. 回写 `ROADMAP.md`、`docs/最新进度.md` 与相关治理文档。

## 影响

- 让仓库内声明的“PR 到 dev/main 必须过门禁”重新与 GitHub 远端实际配置一致。
- 降低文档/发布门禁被绕过的风险。
