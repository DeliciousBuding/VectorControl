# VectorControl ROADMAP（dev 分支）

更新时间：2026-02-08 16:35:00

规则：`[ ]` 待完成，`[√]` 已完成（完成后尽快归档到 `docs/ROADMAP完成归档.md`）。  
说明：本文件只保留当前待办。历史完成项统一归档。

任务标签：`[总控Agent]`、`[前端Agent1]`、`[后端Agent1]`、`[协同]`。  
强制要求：每个 Agent 每完成一个小闭环，必须更新共享目录 `<local>\AGENT` 下的进度与通讯文档。

## 全局发布门禁（每次 `main` 更新都必须执行）

1. 文档全量巡检与必要完善（至少覆盖：`README.md`、`ROADMAP.md`、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`）。
2. 发布前执行：`python scripts/check_release_preflight.py`（默认包含文档门禁严格模式、后端 compileall、前端 build）。
3. push 前确保 `.githooks/pre-push` 严格检查通过（`python scripts/check_docs_gate.py --strict`）。
4. 发布提交必须包含 `新增/修复/优化/文档` 四段，且 `文档` 段必须写清“检查范围 + 更新结论 + 延后项（无则写无）”。
5. 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。

## 当前迭代策略（敏捷）

1. 本阶段忽略分支保护相关治理项，不作为迭代阻塞条件（按你的当前指令执行）。
2. 每轮只推进 1-2 个可验收闭环，优先线上可用性与核心交易链路。
3. 每轮必须同时更新：代码 + 文档 + `ROADMAP` + 验收记录。

## P0（最优先：稳定性、发布门禁、线上可用）

- [√] [后端Agent1] 修复测速 TLS EOF 误报：`network_benchmark` 支持站点级协议/端口与 HTTPS->HTTP 回退（`backend/app/core/network_benchmark.py`）。
- [√] [后端Agent1] 修复周末“估算中”误导：估值引擎在 `cn_hk/us_overseas` 周末按最近结算口径输出 `confirm_state=confirmed`（`backend/app/estimator/engine.py`）。
- [ ] [总控Agent] 修复 VPS 测速 `Not Found`：完成后端路由、Nginx 转发、前后端版本一致性三段排查，并输出故障复盘。
- [ ] [总控Agent] 完成一次包含测速接口校验的 Gate-D 实机验收并留档（`docs/Gate-D验收证据模板.md`）。
- [√] [前端Agent1] 修复“设置中心白屏”并补齐回归用例（抽屉打开、测速模块渲染、异常兜底）。
- [ ] [总控Agent] 按 `docs/P0线上故障排查SOP.md` 完成“测速 Not Found + 设置中心白屏”双故障关闭留档（含根因、修复提交、回归证据）。

## P1（基金数据库与交易事实闭环）

- [√] [后端Agent1] 打通“导入 -> 对账 -> 入账”链路：导入默认 `pending`，`sync_pending` 补全后转 `confirmed` 并进入收益主口径。
- [√] [后端Agent1] 补齐 `fund_master`、`fund_alias` 表并迁移现有目录数据（已完成 `fund_master/fund_alias` 建表、目录回填、别名检索与字段透出）。
- [√] [后端Agent1] 建立基金公共数据采集任务：频控、重试、幂等写入、失败隔离、任务日志（`/api/funds/sync` 增加抓取重试、请求间隔频控、任务明细日志落库与失败隔离）。
- [√] [后端Agent1] 完成基金详情 API 第二阶段：收益区间统计、完整性标记、异常点标识（`/api/funds/{fund_id}` 新增 `performance_ranges`、`integrity`、`anomalies`）。
- [√] [后端Agent1] 完成基金同步 API 第二阶段：异步任务化、失败重试、细粒度错误分类（新增 `async_mode` 后台任务执行与任务状态 `running/done/partial/failed`，日志细分 `fetch_exception/quote_unavailable/quote_format_invalid/nav_missing/persist_failed`）。
- [ ] [协同] 基金自动补全第二阶段：已完成“持仓新增自动补全（代码联想+名称/市场回填）”，待补齐“持仓编辑自动补全”闭环后转 `[√]`。

## P1.5（消息通道增强：飞书 + Telegram 预留）

- [ ] [后端Agent1] 完善飞书机器人推送链路：模板化消息、失败重试、发送日志可追踪。
- [ ] [后端Agent1] 飞书抓取治理：白名单域名、频控、缓存过期、日志审计、密钥脱敏。
- [ ] [总控Agent] 输出飞书接入手册：配置步骤、权限范围、排障与回滚。
- [ ] [后端Agent1] 预留 Telegram Bot 通道：统一消息通道抽象、配置项占位、发送器接口与开关（默认关闭）。

## P2（决策层与执行闭环深化）

- [√] [后端Agent1] 将 `sync_pending` 补全结果接入收益主口径与复盘报告，避免“状态变化已确认但收益未同步”（入账后自动失效估值快照缓存，日报新增对账入账段落）。
- [√] [前端Agent1] 完成交易手工修正前端闭环：交易页支持编辑发生时间/状态并展示审计链路。
- [√] [协同] 完成 `/system/status` 增强：增加最近一次基金同步、最近一次对账统计、当前线上版本号与 commit 对照。

## P3（持续改进）

- [ ] [总控Agent] 分支保护治理回补：恢复 `Docs Gate / docs-gate` 与 `Release Consistency / verify-release` 的远端必需检查留档。
- [ ] [后端Agent1] 登录安全增强：细粒度限流、失败观测、告警阈值。
- [√] [前端Agent1] 埋点体系落地：搜索转化、交易转化、定投行为、首屏效率。
- [√] [前端Agent1] 前端性能优化收敛：高频刷新场景 `React.memo` 覆盖与 `50+` 持仓压测回归。
