# VectorControl Unified ROADMAP (Repo Synced Copy)

更新时间：2026-02-10 04:52:42

规则：`[ ]` 待完成，`[√]` 已完成（完成后尽快归档到 `docs/ROADMAP完成归档.md`）。  
Description: full synced roadmap copy in repository (non-placeholder). Source: `<local>\AGENT\ROADMAP.md`.

任务标签：`[前端Agent1]`、`[后端Agent1]`、`[协同]`。  
强制要求：每个 Agent 每完成一个小闭环，必须更新共享目录 `<local>\AGENT` 下的进度与通讯文档。

## 全局发布门禁（每次 `main` 更新都必须执行）

1. 文档全量巡检与必要完善（至少覆盖：`README.md`、`<local>\AGENT\ROADMAP.md`、`ROADMAP.md`（镜像）、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`）。
2. 发布前执行：`python scripts/check_release_preflight.py`（默认包含文档门禁严格模式、后端 compileall、前端 build）。
3. push 前确保 `.githooks/pre-push` 严格检查通过（`python scripts/check_docs_gate.py --strict`）。
4. 发布提交必须包含 `新增/修复/优化/文档` 四段，且 `文档` 段必须写清“检查范围 + 更新结论 + 延后项（无则写无）”。
5. 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。

## 当前迭代策略（敏捷）

1. 本阶段忽略分支保护相关治理项，不作为迭代阻塞条件（按你的当前指令执行）。
2. 每轮只推进 1-2 个可验收闭环，优先线上可用性与核心交易链路。
3. 每轮必须同时更新：代码 + 文档 + `ROADMAP` + 验收记录。

## 集成队列（总控维护）

说明：记录“已推送待集成”的闭环，便于总控按单 commit 单主题合入 dev；合入后从本段移除，并在对应任务条目标记“已合入 dev@xxxx”。

- 当前无待集成条目

## P0（最优先：稳定性、发布门禁、线上可用）

- [√] [后端Agent1] 修复测速 TLS EOF 误报：`network_benchmark` 支持站点级协议/端口与 HTTPS->HTTP 回退（`backend/app/core/network_benchmark.py`）。
- [√] [后端Agent1] 修复周末“估算中”误导：估值引擎在 `cn_hk/us_overseas` 周末按最近结算口径输出 `confirm_state=confirmed`（`backend/app/estimator/engine.py`）。
- [√] [后端Agent1] 修复 VPS 测速 `Not Found`：完成后端路由、Nginx 转发与服务路径三段排查并给出修复提交（新增 `/api/network-benchmark/*` 兼容路由与 Nginx 历史路径重写）。
- [√] [前端Agent1] 对齐测速接口联调与错误态兜底：确保“设置中心 -> 测速”在后端异常时可解释、不白屏，并补齐回归用例（前端错误提示已透传 `X-Request-ID` 并补齐 api 层回归用例）。
- [√] [前端Agent1] 修复“设置中心白屏”并补齐回归用例（抽屉打开、测速模块渲染、异常兜底）。
- [√] [后端Agent1] 基于 `docs/Gate-D验收证据模板.md` 补齐测速接口验收证据（见 `docs/Gate-D测速NotFound后端证据.md`，含路由命中、代理配置、服务路径与 VPS 补录命令）。
- [ ] [前端Agent1] 基于 `docs/Gate-D验收证据模板.md` 补齐设置中心/测速页面实机验收证据（已合并 `f36d94f -> dev@943c7a9`；本地证据文档已完成：`docs/Gate-D设置中心测速前端证据.md`，待生产实机截图补录后关单）。
- [ ] [协同] 按 `docs/P0线上故障排查SOP.md` 完成“测速 Not Found + 设置中心白屏”双故障关闭留档（含根因、修复提交、回归证据）。
- [ ] [后端Agent1] 双故障关闭留档 v1（后端侧）：按 `docs/P0线上故障排查SOP.md` 起草 postmortem（根因/影响面/修复提交/回归证据/预防项），并给出“待前端补充截图/待总控验收”的清单。
- [ ] [前端Agent1] 双故障关闭留档 v1（前端侧）：为 `docs/Gate-D设置中心测速前端证据.md` 补齐“实机截图清单 + 占位符 + 验收勾选表”，便于后续补录关单。
- [ ] [协同] 双故障关闭留档（可审核版本）：后端主笔 postmortem + 前端补齐实机截图清单，占位符齐全，总控最终 Gate-D 勾选并归档（已于 2026-02-09 17:20:05 预告排队）
- [ ] [协同] 本地可测试闭环：补齐 `docs/部署与运行.md` 的 Windows 本地启动步骤（后端 uvicorn 21345 + 前端 vite 5173 + 健康检查 URL），并明确“如何停止服务/如何查看日志”的最小说明。（前端已推送 `7a3f204`，待总控集成）
- [√] [后端Agent1] Secrets Leak Guard v1：新增敏感信息正则扫描（至少覆盖 Telegram bot token 形态与飞书 webhook URL 形态），并接入 `scripts/check_release_preflight.py` 与 `.githooks/pre-push`，阻断误提交；提示需可解释且给出定位行。（已合入 `origin/dev@e98dac4`）
- [√] [协同] 收益曲线最小闭环：后端提供 `/api/charts/*`（基于 estimate_snapshot 聚合）+ 前端首页展示“组合收益曲线”缩略图（已合入 `origin/dev@1b74f87`）
- [√] [前端Agent1] 首页收益曲线体验 v2：用 `/api/charts/returns_history` 展示大号曲线（纯 SVG，无新依赖）+ 最近 7 天 day_profit 列表 + 7/30/90 切换，补最小回归（已合入 `origin/dev@e98dac4`）
- [√] [后端Agent1] 定投计划配置入参校验（dca_plans）：在 `PUT /api/settings` 对 `strategy.dca_plans` 做轻量校验与归一化（id/name/amount/schedule/fund_id/paused），非法返回 422；补最小 smoke；更新契约（已合入 `origin/dev@d707642`）
- [ ] [后端Agent1] 发布预检输出编码修正（Windows 终端可读性）：不改检查逻辑，仅修复 `check_release_preflight.py` 中文输出乱码问题并补最小自测（已于 2026-02-09 17:13:30 预告排队）
- [ ] [前端Agent1] 本地一键启动脚本（dev_up/dev_down）：新增 `scripts/dev_up.ps1`/`scripts/dev_down.ps1` 并更新 `docs/部署与运行.md` Windows 段落引用（已于 2026-02-09 17:13:30 预告排队）
- [ ] [后端Agent1] Secrets Leak Guard v1.1：扩展常见密钥形态扫描（低误报优先）并补 `--selftest`（已于 2026-02-09 17:13:30 预告排队）
- [√] [前端Agent1] 定投计划体验 v2：列表展示“下次执行日/距今天数”+ 最近一次执行结果（ok/failed），并支持首页待办一键定位到定投区；补最小回归（已合入 origin/dev@1d934c3，来源 origin/feat/frontend-agent1-dca-plans-next-run-v2@41b0a01）
- [√] [后端Agent1] SIP 定投计划后端 v1：基于 mot-bot 思路新增 `/api/sip` CRUD + execute，并并入 `app.storage.db.init_db()` 统一建表迁移，补齐 smoke + 契约（已完成 `python3 -m compileall app` 与 storage 层本地自检；`app.api.test_sip_crud_execute_smoke` 待依赖齐全环境执行）
- [ ] [前端Agent1] SIP 定投计划前端 v1：SettingsDrawer 增加定投计划管理面板，对接 `/api/sip`，补最小回归（已于 2026-02-09 16:25:17 预告排队）
- [ ] [后端Agent1] 图表接口稳定性 v1：`/api/charts/returns_history` 补充市场值/成本汇总字段并明确 asof 解析口径，扩展 smoke 与契约（已于 2026-02-09 16:55:54 预告排队）
- [√] [后端Agent1] 图表接口 days 参数校验：`GET /api/charts/returns_history?days=` 仅允许 7/30/90，默认 30，非法 422 并可解释；补最小 smoke + 契约（已合入 `origin/dev@3b49cfb`）
- [ ] [后端Agent1] 图表接口稳定性 v2（资产/成本汇总字段）：为 `returns_history.data[]` 补充 `total_market_value_cny`/`total_cost_basis_cny`（按当日最后快照汇总），扩展 smoke + 契约（已于 2026-02-09 17:20:05 预告排队）
- [ ] [后端Agent1] 图表接口性能 v1（returns_history 聚合优化）：最大 days/DB 聚合/按日缓存（含过期策略），补最小性能 smoke + 架构说明（已于 2026-02-09 17:29:19 预告排队）
- [ ] [前端Agent1] 收益曲线体验 v3（摘要信息）：在收益曲线面板增加累计收益/最大回撤/近30天波动摘要与口径提示，补最小回归（已于 2026-02-09 17:18:30 预告排队）
- [ ] [前端Agent1] 系统状态面板 v2（复制内容增强）：复制状态信息包包含版本/页面URL/request_id（脱敏），补最小回归（已于 2026-02-09 17:20:05 预告排队）
- [ ] [前端Agent1] 收益曲线体验 v4（空数据与异常点展示）：空状态可解释、缺失天断线、异常点 marker（后端未来提供 anomalies），补最小回归（已于 2026-02-09 17:20:05 预告排队）
- [ ] [后端Agent1] 本地验收数据种子（dev_seed_demo）：提供 demo 数据写入脚本与文档说明（仅本地 dev DB，含二次确认参数，不含任何真实凭据）（已于 2026-02-09 17:18:30 预告排队）
- [ ] [前端Agent1] 移动端适配 v1：精选 mot-bot 思路，小步优化 SettingsDrawer/HoldingsTable/交易表单窄屏可用性（已于 2026-02-09 16:55:54 预告排队）
- [ ] [后端Agent1] 分红（dividend）闭环 v1：完善交易口径并在 `GET /api/report/daily` 增加“分红汇总”段落，补最小 smoke + 契约（已于 2026-02-09 16:58:08 预告排队）
- [ ] [前端Agent1] 分红（dividend）录入 UI v1：交易页增加 tradeType=dividend 并正确写入/展示，补最小回归（已于 2026-02-09 16:58:08 预告排队）
- [√] [后端Agent1] 基准对比 v1：接口可用但 benchmark_return 允许为 null，明确 unknown 状态与 data_status=partial，补最小 smoke + 契约（已合入 origin/dev@ea2d2ef，来源 origin/feat/backend-agent1-benchmark-v1@16938b1）
- [√] [协同] 基准对比 UI v1：只展示、不评判（unknown 时不显示跑赢/跑输），补最小回归（总控单人闭环，已在 `origin/dev@d96c0e9` 落地首页面板与回归测试）

## P1（基金数据库与交易事实闭环）

- [√] [协同] 全市场基金搜索回源 + 入库 + 全局跳转体验（总控单人开发，已完成本轮闭环）

### 本轮单人开发计划（总控执行，单 commit 单主题）

- [√] Step 1（文档先行）：在本文件固化“全市场基金搜索闭环”目标、范围、验收标准与回滚点（本条）。
- [√] Step 2（后端数据源）：新增东方财富基金检索 provider（仅返回基金类结果，6 位基金代码），补最小单测/烟测。
- [√] Step 3（后端搜索接口）：`GET /api/funds/search` 增加“本地无命中时远端回源”并返回稳定结构；补最小 smoke。
- [√] Step 4（后端自动入库）：将回源命中结果 upsert 到 `fund_catalog/fund_master/fund_alias`，确保 `/api/funds/{fund_id}` 可查；补最小 smoke。
- [√] Step 5（前端交互）：全局搜索选中基金时，若不在持仓则跳转“基金中心”并打开详情；若在持仓保持原有跳转；补最小回归。
- [√] Step 6（契约与验收）：更新 `docs/接口契约.md` 与 `docs/最新进度.md`，执行 `python scripts/check_release_preflight.py`，记录验收结论与风险。

### 本轮验收标准（完成即关单）

- [√] 输入“非持仓基金”关键词（如“易方达”）能在搜索中看到结果。
- [√] 选择结果后可进入基金中心并加载详情，不再表现为“无反应”。
- [√] 首次命中的新基金可在后端库中查到（`fund_master` 新增），后续可直接检索命中。
- [√] 不引入新的敏感信息落库/日志泄露风险；现有接口返回结构保持兼容。

- [√] [后端Agent1] 打通“导入 -> 对账 -> 入账”链路：导入默认 `pending`，`sync_pending` 补全后转 `confirmed` 并进入收益主口径。
- [√] [后端Agent1] 补齐 `fund_master`、`fund_alias` 表并迁移现有目录数据（已完成 `fund_master/fund_alias` 建表、目录回填、别名检索与字段透出）。
- [√] [后端Agent1] 建立基金公共数据采集任务：频控、重试、幂等写入、失败隔离、任务日志（`/api/funds/sync` 增加抓取重试、请求间隔频控、任务明细日志落库与失败隔离）。
- [√] [后端Agent1] 完成基金详情 API 第二阶段：收益区间统计、完整性标记、异常点标识（`/api/funds/{fund_id}` 新增 `performance_ranges`、`integrity`、`anomalies`）。
- [√] [后端Agent1] 完成基金同步 API 第二阶段：异步任务化、失败重试、细粒度错误分类（新增 `async_mode` 后台任务执行与任务状态 `running/done/partial/failed`，日志细分 `fetch_exception/quote_unavailable/quote_format_invalid/nav_missing/persist_failed`）。
- [√] [协同] 基金自动补全第二阶段：已完成持仓新增/编辑自动补全（代码联想+名称/市场标签回填）。

- [√] [前端Agent1] 设置中心增加“系统状态/健康检查”面板：展示 `/api/system/status` + `/api/healthz` 结果，并提供“一键复制状态”便于线上排障（已合入 `origin/dev@6af8e0c`）。
- [ ] [前端Agent1] SettingsDrawer 信息架构 v2（高频项优先）：轻量重排分组，保持可回归（已于 2026-02-09 17:24:16 预告排队）
- [ ] [协同] 可观测性面板 v1：前端 dev-only 面板 + 后端 `GET /api/system/diagnostics`（登录）提供可复制诊断信息（已于 2026-02-09 17:26:11 预告排队）

## P1.5（消息通道增强：飞书 + Telegram 预留）

- [ ] [协同] 通知通道“统一动作结果模型”：对 Telegram/飞书的 `test_message` 返回结构与错误分类做 SSOT 约束（`ok/sent/trace_id/attempts/error{category,message}`），并在 `docs/接口契约.md` 固化（前端仅依赖该结构渲染提示，不做 provider 特判）。
- [ ] [后端Agent1] 统一 Telegram/飞书 `test_message` 返回结构与错误分类：两者返回字段完全一致（`ok/sent/trace_id/attempts/max_attempts/error{category,message}`），并同步更新 smoke + `docs/接口契约.md`。（已推送 `cca0990`，待总控集成）
- [√] [后端Agent1] 完善飞书机器人推送链路：模板化消息、失败重试、发送日志可追踪（已合并 `74c9c81 -> dev@3184e34`，补齐 sender smoke 测试）。
- [ ] [后端Agent1] 飞书 webhook 治理 v1：URL 校验（仅 https；host 白名单 `open.feishu.cn`）、sender 日志脱敏（不记录明文 webhook）、补最小 smoke。（已推送 `f6be5b1`，待总控集成）
- [ ] [后端Agent1] 飞书抓取治理 v2（后续）：频控、缓存过期、日志审计、失败隔离（本条不阻塞 v1）。
- [√] [前端Agent1] 输出飞书接入手册（前端配置入口说明、权限边界、排障与回滚步骤）（已合并 `7a6e02d -> dev@dadc28c`）。
- [√] [后端Agent1] 预留 Telegram Bot 通道：统一消息通道抽象、配置项占位、发送器接口与开关（默认关闭）（新增 `notifier` 通道分发抽象与 `telegram` 发送器占位，用户设置增加 `notifications.telegram` 默认关闭配置）。
- [√] [后端Agent1] Telegram Bot 实发接入（最小闭环）：实现 `telegram_sender` 真实发送（HTTP API `sendMessage`）、新增独立凭据写接口 `PUT /api/settings/notifications/telegram/credential`（响应不回显明文），补齐 sender/接口 smoke 测试与契约文档更新。（已合并 `909c7fa -> dev@909c7fa`）
- [√] [后端Agent1] 输出 Telegram 通道配置与排障文档：`docs/telegram/Telegram通道配置与排障.md`（已合并 `a262661 -> dev@a262661`）
- [√] [后端Agent1] Telegram 运维文档补强：补齐 bot_token 安全轮换流程与操作提醒（已合并 `acf8fb7 -> dev@53f3437`）。
- [√] [前端Agent1] 设置中心 Telegram 配置入口（后续）：在 SettingsDrawer 增加 Telegram 通道开关与 `chat_id/parse_mode/disable_web_page_preview` 配置；凭据更新走独立接口，不在普通 `PUT /api/settings` 流程中回显 `bot_token` 明文。
- [√] [后端Agent1] Telegram “发送测试消息”接口：读取已保存凭据向 chat_id 发送一条固定测试文案；返回可解释错误并补齐 smoke/契约。（已合入 `dev@e08ee05`）
- [√] [前端Agent1] SettingsDrawer 增加“发送测试消息”按钮并展示成功/失败提示；兼容 `bot_token="<REDACTED>"` 视为已配置；补齐前端回归用例。（已合入 `dev@3936d6e`）
- [√] [协同] 安全治理：评估并落地 `GET /api/settings` 对 `notifications.telegram.bot_token` 的脱敏与迁移方案（避免前端/录屏/日志泄露）；运维侧的 token 轮换/撤销说明已在 Telegram 文档中覆盖（见 `docs/telegram/Telegram通道配置与排障.md` + dev 记录）。
- [√] [后端Agent1] 安全治理：实现 `GET /api/settings` 对敏感字段脱敏（至少 telegram.bot_token、feishu.webhook_url），并提供兼容策略（若 `PUT /api/settings` 回传 `"<REDACTED>"` 则忽略该字段避免覆盖；独立凭据更新接口仍可用）；补齐契约与 smoke。（已合入 `dev@8e0c1a8`）
- [√] [前端Agent1] 配合 `GET /api/settings` 脱敏：设置中心不依赖明文回显，保持“已配置/掩码/摘要”展示与可解释提示；补齐回归用例。（已合入 `dev@3936d6e`）
- [√] [后端Agent1] 飞书“发送测试消息”接口：读取已保存飞书 webhook（或既有配置）发送一条固定测试文案；返回可解释错误并补齐 smoke/契约。（已合入 `dev@1379d26`）
- [√] [前端Agent1] SettingsDrawer 增加飞书“发送测试消息”按钮并展示成功/失败提示；补齐前端回归用例。（已推送 `369c94e`，待总控集成）
- [ ] [前端Agent1] 测试消息按钮组件化：抽 `TestMessageButton` 统一 Telegram/飞书 test_message 交互与提示（trace_id + error.category/message），降低重复逻辑与回归风险。（已推送 `7c52b6f`，待总控集成）
- [ ] [后端Agent1] 通知诊断 status（只读脱敏）：新增 `GET /api/settings/notifications/status`，返回每个通道 `enabled/credential_configured/last_test_summary(trace_id,time,ok,sent,error_category)`；不得回显任何凭据明文。第一版允许 `last_test_summary=null`（不做持久化），但字段必须存在且契约明确。（已推送 `4d6d34b`，待总控集成）
- [√] [前端Agent1] 通知诊断面板：SettingsDrawer 增加 “通知诊断” 小面板，读取 `GET /api/settings/notifications/status` 展示每个通道状态与最近一次测试结果，并集中放置 Telegram/飞书的“发送测试消息”按钮与提示；当后端未提供 last_test_summary 时，前端仅展示“未测试/无记录”。（已推送 `bbaf96d`，待总控集成）
- [ ] [后端Agent1] 通知诊断 status v2a（可观测性）：每次调用 `*/test_message` 后落库 `last_test_summary`（含 time/trace_id/ok/sent/error_category），并在 `GET /api/settings/notifications/status` 返回；仍不得回显任何凭据明文，契约与 smoke 补齐。（已推送 `ea4e344`，待总控集成；不阻塞 v1）
- [ ] [后端Agent1] 通知诊断 status v2b（历史）：在 status 中返回 `last_test_history` 最近 N 条（默认 10），用于前端展示失败趋势。（已推送 `d5332f3`，待总控集成；不阻塞 v2a）
- [ ] [前端Agent1] 通知诊断面板 v2a：支持一键复制 `trace_id`，并对 `last_test_summary.time` 做可读格式展示；保持统一提示格式（trace_id + error.category/message）。（已推送 `26c4c9d`，待总控集成）
- [ ] [前端Agent1] 通知诊断面板 v2b：展示 `last_test_history` 最近 N 条（若后端提供），支持展开/收起与复制 trace_id。（已推送 `3b2989d`，待总控集成；不阻塞 v2a）
- [ ] [后端Agent1] 通知诊断 v3：`POST /api/settings/notifications/test_all` 一键测试所有通道并返回逐通道结果（不得回显任何凭据明文），补最小 smoke + 契约（已于 2026-02-09 17:15:29 预告排队）
- [ ] [前端Agent1] 通知诊断 v3：面板增加 `Test all` 与“一键复制结果”，渲染逐通道结果并补最小回归（已于 2026-02-09 17:15:29 预告排队）
- [ ] [后端Agent1] 健康检查口径一致性：提供 `/api/healthz` 与 `/api/health` 兼容（或统一为一个并同步更新 Gate 脚本与文档），补最小 smoke，并在 `docs/部署与运行.md` 明确“健康检查 URL”。（已下发，执行中）
- [ ] [后端Agent1] Telegram sender 日志脱敏与错误映射收敛：确保任何日志/异常链路不包含 token 明文；将 Telegram API 失败映射到稳定 `error.category` 并在契约固化；补最小 smoke。（已在 comms 预告，待总控正式下发）
- [ ] [后端Agent1] 通知测试消息防滥用 v1（cooldown/429）：test_message 增加用户级 cooldown，并在 status 返回 cooldown 信息，补 smoke + 契约（已于 2026-02-09 17:29:19 预告排队）
- [ ] [前端Agent1] 通知诊断 UX v4（cooldown 展示与按钮禁用）：展示倒计时/到期时间，429 提示含 trace_id，补最小回归（已于 2026-02-09 17:29:19 预告排队）
- [ ] [协同] Telegram chat_id 自动发现（可选增强）：增加 inbound webhook 接收 Telegram update（带独立 secret），用于在不粘贴 token 的情况下辅助绑定 chat_id（需部署侧支持，不阻塞当前迭代）。
- [ ] [前端Agent1] 通知诊断面板 v2c：复制诊断信息（脱敏 status JSON + 版本信息）一键带走排障证据；包含 clipboard fallback 与最小回归。（已下发，执行中）

## P2（决策层与执行闭环深化）

- [√] [后端Agent1] 将 `sync_pending` 补全结果接入收益主口径与复盘报告，避免“状态变化已确认但收益未同步”（入账后自动失效估值快照缓存，日报新增对账入账段落）。
- [√] [前端Agent1] 完成交易手工修正前端闭环：交易页支持编辑发生时间/状态并展示审计链路。
- [√] [协同] 完成 `/system/status` 增强：增加最近一次基金同步、最近一次对账统计、当前线上版本号与 commit 对照。
- [ ] [后端Agent1] 风险口径对齐 v1：`GET /api/report/daily` 增加 `data_quality` 摘要（估算/缺失/异常），补最小 smoke + 契约（已于 2026-02-09 17:27:03 预告排队）
- [ ] [前端Agent1] 日报可解释性 v1：展示 `data_quality` 提示与 tooltip 详情，补最小回归（已于 2026-02-09 17:27:03 预告排队）

## P3（持续改进）

- [ ] [后端Agent1] 分支保护治理回补：恢复 `Docs Gate / docs-gate` 与 `Release Consistency / verify-release` 的远端必需检查留档。
- [ ] [后端Agent1] 登录安全增强：细粒度限流、失败观测、告警阈值。
- [ ] [后端Agent1] 登录限流 v1（最小闭环）：对 `POST /api/auth/login` 增加按 IP+username 的简单限流（返回 429 + 可解释错误 + trace_id），并补最小 smoke。
- [ ] [前端Agent1] 认证错误 UX 收敛（401/429）：统一提示与引导，避免白屏，并补最小回归（已于 2026-02-09 17:23:29 预告排队）
- [ ] [后端Agent1] 前端构建缓存优化（CI/本地）：`check_release_preflight.py` 运行速度优化（不改变默认行为），补文档说明（已于 2026-02-09 17:23:29 预告排队）
- [ ] [后端Agent1] 设置保存审计日志 v1：`PUT /api/settings` 与独立凭据写接口落库变更摘要（不存凭据明文）+ `GET /api/settings/audit_logs`，补 smoke + 契约（已于 2026-02-09 17:24:16 预告排队）
- [ ] [前端Agent1] 设置变更可视化 v1：保存成功后展示变更摘要；如有 audit_logs 则可查看最近记录，补最小回归（已于 2026-02-09 17:24:16 预告排队）
- [ ] [后端Agent1] 配置一致性检查 v1（settings schema lint）：新增 `scripts/check_settings_schema.py` 并可接入 preflight（已于 2026-02-09 17:25:08 预告排队）
- [ ] [前端Agent1] 前端 settings schema 断言：开发期禁止未知 key/敏感明文 payload，补最小回归（已于 2026-02-09 17:25:08 预告排队）
- [ ] [后端Agent1] 数据导入幂等键 v1：`POST /api/transactions/import` 支持幂等键防重复落库，补 smoke + 契约（已于 2026-02-09 17:25:08 预告排队）
- [ ] [协同] 本地性能基线脚本（perf_smoke）：跑关键页面计时并落地本地基线文件（不入库）（已于 2026-02-09 17:26:11 预告排队）
- [ ] [后端Agent1] 账号安全 v1（密码策略与会话过期可见）：补最小 smoke + 契约（已于 2026-02-09 17:27:50 预告排队）
- [ ] [前端Agent1] 登录体验 v1（会话过期提示 + 返回原页面）：补最小回归（已于 2026-02-09 17:27:50 预告排队）
- [ ] [协同] 备份与恢复 runbook（本地/生产）：sqlite/volume 备份恢复步骤与验证清单（已于 2026-02-09 17:27:50 预告排队）
- [√] [前端Agent1] 埋点体系落地：搜索转化、交易转化、定投行为、首屏效率。
- [√] [前端Agent1] 前端性能优化收敛：高频刷新场景 `React.memo` 覆盖与 `50+` 持仓压测回归。

## 总工审计（2026-02-08）

- [√] [后端Agent1] 增加 `/api/settings/network-benchmark/latest|run` 与兼容路径的路由级 smoke 测试，防止“接口存在但线上回归不可见”（新增 `test_settings_network_benchmark_not_found_smoke.py` 覆盖 settings + 兼容路径）。
- [√] [后端Agent1] 为 `POST /api/settings/network-benchmark/run` 增加入参强校验（`profile` 枚举、`timeout_seconds` 范围），避免当前静默回退导致误配置不可感知（非法入参统一返回 422）。
- [√] [后端Agent1] 增加全局 `request_id` 中间件与 `X-Request-ID` 响应头，统一日志关联（已合并 `ebc2e7e -> dev@8d9fd62`，补齐 request_id middleware smoke）。
- [√] [前端Agent1] 设置中心补齐飞书高级参数编辑入口（`timeout_seconds/retry_times/template`）并与契约字段对齐。
- [√] [协同] 评估并落地 `GET /api/settings` 中敏感配置脱敏策略（如 `webhook_url` 部分掩码 + 单独“更新凭据”写接口），降低前端日志/录屏泄露风险（前端已合并 `cbb7e95 -> dev@3522db6`；后端新增 `PUT /api/settings/notifications/feishu/webhook` 独立凭据写接口并补齐 smoke + 契约更新；前端联调已切换凭据更新调用该独立接口，普通 `PUT /api/settings` 不再携带 webhook 明文）。
