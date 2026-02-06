# VectorControl

VectorControl 是一个面向个人投资的决策中枢，强调“可解释、可审计、可复现”，而不是资讯驱动或情绪驱动的看盘工具。

## 项目定位
- 核心目标：把日常投资动作收敛为稳定流程 `估值 -> 指令 -> 执行 -> 复盘`。
- 产品原则：多用户隔离、口径统一、失败可降级、页面不中断。
- 工程原则：文档先行、契约冻结、Gate 验收、最小可回滚改动。

## 架构总览

```text
VectorControl
├─ backend/                        # FastAPI 后端
│  ├─ app/main.py                  # 应用装配、鉴权中间件、路由注册
│  └─ app/
│     ├─ api/routers/              # 路由层（auth/estimate/holdings/...）
│     ├─ storage/                  # 数据访问层（SQLite）
│     ├─ estimator/                # 估值与聚合口径
│     ├─ risk/                     # 风险与覆盖率汇总
│     ├─ policy/                   # 规则策略
│     └─ data_sources/             # 外部数据源（超时+回退）
├─ frontend/                       # React + Vite 前端
│  └─ src/
│     ├─ components/               # 页面与业务组件
│     ├─ hooks/                    # 交互与状态逻辑
│     ├─ utils/                    # 口径/格式化/图表辅助
│     └─ api.js                    # 同域 /api 请求封装
├─ config/                         # YAML 配置（初始化导入/导出备份）
├─ deploy/                         # 生产部署（Compose + Nginx + HTTPS）
├─ docs/                           # 架构、契约、设计、部署文档
├─ scripts/                        # Gate 验收脚本与运维脚本
└─ ROADMAP.md                      # 任务状态单一真源
```

## 核心设计决策

### 1) 数据真源与边界
- 运行态真源：`SQLite`。
- `config/*.yaml`：仅用于初始化导入与导出备份，不作为运行态直接写入目标。
- 前端只通过 API 改数据，不直接改 YAML。

### 2) 多用户与隔离
- 会话模式：`Bearer Session Token`。
- 除 `/api/health` 与 `/api/auth/*` 外，所有 `/api/*` 必须登录态。
- 业务数据按 `user_id` 强制隔离，A/B 用户互不可见。

### 3) 外部源降级
- 外部请求必须有超时与回退。
- 单基金失败不阻断全局聚合。
- `/api/estimate` 输出覆盖率 `coverage.total/ok/failed` 与逐基金 `status/reason/source/asof`。

### 4) 接口契约冻结（Gate-B）
核心接口只允许“增字段”，不允许删字段或改语义：
- `/api/config`
- `/api/estimate`
- `/api/advice`
- `/api/actions`
- `/api/report/daily`
- `/api/holdings`

### 5) 前端设计系统
- 白底、极简、工业风，所有颜色/字号/间距走 Token。
- 图表必须有基准虚线（0% 或成本线）。
- 涨跌不只依赖颜色，必须带符号或方向语义。
- 关键模块必须有加载/成功/失败三态与空状态 CTA。

## 运行流程（请求链路）
1. 前端通过 `api.js` 请求同域 `/api/*`。
2. 后端中间件解析令牌，写入 `request.state.user_id`。
3. 路由层调用 `storage/estimator/risk/policy` 完成业务计算。
4. 接口返回结构化结果；前端按状态与覆盖率做可视化。
5. 执行动作写入日志，日报接口聚合估值与动作结果。

## Gate 体系
- Gate-A：新机器 5 分钟可复现（启动、登录、刷新、动作、日报）。
- Gate-B：契约稳定（核心接口结构不破坏）。
- Gate-C：降级可用（外部源部分失败仍可服务）。
- Gate-D：生产部署闭环（VPS + Nginx + HTTPS + 验收脚本）。

## 本地开发
详细步骤见 `docs/部署与运行.md`。

快速入口：
```bash
python scripts/check_gate_a_full.py
python scripts/check_gate_b_full.py
python scripts/check_gate_c_full.py
```

## 生产部署
部署方案：`Nginx + Docker Compose + Let's Encrypt`

详细步骤见 `docs/部署与运行.md` 的“VPS 生产部署（Gate-D）”章节。

最小命令：
```bash
cp deploy/.env.example deploy/.env.prod
bash scripts/deploy_prod.sh
VC_DOMAIN=your.domain python3 scripts/check_gate_d.py
```

## 文档索引
- 路线图：`ROADMAP.md`
- 开发规范：`docs/开发规范.md`
- 接口契约：`docs/接口契约.md`
- 设计系统：`docs/设计系统与交互规范.md`
- 页面蓝图：`docs/产品需求与页面蓝图.md`
- Git 工作流：`docs/Git工作流.md`
- 部署与运行：`docs/部署与运行.md`

## 免责声明
- 本项目数据与分析仅用于学习与技术研究，不构成投资建议。
- 外部公开接口可能存在延迟、缺失、变更或不可用。
- 使用者需自行判断并承担风险。
