# ROADMAP 完成归档

归档日期：2026-02-07  这里也需要写成最新的系统时间精确点
来源文件：`ROADMAP.md`（归档前版本）  
说明：仅归档已完成项（`[√]`）。未完成项已迁移到新的 `ROADMAP.md` 待办清单。

## 1. 治理与门禁
- [√] 统一分支策略（`main` 稳定、`dev` 迭代）。
- [√] 文档、注释、提交信息统一中文。
- [√] Gate-A：本地 5 分钟可复现闭环。
- [√] Gate-B：核心接口契约冻结并回归通过。
- [√] Gate-C：外部源失败可降级，覆盖率可视化。
- [√] Gate-D：部署闭环脚手架完成，HTTP 最小闭环已通过 `check_gate_d.py`。

## 2. 多用户与数据隔离
- [√] 注册/登录/会话校验基础能力。
- [√] 业务数据按 `user_id` 隔离。
- [√] 持仓 CRUD 最小闭环。
- [√] 切账号隔离回归用例。

## 3. 前端主工作台
- [√] 底部 5 Tab 导航结构。
- [√] 首页任务流（资产总览 + 主动作 + 今日待办）。
- [√] 持仓主表日期化表头与双行高密展示。
- [√] 排序三态（不排序/升序/降序）与稳定排序。
- [√] 分组顺序固定（国内/港股在上，美股/海外在下）。
- [√] 基金详情核心字段与多周期图表。
- [√] 图表基准虚线（0%/成本线）与口径统一。

## 4. 交易与消息
- [√] 交易链路最小闭环（买入/定投/赎回/转换页面骨架与流程入口）。
- [√] 消息中心最小可用（交易/提醒/系统分类）。
- [√] 最近交易记录最小可用。

## 5. 数据口径与可观测
- [√] `/api/estimate` 输出覆盖率（`coverage.total/ok/failed`）。
- [√] 昨日收益“确认值优先，估算回退”。
- [√] 市场分组规则固化（含 QDII 归类）。
- [√] `as_of / updated_at / confirm_state` 展示规则固化。
- [√] 刷新链路单请求化（`/api/estimate` 内联 `risk_overview`，前端不再二次请求风险接口）。

## 6. 生产部署（当前轮次）
- [√] `deploy/docker-compose.prod.yml` 生产编排（nginx/backend/postgres）。
- [√] `scripts/deploy_prod.sh` 一键部署（支持 `VC_ENABLE_TLS=false` HTTP 最小闭环）。
- [√] `scripts/check_gate_d.py` 部署验收脚本（首页、健康、鉴权、容器状态）。
- [√] `docs/部署与运行.md` 补齐生产部署、验收、回滚步骤。

## 7. 文档治理与发布门禁（2026-02-07 增量）
- [√] `README.md` 建立文档导航与 SSOT 矩阵。
- [√] 将“main 发布前必须完成文档全量检查与完善”写入 `AGENTS.md` / `docs/Git工作流.md` / `docs/架构说明.md`。
- [√] 新增 `scripts/check_docs_gate.py`：校验核心文档存在、UTF-8 无 BOM、发布模板四段完整性。
- [√] 新增 `.githooks/pre-push`：push 前执行 `python scripts/check_docs_gate.py --strict`。
- [√] 新增 `.github/workflows/docs-gate.yml`：PR 到 `dev/main` 自动执行严格门禁。
- [√] 新增 `scripts/check_release_message.py` + `.githooks/commit-msg`：发布提交强校验 `vX.Y.Z` 与 `新增/修复/优化/文档` 四段。
- [√] 新增 `scripts/check_main_release.py` + `.github/workflows/release-consistency.yml`：发布后校验提交、Tag 与远端一致性。
- [√] 新增 `docs/Gate-D验收证据模板.md`：标准化上线验收留档。
- [√] 新增 `docs/架构决策记录.md`（ADR）：沉淀关键架构取舍。

## 8. 可解释性与系统自省第一阶段（2026-02-07 增量）
- [√] `GET /api/system/status` 后端接口落地（版本、commit、数据快照、任务状态）。
- [√] `/system/status` 前端页面落地（我的页入口 + 手动刷新）。
- [√] `data_status` 第一阶段落地：`/api/estimate`、`/api/holdings*`、`/api/funds/*`、`/api/actions` 统一返回 `status/asof/note`。
- [√] 页面状态解释第一阶段落地：首页/持仓/交易/基金中心显示口径条与说明。

