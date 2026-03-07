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
