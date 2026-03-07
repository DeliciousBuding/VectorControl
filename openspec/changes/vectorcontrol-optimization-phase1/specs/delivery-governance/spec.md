## 新增需求

### 需求:发布事实源必须与门禁脚本一致
仓库对外声明的发布巡检范围，必须由自动化门禁真实覆盖，避免“文档已声明、脚本未校验”的漂移。

#### 场景:发布前检查关键文档
- **当** 维护者修改 `scripts/`、`.githooks/`、`.github/workflows/`、部署文档或发布流程文档
- **那么** 文档门禁必须要求同步检查并覆盖 `README.md`、`ROADMAP.md`、`docs/架构说明.md`、`docs/开发规范.md`、`docs/接口契约.md`、`docs/交易流水YAML导入规范.md`、`docs/P0线上故障排查SOP.md`、`docs/状态解释验收样例.md`、`docs/最新进度.md`、`docs/Git工作流.md`、`docs/部署与运行.md`

### 需求:Gate-D 验收模板必须符合当前真实部署基线
Gate-D 验收模板必须反映当前真实生产基线，而不是引用已经下线或未落地的部署能力。

#### 场景:当前生产为 HTTP + SQLite
- **当** 当前生产基线仍为 `HTTP + Nginx + backend + SQLite`
- **那么** 验收模板不得把 `HTTPS`、`postgres`、证书巡检写成当前必选项
- **并且** 模板必须保留首页、`/api/healthz`、未登录 `401`、容器状态、SQLite 持久化等最小验收项

### 需求:故障排查文档必须引用当前 Nginx 事实源
线上故障排查 SOP 必须引用当前实际在用的 Nginx 配置与部署路径。

#### 场景:排查测速 Not Found 或 502
- **当** 维护者按照 SOP 排查 `502 Bad Gateway`、测速 `Not Found` 或设置中心白屏
- **那么** 文档中引用的 Nginx 配置路径必须与当前 Dockerfile 实际复制进镜像的配置一致
- **并且** 排查命令与当前 `docker-compose.prod.yml` 基线保持兼容
