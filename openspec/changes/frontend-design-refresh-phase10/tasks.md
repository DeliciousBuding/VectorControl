## 1. 设计调研

- [x] 1.1 参考 Apple HIG、Google Material、GitHub Primer Page Layout / Table 经验与 OpenAI 官网的产品语言
- [x] 1.2 选择 `HoldingsTable` 作为高频数据表格的最小闭环

## 2. 持仓表视觉升级

- [x] 2.1 为 `HoldingsTable` 增加头部摘要卡与工具栏分组
- [x] 2.2 收敛表格外壳与列设置菜单样式
- [x] 2.3 修正行 hover / 选中 / 编辑态 class 接通
- [x] 2.4 补齐 `HoldingsTable` 最小回归测试锚点

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/HoldingsTable.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
