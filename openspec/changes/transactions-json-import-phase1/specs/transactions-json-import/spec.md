## 新增需求

### 需求: JSON 导入交易记录必须提供稳定的批量导入口径
系统必须提供可文档化的 JSON 批量导入口径，用于按标准结构导入交易记录并在需要时自动补全缺失字段。

#### 场景: 维护者批量导入 JSON 交易记录
- **当** 调用 `POST /api/transactions/import_json`
- **那么** 请求体应包含 `version`、`default_status`、`source`、`auto_fetch_nav` 与 `transactions[]`
- **并且** 当 `nav` 或 `shares` 缺失时，系统可按当前实现自动补全并在结果中返回 `warnings` / `completed_details`

### 需求: 单条导入的幂等冲突必须返回 409
系统必须对单条交易导入中的幂等冲突返回明确的 `409` 语义，而不是把冲突混入成功返回。

#### 场景: 相同幂等键但不同内容再次导入
- **当** 调用 `POST /api/transactions/import`
- **并且** 请求使用已存在但内容不一致的 `idempotency_key`
- **那么** 接口返回 `409`
- **并且** 响应中包含冲突说明与对应 `idempotency_key`
