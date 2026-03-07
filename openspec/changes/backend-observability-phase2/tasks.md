## 1. 观测基线整理

- [x] 1.1 盘点当前 `/api/system/diagnostics`、network benchmark 与部署排障文档中的现有观测字段
- [x] 1.2 梳理热点接口与 SQLite 热点查询的优先观察对象

## 2. 优化拆解

- [x] 2.1 设计热点接口耗时记录与错误分类补强方案
- [x] 2.2 设计 SQLite 热点查询、锁等待或持久化排障的最小观测出口
- [x] 2.3 明确实施后需同步更新的文档与验证清单

## 3. 验证

- [x] 3.1 验证热点接口与诊断输出可用于排障
- [x] 3.2 将本轮后端观测优化结果同步到 `docs/最新进度.md` 与 `ROADMAP.md`
- [x] 3.3 扩展 SQLite 诊断字段（`db_dir`、`synchronous`、`wal_autocheckpoint_pages`、`derived.lock_risk/observations`）并通过 smoke 覆盖稳定输出
- [x] 3.4 在 `request_id` 中间件补齐请求完成结构化日志（`method/path/status_code/request_id/server_elapsed_ms`），并通过 `test_request_id_middleware_smoke.py` 覆盖
- [x] 3.5 将应用启动从 `FastAPI.on_event("startup")` 收敛到 `lifespan`，并通过 `test_app_assembly_smoke.py` + `check_release_preflight.py` 验证预检噪音减少
- [x] 3.6 在 `/api/system/status` 与 `/api/system/diagnostics` 暴露最近请求摘要，并在 `diagnostic_text` 中输出最近请求列表，供热点接口排障直接使用
