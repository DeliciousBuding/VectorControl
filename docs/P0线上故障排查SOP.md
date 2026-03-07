# P0 线上故障排查 SOP（502 Bad Gateway / 测速 Not Found / 设置中心白屏）
更新时间：2026-03-08 00:50:22

用途：为 `P0` 阻塞故障提供统一排查路径、最小复现命令与验收标准，避免重复口头排查。

## 1. 适用范围

- 故障 A：用户登录 POST `/api/auth/login` 返回 502 Bad Gateway
- 故障 B：设置中心点击测速后提示红色 `Not Found`
- 故障 C：打开设置中心出现白屏或明显空白
- 环境：本地联调、VPS 生产环境

## 2. 故障 A：502 Bad Gateway

### 2.1 现象判定

- 用户登录 POST `/api/auth/login` 或其他 API 请求返回 502 Bad Gateway
- Nginx error log 出现类似 `no resolver defined` 或 `could not be resolved` 错误

### 2.2 排查路径

1. 检查 Nginx error log
   - VPS 命令：`docker compose -f deploy/docker-compose.prod.yml logs nginx --tail 100`
   - 查找 `resolver`、`NXDOMAIN`、`no resolver defined` 等关键词
2. 确认是否为 Docker 内部主机名解析失败
   - 检查 Nginx 配置中 `proxy_pass http://backend;` 等使用 Docker 服务名的地方
   - Docker Compose 网络中服务名解析需要 DNS resolver
3. 修复 Nginx 配置
   - 在 `location /api/` 块中添加 `resolver 127.0.0.11;`（Docker 内置 DNS）
   - 执行 `docker compose -f deploy/docker-compose.prod.yml exec nginx nginx -s reload`

### 2.3 验收标准

- POST `/api/auth/login` 返回 200 或明确业务错误（非 502）
- 其他 API 接口正常响应
- Nginx error log 不再出现 DNS 解析相关错误

---

## 3. 故障 B：测速 `Not Found`

### 3.1 现象判定

- 前端设置页测速按钮触发后返回 `404 Not Found`
- 或直接请求以下接口返回 404：
  - `GET /api/settings/network-benchmark/latest`
  - `POST /api/settings/network-benchmark/run`

### 3.2 三段排查（必须按顺序）

1. 后端路由存在性
   - 检查文件：`backend/app/api/routers/settings.py`
   - 检查注册：`backend/app/main.py` 是否包含 settings 路由注册
   - 兼容要求：同时支持 `/api/settings/network-benchmark/*` 与 `/api/network-benchmark/*`（含 `_` 变体）
   - 本地命令（示例）：
     - `python -m uvicorn app.main:app --host 127.0.0.1 --port 21345`
     - `curl -i http://127.0.0.1:21345/api/settings/network-benchmark/latest`
2. Nginx `/api` 反向代理
   - 检查文件：运行态优先看 `deploy/nginx/site.rendered.conf`；模板来源为 `deploy/nginx/site.http.conf` 或 `deploy/nginx/site.conf`
   - 核心点：`/api` 必须转发到 backend 容器，不可被静态路由吞掉
   - 兼容要求：历史路径 `/network-benchmark/*`、`/settings/network-benchmark/*` 重写到 `/api/settings/network-benchmark/*`
   - VPS 命令（示例）：
     - `docker compose -f deploy/docker-compose.prod.yml ps`
     - `curl -i http://127.0.0.1/api/settings/network-benchmark/latest`（容器内或主机可达路径）
3. 前后端版本一致性
   - 对比 `frontend` 构建版本与 `backend` commit/tag 是否同一发布
   - VPS 命令（示例）：
     - `git rev-parse --short HEAD`
     - `docker compose -f deploy/docker-compose.prod.yml images`

### 3.3 验收标准

- `GET /api/settings/network-benchmark/latest` 返回 `200` 或明确业务错误（非 404）
- `POST /api/settings/network-benchmark/run` 可返回测速结果或受控失败提示（非 404）
- `GET /api/network-benchmark/latest` 与 `POST /api/network-benchmark/run` 同样不得返回 404
- Gate-D 验收补证：
  - `docs/Gate-D验收证据模板.md` 中"测速接口"项打钩并附输出

---

## 4. 故障 C：设置中心白屏

### 4.1 现象判定

- 打开设置中心区域空白，关键模块未渲染
- 页面出现运行时错误（控制台报错）导致渲染中断

### 4.2 排查路径

1. 前端运行时错误
   - 检查组件：`frontend/src/components/SettingsDrawer.jsx`
   - 检查依赖组件是否抛错（含 `TopToolbar`、状态条、测速卡片）
2. 接口返回与容错
   - 检查 `frontend/src/api.js` 与错误映射层
   - 确认接口失败时是否有兜底 UI（而非直接崩溃）
3. 构建产物一致性
   - 执行 `npm --prefix frontend run build`
   - 确认部署镜像与本地构建一致，避免旧 bundle 缓存

### 4.3 验收标准

- 设置抽屉可正常打开，至少展示基本设置项
- 测速模块可渲染，不因接口异常导致整页白屏
- 接口失败时显示可读错误与下一步提示（不允许"无反馈"）

---

## 5. 复盘留档模板（故障关闭后必填）

- 故障编号：
- 发现时间：
- 影响范围：
- 根因（路由 / 代理 / 版本 / 前端异常）：
- 修复提交：
- 回归范围：
- 证据链接（截图、命令输出、Gate-D 模板位置）：
- 是否更新文档：
  - `README.md`
  - `ROADMAP.md`
  - `docs/最新进度.md`
  - `docs/Gate-D验收证据模板.md`（如字段有变化）

## 6. 发布前核对（关联 main 文档门禁）

- 本 SOP 如有变更，需与以下文件同批同步：
  - `AGENTS.md`
  - `docs/开发规范.md`
  - `docs/Git工作流.md`
  - `docs/部署与运行.md`
- 发布前执行：
  - `python scripts/check_docs_gate.py`
  - `python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`（发布后）
