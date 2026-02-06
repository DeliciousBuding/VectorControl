# Git 工作流（VectorControl）

## 分支模型

- `main`：正式可用版本，仅合并经过验收的变更。
- `dev`：集成分支，功能完成后先进入 `dev`。
- `backend-milestones`：后端功能分支。
- `frontend-milestones`：前端功能分支。
- `data-config`：配置与持仓数据分支。

## 日常流程

1. 从 `dev` 拉取最新代码并创建/更新功能分支。
2. 在本职路径开发并自测。
3. 提交中文 commit message。
4. 合并回 `dev`，处理冲突后再做集成自测。
5. 阶段发布时由 `dev` 合并到 `main`。

## 提交边界

- 前端分支只提交 `frontend/` 与前端相关文档。
- 后端分支只提交 `backend/` 与后端相关文档。
- 数据分支只提交 `config/` 与必要的最小兼容代码。
- 禁止夹带其他分支未完成代码。

## 合并顺序（推荐）

1. `backend-milestones -> dev`
2. `frontend-milestones -> dev`
3. `data-config -> dev`
4. `dev -> main`

## 合并前清单

- `git status --short` 干净。
- 前端构建通过：`npm run build`。
- 后端接口可用：
- `/api/health`
- `/api/config`
- `/api/estimate`
- `/api/risk/overview`

## 中文提交示例

- `功能: 持仓表支持列排序与编辑`
- `修复: 估值接口异常提示文案`
- `重构: 后端路由按领域拆分`
- `文档: 补充开发规范与工作流`
