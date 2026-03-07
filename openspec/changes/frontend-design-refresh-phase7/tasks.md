## 1. 设计调研

- [x] 1.1 参考 Apple / Material / OpenAI 官网对高密度页面首屏的组织方式
- [x] 1.2 选择 `TradeCenter` 首屏作为本轮最小闭环

## 2. 交易工作台升级

- [x] 2.1 为 `TradeCenter` 增加工作台头部和说明文案
- [x] 2.2 为交易页增加待确认 / 已确认 / 失败待办摘要卡
- [x] 2.3 收敛交易类型切换为统一的低噪声激活态
- [x] 2.4 补齐 `TradeCenter` 最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/TradeCenter.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
