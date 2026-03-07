## 1. 治理状态整理

- [x] 1.1 建立 `feishu-governance-v2-phase1` change 骨架
- [x] 1.2 为飞书 sender 增加治理状态缓存与 TTL 清理

## 2. 实现

- [x] 2.1 增加同 webhook 最小频控
- [x] 2.2 增加连续失败后的临时隔离
- [x] 2.3 增加结构化治理日志

## 3. 验证

- [x] 3.1 运行 compileall
- [x] 3.2 运行 `backend/app/api/test_notifier_feishu_sender_smoke.py`
- [x] 3.3 更新 `docs/最新进度.md`
- [x] 3.4 更新 `ROADMAP.md`
