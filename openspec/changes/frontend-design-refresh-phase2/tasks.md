## 1. 设计调研

- [x] 1.1 参考 Ant Design `PageHeader` / Workbench 与 GitHub Primer 布局层级
- [x] 1.2 参考开源 dashboard 的概览优先节奏，确定第二刀只改头部与基准区

## 2. 工具栏与基准区升级

- [x] 2.1 将 `TopToolbar` 升级为双层头部与上下文条结构
- [x] 2.2 将状态、刷新、计算与口径信息前置为上下文条
- [x] 2.3 为 `BenchmarkComparisonPanel` 新增概览卡与更强的标题层级
- [x] 2.4 补齐 `TopToolbar` 的最小交互回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/TopToolbar.test.jsx src/components/BenchmarkComparisonPanel.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 更新 `docs/最新进度.md`、`ROADMAP.md`
