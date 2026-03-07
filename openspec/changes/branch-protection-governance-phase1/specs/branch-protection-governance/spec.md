## 新增需求

### 需求: GitHub 远端分支保护必须与仓库治理声明一致
仓库声明要求 `dev/main` 受云端门禁保护时，GitHub 远端必须恢复对应 required checks。

#### 场景: 恢复 `dev` 分支保护
- **当** 查看 GitHub 远端 `dev` 分支保护
- **那么** 必须包含 `Docs Gate / docs-gate` required check

#### 场景: 恢复 `main` 分支保护
- **当** 查看 GitHub 远端 `main` 分支保护
- **那么** 必须包含 `Docs Gate / docs-gate` 与 `Release Consistency / verify-release` required checks

#### 场景: PR 到 `main`
- **当** 有 PR 指向 `main`
- **那么** `Release Consistency / verify-release` 必须能作为 PR check 实际触发
