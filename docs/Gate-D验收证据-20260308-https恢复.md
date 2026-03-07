# Gate-D 验收证据（2026-03-08 HTTPS 恢复）
更新时间：2026-03-08 00:51:04
状态: [Closed]

用途：记录 `prod` / `vectorcontrol.tech` 的 HTTPS 恢复闭环。

## 1. 基本信息

- 验收时间（北京时间）：`2026-03-08 00:48:18`
- 目标环境：`prod / production`
- 域名：`https://vectorcontrol.tech`
- 公网地址：``

## 2. 根因

- UFW 未放行 `443/tcp`
- 生产当前运行 HTTP 模板，未加载 TLS 站点配置
- `deploy/certbot/conf` 为空，未持有有效证书
- 远端遗留目录 `/opt/vectorcontrol/deploy/nginx/site.rendered.conf` 阻断渲染输出

## 3. 修复动作

- 申请 `vectorcontrol.tech` / `www.vectorcontrol.tech` Let's Encrypt 证书
- 放行 `443/tcp`
- 清理远端错误目录并重新渲染 `deploy/nginx/site.rendered.conf`
- 以 `VC_ENABLE_TLS=true`、`VC_DOMAIN=vectorcontrol.tech` 重新部署生产栈

## 4. 验证结果

- `https://vectorcontrol.tech/`：`PASS`
- `https://vectorcontrol.tech/api/healthz`：`PASS`
- TLS 证书：`PASS`

## 5. 附件

- `docs/evidence/gate-d-20260307/https-head-20260308.txt`
- `docs/evidence/gate-d-20260307/https-healthz-20260308.json`
- `docs/evidence/gate-d-20260307/https-cert-20260308.txt`
- `docs/evidence/gate-d-20260307/https-docker-compose-ps-20260308.txt`
- `docs/evidence/gate-d-20260307/https-gate-d-20260308.txt`

## 6. 结论

- `vectorcontrol.tech` 的 HTTPS 访问已恢复
- 当前剩余缺口：自动续期尚未纳入仓库脚本基线，后续可独立补强
