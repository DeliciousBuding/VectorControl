## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的摘要式工作台组织方式
- [x] 1.2 选择 `RiskCenter` 作为下一处小型高价值区块

## 2. 风险中枢升级

- [x] 2.1 为 `RiskCenter` 增加富标题与风险概览摘要卡
- [x] 2.2 收敛集中度、相关性、压力测试和预警卡片的层级
- [x] 2.3 保持空态继续复用 `SurfaceState`
- [x] 2.4 新增 `RiskCenter` 最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/RiskCenter.test.jsx src/components/TradeCenter.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
