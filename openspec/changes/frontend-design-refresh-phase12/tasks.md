## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的设置 / 诊断区组织方式
- [x] 1.2 选择 `SettingsDrawer` 的系统状态与通知诊断作为最小闭环

## 2. 设置中心诊断区升级

- [x] 2.1 收敛 `系统状态` 的头部、快照网格与工具条
- [x] 2.2 收敛 `通知诊断` 的概览卡、摘要块与操作条
- [x] 2.3 保持现有 `data-testid` 与交互逻辑不变
- [x] 2.4 补一个最小视觉 contract 测试锚点

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/SettingsDrawer.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