## 9. 基金能力第一阶段（2026-02-07 增量）
- [√] 落库 `fund_nav_daily`、`fund_source_job` 并接入读写链路。
- [√] 新增 `GET /api/funds/search`（代码/名称/拼音/简称模糊检索）。
- [√] 新增 `GET /api/funds/{fund_id}`（基金主信息）。
- [√] 新增 `GET /api/funds/{fund_id}/nav/latest` 与 `GET /api/funds/{fund_id}/nav/history`（估值快照优先 + 实时抓取回退）。
- [√] 新增 `POST /api/funds/sync` 与 `GET /api/funds/sync/jobs/{job_id}`（管理员）。
- [√] 前端基金独立详情路由与最小展示闭环（`/funds/:fund_id`）。
- [√] 交易页基金关键词自动补全第一阶段。

## 10. 交易事实能力增量（2026-02-07）
- [√] 交易/赎回支持 `occurred_at`（具体发生时间）并打通后端存储。
- [√] 定义 `transactions_import.yaml` 规范 v1：见 `docs/交易流水YAML导入规范.md`。

## 11. 交易导入与查询接口（2026-02-07 增量）
- [√] 新增 `POST /api/transactions/import_yaml`：支持 YAML 导入、幂等跳过、冲突识别、`added/skipped/conflicted/warnings` 统计。
- [√] 新增 `GET /api/transactions`：支持 `all/pending/confirmed` 过滤并输出 `summary` 汇总。
- [√] 交易接口已接入 `data_status`（`status/asof/note`），用于解释 pending/confirmed 双态口径。
- [√] 新增烟测 `backend/app/api/test_transactions_import_smoke.py`：覆盖导入与隔离关键路径。

## 12. pending 对账第一阶段（2026-02-07 增量）
- [√] 新增 `POST /api/transactions/sync_pending`：按 `fund_nav_daily` 净值补全 `pending -> confirmed`。
- [√] 对账过程回写 `nav/shares/confirmed_at/source(updated)`，并刷新 `data_status` 口径。
- [√] 新增烟测 `test_sync_pending_transitions_to_confirmed`：验证对账迁移成功。
- [√] 交易页前端接入 `sync_pending`：支持状态筛选、对账按钮、结果反馈与 `data_status` 联动展示。
- [√] 基金详情页前端接入 `sync_pending`：支持按 `fund_id` 对账当前基金，并展示该基金交易双态汇总。
- [√] 交易接口支持 `fund_id`：可按单基金查询交易流水，并执行单基金 pending 对账。
- [√] 持仓页基金详情图表区接入 `data_status`：图表提示联动 `status/asof/note`，显式区分已确认/估算中/部分可用。
- [√] 将 `data_status` 与 `/api/system/status` 固化到 Gate-D 回归清单：`docs/Gate-D验收证据模板.md` 增加必查字段与截图索引。
- [√] 新增 `docs/状态解释验收样例.md`：沉淀接口样例、页面验收点与截图留档规范。
- [√] 交易页新增生命周期最小图：`pending -> confirmed -> 计入收益` 三阶段可视化与当前节点高亮。
- [√] 发布流程执行化：发布提交 `文档:` 段增加“检查范围 / 更新结论 / 延后项”强校验（`scripts/check_release_message.py`）。
- [√] 交易手工修正闭环：新增 `PATCH /api/transactions/{id}`，支持关键字段修正并写入 `audit_logs` 审计记录。

## 13. ROADMAP 二次瘦身归档（2026-02-08）
- [√] 刷新慢优化第二阶段：落地估值快照缓存 + 基金级增量刷新，减少全量重算。
- [√] 前端错误反馈统一收敛：登录、刷新、设置、交易关键路径统一可读错误与下一步提示。
- [√] 发布流程执行化：每次 `main` 发布在提交说明 `文档:` 段写清“检查范围 + 更新结论 + 延后项”。
- [√] `data_status` 第二阶段后端落地：`/api/transactions` 与 `sync_pending` 统一口径返回。
- [√] `data_status` 第二阶段前端落地：交易页、基金详情页与图表区联动显示状态口径。
- [√] 状态解释回归固化：`data_status` 与 `/system/status` 纳入 Gate-D 模板必查项。
- [√] 输出 `docs/状态解释验收样例.md`：沉淀接口样例、页面验收点与留档规范。
- [√] 交易导入规范与接口第一阶段完成：`transactions_import.yaml` + `POST /api/transactions/import_yaml` + `GET /api/transactions`。
- [√] 交易生命周期最小图落地：交易页显示 `pending -> confirmed -> 计入收益` 当前节点。
- [√] 风险状态条前置与持仓操作闭环落地：`Risk Status Bar` + `Edit/Audit` 快捷入口 + 历史变更记录。
- [√] 图表纪律改造完成：收益 `0%` 基准线、成本线、Mini-Sparkline 时间范围标注与对比度增强。
