## 1. 热修复

- [x] 1.1 定位登录后白屏根因为 `buildFundSeries` 缺失导入
- [x] 1.2 补齐 `App.jsx` 导入并保持其余逻辑不变
- [x] 1.3 补最小回归测试

## 2. 验证与部署

- [x] 2.1 运行 `npm --prefix frontend run test:run -- src/App.test.jsx src/components/PortfolioReturnsPanel.test.jsx`
- [x] 2.2 运行 `python scripts/check_release_preflight.py`
- [ ] 2.3 同步到 `prod` 并执行 `scripts/update_prod.sh`
- [ ] 2.4 使用 Playwright 验证登录后首页可用
- [ ] 2.5 更新 `docs/最新进度.md`、`ROADMAP.md`
