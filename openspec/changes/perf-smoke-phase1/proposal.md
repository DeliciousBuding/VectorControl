## 为什么

当前仓库缺少一个本地页面计时脚本，无法统一记录首页、基金详情页、系统状态页的 ready 时间基线。

## 变更内容

1. 建立 `perf-smoke-phase1` change 骨架。
2. 新增 `scripts/perf_smoke.py` 与 `scripts/perf_smoke_runner.cjs`。
3. 将结果输出到 `.perf/perf_smoke/`，不纳入 Git。
