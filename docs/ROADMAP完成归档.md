# ROADMAP 完成归档
> 最后更新: 2026-02-10 19:16:30 (UTC+8)

归档日期：2026-02-10 19:16:30
来源文件：`ROADMAP.md`（归档前版本）
说明：仅归档已完成项（`[√]`）。未完成项已迁移到新的 `ROADMAP.md` 待办清单。

---

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
- [√] 昨日收益"确认值优先，估算回退"。
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
- [√] 将"main 发布前必须完成文档全量检查与完善"写入 `AGENTS.md` / `docs/Git工作流.md` / `docs/架构说明.md`。
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
- [√] 发布流程执行化：发布提交 `文档:` 段增加"检查范围 / 更新结论 / 延后项"强校验（`scripts/check_release_message.py`）。
- [√] 交易手工修正闭环：新增 `PATCH /api/transactions/{id}`，支持关键字段修正并写入 `audit_logs` 审计记录。

## 13. ROADMAP 二次瘦身归档（2026-02-08）
- [√] 刷新慢优化第二阶段：落地估值快照缓存 + 基金级增量刷新，减少全量重算。

## 14. v1.1.0 发布归档（2026-02-10）
### P0 稳定性与发布门禁
- [√] [后端Agent1] 修复测速 TLS EOF 误报：`network_benchmark` 支持站点级协议/端口与 HTTPS->HTTP 回退（`backend/app/core/network_benchmark.py`）。
- [√] [后端Agent1] 修复周末"估算中"误导：估值引擎在 `cn_hk/us_overseas` 周末按最近结算口径输出 `confirm_state=confirmed`（`backend/app/estimator/engine.py`）。
- [√] [后端Agent1] 修复 VPS 测速 `Not Found`：完成后端路由、Nginx 转发与服务路径三段排查并给出修复提交（新增 `/api/network-benchmark/*` 兼容路由与 Nginx 历史路径重写）。
- [√] [前端Agent1] 对齐测速接口联调与错误态兜底：确保"设置中心 -> 测速"在后端异常时可解释、不白屏，并补齐回归用例（前端错误提示已透传 `X-Request-ID` 并补齐 api 层回归用例）。
- [√] [前端Agent1] 修复"设置中心白屏"并补齐回归用例（抽屉打开、测速模块渲染、异常兜底）。
- [√] [后端Agent1] 基于 `docs/Gate-D验收证据模板.md` 补齐测速接口验收证据（见 `docs/Gate-D测速NotFound后端证据.md`，含路由命中、代理配置、服务路径与 VPS 补录命令）。
- [√] [后端Agent1] Secrets Leak Guard v1：新增敏感信息正则扫描（至少覆盖 Telegram bot token 形态与飞书 webhook URL 形态），并接入 `scripts/check_release_preflight.py` 与 `.githooks/pre-push`，阻断误提交；提示需可解释且给出定位行。
- [√] [后端Agent1] Secrets Leak Guard v1.1：扩展常见密钥形态扫描（低误报优先）并补 --selftest。
- [√] [后端Agent1] 双故障关闭留档 v1（后端侧）：按 `docs/P0线上故障排查SOP.md` 起草 postmortem（根因/影响面/修复提交/回归证据/预防项）。
- [√] [前端Agent1] 双故障关闭留档 v1（前端侧）：为 `docs/Gate-D设置中心测速前端证据.md` 补齐"实机截图清单 + 占位符 + 验收勾选表"。
- [√] [后端Agent1] 增加 `/api/settings/network-benchmark/latest|run` 与兼容路径的路由级 smoke 测试，防止"接口存在但线上回归不可见"。
- [√] [后端Agent1] 为 `POST /api/settings/network-benchmark/run` 增加入参强校验（`profile` 枚举、`timeout_seconds` 范围），避免当前静默回退导致误配置不可感知。
- [√] [后端Agent1] 增加全局 `request_id` 中间件与 `X-Request-ID` 响应头，统一日志关联。
- [√] [前端Agent1] 设置中心补齐飞书高级参数编辑入口（`timeout_seconds/retry_times/template`）并与契约字段对齐。
- [√] 评估并落地 `GET /api/settings` 中敏感配置脱敏策略（如 `webhook_url` 部分掩码 + 单独"更新凭据"写接口），降低前端日志/录屏泄露风险。

### 收益曲线与基准对比
- [√] [协同] 收益曲线最小闭环：后端提供 `/api/charts/*`（基于 estimate_snapshot 聚合）+ 前端首页展示"组合收益曲线"缩略图。
- [√] [前端Agent1] 首页收益曲线体验 v2：用 `/api/charts/returns_history` 展示大号曲线（纯 SVG，无新依赖）+ 最近 7 天 day_profit 列表 + 7/30/90 切换，补最小回归。
- [√] [前端Agent1] 收益曲线体验 v3（摘要信息）：在收益曲线面板增加累计收益/最大回撤/近30天波动摘要与口径提示，补最小回归。
- [√] [前端Agent1] 收益曲线体验 v4（空数据与异常点展示）：空状态可解释、缺失天断线、异常点 marker。
- [√] [后端Agent1] 基准对比 v1：接口可用但 benchmark_return 允许为 null，明确 unknown 状态与 data_status=partial，补最小 smoke + 契约。
- [√] [协同] 基准对比 UI v1：只展示、不评判（unknown 时不显示跑赢/跑输），补最小回归。

