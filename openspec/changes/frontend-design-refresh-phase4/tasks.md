## 1. 设计调研

- [x] 1.1 参考 Ant Design Drawer / Data Entry 的设置面板层级
- [x] 1.2 参考 GitHub Primer 设置表单层级与 Saleor Dashboard 的后台配置页节奏

## 2. 设置中心升级

- [x] 2.1 为 `SettingsDrawer` 增加头部摘要层与关键状态卡片
- [x] 2.2 接通 Drawer 面板样式，统一头部、正文和页脚设计语言
- [x] 2.3 升级常用设置、网络诊断、消息推送分区标题与说明
- [x] 2.4 保持按需加载、保存、通知测试等既有行为不变

## 3. 验证与留档

- [x] 3.1 运行 `npm --prefix frontend run test:run -- src/components/SettingsDrawer.test.jsx`
- [x] 3.2 运行 `npm --prefix frontend run test:run`
- [x] 3.3 运行 `npm --prefix frontend run analyze`
- [x] 3.4 运行 `python scripts/check_release_preflight.py`
- [x] 3.5 更新 `docs/最新进度.md`、`ROADMAP.md`
