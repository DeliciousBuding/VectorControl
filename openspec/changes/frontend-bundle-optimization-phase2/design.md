## 上下文

当前仓库已经完成第一轮文档与门禁收口，前端也已经具备正式分析入口：`npm --prefix frontend run analyze`。从现有进度记录看，下一阶段的核心问题已经比较明确：

- 构建最大 chunk 仍集中在 `antd-vendor` 与 `echarts-vendor`
- 第二轮计划包含页面级懒加载与 bundle 收缩
- 现有 `recordMetric()` 需要与 bundle 变化建立可对照基线

因此，第二轮前端优化应先把“优化入口、对比口径、最小验证”定义清楚，再进入代码级拆分。

## 目标 / 非目标

**目标：**
1. 定义前端 bundle 优化的第二轮入口与执行顺序。
2. 明确构建分析、页面级懒加载与 `recordMetric()` 基线之间的对应关系。
3. 给出后续实现阶段必须更新的文档与验证出口。

**非目标：**
1. 本骨架阶段不直接重写 `App.jsx` 或大规模拆组件。
2. 本骨架阶段不替换 `antd`、`echarts` 等核心依赖。
3. 本骨架阶段不引入新的前端性能平台或外部监控。

## 决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 基线来源 | `npm --prefix frontend run analyze` + `recordMetric()` | 与第一轮已落地入口保持一致，避免重复体系 |
| 优化粒度 | 先页面级/高成本模块拆分，再看更细粒度依赖收缩 | 对现有代码侵入更小，便于逐步验证 |
| 文档出口 | `docs/最新进度.md` + `ROADMAP.md` + 本 change | 保持 README / 路线图 / OpenSpec 同步 |

## 验证策略

1. 记录当前构建分析结果，至少覆盖 `antd-vendor`、`echarts-vendor`、主包与页面级 chunk。
2. 记录关键页面或入口的现有 `recordMetric()` 基线，确保后续优化有前后对照。
3. 后续进入实现阶段后，继续使用 `npm --prefix frontend run analyze` 与文档记录确认变化。