### 定投计划（SIP）
- [√] [后端Agent1] 定投计划配置入参校验（dca_plans）：在 `PUT /api/settings` 对 `strategy.dca_plans` 做轻量校验与归一化（id/name/amount/schedule/fund_id/paused），非法返回 422；补最小 smoke；更新契约。
- [√] [前端Agent1] 定投计划体验 v2：列表展示"下次执行日/距今天数"+ 最近一次执行结果（ok/failed），并支持首页待办一键定位到定投区；补最小回归。
- [√] [后端Agent1] SIP 定投计划后端 v1：基于 mot-bot 思路新增 `/api/sip` CRUD + execute，并并入 `app.storage.db.init_db()` 统一建表迁移，补齐 smoke + 契约。
- [√] [前端Agent1] SIP 定投计划前端 v1：SettingsDrawer 增加定投计划管理面板，对接 `/api/sip`，补最小回归。

### 图表接口稳定性
- [√] [后端Agent1] 图表接口稳定性 v1：`/api/charts/returns_history` 补充市场值/成本汇总字段并明确 asof 解析口径，扩展 smoke 与契约。
- [√] [后端Agent1] 图表接口 days 参数校验：`GET /api/charts/returns_history?days=` 仅允许 7/30/90，默认 30，非法 422 并可解释；补最小 smoke + 契约。
- [√] [后端Agent1] 图表接口稳定性 v2（资产/成本汇总字段）：为 `returns_history.data[]` 补充 `total_market_value_cny`/`total_cost_basis_cny`（按当日最后快照汇总），扩展 smoke + 契约。

### 系统状态与数据种子
- [√] [前端Agent1] 系统状态面板 v2（复制内容增强）：复制状态信息包包含版本/页面URL/request_id（脱敏），补最小回归。
- [√] [后端Agent1] 本地验收数据种子（dev_seed_demo）：提供 demo 数据写入脚本与文档说明（仅本地 dev DB，含二次确认参数，不含任何真实凭据）。

### 开发工具与本地体验
- [√] [后端Agent1] 发布预检输出编码修正（Windows 终端可读性）：修复 `check_release_preflight.py` 中文输出乱码问题。
- [√] [前端Agent1] 本地一键启动脚本（dev_up/dev_down）：新增 `scripts/dev_up.ps1`/`scripts/dev_down.ps1` 并更新 `docs/部署与运行.md` Windows 段落引用。

### 基金搜索闭环
- [√] [协同] 全市场基金搜索回源 + 入库 + 全局跳转体验（总控单人开发，已完成本轮闭环）。
- [√] Step 1（文档先行）：在本文件固化"全市场基金搜索闭环"目标、范围、验收标准与回滚点。
- [√] Step 2（后端数据源）：新增东方财富基金检索 provider（仅返回基金类结果，6 位基金代码），补最小单测/烟测。
- [√] Step 3（后端搜索接口）：`GET /api/funds/search` 增加"本地无命中时远端回源"并返回稳定结构；补最小 smoke。
- [√] Step 4（后端自动入库）：将回源命中结果 upsert 到 `fund_catalog/fund_master/fund_alias`，确保 `/api/funds/{fund_id}` 可查；补最小 smoke。
- [√] Step 5（前端交互）：全局搜索选中基金时，若不在持仓则跳转"基金中心"并打开详情；若在持仓保持原有跳转；补最小回归。
- [√] Step 6（契约与验收）：更新 `docs/接口契约.md` 与 `docs/最新进度.md`，执行 `python scripts/check_release_preflight.py`，记录验收结论与风险。
- [√] 验收标准：输入"非持仓基金"关键词能在搜索中看到结果；选择后可进入基金中心并加载详情；首次命中新基金可在后端库中查到；不引入新的敏感信息泄露风险。

### 基金数据深化
- [√] [后端Agent1] 打通"导入 -> 对账 -> 入账"链路：导入默认 `pending`，`sync_pending` 补全后转 `confirmed` 并进入收益主口径。
- [√] [后端Agent1] 补齐 `fund_master`、`fund_alias` 表并迁移现有目录数据。
- [√] [后端Agent1] 建立基金公共数据采集任务：频控、重试、幂等写入、失败隔离、任务日志。
- [√] [后端Agent1] 完成基金详情 API 第二阶段：收益区间统计、完整性标记、异常点标识。
- [√] [后端Agent1] 完成基金同步 API 第二阶段：异步任务化、失败重试、细粒度错误分类。
- [√] [协同] 基金自动补全第二阶段：已完成持仓新增/编辑自动补全（代码联想+名称/市场标签回填）。

### 系统状态面板
- [√] [前端Agent1] 设置中心增加"系统状态/健康检查"面板：展示 `/api/system/status` + `/api/healthz` 结果，并提供"一键复制状态"便于线上排障。

