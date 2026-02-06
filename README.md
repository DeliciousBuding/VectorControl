# fund-watchtower

`fund-watchtower` 是一个面向个人基金盯盘场景的全栈项目，提供：

- 手动刷新估值看板
- 四船分桶策略建议
- 执行记录与日报预览
- 本地 SQLite 数据落库

当前后端接口包含：`/api/health`、`/api/config`、`/api/estimate`、`/api/advice`、`/api/actions`、`/api/report/daily`。

## 快速开始

### 1. 准备环境变量

复制示例文件并按需填写：

```bash
cp .env.example .env
```

### 2. 启动后端（本地）

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 21345
```

### 3. 健康检查

```bash
curl http://localhost:21345/api/health
```

### 4. 估值接口（需要 token）

```bash
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:21345/api/estimate
```

### 5. 策略建议接口（需要 token）

```bash
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:21345/api/advice
```

## Windows 一键启动

### 1) 启动后端

- 双击：`scripts\start_backend.bat`
- 验证：`http://127.0.0.1:21345/api/health`

### 2) 启动前端

- 双击：`scripts\start_frontend.bat`
- 打开：`http://127.0.0.1:5173`

### 3) Token 使用说明

- 若 `.env` 配置了 `API_TOKEN`，页面顶部填该 token。
- 若未配置，后端会生成运行时 token，通常写入 `backend/data/runtime_token.txt`。

## Docker 启动

```bash
docker compose -f docker/docker-compose.yml up --build
```

## 环境变量

- `API_TOKEN`：接口访问 token。若未配置或为 `change-me`，启动时自动生成随机 token。
- `FEISHU_WEBHOOK_URL`：飞书机器人 webhook（后续推送功能使用）。
- `PORT`：服务端口，默认 `21345`。
- `TZ`：时区，默认 `Asia/Shanghai`。

## 鸣谢与灵感来源

本项目为独立实现（independent implementation），在架构设计与公开数据访问模式上参考/借鉴了以下优秀开源项目的思路，但 **未直接复制任何源代码**：

- FundVal-Live: https://github.com/Ye-Yu-Mo/FundVal-Live （fundgz JSONP 数据格式/估值思路启发）
- lanZzV/fund: https://github.com/lanZzV/fund （多数据源与个人盯盘功能启发）
- real-time-fund: https://github.com/hzm0321/real-time-fund （轻量前端刷新与回退思路启发）
- FundCrawler: https://github.com/Jerry1014/FundCrawler （基金数据获取边界与反爬风险启发）

## 免责声明

- 本项目提供的估值/行情/分析仅用于学习与技术研究，不构成任何投资建议。
- 数据来自公开接口，可能存在延迟、缺失或误差；接口变更可能导致不可用。
- 使用者需自行判断与承担风险，开发者不对任何交易结果负责。

## 开发规范

项目开发规范见：`docs/开发规范.md`

推荐在本地启用提交约束：

```bash
git config core.hooksPath .githooks
git config commit.template .gitmessage-zh.txt
```

如果 Windows 终端显示乱码，请先执行：

```bash
chcp 65001
```

## 项目结构

```text
fund-watchtower/
  backend/
  config/
  docker/
  frontend/
  scripts/
  docs/
  .env.example
  README.md
```
