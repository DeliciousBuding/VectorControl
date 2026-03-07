## 1. 基线整理

- [x] 1.1 记录 `npm --prefix frontend run analyze` 当前 chunk 基线，标出 `antd-vendor`、`echarts-vendor`、主包与页面级 chunk
- [ ] 1.2 结合现有 `recordMetric()` 输出，整理首页、交易入口、设置中心的关键交互基线

## 2. 优化拆解

- [x] 2.1 梳理适合页面级懒加载的入口与高成本依赖边界
- [x] 2.2 拆解 `antd` / `echarts` 热点引入路径，确定第二轮优先收缩项
- [x] 2.3 明确优化实施后需要同步更新的 README / `docs/最新进度.md` / `ROADMAP.md` 记录

## 3. 验证

- [x] 3.1 运行 `npm --prefix frontend run analyze`
- [x] 3.2 对比优化前后 chunk 与 metrics 变化，并记录到 `docs/最新进度.md`
- [x] 3.3 通过页面级 lazy 化与未使用依赖清理将 `index` 主包收敛到约 `125.66 kB`，并将 `antd-vendor` 收敛到约 `960.94 kB`
- [x] 3.4 去除 `echarts-for-react` 运行时包装后，将首页图表 runtime chunk 从约 `581.33 kB` 收敛到约 `552.04 kB`，并保持 `ReturnsChart` / `BenchmarkComparison` 行为不变
- [x] 3.5 将首页主路径切回 `PortfolioReturnsPanel` / `BenchmarkComparisonPanel` 轻量实现后，analyze 输出中不再出现独立 ECharts runtime chunk
- [x] 3.6 确认前端源码已无真实 ECharts 运行时引用后，删除 `echartsCore.js` / `ReturnsChart.jsx` / `BenchmarkComparison.jsx` 并移除 `echarts`、`echarts-for-react` 依赖；重新执行 `test:run` 与 `analyze` 后，源码与产物中均不再存在 ECharts runtime
- [x] 3.7 将交易中心抽离为懒加载 `TradeCenter.jsx` 并拆出 `trade-antd` 分块；重新执行 `test:run` 与 `analyze` 后，`index` 收敛到约 `105.56 kB`、`antd-vendor` 收敛到约 `849.94 kB`，同时记录当前仍存在的循环分块告警作为下一刀输入
- [x] 3.8 将 `SettingsDrawer` 中的 `Drawer width` 弃用用法收敛为 `size`，并通过 `src/components/SettingsDrawer.test.jsx` 验证测试输出不再包含对应 deprecation 警告
