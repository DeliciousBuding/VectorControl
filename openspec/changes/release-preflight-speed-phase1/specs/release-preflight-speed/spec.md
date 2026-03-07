## 新增需求

### 需求: release preflight 必须支持并发前置校验
发布前预检必须在不改变默认校验集合的前提下，尽量减少互不依赖步骤之间的等待时间。

#### 场景: 维护者运行 release preflight
- **当** 执行 `python scripts/check_release_preflight.py`
- **那么** `docs gate`、`secrets leak scan`、`backend compileall` 可并发执行
- **并且** 后续 smoke / tests / build 继续按顺序执行

### 需求: release preflight 必须输出步骤耗时
优化后的 preflight 仍必须输出每一步的耗时，便于观察瓶颈。

#### 场景: 维护者查看 preflight 输出
- **当** 任一步骤完成
- **那么** 输出中包含步骤名与耗时
