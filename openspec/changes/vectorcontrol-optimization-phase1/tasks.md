## 1. OpenSpec 骨架接入

- [x] 1.1 新增 `openspec/changes/vectorcontrol-optimization-phase1/.openspec.yaml`
- [x] 1.2 新增 `openspec/changes/vectorcontrol-optimization-phase1/proposal.md`
- [x] 1.3 新增 `openspec/changes/vectorcontrol-optimization-phase1/design.md`
- [x] 1.4 新增 `openspec/changes/vectorcontrol-optimization-phase1/tasks.md`
- [x] 1.5 新增 `openspec/changes/vectorcontrol-optimization-phase1/specs/delivery-governance/spec.md`
- [x] 1.6 新增 `openspec/changes/vectorcontrol-optimization-phase1/specs/frontend-performance-baseline/spec.md`

## 2. 文档事实源收敛

- [x] 2.1 更新 `README.md`，加入 `openspec/` 入口并修正文档矩阵中的 Gate-D 模板描述
- [x] 2.2 更新 `docs/Gate-D验收证据模板.md` 到当前 HTTP + SQLite 基线
- [x] 2.3 更新 `docs/P0线上故障排查SOP.md`，将 Nginx 配置引用收敛到 `deploy/nginx/site.http.conf` / `nginx.conf`
- [x] 2.4 更新 `docs/最新进度.md`，把已完成的本地预检 / 生产部署 / 下一步优化入口写清楚
- [x] 2.5 更新 `docs/Gate-D设置中心测速前端证据.md`，将测速前端证据模板收敛到当前 HTTP + SQLite 基线
- [x] 2.6 更新 `docs/Gate-D测速NotFound后端证据.md` 与 `docs/Postmortem-测速NotFound与设置中心白屏-后端.md`，将历史 `site.conf` / HTTPS 口径收敛到当前 HTTP 基线
- [x] 2.7 按 `docs/P0线上故障排查SOP.md` 将“双故障关闭留档”整理为可引用证据链，并同步回写 `ROADMAP.md`
- [x] 2.8 生成 `docs/Gate-D验收证据-20260307.md` 与 `docs/evidence/gate-d-20260307/`，补齐生产首页 / 设置中心 / 系统状态页实机截图与命令输出

## 3. 门禁与性能入口补齐

- [x] 3.1 更新 `scripts/check_docs_gate.py`，让追踪文档范围与仓库声明的主发布巡检范围一致
- [x] 3.2 更新 `frontend/package.json`，新增正式分析脚本入口
- [x] 3.3 更新相关文档，说明如何使用前端分析入口与现有 `recordMetric()` / diagnostics 能力
- [x] 3.4 更新 `scripts/check_release_message.py`，将提交信息校验从英文前缀收敛为仓库要求的中文前缀与发布提交四段说明规则

## 4. 验证

- [x] 4.1 运行 `python scripts/check_docs_gate.py --strict`
- [x] 4.2 运行 `python scripts/check_release_preflight.py`
- [x] 4.3 运行 `npm --prefix frontend run analyze -- --help` 或等效命令，确认分析入口可执行
- [x] 4.4 更新 `ROADMAP.md` / `docs/最新进度.md` 中与本轮相关的状态记录
- [x] 4.5 使用正常中文提交、英文前缀提交、发布提交三组样例验证 `python scripts/check_release_message.py <msg_file>` 行为符合预期
- [x] 4.6 在当前集成态重新运行 `python scripts/check_docs_gate.py --strict`，确认严格文档门禁通过
- [x] 4.7 在当前集成态重新运行 `python scripts/check_release_preflight.py`，确认发布前一键预检通过
- [x] 4.8 在 `prod` 的当前部署目录 `/opt/vectorcontrol` 只读运行 `docker compose ... config`、`curl http://127.0.0.1/api/healthz` 与 `python3 scripts/check_gate_d.py --base-url http://127.0.0.1`，确认 HTTP + SQLite 基线验收通过
- [x] 4.9 在 `prod` / `prod` 实际执行 `sudo bash scripts/update_prod.sh`，修复 Nginx 生产镜像复制路径、旧 `site.rendered.conf` 挂载与 brotli 启动阻塞，并复跑 `docker compose -f deploy/docker-compose.prod.yml ps`、`curl http://127.0.0.1/api/healthz` 与 `python3 scripts/check_gate_d.py --base-url http://127.0.0.1`，补录正式部署证据
