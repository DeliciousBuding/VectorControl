# VectorControl

VectorControl 是一个面向个人投资场景的“决策中枢”项目，核心目标不是做行情聚合页，而是建立一套可复现、可审计、可演进的持仓决策工作流。

本文档用于说明项目架构与模块边界，便于你在 Web 版 AI 工具中直接粘贴并快速建立上下文。

## 1. 项目定位

- 定位：专业、冷静、理性的持仓决策系统。
- 目标：把“数据获取 -> 估值计算 -> 风险评估 -> 策略建议 -> 执行记录 -> 复盘”串成闭环。
- 原则：多用户隔离、数据可追溯、接口可扩展、前后端解耦。

## 2. 技术栈

- 后端：FastAPI + SQLite
- 前端：React + Vite
- 配置：YAML（`config/`）
- 运行方式：本机脚本 / Docker

## 3. 总体架构

```text
VectorControl
├─ backend/                 # 后端服务（FastAPI）
│  └─ app/
│     ├─ main.py            # 应用入口（初始化、中间件、路由注册）
│     ├─ api/
│     │  ├─ deps.py         # 路由共享依赖
│     │  └─ routers/        # 按领域拆分的接口
│     ├─ core/              # 配置加载、环境变量、全局设置
│     ├─ estimator/         # 估值引擎
│     ├─ risk/              # 风险中枢引擎
│     ├─ policy/            # 策略建议逻辑
│     ├─ storage/           # SQLite 数据访问与迁移
│     └─ data_sources/      # 外部行情数据源与回退策略
├─ frontend/                # 前端工作台（React）
│  └─ src/
│     ├─ App.jsx            # 页面编排层
│     ├─ api.js             # 接口访问封装
│     ├─ components/        # UI 组件
│     ├─ hooks/             # 前端业务状态与数据流
│     └─ utils/             # 格式化、计算、图表辅助
├─ config/                  # 业务配置（基金、持仓、策略）
├─ docs/                    # 文档（部署、规范、工作流）
├─ scripts/                 # Windows 启动脚本
└─ ROADMAP.md               # 任务清单（[ ] / [x]）
```

## 4. 后端模块职责

### 4.1 API 路由层（`backend/app/api/routers`）

- `auth`：注册、登录、登出、当前用户
- `config`：配置摘要与会话信息
- `settings`：用户设置读取与更新
- `estimate`：估值输出（含持仓明细）
- `risk`：风险中枢输出
- `advice`：策略建议输出
- `actions`：执行记录读写
- `holdings`：持仓字段更新
- `report`：日报生成

### 4.2 引擎层

- `estimator/engine.py`：
- 拉取外部行情
- 聚合单基金估值结果
- 生成分桶估值与持仓明细

- `risk/engine.py`：
- 计算集中度
- 相关性概览
- 压力测试
- 结构重叠预警

- `policy/advice.py`：
- 基于估值与策略配置生成建议动作

### 4.3 存储层（`storage/db.py`）

主要负责 SQLite 表结构与数据访问，当前核心表包括：

- `user_accounts`：用户账号
- `user_sessions`：会话令牌
- `holdings`：用户持仓
- `estimate_snapshot`：估值快照
- `actions_log`：执行记录
- `user_settings`：用户个性化设置

## 5. 前端模块职责

### 5.1 编排层

- `App.jsx`：页面结构编排，不承载重业务逻辑。

### 5.2 业务层

- `hooks/useAuth.js`：认证状态管理
- `hooks/usePortfolio.js`：持仓、刷新、设置等状态管理

### 5.3 视图层

- `components/`：
- 顶栏、状态提示、持仓表
- 单基金详情与图表
- 风险中枢
- 设置抽屉

### 5.4 工具层

- `utils/format.js`：金额/百分比/日期格式化
- `utils/holdings.js`：持仓字段处理与排序状态机
- `utils/chart.js`：图表数据构造

## 6. 核心数据流（端到端）

### 6.1 登录与用户隔离

1. 前端调用 `/api/auth/login` 或 `/api/auth/register`。
2. 后端返回 token，前端持久化。
3. 后续请求通过 `Authorization: Bearer <token>` 进入用户态。
4. 数据查询按 `user_id` 隔离。

### 6.2 估值刷新

1. 前端请求 `/api/estimate`。
2. 后端读取用户持仓，调用数据源获取估值。
3. 引擎生成 `funds[]` 与 `buckets[]`。
4. 后端写入 `estimate_snapshot`。
5. 前端渲染持仓与图表。

### 6.3 风险分析

1. 前端请求 `/api/risk/overview`。
2. 后端基于持仓与快照计算风险指标。
3. 前端渲染风险中枢模块。

### 6.4 执行与复盘

1. 前端调用 `/api/actions` 写入执行记录。
2. 前端调用 `/api/report/daily` 获取日报。
3. 后端综合估值快照、动作日志与策略输出复盘文本。

## 7. 当前接口概览

- `/api/health`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/config`
- `/api/settings`（GET/PUT）
- `/api/estimate`
- `/api/risk/overview`
- `/api/advice`
- `/api/actions`（GET/POST）
- `/api/holdings/{fund_id}`（PATCH）
- `/api/report/daily`

## 8. 配置文件

- `config/funds.yaml`：基金基础信息与分组
- `config/portfolio.yaml`：持仓配置（市值、成本、标签等）
- `config/policy.yaml`：策略阈值与规则

## 9. 开发与协作约束

- 规范文档：`docs/开发规范.md`
- 分支与合并：`docs/Git工作流.md`
- 任务清单：`ROADMAP.md`

## 10. 部署与运行文档索引

部署、启动、操作、自测、排错不再放在 README，统一见：

- [部署与运行手册](docs/部署与运行.md)

## 11. 致谢与免责声明

### 11.1 致谢

本项目为独立实现，参考了以下开源项目思路（未直接复制源码）：

- FundVal-Live: <https://github.com/Ye-Yu-Mo/FundVal-Live>
- lanZzV/fund: <https://github.com/lanZzV/fund>
- real-time-fund: <https://github.com/hzm0321/real-time-fund>
- FundCrawler: <https://github.com/Jerry1014/FundCrawler>

### 11.2 免责声明

- 本项目数据与分析仅用于学习与研究，不构成投资建议。
- 数据来自公开接口，可能存在延迟、缺失或误差。
- 使用者需自行承担投资风险。