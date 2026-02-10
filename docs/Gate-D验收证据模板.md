# Gate-D 验收证据模板（HTTPS + 回滚 + 巡检）
> 最后更新: 2026-02-10 17:55:40 (UTC+8)

用途：用于每次 `main` 发布后的 Gate-D 实机验收留档，保证“可追溯、可复盘、可审计”。

---

## 1. 基本信息

- 发布版本：`vX.Y.Z`
- 发布提交：`<commit>`
- 发布 Tag：`vX.Y.Z`
- 发布人：
- 验收人：
- 验收时间（北京时间）：
- 目标环境：`production`
- 目标域名：`https://<domain>`

## 2. 一致性校验记录（发布说明 + Tag）

- 执行命令：
  - `python scripts/check_main_release.py --commit <commit> --check-remote-tag --remote origin`
- 结果：
  - `PASS / FAIL`
- 关键输出摘录：
  - `...`
- 异常处理（如有）：
  - `...`

## 3. HTTPS 与健康检查

- 执行命令：
  - `curl -s https://<domain>/api/healthz`
  - `python scripts/check_gate_d.py`（按实际参数）
- 结果：
  - 首页：`PASS / FAIL`
  - `/api/healthz`：`PASS / FAIL`
  - 未登录接口保护（401）：`PASS / FAIL`
  - 测速接口（可选凭证校验）：`PASS / FAIL`
- 关键输出摘录：
  - `...`

## 4. 容器与版本状态

- 执行命令：
  - `git rev-parse --short HEAD`
  - `docker compose -f deploy/docker-compose.prod.yml ps`
- 结果：
  - 当前 commit：
  - `nginx` 状态：
  - `backend` 状态：
  - `postgres` 状态：
- 关键输出摘录：
  - `...`

## 5. 回滚记录（演练或真实）

- 是否执行回滚验证：`是 / 否`
- 回滚目标：`<tag|commit>`
- 执行命令：
  - `git checkout <tag_or_commit>`
  - `docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml up -d --build`
  - `python scripts/check_gate_d.py`
- 回滚结果：`PASS / FAIL`
- 复原到最新版本结果：`PASS / FAIL`
- 关键输出摘录：
  - `...`

## 6. 巡检清单（勾选）

- [ ] 分支为 `main`，版本号与 Tag 一致（`vX.Y.Z`）
- [ ] 发布说明包含 `新增/修复/优化/文档` 四段
- [ ] `check_main_release.py` 通过
- [ ] `check_gate_d.py` 通过
- [ ] `nginx/backend/postgres` 全部 running
- [ ] 证书与域名访问正常
- [ ] `data_status` 回归通过（首页/持仓/交易/基金中心口径条可见，状态/时点/说明完整）
- [ ] 基金详情图表区口径提示回归通过（联动 `status/asof/note`）
- [ ] `/api/system/status` 回归通过（`version/commit/server_time/snapshot` 可读）
- [ ] 设置中心测速异常态回归通过（接口失败或脏数据时展示“下一步”提示，页面无白屏）
- [ ] 异常项已记录并建立修复任务（写入 `ROADMAP.md`）

## 7. 附件索引

- 首页截图：
- 健康检查输出：
- Gate-D 脚本输出：
- 容器状态截图/文本：
- 状态解释截图（建议对照 `docs/状态解释验收样例.md`）：
  - `status-home.png`
  - `status-holdings-chart.png`
  - `status-trade-sync.png`
  - `status-system-status.png`
- 设置中心测速异常态截图：
  - `settings-benchmark-error.png`
- 回滚演练记录：

## 8. 结论

- 本次 Gate-D 验收结论：`通过 / 不通过`
- 风险等级：`低 / 中 / 高`
- 后续动作：
  1. 
  2. 
