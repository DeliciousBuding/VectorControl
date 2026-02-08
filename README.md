# VectorControl

VectorControl 是一个面向个人投资决策的全栈系统，核心目标是把“数据获取 -> 估值汇总 -> 动作建议 -> 执行记录 -> 日报复盘”做成可审计、可回放、可部署的闭环。

## 1. 项目定位

- 面向对象：基金持仓用户（以“纪律执行”和“复盘解释”为核心）
- 产品原则：
  - 不做情绪化推荐
  - 不做不可解释黑盒预测
  - 优先保证可用性、可追溯性、可回滚
- 分支策略：
  - `dev`：开发与集成分支
  - `main`：发布与线上部署分支（每次发布带版本号）

## 2. 技术栈

- 前端：`React + Vite`
- 后端：`FastAPI`
- 存储：`PostgreSQL`（生产），兼容本地轻量运行
- 部署：`Docker Compose + Nginx + Let's Encrypt`
- 配置：`config/*.yaml`（策略与初始化配置）

## 3. 目录结构

```text
VectorControl/
  backend/                 # FastAPI 后端
    app/
      api/routers/         # 接口路由层
      storage/             # 数据访问层（数据库与初始化）
      estimator/           # 估值与汇总逻辑
      risk/                # 风险指标与风控逻辑
      policy/              # 策略规则
      data_sources/        # 外部数据源适配与降级
      notifier/            # 推送能力（预留）
      core/                # 通用核心能力（含网络测速）
      main.py              # 应用入口
  frontend/                # React 前端
    src/
      components/          # 页面组件
      hooks/               # 状态与业务 Hook
      utils/               # 工具函数
      api.js               # 后端接口封装
      App.jsx              # 页面主入口
  deploy/                  # 生产部署配置
    docker-compose.prod.yml
    nginx/
  scripts/                 # 启动、验收、部署脚本
  docs/                    # 架构、规范、部署、路线图文档
  config/                  # 持仓与策略配置
  ROADMAP.md               # 里程碑与任务清单
  AGENTS.md                # Agent 执行规范
```

## 4. 核心业务闭环

1. 数据采集：从外部数据源获取基金估值与行情
2. 估值汇总：按持仓计算当日收益、持有收益、仓位占比等指标
3. 动作建议：依据策略与风控规则生成当日建议
4. 执行记录：记录用户执行结果与动作日志
5. 日报复盘：输出可追溯日报文本与摘要

## 5. 关键接口（示例）

- 健康检查：`GET /api/health`、`GET /api/healthz`
- 鉴权：`POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`
- 持仓：`GET /api/holdings`、`POST /api/holdings`、`POST /api/holdings/import_yaml`
- 持仓审计：`GET /api/holdings/{fund_id}/audit`
- 估值：`GET /api/estimate`（支持 `prefer_cached / force_refresh / incremental`）
- 建议与执行：`GET /api/advice`、`GET/POST /api/actions`
- 交易流水：`GET /api/transactions`、`POST /api/transactions/import_yaml`、`PATCH /api/transactions/{transaction_id}`、`POST /api/transactions/sync_pending`
- 报告：`GET /api/report/daily`
- 设置测速：`GET /api/settings/network-benchmark/latest`、`POST /api/settings/network-benchmark/run`

详细字段与契约请见：`docs/接口契约.md`

## 6. 本地开发启动

### 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 21345
```

### 前端

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### 本地访问

- 前端：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:21345/api/health`

## 7. 生产部署（VPS）

生产环境采用 Docker Compose 编排，Nginx 负责反向代理与 HTTPS。

- 部署入口文档：`docs/部署与运行.md`
- Gate-D 验收脚本：`scripts/check_gate_d.py`
- 关键要求：
  - 仅暴露 80/443
  - 数据库不对公网暴露
  - 证书通过 Let's Encrypt 管理

## 8. 文档导航

