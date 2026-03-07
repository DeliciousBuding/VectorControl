## 上下文

当前仓库已有：

- `deploy/nginx/site.conf`：TLS 模板
- `deploy/nginx/site.http.conf`：HTTP 模板
- `deploy/docker-compose.prod.yml`：生产编排，挂载 `site.rendered.conf`
- `scripts/render_nginx_site.py`：按 env 渲染站点配置

本轮重点不是重做 TLS 体系，而是把已经存在但未闭环的能力真正跑通。

## 目标 / 非目标

**目标：**
1. 让 `vectorcontrol.tech` 的公网 `443` 恢复可用
2. 确保证书、UFW、渲染脚本与 Compose 配置一起闭环
3. 补齐证据、文档与 OpenSpec

**非目标：**
1. 本轮不引入自动续期编排
2. 本轮不改域名解析或网络拓扑
3. 本轮不重构 Nginx 模板结构

## 方案

1. 保持 `site.conf` / `site.http.conf` 双模板，统一经 `render_nginx_site.py` 渲染到 `site.rendered.conf`
2. 更新部署脚本，兼容 `python3` 优先、`python` 回退
3. 在 `prod` 上：
   - 设置 `VC_DOMAIN=vectorcontrol.tech`
   - 设置 `VC_ENABLE_TLS=true`
   - 设置 `VC_SCHEME=https`
   - 使用 Let's Encrypt `standalone` 方式签发证书
   - 放行 `443/tcp`
   - 重启生产栈

## 验证策略

1. 本地验证渲染脚本能生成 TLS 模板
2. `prod` 本机验证 `curl --resolve ... https://vectorcontrol.tech`
3. 外部验证：
   - `curl -I https://vectorcontrol.tech`
   - `curl https://vectorcontrol.tech/api/healthz`
4. 回写证据到 `docs/evidence/gate-d-20260307/https-*`
