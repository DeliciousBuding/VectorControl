## 为什么

第一轮收口已经补齐 `npm --prefix frontend run analyze` 正式入口，并在 `docs/最新进度.md` 中确认当前最大 chunk 仍集中在 `antd-vendor` 与 `echarts-vendor`。这意味着第二轮优化需要从“有入口”进入“有目标、有拆解、有验证”的 bundle 收缩阶段。

当前还存在三类直接问题：

1. 首屏体积仍偏大，页面级 chunk 与重依赖边界尚未收敛。
2. `recordMetric()` 已经存在，但缺少和 bundle 优化一一对应的基线记录方式。
3. README / ROADMAP / 最新进度 尚未给出第二轮前端优化的固定入口，后续执行容易再次回到口头驱动。

## 变更内容

1. 建立第二轮前端 bundle 优化 change 骨架。
2. 明确 `antd` / `echarts` / 主包 / 页面级 chunk 的基线记录与优化顺序。
3. 规定第二轮必须复用现有 `recordMetric()` 与文档入口记录优化前后差异。

## 影响

- 为后续前端 bundle 收缩、页面级懒加载与指标对比提供统一入口。
- 让 `docs/最新进度.md`、`ROADMAP.md` 与 OpenSpec change 保持同一条执行链路。
- 不在本 change 骨架阶段直接改动前端代码或构建配置。
