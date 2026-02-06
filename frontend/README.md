# VectorControl 前端

当前前端已完成 F5：在单页看板中接入 `/api/report/daily`，并保留手动刷新与执行记录能力。

## 环境要求
- Node.js 18+（包含 npm）。

## 本地开发
```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 打包构建
```bash
npm run build
```

构建产物输出到 `dist/`，可用于后端静态托管。

## 接口对接约定
- 仅使用相对路径，例如：`/api/estimate`、`/api/advice`、`/api/actions`、`/api/report/daily`。
- token 保存在 `localStorage`，键名：`vectorcontrol_token`。
- 支持查询参数兜底：`?token=YOUR_TOKEN`。
- 若存在 token，请求自动附带 `Authorization: Bearer <token>`。
- 仅手动刷新；接口异常在状态栏展示。

## 页面结构
- 顶栏：标题、token 输入、刷新按钮、上次刷新时间。
- 四船看板：渲染 `/api/estimate` 的 `buckets`。
- 今日指令：渲染 `/api/advice` 的 `actions`。
- 执行记录：通过 `/api/actions` 读写勾选状态。
- 复盘预览：渲染 `/api/report/daily` 的 `summary` 与 `sections`。
