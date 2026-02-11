# VectorControl Unified ROADMAP (Repo Synced Copy)

更新时间：2026-02-11 02:35:00

规则：`[ ]` 待完成，`[√]` 已完成（完成后尽快归档到 `docs/ROADMAP完成归档.md`）。
Description: full synced roadmap copy in repository (non-placeholder). Source: `<local>\AGENT\ROADMAP.md`.

任务标签：`[前端Agent1]`、`[后端Agent1]`、`[协同]`。
强制要求：每个 Agent 每完成一个小闭环，必须更新共享目录 `<local>\AGENT` 下的进度与通讯文档。

## 全局发布门禁（每次 `main` 更新都必须执行）

1. 文档全量巡检与必要完善（至少覆盖：`README.md`、`<local>\AGENT\ROADMAP.md`、`ROADMAP.md`（镜像）、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`）。
2. 发布前执行：`python scripts/check_release_preflight.py`（默认包含文档门禁严格模式、后端 compileall、前端 build）。
3. push 前确保 `.githooks/pre-push` 严格检查通过（`python scripts/check_docs_gate.py --strict`）。
4. 发布提交必须包含 `新增/修复/优化/文档` 四段，且 `文档` 段必须写清"检查范围 + 更新结论 + 延后项（无则写无）"。
5. 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。

## 当前迭代策略（敏捷）

1. 本阶段忽略分支保护相关治理项，不作为迭代阻塞条件（按你的当前指令执行）。
2. 每轮只推进 1-2 个可验收闭环，优先线上可用性与核心交易链路。
3. 每轮必须同时更新：代码 + 文档 + `ROADMAP` + 验收记录。

## 集成队列（总控维护）

说明：记录"已推送待集成"的闭环，便于总控按单 commit 单主题合入 dev；合入后从本段移除，并在对应任务条目标记"已合入 dev@xxxx"。

- 当前无待集成条目

## P0（最优先：稳定性、发布门禁、线上可用）

- [ ] [前端Agent1] 基于 `docs/Gate-D验收证据模板.md` 补齐设置中心/测速页面实机验收证据（已合并 `f36d94f -> dev@943c7a9`；本地证据文档已完成：`docs/Gate-D设置中心测速前端证据.md`，待生产实机截图补录后关单）。
- [ ] [协同] 按 `docs/P0线上故障排查SOP.md` 完成"测速 Not Found + 设置中心白屏"双故障关闭留档（含根因、修复提交、回归证据）。
- [ ] [协同] 双故障关闭留档（可审核版本）：后端主笔 postmortem + 前端补齐实机截图清单，占位符齐全，总控最终 Gate-D 勾选并归档（已于 2026-02-09 17:20:05 预告排队）。
- [ ] [协同] 本地可测试闭环：补齐 `docs/部署与运行.md` 的 Windows 本地启动步骤（后端 uvicorn 21345 + 前端 vite 5173 + 健康检查 URL），并明确"如何停止服务/如何查看日志"的最小说明。（前端已推送 `7a3f204`，待总控集成）。
- [√] [后端] 图表接口性能 v1：returns_history 增加 60s TTL 缓存（已完成@bot 89703c4）
- [√] [前端] 移动端适配 v1：精选 mot-bot 思路，小步优化 SettingsDrawer/HoldingsTable/交易表单窄屏可用性（已完成@bot dd7edf3）
- [√] [前端] 分红（dividend）录入 UI v1：交易页增加 tradeType=dividend 并正确写入/展示（已完成@bot 06fea1b）
- [√] [后端] 风险口径对齐 v1：GET /api/report/daily 增加 data_quality 摘要（已完成@bot 17bea90）
- [√] [前端] 日报可解释性 v1：展示 data_quality 提示（已完成@bot 2b293be）
- [√] [前端] 全局搜索框样式优化：搜索输入框需优化为现代风格（圆角、阴影、padding），与主标题同行布局（已完成@bot d9d720f）
- [√] [前端] 顶栏布局重构 v1：重新设计 TopToolbar 布局 — 一行内左侧 VC 图标+标题+副标题，右侧全局搜索框+状态+刷新+个人中心；数据状态详情面板从 header 移出为独立可折叠区域（已完成@bot d9d720f）
- [√] [前端] 整体前端设计优化 v1：统一组件风格（圆角、阴影、间距、字号），提升现代感与一致性（已完成@bot 0fee5e4）
- [√] [前端] 修复组合收益曲线 Not Found：接口联通性已验证，空数据时显示友好提示而非 Not Found
- [√] [前端] 修复基准对比 Not Found：接口联通性已验证，空数据时显示 unknown 状态
- [√] [前端] 修复交易页定投计划 Not Found：接口联通性已验证，正常显示定投计划列表
- [√] [前端] 修复交易流水 Not Found：接口联通性已验证，正常显示交易流水列表

## P1（基金数据库与交易事实闭环）

- [√] [前端] SettingsDrawer 信息架构 v2（高频项优先）：轻量重排分组（已完成@bot 9f38a2e）
- [√] [协同] 可观测性面板 v1：前端 dev-only 面板 + 后端 `GET /api/system/diagnostics`（登录）提供可复制诊断信息（已完成@bot b6684d5, 0f9c6f6）

## P1.5（消息通道增强：飞书 + Telegram 预留）

- [ ] [协同] 通知通道"统一动作结果模型"：对 Telegram/飞书的 `test_message` 返回结构与错误分类做 SSOT 约束（`ok/sent/trace_id/attempts/error{category,message}`），并在 `docs/接口契约.md` 固化（前端仅依赖该结构渲染提示，不做 provider 特判）。
- [ ] [后端Agent1] 统一 Telegram/飞书 `test_message` 返回结构与错误分类：两者返回字段完全一致（`ok/sent/trace_id/attempts/max_attempts/error{category,message}`），并同步更新 smoke + `docs/接口契约.md`。（已推送 `cca0990`，待总控集成）。
- [ ] [后端Agent1] 飞书 webhook 治理 v1：URL 校验（仅 https；host 白名单 `open.feishu.cn`）、sender 日志脱敏（不记录明文 webhook）、补最小 smoke。（已推送 `f6be5b1`，待总控集成）。
- [ ] [后端Agent1] 飞书抓取治理 v2（后续）：频控、缓存过期、日志审计、失败隔离（本条不阻塞 v1）。
- [ ] [前端Agent1] 测试消息按钮组件化：抽 `TestMessageButton` 统一 Telegram/飞书 test_message 交互与提示（trace_id + error.category/message），降低重复逻辑与回归风险。（已推送 `7c52b6f`，待总控集成）。
- [ ] [后端Agent1] 通知诊断 status（只读脱敏）：新增 `GET /api/settings/notifications/status`，返回每个通道 `enabled/credential_configured/last_test_summary(trace_id,time,ok,sent,error_category)`；不得回显任何凭据明文。第一版允许 `last_test_summary=null`（不做持久化），但字段必须存在且契约明确。（已推送 `4d6d34b`，待总控集成）。
- [ ] [后端Agent1] 通知诊断 status v2a（可观测性）：每次调用 `*/test_message` 后落库 `last_test_summary`（含 time/trace_id/ok/sent/error_category），并在 `GET /api/settings/notifications/status` 返回；仍不得回显任何凭据明文，契约与 smoke 补齐。（已推送 `ea4e344`，待总控集成；不阻塞 v1）。
- [ ] [后端Agent1] 通知诊断 status v2b（历史）：在 status 中返回 `last_test_history` 最近 N 条（默认 10），用于前端展示失败趋势。（已推送 `d5332f3`，待总控集成；不阻塞 v2a）。
- [ ] [前端Agent1] 通知诊断面板 v2a：支持一键复制 `trace_id`，并对 `last_test_summary.time` 做可读格式展示；保持统一提示格式（trace_id + error.category/message）。（已推送 `26c4c9d`，待总控集成）。
- [ ] [前端Agent1] 通知诊断面板 v2b：展示 `last_test_history` 最近 N 条（若后端提供），支持展开/收起与复制 trace_id。（已推送 `3b2989d`，待总控集成；不阻塞 v2a）。
- [√] [后端] 通知诊断 v3：`POST /api/settings/notifications/test_all` 一键测试所有通道（已完成@bot 907c31f）
- [√] [前端] 通知诊断 v3：面板增加 `Test all` 与结果展示（已完成@bot 23732f5）
- [ ] [后端Agent1] 健康检查口径一致性：提供 `/api/healthz` 与 `/api/health` 兼容（或统一为一个并同步更新 Gate 脚本与文档），补最小 smoke，并在 `docs/部署与运行.md` 明确"健康检查 URL"。（已下发，执行中）。
- [ ] [后端Agent1] Telegram sender 日志脱敏与错误映射收敛：确保任何日志/异常链路不包含 token 明文；将 Telegram API 失败映射到稳定 `error.category` 并在契约固化；补最小 smoke。（已在 comms 预告，待总控正式下发）。
- [√] [后端] 通知测试消息防滥用 v1（cooldown/429）：test_message 增加用户级 cooldown（已完成@bot ea258c4）
- [ ] [前端Agent1] 通知诊断 UX v4（cooldown 展示与按钮禁用）：展示倒计时/到期时间，429 提示含 trace_id，补最小回归（已于 2026-02-09 17:29:19 预告排队）。
- [ ] [协同] Telegram chat_id 自动发现（可选增强）：增加 inbound webhook 接收 Telegram update（带独立 secret），用于在不粘贴 token 的情况下辅助绑定 chat_id（需部署侧支持，不阻塞当前迭代）。
- [ ] [前端Agent1] 通知诊断面板 v2c：复制诊断信息（脱敏 status JSON + 版本信息）一键带走排障证据；包含 clipboard fallback 与最小回归。（已下发，执行中）。

## P2（决策层与执行闭环深化）

- [后端Agent1] 风险口径对齐 v1：`GET /api/report/daily` 增加 `data_quality` 摘要（估算/缺失/异常），补最小 smoke + 契约（已于 2026-02-09 17:27:03 预告排队）。
- [√] [前端] 日报可解释性 v1：展示 `data_quality` 提示与 tooltip 详情（已完成@bot 2b293be）

## P3（持续改进）

- [ ] [后端Agent1] 分支保护治理回补：恢复 `Docs Gate / docs-gate` 与 `Release Consistency / verify-release` 的远端必需检查留档。
- [ ] [后端Agent1] 登录安全增强：细粒度限流、失败观测、告警阈值。
- [√] [后端] 登录限流 v1（最小闭环）：对 `POST /api/auth/login` 增加按 IP+username 的简单限流（返回 429 + trace_id）（已完成@bot e70e401）
- [ ] [前端Agent1] 认证错误 UX 收敛（401/429）：统一提示与引导，避免白屏，并补最小回归（已于 2026-02-09 17:23:29 预告排队）。
- [ ] [后端Agent1] 前端构建缓存优化（CI/本地）：`check_release_preflight.py` 运行速度优化（不改变默认行为），补文档说明（已于 2026-02-09 17:23:29 预告排队）。
- [ ] [后端Agent1] 设置保存审计日志 v1：`PUT /api/settings` 与独立凭据写接口落库变更摘要（不存凭据明文）+ `GET /api/settings/audit_logs`，补 smoke + 契约（已于 2026-02-09 17:24:16 预告排队）。
- [ ] [前端Agent1] 设置变更可视化 v1：保存成功后展示变更摘要；如有 audit_logs 则可查看最近记录，补最小回归（已于 2026-02-09 17:24:16 预告排队）。
- [ ] [后端Agent1] 配置一致性检查 v1（settings schema lint）：新增 `scripts/check_settings_schema.py` 并可接入 preflight（已于 2026-02-09 17:25:08 预告排队）。
- [ ] [前端Agent1] 前端 settings schema 断言：开发期禁止未知 key/敏感明文 payload，补最小回归（已于 2026-02-09 17:25:08 预告排队）。
- [ ] [后端Agent1] 数据导入幂等键 v1：`POST /api/transactions/import` 支持幂等键防重复落库，补 smoke + 契约（已于 2026-02-09 17:25:08 预告排队）。
- [ ] [协同] 本地性能基线脚本（perf_smoke）：跑关键页面计时并落地本地基线文件（不入库）（已于 2026-02-09 17:26:11 预告排队）。
- [ ] [后端Agent1] 账号安全 v1（密码策略与会话过期可见）：补最小 smoke + 契约（已于 2026-02-09 17:27:50 预告排队）。
- [ ] [前端Agent1] 登录体验 v1（会话过期提示 + 返回原页面）：补最小回归（已于 2026-02-09 17:27:50 预告排队）。
- [ ] [协同] 备份与恢复 runbook（本地/生产）：sqlite/volume 备份恢复步骤与验证清单（已于 2026-02-09 17:27:50 预告排队）。
