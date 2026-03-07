## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer 与 OpenAI 官网的认证入口组织方式
- [x] 1.2 选择 `LoginPanel` 作为认证入口视觉升级的最小闭环

## 2. 认证入口升级

- [x] 2.1 收敛 `LoginPanel` 的工作区头部与摘要卡
- [x] 2.2 收敛登录 / 注册模式切换容器与表单层级
- [x] 2.3 将关键行内样式迁移到统一样式层
- [x] 2.4 补最小回归测试

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/LoginPanel.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
