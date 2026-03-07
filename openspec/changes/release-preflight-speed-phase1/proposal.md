## 为什么

`check_release_preflight.py` 已成为当前主仓固定门禁入口，但其执行顺序仍完全串行，存在可以在不改变默认校验集合的前提下优化总时长的空间。

## 变更内容

1. 建立 release preflight 速度优化 change 骨架。
2. 将 `docs gate / secrets leak / backend compileall` 三个互不依赖的前置步骤改为并发执行。
3. 为每一步输出追加耗时，方便定位瓶颈。

## 影响

- 缩短本地与 CI 预检时间。
- 保持默认校验内容与失败语义不变。
