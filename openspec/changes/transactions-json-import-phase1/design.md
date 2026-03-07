## 上下文

当前后端已同时提供：

- `POST /api/transactions/import`：单条导入，带幂等键语义；
- `POST /api/transactions/import_json`：批量 JSON 导入，支持 `auto_fetch_nav`、自动补全净值与份额。

但此前单条导入接口对冲突状态的返回码未与 smoke 保持一致，且仓库内缺少对应 OpenSpec 入口与契约口径。

## 目标 / 非目标

**目标：**
1. 固化 JSON 导入功能的契约入口；
2. 明确冲突时返回 `409`；
3. 保留现有自动补全行为并用 smoke 验证。

**非目标：**
1. 本轮不扩展新的导入文件格式；
2. 本轮不改写 YAML 导入规范；
3. 本轮不引入新的外部数据源。

## 决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 单条导入冲突语义 | 返回 `409` | 与 smoke 预期和幂等冲突语义一致 |
| 批量 JSON 导入口径 | 继续复用 `/api/transactions/import_json` | 当前能力已存在，落地成本最低 |
| 验证方式 | `test_transactions_import_smoke.py` | 已覆盖导入、冲突、自动补全等关键链路 |

## 验证策略

1. `python -m compileall backend/app`
2. `PYTHONPATH=backend python -m pytest -q backend/app/api/test_transactions_import_smoke.py`
3. 同步更新 `docs/接口契约.md`、`docs/最新进度.md`、`ROADMAP.md`
