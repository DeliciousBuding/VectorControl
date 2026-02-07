# VectorControl

VectorControl 是一个面向个人投资者的「持仓决策中枢」项目。  
目标不是预测市场，而是把投资流程工程化为：

`估值 -> 指令 -> 执行 -> 复盘`

项目强调：
- 多用户数据隔离（按 `user_id`）
- 接口契约稳定（只增字段，不改语义）
- 失败可降级（单基金失败不阻断全局）
- 可部署、可回滚、可验收（Gate-A/B/C/D）

## 当前发布版本
- `v1.0.0`（main 发布版）

## 架构速览
- 前端：`React + Vite`，单页工作台，核心页面为首页/自选/交易/持仓/我的。
- 后端：`FastAPI`，按 `router + service-like modules + storage` 分层。
- 数据库：默认 SQLite（本地），生产建议 PostgreSQL（已提供 Compose 编排）。
- 配置：`config/*.yaml` 用于初始化导入与备份导出，不作为运行态写入真源。
- 部署：`Docker Compose + Nginx + HTTPS`（Let’s Encrypt）。

更详细结构见：`docs/架构说明.md`

## 目录结构
```text
VectorControl/
├─ backend/                     # FastAPI 后端
│  └─ app/
│     ├─ main.py               # 应用装配、中间件、路由注册
│     ├─ api/routers/          # 接口路由层
│     ├─ storage/              # 数据库访问与表结构初始化
│     ├─ estimator/            # 估值、指标口径、聚合逻辑
│     ├─ risk/                 # 风险概览与覆盖率
│     ├─ policy/               # 指令规则与阈值
│     ├─ data_sources/         # 外部数据源（超时/回退）
│     └─ notifier/             # 推送扩展位
├─ frontend/                    # React 前端
│  └─ src/
│     ├─ components/           # 页面组件
│     ├─ hooks/                # 鉴权与业务状态
│     ├─ utils/                # 图表、口径、格式化工具
│     └─ api.js                # 同域 /api 请求封装
├─ config/                      # 初始化配置（基金、持仓、策略）
├─ deploy/                      # 生产编排（Compose/Nginx/Dockerfile）
├─ scripts/                     # Gate 验收与部署脚本
├─ docs/                        # 架构、契约、设计、部署、规范
├─ ROADMAP.md                   # 任务清单与勾选进度
└─ AGENTS.md                    # 仓库级执行规则
```

## 后端核心接口
- 鉴权与用户：`/api/auth/register`、`/api/auth/login`、`/api/auth/me`、`/api/auth/logout`
- 配置与持仓：`/api/config`、`/api/holdings`、`/api/holdings/import_yaml`
- 估值与风险：`/api/estimate`、`/api/risk/overview`
- 决策与执行：`/api/advice`、`/api/actions`
- 复盘：`/api/report/daily`
- 健康检查：`/api/health`、`/api/healthz`

接口契约详见：`docs/接口契约.md`

## 本地开发
### 1) 启动后端
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 21345
```

### 2) 启动前端
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### 3) 浏览器访问
- 前端：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:21345/api/health`

## 一键脚本与门禁
- 本地脚本：`scripts/start_backend.bat`、`scripts/start_frontend.bat`
- Gate 验收：`scripts/check_gate_a_full.py`、`scripts/check_gate_b_full.py`、`scripts/check_gate_c_full.py`、`scripts/check_gate_d.py`

部署细节见：`docs/部署与运行.md`

## 当前分支策略
- `dev`：日常开发与集成
- `main`：发布与生产

详细规范见：`AGENTS.md` 与 `docs/Git工作流.md`

## 文档索引
- 架构说明：`docs/架构说明.md`
- 最新进度：`docs/最新进度.md`
- 产品蓝图：`docs/产品需求与页面蓝图.md`
- 设计规范：`docs/设计系统与交互规范.md`
- 接口契约：`docs/接口契约.md`
- 部署运行：`docs/部署与运行.md`
- 开发规范：`docs/开发规范.md`
- Git 工作流：`docs/Git工作流.md`

## 免责声明
- 本项目仅用于学习与工程实践，不构成投资建议。
- 外部数据源可能延迟、缺失或变更，请自行判断风险。
