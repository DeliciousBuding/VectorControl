# VectorControl

VectorControl 是一个面向个人投资决策的全栈系统，核心目标是把“数据获取 -> 估值汇总 -> 动作建议 -> 执行记录 -> 日报复盘”做成可审计、可回放、可部署的闭环。

## 1. 项目定位

- 面向对象：基金持仓用户（以“纪律执行”和“复盘解释”为核心）
- 产品原则：
  - 不做情绪化推荐
  - 不做不可解释黑盒预测
  - 优先保证可用性、可追溯性、可回滚
- 当前主分支策略：
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

1. **数据采集**：从外部数据源获取基金估值与行情
2. **估值汇总**：按持仓计算当日收益、持有收益、仓位占比等指标
3. **动作建议**：依据策略与风控规则生成当日建议
4. **执行记录**：记录用户执行结果与动作日志
5. **日报复盘**：输出可追溯日报文本与摘要

## 5. 关键接口（示例）

- 健康检查：`GET /api/health`、`GET /api/healthz`
- 鉴权：`POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`
- 持仓：`GET /api/holdings`、`POST /api/holdings`、`POST /api/holdings/import_yaml`
- 估值：`GET /api/estimate`
- 建议与执行：`GET /api/advice`、`GET/POST /api/actions`
- 报告：`GET /api/report/daily`

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

- `docs/最新进度.md`：最新进展与变更记录
- `docs/产品需求与页面蓝图.md`：产品与页面结构
- `docs/设计系统与交互规范.md`：设计 Token 与交互规则
- `docs/接口契约.md`：接口定义与字段约束
- `docs/开发规范.md`：开发约束与编码规范
- `docs/Git工作流.md`：分支策略与提交流程
- `ROADMAP.md`：任务路线图与完成状态

## 9. 备注

- 本项目所有文档、注释、提交信息统一使用中文。
- 如遇乱码，请优先检查文件编码是否为 **UTF-8 无 BOM**。