## 为什么

`/api/transactions/import_json` 与 `/api/transactions/import` 已具备基本能力，但仓库内缺少针对“JSON 导入交易记录”这一需求的独立变更入口，导致标准 JSON 格式、自动补全缺失字段、幂等冲突返回语义没有统一承载。

本轮需要补齐：

1. JSON 导入的契约与验证入口；
2. 单条导入接口的幂等冲突返回语义；
3. 与 `ROADMAP.md`、`docs/最新进度.md` 的状态同步。

## 变更内容

1. 建立 JSON 导入交易记录的 OpenSpec change 骨架。
2. 明确 `/api/transactions/import` 与 `/api/transactions/import_json` 的契约边界。
3. 通过 smoke 验证幂等冲突与自动补全行为。

## 影响

- 让 JSON 导入从“已实现但未完全关单”变为有文档、有验证、有路线图状态的闭环。
- 让后续自动补全、批量导入与冲突处理有统一事实源。
