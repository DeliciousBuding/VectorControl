## 上下文

当前本地环境已具备：

- 后端可直接由 `uvicorn` 启动；
- 前端生产构建产物；
- Playwright 浏览器可用。

因此可通过“后端子进程 + 本地静态代理 + Playwright”来记录关键页面 ready 时间。

## 验证策略

1. 运行 `python scripts/perf_smoke.py`
2. 确认 `.perf/perf_smoke/latest.json` 与时间戳文件生成
