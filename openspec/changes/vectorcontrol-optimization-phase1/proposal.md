## 为什么

当前 `VectorControl` 已具备基础发布门禁、最小部署闭环和核心测试，但仍存在三类直接阻碍“文档驱动 + 无人值守持续优化”的问题：

1. **OpenSpec 变更入口缺失**
   - 仓库内尚未建立 `openspec/` 变更骨架，导致需求、设计、任务与长期规范没有统一承载层。
2. **文档事实源存在漂移**
   - `docs/Gate-D验收证据模板.md`、`docs/P0线上故障排查SOP.md`、`README.md` 等文件与当前真实部署基线（HTTP + Nginx + backend + SQLite）未完全对齐。
   - `scripts/check_docs_gate.py` 当前覆盖范围小于仓库文档声明的发布巡检范围，削弱了门禁可信度。
3. **性能优化缺少正式入口与量化基线**
   - 当前前端已具备 `recordMetric()` 本地事件记录、`vite` 分 chunk 配置、后端已有 diagnostics / benchmark 能力，但缺少一套文档化、可执行、可验收的性能优化基线流程。

现在是收口的时机，因为：
- 仓库已经进入可部署状态，适合从“能跑”升级到“可持续优化”。
- 用户明确要求进入文档驱动、无人值守的持续优化模式。
- 后续继续开发前，必须先建立变更骨架、统一事实源、补齐性能分析入口。

## 变更内容

1. **新增仓库内 OpenSpec 变更骨架**
   - 为 `VectorControl` 建立最小可用的 `openspec/changes/` 与 `openspec/specs/` 结构。
   - 首个 change 聚焦“第一批优化收口”，而不是泛化到所有未来需求。

2. **收敛发布与运维事实源**
   - 统一当前生产基线口径为：`HTTP + Nginx + backend + SQLite`。
   - 修正文档中仍指向 HTTPS / postgres / 旧 Nginx 配置的内容。
   - 让 docs gate 的“必查范围”与 README / ROADMAP / Git 工作流中的文档巡检范围保持一致。

3. **建立性能优化的正式入口**
   - 在文档与脚本层补齐前端分析入口与性能基线说明。
   - 将现有 `frontend/src/utils/metrics.js`、`vite analyze`、`/api/system/diagnostics`、`network-benchmark` 纳入同一条优化链路。

## 功能 (Capabilities)

### 新增功能

- **delivery-governance**：定义发布文档门禁、部署验收与事实源同步规则
- **frontend-performance-baseline**：定义前端体积分析、性能记录与基线验收入口
- **openspec-usage-in-vectorcontrol**：在仓库内建立变更驱动优化的最小 OpenSpec 入口

### 修改功能

- **发布门禁范围**：让 docs gate 与文档声明的巡检范围保持一致
- **Gate-D 验收留档**：将模板更新到当前真实基线
- **线上故障 SOP**：更新到当前 Nginx 与部署事实

## 影响

- 新增 `openspec/` 目录与首个变更包
- 更新发布/运维/验收文档
- 更新文档门禁脚本与前端 package scripts
- 为后续每轮优化建立统一的 change -> task -> verify 入口