### P1.5 消息通道增强
- [√] [后端Agent1] 完善飞书机器人推送链路：模板化消息、失败重试、发送日志可追踪。
- [√] [后端Agent1] 预留 Telegram Bot 通道：统一消息通道抽象、配置项占位、发送器接口与开关（默认关闭）。
- [√] [后端Agent1] Telegram Bot 实发接入（最小闭环）：实现 `telegram_sender` 真实发送、新增独立凭据写接口，补齐 sender/接口 smoke 测试与契约文档更新。
- [√] [后端Agent1] 输出 Telegram 通道配置与排障文档。
- [√] [后端Agent1] Telegram 运维文档补强：补齐 bot_token 安全轮换流程与操作提醒。
- [√] [前端Agent1] 输出飞书接入手册（前端配置入口说明、权限边界、排障与回滚步骤）。
- [√] [前端Agent1] 设置中心 Telegram 配置入口：在 SettingsDrawer 增加 Telegram 通道开关与配置。
- [√] [后端Agent1] Telegram "发送测试消息"接口：读取已保存凭据向 chat_id 发送一条固定测试文案；返回可解释错误并补齐 smoke/契约。
- [√] [前端Agent1] SettingsDrawer 增加"发送测试消息"按钮并展示成功/失败提示；兼容 `bot_token="<REDACTED>"` 视为已配置；补齐前端回归用例。
- [√] [协同] 安全治理：评估并落地 `GET /api/settings` 对 `notifications.telegram.bot_token` 的脱敏与迁移方案。
- [√] [后端Agent1] 安全治理：实现 `GET /api/settings` 对敏感字段脱敏（至少 telegram.bot_token、feishu.webhook_url），并提供兼容策略。
- [√] [前端Agent1] 配合 `GET /api/settings` 脱敏：设置中心不依赖明文回显，保持"已配置/掩码/摘要"展示与可解释提示。
- [√] [后端Agent1] 飞书"发送测试消息"接口：读取已保存飞书 webhook 发送一条固定测试文案；返回可解释错误并补齐 smoke/契约。
- [√] [前端Agent1] SettingsDrawer 增加飞书"发送测试消息"按钮并展示成功/失败提示；补齐前端回归用例。
- [√] [前端Agent1] 通知诊断面板：SettingsDrawer 增加 "通知诊断" 小面板，读取状态展示每个通道状态与最近一次测试结果。

### P2 决策层与执行闭环深化
- [√] [后端Agent1] 将 `sync_pending` 补全结果接入收益主口径与复盘报告。
- [√] [前端Agent1] 完成交易手工修正前端闭环：交易页支持编辑发生时间/状态并展示审计链路。
- [√] [协同] 完成 `/system/status` 增强：增加最近一次基金同步、最近一次对账统计、当前线上版本号与 commit 对照。

### P3 持续改进
- [√] [前端Agent1] 埋点体系落地：搜索转化、交易转化、定投行为、首屏效率。
- [√] [前端Agent1] 前端性能优化收敛：高频刷新场景 `React.memo` 覆盖与 `50+` 持仓压测回归。

### 总工审计（2026-02-08）
- [√] [后端Agent1] 增加 `/api/settings/network-benchmark/latest|run` 与兼容路径的路由级 smoke 测试。
- [√] [后端Agent1] 为 `POST /api/settings/network-benchmark/run` 增加入参强校验。
- [√] [后端Agent1] 增加全局 `request_id` 中间件与 `X-Request-ID` 响应头。
- [√] [前端Agent1] 设置中心补齐飞书高级参数编辑入口。
- [√] [协同] 评估并落地 `GET /api/settings` 中敏感配置脱敏策略。

---

> 本次归档共迁移 **127 项**已完成任务到本文档。原始 ROADMAP.md 仅保留待办项（`[ ]`）。

## 2026-02-11 完成（bot 分支）

### P0 前端设计优化
- [√] [前端] 修复组合收益曲线 Not Found：接口联通性已验证，空数据时显示友好提示而非 Not Found
- [√] [前端] 修复基准对比 Not Found：接口联通性已验证，空数据时显示 unknown 状态
- [√] [前端] 修复交易页定投计划 Not Found：接口联通性已验证，正常显示定投计划列表
- [√] [前端] 修复交易流水 Not Found：接口联通性已验证，正常显示交易流水列表
- [√] [前端] 全局搜索框样式优化：搜索输入框需优化为现代风格（圆角、阴影、padding），与主标题同行布局（已完成@bot d9d720f）
- [√] [前端] 顶栏布局重构 v1：重新设计 TopToolbar 布局 — 一行内左侧 VC 图标+标题+副标题，右侧全局搜索框+状态+刷新+个人中心；数据状态详情面板从 header 移出为独立可折叠区域（已完成@bot d9d720f）
- [√] [前端] 整体前端设计优化 v1：统一组件风格（圆角、阴影、间距、字号），提升现代感与一致性（已完成@bot 0fee5e4）

### 工具脚本修复
- [√] dev_seed_demo.py 表结构兼容性修复（commit: 766aa80）

