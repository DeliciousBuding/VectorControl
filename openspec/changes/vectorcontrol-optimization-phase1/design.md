## 上下文

当前仓库已经完成了从“不可直接部署”到“HTTP + SQLite 最小闭环可部署”的收敛，但治理层和优化层仍缺一块正式桥梁：

- `README.md`、`ROADMAP.md`、`docs/开发规范.md`、`docs/Git工作流.md` 已经在强调文档门禁、发布预检与 Gate-D。
- `scripts/check_docs_gate.py` 已经能校验部分关键文件，但当前追踪文档集合仍小于仓库文档中声明的主发布巡检范围。
- `docs/Gate-D验收证据模板.md`、`docs/P0线上故障排查SOP.md` 仍残留 HTTPS / postgres / `deploy/nginx/site.conf` 等旧口径。
- 前端已经具备：
  - `frontend/src/utils/metrics.js` 本地指标记录
  - `frontend/src/App.jsx` 多处 `recordMetric()` 埋点
  - `frontend/vite.config.js` 的 chunk 拆分和 `visualizer`
- 但目前 `frontend/package.json` 没有正式的分析脚本，性能优化尚未进入门禁与文档体系。

因此第一批优化不应直接从大规模代码重构开始，而应先建立一条“文档定义 -> 任务拆解 -> 脚本入口 -> 验收更新”的正式路径。

## 目标 / 非目标

**目标：**
1. 在 `VectorControl` 仓库内建立最小可用的 OpenSpec 变更骨架。
2. 统一当前发布/部署/故障排查/验收的事实源口径。
3. 为性能优化建立正式入口（至少覆盖前端构建分析与现有 metrics 说明）。
4. 保持当前 `check_release_preflight.py`、`.githooks/pre-push`、Gate-D 能继续工作。

**非目标：**
1. 本轮不做大规模前端重构（如拆 `App.jsx` / `SettingsDrawer.jsx`）。
2. 本轮不做后端数据库层重构或语言迁移。
3. 本轮不引入 PostgreSQL、HTTPS 或新的外部监控系统。
4. 本轮不修改用户未要求的分支策略与发布规则。

## 决策

| 决策 | 选择 | 理由 |
|------|------|------|
| OpenSpec 接入方式 | 薄接入 | 保留 `docs/` 与 `ROADMAP.md`，只补 `openspec/` 作为变更骨架，成本最低 |
| 首个 change 范围 | 治理与基线收口 | 先保证后续优化有统一入口，而不是直接进入大改 |
| docs gate 扩展策略 | 对齐仓库已声明的主发布巡检范围 | 避免“文档宣称检查了，但脚本没检查” |
| 性能优化入口 | 先补分析与文档入口，不先补复杂自动化 | 利用现有 `vite visualizer`、`recordMetric`、diagnostics 能力，快速落地 |
| 事实源口径 | 以当前真实运行基线为准 | 当前已落地的是 HTTP + Nginx + backend + SQLite |

## 风险 / 权衡

1. **文档门禁扩大后，维护成本会上升**
   - 权衡：这是有意为之。仓库已经显式要求全量巡检，脚本必须与规则一致。

2. **OpenSpec 接入过快可能与现有 docs 重复**
   - 权衡：本次仅做“薄接入”，不迁移既有长文，减少重复。

3. **性能分析入口一旦加入脚本，可能影响发布速度**
   - 权衡：首批只补 `analyze` 入口与文档，不把性能分析强制加入 preflight。

4. **当前工作区已有较多未提交改动**
   - 权衡：本轮变更必须最小化，避免覆盖既有已完成收敛工作。

## 验证策略

1. 新增的 `openspec/changes/vectorcontrol-optimization-phase1/` 结构完整。
2. `docs/Gate-D验收证据模板.md`、`docs/P0线上故障排查SOP.md`、`README.md` 等关键文档与当前事实源一致。
3. `scripts/check_docs_gate.py --strict` 通过。
4. `python scripts/check_release_preflight.py` 通过。
5. `frontend/package.json` 可执行正式分析入口（例如 `npm --prefix frontend run analyze`）。
6. 所有新增/修改文档使用 `更新时间：YYYY-MM-DD HH:MM:SS` 头部格式。
