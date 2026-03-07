## 1. 设计调研

- [x] 1.1 参考官方设计规范，确定首页视觉方向与层级目标
- [x] 1.2 明确本轮只改首页叶子组件与样式，不扩大回归面

## 2. 首页工作台升级

- [x] 2.1 为首页新增统一概览区，收纳摘要卡、数据口径与数据质量条
- [x] 2.2 重构 `SummaryCards` 的视觉层级与说明文案
- [x] 2.3 重构 `DataStatusBanner` 为结构化状态信息块
- [x] 2.4 升级 `PortfolioReturnsPanel` 标题区、最新时点与摘要卡层次
- [x] 2.5 收敛 `main.jsx` 中的 Ant Design 主题令牌

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run`
- [x] 3.2 运行 `npm --prefix frontend run build`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 更新 `docs/最新进度.md`、`ROADMAP.md`
