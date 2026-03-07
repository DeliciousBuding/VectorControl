## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的风险 / 摘要区组织方式
- [x] 1.2 选择 `RiskStatusBar` 作为风险入口视觉升级的最小闭环

## 2. 风险状态条升级

- [x] 2.1 收敛 `RiskStatusBar` 的快照说明区、摘要卡与 CTA 层级
- [x] 2.2 补齐空态的快照式表达
- [x] 2.3 保持现有跳转行为不变
- [x] 2.4 补一个最小视觉 contract 测试锚点

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/RiskStatusBar.test.jsx src/components/RiskCenter.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
