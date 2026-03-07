## 新增需求

### 需求:前端 bundle 优化必须保留可对比基线
第二轮前端 bundle 优化必须建立可重复、可对比的体积与交互基线，避免只记录“做了优化”而没有前后证据。

#### 场景:维护者比较优化前后的大包变化
- **当** 维护者推进第二轮前端 bundle 收缩
- **那么** 必须能够通过 `npm --prefix frontend run analyze` 对比 `antd-vendor`、`echarts-vendor`、主包或页面级 chunk 的变化
- **并且** 必须结合现有 `recordMetric()` 记录说明关键页面或交互的前后差异

### 需求:前端 bundle 优化必须优先复用当前仓库入口
第二轮前端 bundle 优化必须优先复用当前仓库已经存在的脚本、文档与指标入口，而不是新建平行流程。

#### 场景:维护者开始第二轮前端优化
- **当** 维护者开始推进 bundle 收缩或页面级懒加载
- **那么** 应先从 `openspec/changes/frontend-bundle-optimization-phase2/` 读取 proposal / design / tasks
- **并且** 后续结果必须同步回写 `docs/最新进度.md` 与 `ROADMAP.md`
