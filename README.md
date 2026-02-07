# VectorControl

VectorControl 是一个面向个人投资的“决策中枢”项目。  
目标不是预测市场，而是把投资流程稳定化、可解释化、可审计化：

`估值 -> 指令 -> 执行 -> 复盘`

## 1. 项目定位
- 冷静理性：不做情绪化资讯流，不做“喊单式”推荐。
- 工程可控：接口契约冻结、Gate 门禁、失败降级、可回滚。
- 用户隔离：多用户会话与业务数据严格按 `user_id` 隔离。
- 可部署：支持本地开发与 VPS 生产部署（Docker Compose + Nginx + HTTPS）。

## 2. 目录结构
```text
VectorControl
├─ backend/                        # FastAPI 后端
│  └─ app/
│     ├─ main.py                   # 应用装配与中间件
│     ├─ api/routers/              # 路由层
│     ├─ storage/                  # 数据访问层
│     ├─ estimator/                # 估值聚合与指标口径
│     ├─ risk/                     # 风险与覆盖率
│     ├─ policy/                   # 策略规则
│     └─ data_sources/             # 外部数据源（超时 + 回退）
├─ frontend/                       # React + Vite 前端
│  └─ src/
│     ├─ components/               # 页面与业务组件
│     ├─ hooks/                    # 状态逻辑
│     ├─ utils/                    # 口径/图表/格式化工具
│     └─ api.js                    # 同域 /api 请求封装
├─ config/                         # YAML 初始化配置（导入/导出）
├─ deploy/                         # 生产部署（Compose + Nginx + TLS）
├─ scripts/                        # Gate 验收与部署运维脚本
├─ docs/                           # 架构、契约、设计、部署文档
├─ ROADMAP.md                      # 任务状态单一真源
└─ AGENTS.md                       # 仓库级执行规范
```

## 3. 后端架构
### 3.1 分层职责
- `main.py`：创建 FastAPI、注册中间件和路由。
- `api/routers`：只做参数校验与编排，不承载复杂业务。
- `storage`：数据库读写与表结构初始化。
- `estimator/risk/policy`：估值、覆盖率、指令与风控口径。
- `data_sources`：外部源抓取、超时控制、失败回退。

### 3.2 数据真源与隔离
- 运行态数据真源：数据库（本地可 SQLite，生产推荐 Postgres）。
- YAML 仅用于初始化导入和导出备份，不直接做运行态写入。
- 业务数据按 `user_id` 强制隔离，接口未登录返回 401。

### 3.3 契约原则
核心接口遵循“只增字段，不删字段，不改语义”：
- `/api/config`
- `/api/estimate`
- `/api/advice`
- `/api/actions`
- `/api/report/daily`
- `/api/holdings`

## 4. 前端架构
### 4.1 页面定位
- 首页：资产总览 + 主动作 + 今日待办。
- 持仓：主工作台（排序、编辑、分组、收益展示）。
- 详情：多周期图表、基准虚线、口径一致。
- 交易：买入/定投/赎回/转换最小闭环。

### 4.2 设计系统约束
- 白底、简洁、工业化风格。
- 颜色/字体/间距/圆角统一走 Token。
- 图表必须有基准虚线（0% 或成本线）。
- 页面必须具备加载/成功/失败三态与可行动空状态。

## 5. Gate 门禁体系
- Gate-A：新环境 5 分钟可复现闭环。
- Gate-B：核心接口契约稳定，回归通过。
- Gate-C：外部源失败可降级且页面不中断。
- Gate-D：生产部署闭环（Compose + Nginx + 验收脚本）。

## 6. 快速开始
### 6.1 本地开发
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 21345

cd ../frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### 6.2 门禁验收
```bash
python scripts/check_gate_a_full.py
python scripts/check_gate_b_full.py
python scripts/check_gate_c_full.py
```

### 6.3 生产部署（入口）
```bash
cp deploy/.env.example deploy/.env.prod
bash scripts/deploy_prod.sh
VC_DOMAIN=your.domain VC_SCHEME=https python scripts/check_gate_d.py
```

部署细节、回滚、证书续期见：`docs/部署与运行.md`

## 7. 文档索引
- 执行规范：`AGENTS.md`
- 任务看板：`ROADMAP.md`
- 最新进度：`docs/最新进度.md`
- 部署运行：`docs/部署与运行.md`
- 接口契约：`docs/接口契约.md`
- 设计规范：`docs/设计系统与交互规范.md`
- 产品蓝图：`docs/产品需求与页面蓝图.md`
- 开发规范：`docs/开发规范.md`
- Git 工作流：`docs/Git工作流.md`

## 8. 免责声明
- 本项目仅用于学习与工程实践，不构成投资建议。
- 外部数据源可能延迟、缺失或变更，需自行判断风险。
