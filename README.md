# VectorControl

VectorControl 是一个面向个人投资场景的“决策中枢”。
目标不是做情绪化看盘，而是建立一套可复现、可审计、可演进的闭环：
`数据获取 -> 估值与风险 -> 决策建议 -> 执行记录 -> 复盘追踪`。

## 文档导航
- 架构与治理（本文件）
- 任务清单：`ROADMAP.md`
- 开发规范：`docs/开发规范.md`
- Git 工作流：`docs/Git工作流.md`
- 部署与运行：`docs/部署与运行.md`
- 接口契约：`docs/接口契约.md`

## 架构总览

```text
VectorControl
├─ backend/
│  └─ app/
│     ├─ main.py
│     ├─ api/
│     │  ├─ deps.py
│     │  └─ routers/
│     ├─ estimator/
│     ├─ risk/
│     ├─ policy/
│     ├─ storage/
│     └─ data_sources/
├─ frontend/
│  └─ src/
│     ├─ components/
│     ├─ hooks/
│     ├─ utils/
│     └─ api.js
├─ config/
├─ docs/
├─ scripts/
└─ ROADMAP.md
```

## 核心架构决策

### 1) 运行态真源
- `SQLite` 是运行态唯一真源。
- `YAML(config/*)` 仅用于初始化导入与离线导出备份。
- 前端/后端运行时写操作不得直接落 YAML。

### 2) 三道门槛（Gate）
- `Gate-A 可复现`：新机器按文档 5 分钟可跑通核心闭环。
- `Gate-B 契约稳定`：核心接口字段冻结，新增只能“加字段”，不能改语义/删字段。
- `Gate-C 降级可用`：外部数据源失败时按基金粒度降级，不允许整页崩溃。

### 3) 前后端解耦
- 后端负责：规则、计算、存储、审计。
- 前端负责：工作台交互、可视化、流程编排。
- 通过稳定 API 契约协作，不跨层写入。

## 核心流程
1. 用户登录后获取会话 token。
2. 前端请求 `/api/estimate` 与 `/api/risk/overview` 渲染持仓与风险。
3. 决策动作通过 `/api/actions` 写入审计日志。
4. 日终通过 `/api/report/daily` 生成复盘摘要。
5. 持仓结构编辑通过 `/api/holdings*` 完成，统一入库。

## 当前优先级
- 第一优先：稳定性与可复现（Gate-A/B/C）。
- 第二优先：持仓中心体验（高密度信息、可编辑、可排序、图表可读）。
- 第三优先：多用户隔离与通知能力扩展。

## 免责声明
- 本项目数据与分析仅用于学习与技术研究，不构成投资建议。
- 外部公开接口可能存在延迟、缺失、变更或不可用风险。
- 使用者需自行判断并承担风险。