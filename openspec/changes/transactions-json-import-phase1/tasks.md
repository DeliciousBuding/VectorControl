## 1. 契约整理

- [x] 1.1 建立 `transactions-json-import-phase1` change 骨架
- [x] 1.2 在 `docs/接口契约.md` 补齐 `/api/transactions/import` 与 `/api/transactions/import_json` 口径

## 2. 实现收口

- [x] 2.1 修正 `/api/transactions/import` 的幂等冲突返回语义，使冲突返回 `409`
- [x] 2.2 保持 `/api/transactions/import_json` 的自动补全能力不变

## 3. 验证

- [x] 3.1 运行 `python -m compileall backend/app`
- [x] 3.2 运行 `PYTHONPATH=backend python -m pytest -q backend/app/api/test_transactions_import_smoke.py`
- [x] 3.3 更新 `docs/最新进度.md` 与 `ROADMAP.md` 中的状态记录
