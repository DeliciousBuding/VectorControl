## 1. 设计调研

- [x] 1.1 参考 Ant Design Workbench / Navigation / Layout 的工作台导航原则
- [x] 1.2 参考 GitHub Primer 与 Saleor Dashboard 的后台导航层级

## 2. 导航体系升级

- [x] 2.1 新增共享导航配置，统一标签、图标、分组与说明文案
- [x] 2.2 升级 `SideNav` 为“品牌区 + 当前工作区 + 分组导航 + 底部说明”结构
- [x] 2.3 升级 `BottomTabs`，复用共享导航配置并补齐图标与当前态
- [x] 2.4 补齐 `SideNav` / `BottomTabs` 最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/SideNav.test.jsx src/components/BottomTabs.test.jsx src/components/TopToolbar.test.jsx src/components/BenchmarkComparisonPanel.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
