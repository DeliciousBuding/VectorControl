# VectorControl Unified ROADMAP (Repo Synced Copy)

更新时间：2026-08-11 18:45:18

规则：`[ ]` 待完成，`[√]` 已完成（完成后尽快归档到 `docs/ROADMAP完成归档.md`）。

## 全局发布门禁（每次 `main` 更新都必须执行）

1. 文档全量巡检与必要完善（至少覆盖：`README.md`、`ROADMAP.md`（镜像）、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`）。
2. 发布前执行：`python scripts/check_release_preflight.py`（默认包含文档门禁严格模式、敏感信息扫描、后端 compileall、后端烟测、前端测试、前端 build）。
3. push 前确保 `.githooks/pre-push` 严格检查通过（`python scripts/check_secrets_leak.py` + `python scripts/check_docs_gate.py --strict`）。
4. 发布提交必须包含 `新增/修复/优化/文档` 四段，且 `文档` 段必须写清"检查范围 + 更新结论 + 延后项（无则写无）"。
5. 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。

## 当前迭代策略（敏捷）

1. 本阶段忽略分支保护相关治理项，不作为迭代阻塞条件。
2. 每轮只推进 1-2 个可验收闭环，优先线上可用性与核心交易链路。
3. 每轮必须同时更新：代码 + 文档 + `ROADMAP` + 验收记录。
4. 进入无人值守连续推进模式时，严格按"一个闭环完成 -> 运行验证 -> 更新文档/OpenSpec/ROADMAP -> 再进入下一个闭环"的顺序执行，不允许跳过验证直接堆叠改动。
5. 不得进行权限外操作：不修改 SSH 主密钥、不修改 SSH config、不改网络拓扑、不做未获授权的外发或系统级破坏性操作。
6. 只有当以下条件同时满足时，才允许视为"当前轮次已无值得继续优化的内容"：
   - 发布链路、docs gate、preflight、Gate-D 持续稳定为绿；
   - 第二轮前端 bundle / 加载时机 / metrics 优化项全部完成；
   - 第二轮后端热点 / 观测 / SQLite 排障出口全部完成；
   - P0 线上证据、故障关闭留档、Gate-D 实机证据全部补齐；
   - 当前 `ROADMAP.md` 中不再存在可继续推进的高优先级优化项。

### 无人值守执行顺序（总控）

按以下顺序循环推进，前一闭环未完成不得切下一闭环：

1. **发布与治理闭环**：docs gate / release preflight / release consistency / Gate-D 证据与故障留档
2. **前端性能闭环**：analyze 基线 / 页面级懒加载 / 重依赖拆分 / metrics 对照与回归
3. **后端观测闭环**：request_id / elapsed / system diagnostics / SQLite 只读观测 / 热点接口耗时与排障出口
4. **业务体验闭环**：基金详情页 / 持仓表 / JSON 导入 / 交易与设置相关体验增强
5. **线上证据闭环**：实机截图 / postmortem / 审核版归档

### 每个闭环的固定动作

1. 先更新对应 OpenSpec change / tasks / 设计说明。
2. 再做最小代码改动，不扩大无关回归面。
3. 跑 focused tests / build / compileall / docs gate / preflight 中与该闭环相关的最小验证。
4. 将结果回写：`docs/最新进度.md`、`ROADMAP.md`、对应 `openspec/changes/*/tasks.md`。
5. 若验证失败，先修复当前闭环，不开启下一个闭环。

## 集成队列（总控维护）

说明：记录"已推送待集成"的闭环，便于总控按单 commit 单主题合入 dev；合入后从本段移除，并在对应任务条目标记"已合入 dev@xxxx"。

- 当前无待集成条目

## P0–P3 任务

当前无未完成条目；历史已完成项（发布链路收敛、视觉升级 phase1–18、前端 bundle/后端观测优化、通知通道、故障关闭留档等）已按规则归档到 `docs/ROADMAP完成归档.md`。
