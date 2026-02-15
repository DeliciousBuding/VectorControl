# Gate-D测速NotFound后端证据（P0）
> 最后更新: 2026-02-11 09:05:00 (UTC+8)
> 状态: [Closed]

## 1. 问题与范围
- 问题：VPS 环境反馈"测速接口 Not Found"。
- 范围：后端路由、Nginx 反向代理、服务路径兼容。
- 对应任务：P0 后端项（测速 Not Found 修复 + Gate-D 后端证据）。

## 2. 三段排查与修复
### 2.1 路由层（backend）
- 检查文件：`backend/app/api/routers/settings.py`
- 修复：补齐历史服务路径兼容路由，新增
- `GET /api/network-benchmark/latest`（第 928-930 行）
- `GET /api/network_benchmark/latest`（第 933-935 行）
- `POST /api/network-benchmark/run`（第 938-940 行）
- `POST /api/network_benchmark/run`（第 943-945 行）
- 说明：原有 `GET/POST /api/settings/network-benchmark/*` 与 `_` 兼容路径保持不变。

### 2.2 Nginx 层（proxy）
- 检查文件：`deploy/nginx/site.conf`
- 修复：新增历史路径重写规则（第 44-47 行）
- 配置内容：
  ```nginx
  # Compatibility for historical speed-test paths.
  location ~ ^/(settings/)?network[-_]benchmark/(latest|run)$ {
    return 307 /api/settings/network-benchmark/$2$is_args$args;
  }
  ```

### 2.3 服务路径层（compose）
- 检查文件：`deploy/docker-compose.prod.yml`
- 结果：`nginx` 与 `backend` 同网络，Nginx 通过服务名 `backend:8000` 转发，路径链路完整。

## 3. 本地验收证据（非404）
执行（TestClient + 登录态）后输出摘要：
- `GET /api/settings/network-benchmark/latest -> 200`
- `GET /api/network-benchmark/latest -> 200`
- `GET /api/network_benchmark/latest -> 200`
- `POST /api/settings/network-benchmark/run -> 200`
- `POST /api/network-benchmark/run -> 200`
- `POST /api/network_benchmark/run -> 200`

## 4. Gate-D补充执行项（VPS）
生产环境验证命令：

```bash
docker compose -f deploy/docker-compose.prod.yml ps
curl -i https://<domain>/api/settings/network-benchmark/latest
curl -i -X POST https://<domain>/api/settings/network-benchmark/run \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"profile":"cn_fund","timeout_seconds":2.0,"persist":false}'
```

## 5. 关联提交
- 后端修复代码：`backend/app/api/routers/settings.py`（第 769-945 行）
- 网关配置修复：`deploy/nginx/site.conf`（第 44-47 行）
- 验收状态：[Closed]
