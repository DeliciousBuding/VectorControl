# Gate-D 验收证据模板（HTTP + SQLite 基线）
更新时间：2026-03-07 14:16:00
状态: [Open]

用途：用于每次 `main` 发布后的 Gate-D 验收留档，保证当前仓库基线 `HTTP + Nginx + backend + SQLite` 的证据可追溯、可复盘、可审计。

---

## 1. 基本信息

- 发布版本：`vX.Y.Z`
- 发布提交：`<commit>`
- 发布 Tag：`vX.Y.Z`
- 发布人：`<name>`
- 验收人：`<name>`
- 验收时间（北京时间）：`YYYY-MM-DD HH:MM:SS`
- 目标环境：`production`
- 基线说明：`HTTP + Nginx + backend + SQLite`

## 2. 一致性校验记录

- 执行命令：
  - `python scripts/check_main_release.py --commit HEAD --check-remote-tag --remote origin`
- 结果：`PASS / FAIL`
- 关键输出摘录：
  - `<release-check output>`
- 异常处理（如有）：
  - `<none / note>`

## 3. 配置与容器状态

- 执行命令：
  - `docker compose --env-file deploy/.env.example -f deploy/docker-compose.prod.yml config`
  - `docker compose -f deploy/docker-compose.prod.yml ps`
  - `git rev-parse --short HEAD`
- 结果：
  - compose 配置展开：`PASS / FAIL`
  - `nginx` 状态：`running / not running`
  - `backend` 状态：`running / not running`
- 关键输出摘录：
  - `<compose config summary>`
  - `<docker compose ps summary>`

## 4. HTTP 与健康检查

- 执行命令：
  - `curl -s http://127.0.0.1/api/healthz`
  - `python scripts/check_gate_d.py --base-url http://127.0.0.1`
- 结果：
  - `/api/healthz`：`PASS / FAIL`
  - Gate-D：`PASS / FAIL`
  - 未登录接口保护（401）：`PASS / FAIL`
- 关键输出摘录：
  - `<healthz response>`
  - `<gate-d output>`

## 5. SQLite 与系统状态

- 执行命令：
  - `curl -s http://127.0.0.1/api/system/status`
  - `curl -s http://127.0.0.1/api/system/diagnostics`
- 结果：
  - `/api/system/status`：`PASS / FAIL`
  - `/api/system/diagnostics`：`PASS / FAIL`
  - SQLite `db_dir / journal_mode / synchronous / lock_risk / observations`：`已核对 / 未核对`
- 关键输出摘录：
  - `<system status excerpt>`
  - `<diagnostic_text excerpt>`

## 6. 状态解释与前端回归

- 必查项：
  - [ ] 首页口径条可见（状态 / 时点 / 说明完整）
  - [ ] 持仓页口径条可见
  - [ ] 交易页口径条可见
  - [ ] `/api/system/status` 页面展示可读
  - [ ] 设置中心测速异常态不白屏
- 相关前端证据：
  - `docs/Gate-D设置中心测速前端证据.md`

## 7. 附件索引

- 健康检查输出：`healthz-response.txt`
- Gate-D 脚本输出：`gate-d-output.txt`
- 容器状态：`docker-compose-ps.txt`
- 系统状态输出：`system-status.json`
- 诊断文本：`system-diagnostics.txt`
- 首页截图：`status-home.png`
- 设置中心测速截图：`settings-benchmark-error.png`

## 8. 结论

- 本次 Gate-D 验收结论：`PASS / FAIL`
- 风险等级：`低 / 中 / 高`
- 后续动作：
  1. `<action 1>`
  2. `<action 2>`
