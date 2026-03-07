# VectorControl Unified ROADMAP (Repo Synced Copy)

更新时间：2026-03-07 14:38:37

规则：`[ ]` 待完成，`[√]` 已完成（完成后尽快归档到 `docs/ROADMAP完成归档.md`）。
Description: full synced roadmap copy in repository (non-placeholder). Source: `<local>\AGENT\ROADMAP.md`.

任务标签：`[前端]`、`[后端]`、`[协同]`。
强制要求：每个 Agent 每完成一个小闭环，必须更新共享目录 `<local>\AGENT` 下的进度与通讯文档。

## 全局发布门禁（每次 `main` 更新都必须执行）

1. 文档全量巡检与必要完善（至少覆盖：`README.md`、`<local>\AGENT\ROADMAP.md`、`ROADMAP.md`（镜像）、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`）。
2. 发布前执行：`python scripts/check_release_preflight.py`（默认包含文档门禁严格模式、敏感信息扫描、后端 compileall、后端烟测、前端测试、前端 build）。
3. push 前确保 `.githooks/pre-push` 严格检查通过（`python scripts/check_secrets_leak.py` + `python scripts/check_docs_gate.py --strict`）。
4. 发布提交必须包含 `新增/修复/优化/文档` 四段，且 `文档` 段必须写清"检查范围 + 更新结论 + 延后项（无则写无）"。
5. 发布后执行：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。

## 当前迭代策略（敏捷）

1. 本阶段忽略分支保护相关治理项，不作为迭代阻塞条件（按你的当前指令执行）。
2. 每轮只推进 1-2 个可验收闭环，优先线上可用性与核心交易链路。
3. 每轮必须同时更新：代码 + 文档 + `ROADMAP` + 验收记录。
4. 进入无人值守连续推进模式时，严格按“一个闭环完成 -> 运行验证 -> 更新文档/OpenSpec/ROADMAP -> 再进入下一个闭环”的顺序执行，不允许跳过验证直接堆叠改动。
5. 不得进行权限外操作：不修改 SSH 主密钥、不修改 SSH config、不改网络拓扑、不做未获授权的外发或系统级破坏性操作。
6. 只有当以下条件同时满足时，才允许视为“当前轮次已无值得继续优化的内容”：
   - 发布链路、docs gate、preflight、Gate-D 持续稳定为绿；
   - 第二轮前端 bundle / 加载时机 / metrics 优化项全部完成；
   - 第二轮后端热点 / 观测 / SQLite 排障出口全部完成；
   - P0 线上证据、故障关闭留档、Gate-D 实机证据全部补齐；
   - 当前 `ROADMAP.md` 中不再存在可继续推进的高优先级优化项。

### 无人值守执行顺序（总控）

按以下顺序循环推进，前一闭环未完成不得切下一闭环：

1. **发布与治理闭环**
   - docs gate
   - release preflight
   - release consistency
   - Gate-D 证据与故障留档
2. **前端性能闭环**
   - analyze 基线
   - 页面级懒加载
   - 重依赖拆分
   - metrics 对照与回归
3. **后端观测闭环**
   - request_id / elapsed
   - system diagnostics
   - SQLite 只读观测
   - 热点接口耗时与排障出口
4. **业务体验闭环**
   - 基金详情页
   - 持仓表
   - JSON 导入
   - 交易与设置相关体验增强
5. **线上证据闭环**
   - 实机截图
   - postmortem
   - 审核版归档

### 每个闭环的固定动作

1. 先更新对应 OpenSpec change / tasks / 设计说明。
2. 再做最小代码改动，不扩大无关回归面。
3. 跑 focused tests / build / compileall / docs gate / preflight 中与该闭环相关的最小验证。
4. 将结果回写：
   - `docs/最新进度.md`
   - `ROADMAP.md`
   - 对应 `openspec/changes/*/tasks.md`
5. 若验证失败，先修复当前闭环，不开启下一个闭环。

## 集成队列（总控维护）

说明：记录"已推送待集成"的闭环，便于总控按单 commit 单主题合入 dev；合入后从本段移除，并在对应任务条目标记"已合入 dev@xxxx"。

- 当前无待集成条目

## P0（最优先：稳定性、发布门禁、线上可用）

### 待集成 (Queue)
- [ ] [协同] 发布链路收敛：完成 `python scripts/check_docs_gate.py --strict` 与 `python scripts/check_release_preflight.py` 本地通过，并在 `prod` 以干净目录完成 HTTP + SQLite 基线验收（当前主仓已再次实跑通过 docs gate / release preflight；`scripts/check_release_message.py` 也已收敛为中文提交前缀 + 发布提交四段说明校验，待补 `ROADMAP` 关单记录与审计化验收闭环）。
- [ ] [前端] 第二轮 bundle 优化：按 `openspec/changes/frontend-bundle-optimization-phase2/` 记录 `antd-vendor` 与页面级 chunk 基线，推进页面级懒加载与 bundle 收缩（已完成基线刷新：`antd-vendor`≈849.94kB、`index`≈105.56kB，并新增 `trade-antd`≈159.42kB；SettingsDrawer、metrics 缓冲写入、首页重图表延后加载、非首页主路径组件 lazy 化、交易中心抽离为 `TradeCenter.jsx`、`SettingsDrawer` 的 `Drawer width` 弃用噪音已清、`App.jsx` 未使用 Ant Design / icon 依赖清理、删除 `echartsCore.js` / `ReturnsChart.jsx` / `BenchmarkComparison.jsx` 并移除 `echarts` + `echarts-for-react` 依赖后，前端源码与 analyze 均已不再存在 ECharts runtime；下一步继续消化 `trade-antd -> antd-vendor` 循环分块告警并收紧 `manualChunks`）。
- [ ] [后端] 第二轮观测优化：按 `openspec/changes/backend-observability-phase2/` 整理热点接口耗时、SQLite 热点查询与部署侧诊断增强（已落地 `estimate_snapshot` 索引化、charts 聚合收敛、`system/status` / `system/diagnostics` 结构化观测、`X-Server-Elapsed-Ms` 最小时长信号、请求完成结构化日志、SQLite 只读观测摘要，以及 `lock_risk / wal_state / db_dir.writable / observations` 最小排障提示；应用启动也已切到 `lifespan`，当前下一步进入更细粒度耗时记录与锁/排障提示文案继续收紧）。
- [ ] [协同] 无人值守执行闭环：将第二轮前端优化、后端观测、线上证据留档按“单闭环完成后再开下一闭环”的顺序持续推进，直到 `ROADMAP` 中高优先级优化项全部收口。
- [ ] [前端] 基于 `docs/Gate-D验收证据模板.md` 补齐设置中心/测速页面实机验收证据（模板与 `docs/Gate-D设置中心测速前端证据.md` 已收敛到当前 HTTP + SQLite 基线；待生产实机截图、真实命令输出与实机结论补录后关单）。
- [ ] [协同] 按 `docs/P0线上故障排查SOP.md` 完成"测速 Not Found + 设置中心白屏"双故障关闭留档（含根因、修复提交、回归证据）。
- [ ] [协同] 双故障关闭留档（可审核版本）：后端 postmortem 与测速 Not Found 后端证据已收敛到当前 HTTP 基线；下一步由前端补齐实机截图清单，总控最终 Gate-D 勾选并归档（已于 2026-02-09 17:20:05 预告排队）。

### 新需求（2026-02-15 庄方宜提出）
- [ ] [前端] **基金专属独立页面**：点击基金跳转独立路由 `/fund/:fund_id`，而非滚动到底部查看
- [ ] [前端] **优化基金详情页信息密度**：左右布局（左波形图+右具体数据），波形图缩小提高信息密度
- [ ] [前端] **持仓表头自定义字段**：支持显示/隐藏列，删除持仓份额为0的列
- [ ] [后端] **导入交易记录JSON功能**：标准JSON格式+自动爬取补全缺失数据

### 已完成 (Done)
- [√] [后端] 智能缓存策略：根据市场状态动态调整缓存时间（非交易时间1小时/交易时间60秒/美股时间30秒）（已完成@bot 99b6d63）
- [√] [后端] 节假日特殊处理：支持2026年中美国节假日检测，非交易日延长缓存（已完成@bot 99b6d63）
- [√] [后端] 市场状态API：`/api/estimate` 返回 `market_status` 字段（北京时间/美东时间/市场开盘状态/节假日名称）（已完成@bot 99b6d63）
- [√] [前端] 修复CSS引入路径：使用完整样式文件修复TopToolbar和SideNav样式（已完成@bot a67bc82）
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

### 已完成 (Done)
- [√] [前端] SettingsDrawer 信息架构 v2（高频项优先）：轻量重排分组（已完成@bot 9f38a2e）
- [√] [协同] 可观测性面板 v1：前端 dev-only 面板 + 后端 `GET /api/system/diagnostics`（登录）提供可复制诊断信息（已完成@bot b6684d5, 0f9c6f6）

## P1.5（消息通道增强：飞书 + Telegram 预留）

### 待集成 (Queue)
- [ ] [协同] 通知通道"统一动作结果模型"：对 Telegram/飞书的 `test_message` 返回结构与错误分类做 SSOT 约束（`ok/sent/trace_id/attempts/error{category,message}`），并在 `docs/接口契约.md` 固化（前端仅依赖该结构渲染提示，不做 provider 特判）。
- [ ] [后端] 飞书抓取治理 v2（后续）：频控、缓存过期、日志审计、失败隔离（本条不阻塞 v1）。
- [ ] [协同] Telegram chat_id 自动发现（可选增强）：增加 inbound webhook 接收 Telegram update（带独立 secret），用于在不粘贴 token 的情况下辅助绑定 chat_id（需部署侧支持，不阻塞当前迭代）。

### 已完成 (Done)
- [√] [后端] 统一 Telegram/飞书 `test_message` 返回结构与错误分类：两者返回字段完全一致（`ok/sent/trace_id/attempts/max_attempts/error{category,message}`），并同步更新 smoke + `docs/接口契约.md`。（已完成@bot cca0990）。
- [√] [后端] 飞书 webhook 治理 v1：URL 校验（仅 https；host 白名单 `open.feishu.cn`）、sender 日志脱敏（不记录明文 webhook）、补最小 smoke。（已完成@bot f6be5b1）。
- [√] [前端] 测试消息按钮组件化：抽 `TestMessageButton` 统一 Telegram/飞书 test_message 交互与提示（trace_id + error.category/message），降低重复逻辑与回归风险。（已完成@bot 7c52b6f）。
- [√] [后端] 通知诊断 status（只读脱敏）：新增 `GET /api/settings/notifications/status`，返回每个通道 `enabled/credential_configured/last_test_summary(trace_id,time,ok,sent,error_category)`；不得回显任何凭据明文。第一版允许 `last_test_summary=null`（不做持久化），但字段必须存在且契约明确。（已完成@bot 4d6d34b）。
- [√] [后端] 通知诊断 status v2a（可观测性）：每次调用 `*/test_message` 后落库 `last_test_summary`（含 time/trace_id/ok/sent/error_category），并在 `GET /api/settings/notifications/status` 返回；仍不得回显任何凭据明文，契约与 smoke 补齐。（已完成@bot ea4e344）。
- [√] [后端] 通知诊断 status v2b（历史）：在 status 中返回 `last_test_history` 最近 N 条（默认 10），用于前端展示失败趋势。（已完成@bot d5332f3）。
- [√] [前端] 通知诊断面板 v2a：支持一键复制 `trace_id`，并对 `last_test_summary.time` 做可读格式展示；保持统一提示格式（trace_id + error.category/message）。（已完成@bot 26c4c9d）。
- [√] [前端] 通知诊断面板 v2b：展示 `last_test_history` 最近 N 条（若后端提供），支持展开/收起与复制 trace_id。（已完成@bot 3b2989d）。
- [√] [后端] 健康检查口径一致性：提供 `/api/healthz` 与 `/api/health` 兼容（或统一为一个并同步更新 Gate 脚本与文档），补最小 smoke，并在 `docs/部署与运行.md` 明确"健康检查 URL"。（已完成@bot）。
- [√] [后端] Telegram sender 日志脱敏与错误映射收敛：确保任何日志/异常链路不包含 token 明文；将 Telegram API 失败映射到稳定 `error.category` 并在契约固化；补最小 smoke。（已完成@bot）。
- [√] [前端] 通知诊断面板 v2c：复制诊断信息（脱敏 status JSON + 版本信息）一键带走排障证据；包含 clipboard fallback 与最小回归。（已完成@bot）。
- [√] [后端] 通知诊断 v3：`POST /api/settings/notifications/test_all` 一键测试所有通道（已完成@bot 907c31f）
- [√] [前端] 通知诊断 v3：面板增加 `Test all` 与结果展示（已完成@bot 23732f5）
- [√] [后端] 通知测试消息防滥用 v1（cooldown/429）：test_message 增加用户级 cooldown（已完成@bot ea258c4）
- [√] [前端] 通知诊断 UX v4（cooldown 展示与按钮禁用）：展示倒计时，冷却中时按钮禁用（已完成@bot 9999eed）

## P2（决策层与执行闭环深化）

### 待集成 (Queue)
- [后端] 风险口径对齐 v1：`GET /api/report/daily` 增加 `data_quality` 摘要（估算/缺失/异常），补最小 smoke + 契约（已于 2026-02-09 17:27:03 预告排队）。

### 已完成 (Done)
- [√] [前端] 日报可解释性 v1：展示 `data_quality` 提示与 tooltip 详情（已完成@bot 2b293be）

## P3（持续改进）

### 待集成 (Queue)
- [ ] [后端] 分支保护治理回补：恢复 `Docs Gate / docs-gate` 与 `Release Consistency / verify-release` 的远端必需检查留档。
- [ ] [后端] 前端构建缓存优化（CI/本地）：`check_release_preflight.py` 运行速度优化（不改变默认行为），补文档说明（已于 2026-02-09 17:23:29 预告排队）。
- [ ] [协同] 本地性能基线脚本（perf_smoke）：跑关键页面计时并落地本地基线文件（不入库）（已于 2026-02-09 17:26:11 预告排队）。

### 已完成 (Done)
- [√] [后端] 登录安全增强：细粒度限流、失败观测、告警阈值。（已完成@bot e70e401）。
- [√] [后端] 数据导入幂等键 v1：`POST /api/transactions/import` 支持幂等键防重复落库，补 smoke + 契约。（已完成@bot）。
- [√] [后端] 账号安全 v1（密码策略与会话过期可见）：补最小 smoke + 契约。（已完成@bot）。
- [√] [前端] 登录体验 v1（会话过期提示 + 返回原页面）：补最小回归。（已完成@bot）。
- [√] [协同] 备份与恢复 runbook（本地/生产）：sqlite/volume 备份恢复步骤与验证清单。（已完成@bot）。
- [√] [后端] 登录限流 v1（最小闭环）：对 `POST /api/auth/login` 增加按 IP+username 的简单限流（返回 429 + trace_id）（已完成@bot e70e401）
- [√] [前端] 认证错误 UX 收敛（401/429）：ErrorBoundary 防止白屏（已完成@bot 89df631）
- [√] [后端] 设置保存审计日志 v1：`PUT /api/settings` 落库变更摘要 + `GET /api/settings/audit_logs`（已完成@bot 94a1d89）
- [√] [前端] 设置变更可视化 v1：保存成功后展示变更摘要（已完成@bot a75210f）
- [√] [后端] 配置一致性检查 v1（settings schema lint）：补齐 settings schema 规则与对应文档约束（已完成@bot 47758b5）
- [√] [前端] 前端 settings schema 断言：开发期禁止未知 key/敏感明文 payload（已完成@bot 6a06a2c）
