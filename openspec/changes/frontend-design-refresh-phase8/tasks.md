## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的高密度工作台组织方式
- [x] 1.2 选择 `TradeCenter` 中后段作为本轮最小闭环

## 2. 交易工作台中后段升级

- [x] 2.1 收敛 `交易生命周期` 的富标题、阶段摘要与步骤卡层级
- [x] 2.2 收敛 `交易流水` 的摘要层、筛选工具条与对账结果条
- [x] 2.3 将交易相关空态 / 错误态 / 加载态接入 `SurfaceState`
- [x] 2.4 补齐 `TradeCenter` 的视觉 contract 回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/TradeCenter.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
