## 新增需求

### 需求: 生产部署必须支持 HTTPS 恢复闭环
当生产 env 打开 `VC_ENABLE_TLS=true` 时，部署脚本必须生成 TLS 站点配置并能正常启动 HTTPS。

#### 场景: 渲染 TLS 站点配置
- **当** `VC_ENABLE_TLS=true` 且 `VC_DOMAIN` 已配置
- **那么** 部署脚本生成基于 `deploy/nginx/site.conf` 的 `site.rendered.conf`

#### 场景: `vectorcontrol.tech` 外部访问
- **当** 外部访问 `https://vectorcontrol.tech/`
- **那么** 返回 `200`
- **并且** `https://vectorcontrol.tech/api/healthz` 返回后端健康结果
