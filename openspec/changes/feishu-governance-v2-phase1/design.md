## 上下文

当前 `FeishuSender` 已具备：

- webhook host / scheme 校验；
- timeout / retry 次数收敛；
- 成功 / 失败结构化日志；
- 对应 smoke 用例。

但发送侧仍缺少：

1. 相邻调用频控；
2. 连续失败后的临时隔离；
3. 内存治理状态的过期清理；
4. 可测试的治理行为。

## 目标 / 非目标

**目标：**
1. 对相同 webhook 引入最小频控；
2. 对连续失败引入临时隔离；
3. 对治理状态做 TTL 清理；
4. 补 smoke 验证。

**非目标：**
1. 本轮不引入持久化状态存储；
2. 本轮不改动 `/api/settings/notifications/feishu/test_message` 契约；
3. 本轮不接入新的飞书 API。

## 验证策略

1. `python -m compileall backend/app/notifier/feishu_sender.py backend/app/api/test_notifier_feishu_sender_smoke.py`
2. `PYTHONPATH=backend python -m pytest -q backend/app/api/test_notifier_feishu_sender_smoke.py`
