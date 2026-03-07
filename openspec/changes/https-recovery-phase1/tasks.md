## 1. OpenSpec 骨架

- [x] 1.1 建立 `https-recovery-phase1` change 骨架
- [x] 1.2 补齐 proposal / design / spec

## 2. 代码与脚本

- [x] 2.1 确认生产 Compose 挂载 `site.rendered.conf`
- [x] 2.2 修复 `update_prod.sh` / `deploy_prod.sh` 对 `python3` 的兼容
- [x] 2.3 固化 `render_nginx_site.py` 渲染链

## 3. 生产修复

- [x] 3.1 在 `prod` 更新 `.env.prod` 为 `vectorcontrol.tech + https`
- [x] 3.2 申请 Let's Encrypt 证书
- [x] 3.3 放行 `443/tcp`
- [x] 3.4 重部署并恢复 HTTPS 访问

## 4. 验证与留档

- [x] 4.1 验证 `https://vectorcontrol.tech/` 返回 `200`
- [x] 4.2 验证 `https://vectorcontrol.tech/api/healthz` 返回 `200`
- [x] 4.3 留档 HTTPS 证书 / HEAD / healthz 证据
- [x] 4.4 更新 `docs/最新进度.md`、`docs/部署与运行.md`、`ROADMAP.md`
