## 1. 设计调研

- [x] 1.1 参考 Ant Design Workbench 与详情页信息优先级原则
- [x] 1.2 参考 Primer split page layout 与 Saleor Dashboard 的详情页节奏

## 2. 基金详情页升级

- [x] 2.1 升级 `FundDetailPage` 头部为页面身份 + 状态标签结构
- [x] 2.2 增加详情页概览卡，前置市值、收益和当日涨跌
- [x] 2.3 统一左右双栏卡片标题、状态块和最新净值视觉语言
- [x] 2.4 补齐详情页最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/pages/FundDetailPage.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
