# Postmortem: 测速 Not Found 与设置中心白屏双故障（后端视角）
更新时间：2026-03-07 14:22:01

- **故障编号**: P0-20260208-01
- **发现时间**: 2026-02-08
- **故障发现**: VPS 环境用户反馈测速功能返回 404，随后发现设置中心页面整体白屏
- **影响范围**:
    - **测速 Not Found**: 用户无法使用网络测速功能。直接影响设置中心的网络质量评估功能。
    - **设置中心白屏**: 用户无法访问任何设置项，包括网络测速、通知配置等，严重影响可用性。

---

## 故障时间线（UTC+8）

| 时间 | 事件 | 备注 |
|------|------|------|
| ~2026-02-08 上午 | 用户在 VPS 环境访问设置中心，触发测速功能 | |
| ~2026-02-08 | 用户反馈测速接口返回 404 | 影响网络质量评估功能 |
| ~2026-02-08 | 发现设置中心页面整体白屏 | 组件渲染崩溃 |
| 2026-02-08 19:44 | 前端 Agent1 执行本地测试与构建 | 验证修复初步生效 |
| 2026-02-10 17:55 | 后端 Agent1 完成 Gate-D 验收证据归档 | 路由兼容性修复 |

---

## 根因分析

### 1. 测速 Not Found（后端侧）

**根本原因**：历史服务路径与当前接口路径不一致，前端代码仍调用旧路径 `/api/network-benchmark/*`，而后端仅提供 `/api/settings/network-benchmark/*` 路径。

**详细分析**：
- **路由缺失**: 后端服务 `VectorControl/backend` 未提供对历史 API 路径 (`/api/network-benchmark/*` 及其 `_` 变体) 的兼容，导致前端直接调用这些旧路径时返回 404。
- **网关配置不全**: Nginx 反向代理层（当前以 `deploy/nginx/site.http.conf` 为准）曾缺少针对旧路径到新标准路径 (`/api/settings/network-benchmark/*`) 的重写规则，未能屏蔽后端的接口路径变更。

### 2. 设置中心白屏（前端侧）

**根本原因**：前端组件 `SettingsDrawer.jsx` 在处理 API 请求异常（如 404）时，缺少充分的错误兜底逻辑，导致 React 组件树渲染崩溃。

**详细分析**：
- 测速接口 404 错误未被正确捕获和处理
- 错误状态未降级渲染，导致整个设置中心抽屉组件崩溃
- 缺少 `ErrorBoundary` 保护机制

---

## 修复措施

### 后端修复

**代码变更**：

1. **路由层修复** (`backend/app/api/routers/settings.py`):
   - 新增 `compat_router` 兼容路由（第 20-21 行）
   - 实现 `/api/network-benchmark/latest` 兼容接口（第 928-930 行）
   - 实现 `/api/network_benchmark/latest` 兼容接口（第 933-935 行）
   - 实现 `/api/network-benchmark/run` 兼容接口（第 938-940 行）
   - 实现 `/api/network_benchmark/run` 兼容接口（第 943-945 行）

2. **网关层修复** (`deploy/nginx/site.http.conf`):
   - 新增历史路径重写规则（第 44-47 行）
   - 配置内容：
     ```nginx
     # Compatibility for historical speed-test paths.
     location ~ ^/(settings/)?network[-_]benchmark/(latest|run)$ {
       return 307 /api/settings/network-benchmark/$2$is_args$args;
     }
     ```

**关联提交**：
- 本次闭环修复对应 `VectorControl` 代码库中的历史提交记录
- 相关路由实现在 `backend/app/api/routers/settings.py:769-945`
- 详细证据见 `docs/Gate-D测速NotFound后端证据.md`

### 前端修复

**代码变更**：
- 提交哈希: `f36d94f` (已合入 `dev@943c7a9`)
- 修复内容：
  - 添加 `ErrorBoundary` 防止接口异常导致白屏
  - 完善 API 请求错误处理
  - 测速异常时显示可解释的错误提示（含"下一步"）
  - 支持 `X-Request-ID` 透传便于日志定位

**详细证据**：见 `docs/Gate-D设置中心测速前端证据.md`

---

## 影响面评估

### 故障影响

| 影响项 | 等级 | 说明 |
|--------|------|------|
| 用户体验 | 高 | 测速功能完全不可用，设置中心无法访问 |
| 数据完整性 | 低 | 不涉及数据丢失，仅功能受阻 |
| 系统可用性 | 高 | P0 级故障，影响核心设置功能 |
| 恢复时间 | - | 修复后功能立即恢复 |

### 修复范围

| 组件 | 变更类型 | 影响 |
|------|----------|------|
| 后端路由 | 新增兼容路由 | 向前兼容，不影响现有接口 |
| Nginx 配置 | 新增重写规则 | 向后兼容，平滑迁移 |
| 前端组件 | 错误处理增强 | 提升容错性，防止白屏 |

---

## 回归范围与证据

### 后端回归

**回归范围**：
- API 路由兼容性验证
- Nginx 重写规则验证
- 接口响应码验证

**验收证据**：
- 本地 TestClient 验收记录（见 `docs/Gate-D测速NotFound后端证据.md`）
- 所有路径均返回 200：
  - `GET /api/settings/network-benchmark/latest`
  - `GET /api/network-benchmark/latest`
  - `GET /api/network_benchmark/latest`
  - `POST /api/settings/network-benchmark/run`
  - `POST /api/network-benchmark/run`
  - `POST /api/network_benchmark/run`

### 前端回归

**回归范围**：
- 设置中心抽屉打开稳定性
- 测速模块渲染
- 接口异常兜底逻辑

**验收证据**：
- 本地测试通过：`Test Files 3 passed`，`Tests 10 passed`
- 构建通过：`built in 1.18s`
- 验证点（均通过）：
  - [x] 设置中心抽屉打开稳定，无白屏
  - [x] 测速加载异常时显示可解释提示（含"下一步"）
  - [x] 测速返回脏数据时可降级渲染
  - [x] 错误响应支持 `X-Request-ID` 透传
  - [x] 构建与测试通过

---

## 预防措施

### 已落实

1. **强化契约驱动**: 未来的接口路径变更需先更新 `docs/接口契约.md`，并由总控评审影响面。
2. **增强网关兼容性**: 制定网关层路由兼容性策略，对于非破坏性变更，优先在网关做重写/兼容，减少对后端服务的直接修改。
3. **完善前端异常兜底**: 全局增强 API 请求的错误处理，组件级增加 `ErrorBoundary`，防止单点接口失败导致整页白屏。
4. **自动化回归测试**: 将覆盖兼容路由和异常场景的测试用例加入 CI/CD 流程。

### 待落实

- [ ] 补充 Nginx 层重写规则的单元测试
- [ ] 完善前端错误边界的集成测试

---

## 故障单状态

| 故障单 | 状态 | 验收时间 |
|--------|------|----------|
| P0-20260208-01 (测速 Not Found) | [Closed] | 2026-02-10 |
| P0-20260208-02 (设置中心白屏) | [Closed] | 2026-02-10 |

---

## 附件索引

- `docs/Gate-D测速NotFound后端证据.md` - 后端验收证据
- `docs/Gate-D设置中心测速前端证据.md` - 前端验收证据
- `docs/Gate-D验收证据模板.md` - Gate-D 发布验收模板
- `backend/app/api/routers/settings.py` - 后端路由实现
- `deploy/nginx/site.http.conf` - 当前 HTTP 基线下的 Nginx 重写配置
