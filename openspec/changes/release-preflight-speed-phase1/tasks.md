## 1. 方案整理

- [x] 1.1 建立 `release-preflight-speed-phase1` change 骨架
- [x] 1.2 确认可并发的前置步骤为 docs gate / secrets leak / backend compileall

## 2. 实现

- [x] 2.1 将前置独立步骤改为并发执行
- [x] 2.2 为每一步输出增加耗时
- [x] 2.3 保持后续 smoke / tests / build 串行

## 3. 验证

- [x] 3.1 运行 `python scripts/check_release_preflight.py`
- [x] 3.2 更新 `docs/最新进度.md`
- [x] 3.3 更新 `ROADMAP.md`
