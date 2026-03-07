# Gate-D 设置中心测速前端证据（当前基线）
更新时间：2026-03-07 14:16:00
状态: [Open]

## 1. 目标

- 覆盖 `设置中心 -> 网络测速` 的关键验收点：
  - 接口异常时页面不白屏
  - 错误提示包含可执行“下一步”
  - 错误链路可携带 `X-Request-ID`
  - 当前本地回归与 Gate-D 证据模板口径一致

## 2. 当前验收范围

- 前端代码：
  - `frontend/src/components/SettingsDrawer.jsx`
  - `frontend/src/api.js`
  - `frontend/src/utils/errorFeedback.js`
- 回归测试：
  - `frontend/src/components/SettingsDrawer.test.jsx`
  - `frontend/src/api.test.js`

## 3. 本地回归记录

- 最近验证命令：
  - `npm --prefix frontend run test:run`
  - `npm --prefix frontend run build`
- 最近结果：
  - `vitest`：`49 passed`
  - `vite build`：`PASS`
- 备注：
  - `SettingsDrawer` 相关测试目前仍会打印 `Drawer width is deprecated` 警告，但不影响通过态与功能回归

## 4. Gate-D 验收清单

- [ ] 设置中心抽屉可正常打开
- [ ] 网络测速成功态可渲染摘要与站点明细
- [ ] 网络测速失败态显示可执行“下一步”
- [ ] 脏数据返回可降级渲染
- [ ] 错误提示中可定位 `X-Request-ID`

## 5. 截图与输出索引

| 文件名 | 验收点 | 状态 |
|--------|--------|------|
| `settings-drawer-open.png` | 抽屉正常打开 | `[待补]` |
| `settings-benchmark-success.png` | 测速成功结果 | `[待补]` |
| `settings-benchmark-error.png` | 测速失败提示 | `[待补]` |
| `settings-benchmark-request-id.png` | 错误提示携带请求ID | `[待补]` |

## 6. 与 Gate-D 模板的关联

- 本文件用于补齐 `docs/Gate-D验收证据模板.md` 中“状态解释与前端回归”部分的前端细项证据。
- 每次 `main` 发布后的 Gate-D 验收，如测速口径、UI 或错误提示有变化，应与该模板同批更新。
