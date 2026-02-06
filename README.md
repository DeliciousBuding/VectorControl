# fund-watchtower

后端服务最小可运行骨架：提供 `/api/health`、`/api/config`、`/api/estimate`、`/api/advice`。

## Quick Start

1. 复制环境变量文件并填写：

```bash
cp .env.example .env
```

2. 本地运行：

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 21345
```

3. Docker Compose 运行：

```bash
docker compose -f docker/docker-compose.yml up --build
```

4. 健康检查：

```bash
curl http://localhost:21345/api/health
```

5. 估值接口（需 token）：

```bash
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:21345/api/estimate
```

6. 策略建议接口（需 token）：

```bash
curl -H "Authorization: Bearer <API_TOKEN>" http://localhost:21345/api/advice
```

## Environment

- `API_TOKEN`: 若未配置或为 `change-me`，启动时会自动生成随机 token，并写入 `backend/data/runtime_token.txt`
- `FEISHU_WEBHOOK_URL`: 飞书机器人 webhook（后续使用）
- `PORT`: 服务端口，默认 `21345`
- `TZ`: 时区，默认 `Asia/Shanghai`

## Project Layout

```
fund-watchtower/
  backend/
  config/
  docker/
  .env.example
  README.md
```
