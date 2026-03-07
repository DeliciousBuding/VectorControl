## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的配置 / 摘要区组织方式
- [x] 1.2 选择 `SettingsDrawer` 的网络测速与消息凭据区作为最小闭环

## 2. 设置中心正文升级

- [x] 2.1 收敛 `网络测速` 的头部、摘要卡、参数网格与结果列表
- [x] 2.2 收敛 `飞书机器人` 的状态摘要、参数区与凭据容器
- [x] 2.3 收敛 `Telegram 机器人` 的状态摘要、参数区与自动发现容器
- [x] 2.4 保持现有 `data-testid` 与交互逻辑不变
- [x] 2.5 补最小视觉 contract 测试锚点

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/SettingsDrawer.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
