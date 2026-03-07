## 新增需求

### 需求: perf_smoke 必须输出本地关键页面计时基线
系统必须提供一个本地脚本，用于记录关键页面的最小 ready 时间基线。

#### 场景: 维护者运行 perf_smoke
- **当** 执行 `python scripts/perf_smoke.py`
- **那么** 脚本应记录首页、基金详情页、系统状态页的 ready 时间
- **并且** 结果写入 `.perf/perf_smoke/latest.json`
