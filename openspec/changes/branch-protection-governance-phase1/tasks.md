## 1. OpenSpec 骨架

- [x] 1.1 建立 `branch-protection-governance-phase1` change 骨架
- [x] 1.2 新增分支保护治理 spec

## 2. 仓库内准备

- [x] 2.1 确认当前 workflow contexts 可直接恢复远端 required checks，无需额外调整仓库内脚本
- [x] 2.2 更新相关治理文档口径

## 3. 远端治理恢复

- [x] 3.1 恢复 `dev` 分支 required check：`Docs Gate / docs-gate`
- [x] 3.2 恢复 `main` 分支 required checks：`Docs Gate / docs-gate`、`Release Consistency / verify-release`
- [x] 3.3 留存 GitHub API 查询结果作为证据

## 4. 验证

- [x] 4.1 运行 `python scripts/check_release_preflight.py`
- [x] 4.2 确认 `ROADMAP.md` 最后未勾选项关闭
