## 上下文

当前 `check_release_preflight.py` 默认执行 6 步：

1. docs gate
2. secrets leak scan
3. backend compileall
4. backend smoke
5. frontend tests
6. frontend build

其中前 3 步互不依赖，可以安全并发；后 3 步保留串行，避免失败定位复杂化。

## 目标 / 非目标

**目标：**
1. 优化 preflight 总时长；
2. 保持默认校验集合不变；
3. 输出更清晰的步骤耗时。

**非目标：**
1. 本轮不引入缓存命中跳过；
2. 本轮不调整 smoke 用例集合；
3. 本轮不改变 docs gate / secrets / compileall 的具体语义。

## 验证策略

1. 运行 `python scripts/check_release_preflight.py`
2. 确认 docs gate、后端 smoke、前端测试、前端构建仍全部通过
