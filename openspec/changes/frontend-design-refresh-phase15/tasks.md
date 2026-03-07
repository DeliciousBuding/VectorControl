## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的摘要面板表达
- [x] 1.2 选择 `DiagnosticsPanel` 作为 dev-only 诊断区的最小闭环

## 2. dev-only 诊断区升级

- [x] 2.1 收敛 `DiagnosticsPanel` 的摘要头部、状态卡和动作区
- [x] 2.2 补齐空态、错误态与诊断文本容器
- [x] 2.3 保持生产环境不渲染的约束不变
- [x] 2.4 补最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/DiagnosticsPanel.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
