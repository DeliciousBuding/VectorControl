# Gate-D 验收证据模板（HTTPS + 回滚 + 巡检）
> 最后更新: 2026-02-11 09:05:00 (UTC+8)
> 状态: [Closed]

用途：用于每次 `main` 发布后的 Gate-D 实机验收留档，保证"可追溯、可复盘、可审计"。

---

## 1. 基本信息

- 发布版本：`v1.0.5`
- 发布提交：`42b1433`
- 发布 Tag：`v1.0.5`
- 发布人：VectorControl Team
- 验收人：Quality Engineer
- 验收时间（北京时间）：2026-02-11 09:00:00
- 目标环境：`production`
- 目标域名：`https://vectorcontrol.example.com`

## 2. 一致性校验记录（发布说明 + Tag）

- 执行命令：
  - `python scripts/check_main_release.py --commit 42b1433 --check-remote-tag --remote origin`
- 结果：`PASS`
- 关键输出摘录：
  - `Commit 42b1433 matches tag v1.0.5`
  - `Release notes validated`
- 异常处理（如有）：无

## 3. HTTPS 与健康检查

- 执行命令：
  - `curl -s https://vectorcontrol.example.com/api/healthz`
  - `python scripts/check_gate_d.py`
- 结果：
  - 首页：`PASS`
  - `/api/healthz`：`PASS`
  - 未登录接口保护（401）：`PASS`
  - 测速接口（可选凭证校验）：`PASS`
- 关键输出摘录：
  - `{"status":"healthy","timestamp":"..."}`

## 4. 容器与版本状态

- 执行命令：
  - `git rev-parse --short HEAD`
  - `docker compose -f deploy/docker-compose.prod.yml ps`
- 结果：
  - 当前 commit：`42b1433`
  - `nginx` 状态：`running`
  - `backend` 状态：`running`
  - `postgres` 状态：`running`
- 关键输出摘录：
  - `Container vectorcontrol-nginx-1   running`
  - `Container vectorcontrol-backend-1  running`
  - `Container vectorcontrol-postgres-1 running`

## 5. 回滚记录（演练或真实）

- 是否执行回滚验证：`是`
- 回滚目标：`v1.0.4`
- 执行命令：
  - `git checkout v1.0.4`
  - `docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml up -d --build`
  - `python scripts/check_gate_d.py`
- 回滚结果：`PASS`
- 复原到最新版本结果：`PASS`
- 关键输出摘录：
  - `Rollback to v1.0.4 successful`
  - `Restored to v1.0.5 successful`

## 6. 巡检清单（勾选）

- [x] 分支为 `main`，版本号与 Tag 一致（`v1.0.5`）
- [x] 发布说明包含 `新增/修复/优化/文档` 四段
- [x] `check_main_release.py` 通过
- [x] `check_gate_d.py` 通过
- [x] `nginx/backend/postgres` 全部 running
- [x] 证书与域名访问正常
- [x] `data_status` 回归通过（首页/持仓/交易/基金中心口径条可见，状态/时点/说明完整）
- [x] 基金详情图表区口径提示回归通过（联动 `status/asof/note`）
- [x] `/api/system/status` 回归通过（`version/commit/server_time/snapshot` 可读）
- [x] 设置中心测速异常态回归通过（接口失败或脏数据时展示"下一步"提示，页面无白屏）
- [x] 异常项已记录并建立修复任务（写入 `ROADMAP.md`）

## 7. 附件索引

- 首页截图：`status-home.png`
- 健康检查输出：`healthz-response.json`
- Gate-D 脚本输出：`gate-d-output.txt`
- 容器状态截图/文本：`container-status.txt`
- 状态解释截图：
  - `status-home.png`
  - `status-holdings-chart.png`
  - `status-trade-sync.png`
  - `status-system-status.png`
- 设置中心测速异常态截图：
  - `settings-benchmark-error.png`
- 回滚演练记录：`rollback演练记录.md`

## 8. 结论

- 本次 Gate-D 验收结论：`通过`
- 风险等级：`低`
- 后续动作：
  1. 持续监控测速接口稳定性
  2. 关注用户反馈
