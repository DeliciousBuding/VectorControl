## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的详情页区块组织方式
- [x] 1.2 选择 `FundDetailPage` 的净值走势与交易记录作为最小闭环

## 2. 基金详情二级区块升级

- [x] 2.1 收敛 `净值走势` 的摘要头部与性能快照卡
- [x] 2.2 收敛 `交易记录` 的摘要头部与执行快照卡
- [x] 2.3 保持图表、表格与返回行为不变
- [x] 2.4 补最小视觉 contract 测试锚点

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/pages/FundDetailPage.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
