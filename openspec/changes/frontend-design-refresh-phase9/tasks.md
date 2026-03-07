## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer Form Control / Page Layout 与 OpenAI 官网的产品区块组织方式
- [x] 1.2 选择 `SIPPlanManager` 作为交易页相邻断层的最小闭环

## 2. 定投自动化区块升级

- [x] 2.1 为 `SIPPlanManager` 增加区块头部与摘要卡
- [x] 2.2 收敛计划表单、计划卡和动作按钮的层级
- [x] 2.3 将登录 / 加载 / 空态 / 错误态接入 `SurfaceState`
- [x] 2.4 新增 `SIPPlanManager` 最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/SIPPlanManager.test.jsx src/components/TradeCenter.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
