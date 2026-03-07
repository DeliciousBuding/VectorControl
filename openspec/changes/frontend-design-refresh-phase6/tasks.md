## 1. 设计调研

- [x] 1.1 参考 Apple HIG / Material / OpenAI 官方站点的状态反馈经验
- [x] 1.2 选择高频页面先落地统一状态语言

## 2. 全局状态语言升级

- [x] 2.1 新增统一的 `SurfaceState` 组件
- [x] 2.2 在 `BenchmarkComparisonPanel` 中替换 loading / error / empty 占位
- [x] 2.3 在 `FundDetailPage` 中替换加载 / 错误 / 空态
- [x] 2.4 在 `RiskCenter` 中替换无数据占位
- [x] 2.5 补齐 `SurfaceState` 最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/SurfaceState.test.jsx src/components/BenchmarkComparisonPanel.test.jsx src/pages/FundDetailPage.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
