## 为什么

`prod` 上的 `https://vectorcontrol.tech/` 在 2026-03-08 实测无法访问，浏览器报 `ERR_CONNECTION_CLOSED`。

根因收敛为：

1. 宿主机 UFW 仅放行 `80`，未放行 `443`
2. 当前生产运行的是 HTTP 基线配置，`443` 虽映射到容器但无可用 TLS 站点配置
3. `deploy/certbot/conf` 为空，未持有 Let's Encrypt 证书
4. 部署脚本依赖 `site.rendered.conf` 渲染链，但远端曾遗留目录残骸，且脚本默认调用 `python`，与 `prod` 仅提供 `python3` 的环境不匹配

## 变更内容

1. 恢复部署脚本中的 Nginx 配置渲染链
2. 补齐 `python3/python` 解释器兼容
3. 在 `prod` 上申请 `vectorcontrol.tech` 与 `www.vectorcontrol.tech` 证书
4. 放行 `443/tcp` 并完成 HTTPS 重部署
5. 留存公网 HTTPS 验收证据并同步文档

## 影响

- `https://vectorcontrol.tech/` 恢复可访问
- 生产部署重新支持 `VC_ENABLE_TLS=true`
- 后续更新可复用同一渲染/证书目录，不再依赖临场手修
