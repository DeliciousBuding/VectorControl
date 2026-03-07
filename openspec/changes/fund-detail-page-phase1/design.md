## 上下文

当前前端已经具备：

- `useAppNavigation` 中的 `/fund/:fund_id` 路由跳转；
- `FundDetailPage.jsx` 独立页面组件；
- 以“左侧图表 + 右侧持仓详情”的紧凑布局展示基金详情。

但这些能力尚未通过对应 OpenSpec change 与正式测试完成关单。

## 目标 / 非目标

**目标：**
1. 固化独立基金页路由存在性；
2. 固化详情页左右布局与关键信息区块存在性；
3. 把 `ROADMAP.md` 中两条已实现需求转为已完成。

**非目标：**
1. 本轮不重做基金详情页视觉设计；
2. 本轮不新增新的图表类型；
3. 本轮不扩展新的后端接口。

## 决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 路由验证 | 复用 `useAppNavigation.test.jsx` | 已覆盖 `/fund/:fund_id` 跳转语义 |
| 页面验证 | 新增 `FundDetailPage.test.jsx` | 直接验证独立页主要区块存在 |
| 状态同步 | 回写 `ROADMAP.md` 与 `docs/最新进度.md` | 保持路线图与当前实现一致 |

## 验证策略

1. `npm --prefix frontend run test:run -- src/pages/FundDetailPage.test.jsx src/hooks/useAppNavigation.test.jsx src/api.test.js`
2. 确认 `ROADMAP.md` 中对应两项转为已完成