- `docs/架构说明.md`：系统分层、职责边界、演进策略（A/B/C + X）
- `docs/开发规范.md`：开发约束、评审重点、Gate 验收要求
- `docs/接口契约.md`：接口字段与兼容性约束（Gate-B 依据）
- `docs/交易流水YAML导入规范.md`：`transactions_import.yaml` 字段规范、幂等策略与最小示例
- `docs/P0线上故障排查SOP.md`：测速 `Not Found` 与设置中心白屏的标准排查、验收与复盘模板
- `docs/部署与运行.md`：本地运行、VPS 部署、Gate-D 验收、回滚
- `docs/Git工作流.md`：分支策略、提交流程、发布前检查清单
- `docs/设计系统与交互规范.md`：设计 Token 与交互规则
- `docs/产品需求与页面蓝图.md`：产品目标、页面蓝图、信息架构
- `docs/最新进度.md`：当前开发进展与验收状态
- `docs/Gate-D验收证据模板.md`：上线后验收留档模板（HTTPS/回滚/巡检）
- `docs/状态解释验收样例.md`：`data_status` 与 `/system/status` 回归样例（接口 + 页面 + 截图清单）
- `docs/架构决策记录.md`：关键架构取舍（ADR）与长期边界共识
- `ROADMAP.md`：当前待办优先级与里程碑
- `docs/ROADMAP完成归档.md`：已完成任务归档（历史留痕）

### 文档单一事实来源（SSOT）矩阵

| 主题 | 单一事实来源 | 必须同步更新的触发条件 |
| --- | --- | --- |
| 架构边界与分层 | `docs/架构说明.md` | 新增模块、跨层重构、数据流调整 |
| 开发约束与门禁 | `AGENTS.md` + `docs/开发规范.md` + `docs/Git工作流.md` | 发布规则变化、Gate 标准变化、提交流程变化 |
| API 契约 | `docs/接口契约.md` | 新增/修改接口、字段语义变化、错误码策略变化 |
| 交易导入规范 | `docs/交易流水YAML导入规范.md` | 导入字段、幂等策略、冲突策略变化 |
| 架构决策取舍 | `docs/架构决策记录.md` | 涉及分层边界、口径策略、输入方式等关键取舍变化 |
| 部署与运维 | `docs/部署与运行.md` | 脚本变更、环境变量变更、验收流程变化 |
| 任务优先级 | `ROADMAP.md` | 任务新增、完成、优先级调整 |
| 历史完成记录 | `docs/ROADMAP完成归档.md` | `ROADMAP.md` 有阶段性清理与归档时 |
| 迭代状态 | `docs/最新进度.md` | 当轮完成重要里程碑或门禁项后 |

### 文档维护规则（发布门禁）

- 每次发布到 `main` 前，必须完成文档全量巡检与必要更新，不允许“代码已改、文档滞后”。
- 文档巡检范围包含 `docs/P0线上故障排查SOP.md`，用于约束线上阻塞故障排查口径一致。
- 发布前执行：`python scripts/check_docs_gate.py`（检查核心文档、UTF-8 无 BOM、发布模板四段完整性、核心文档范围一致性、关键门禁文件完整性、`更新时间：YYYY-MM-DD HH:MM:SS` 格式与时间合法性）。
- 推荐先执行一键预检：`python scripts/check_release_preflight.py`（默认串行执行文档门禁严格模式、后端 compileall、前端 build）。
- push 前自动检查：`.githooks/pre-push` 已接入 `python scripts/check_docs_gate.py --strict`。
- 云端 PR 检查：`.github/workflows/docs-gate.yml` 会在 PR 到 `dev/main` 时执行文档门禁。
- 分支保护固化脚本：`python scripts/branch_protection.py --mode check|apply --required-contexts "Docs Gate / docs-gate" --main-required-contexts "Release Consistency / verify-release"`（当前敏捷阶段后置治理，不阻塞本地迭代，详见 `docs/Git工作流.md`）。
- 提交信息校验：`.githooks/commit-msg` 已接入 `python scripts/check_release_message.py`，发布提交自动校验 `vX.Y.Z` 与 `新增/修复/优化/文档` 四段。
- 发布提交中的 `文档:` 段会被脚本强校验：必须包含“检查范围 / 更新结论 / 延后项（无则写无）”。
- 发布后一致性校验：`python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`。
- 云端发布一致性工作流：`.github/workflows/release-consistency.yml`（`main` push 自动执行）。
- 若本地未启用仓库 hooks，请执行：`git config core.hooksPath .githooks`。
- 发布说明必须包含 `文档` 小节，说明本次文档检查范围与更新结果。
- 如发现暂不能同批更新的内容，必须在 `ROADMAP.md` 记录补齐任务和优先级。

## 9. 备注

- 本项目所有文档、注释、提交信息统一使用中文。
- 如遇乱码，请优先检查文件编码是否为 **UTF-8 无 BOM**。
