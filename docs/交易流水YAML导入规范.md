# 交易流水 YAML 导入规范（v1）

> 最后更新: 2026-02-10 17:50:51 (UTC+8)
适用范围：`POST /api/transactions/import_yaml`（规划中）

本文档定义 `transactions_import.yaml` 的最小可执行规范，目标是保证导入可幂等、可审计、可补全（`pending -> confirmed`）。

## 1. 文件与编码要求

- 文件名建议：`transactions_import.yaml`
- 编码：`UTF-8 无 BOM`
- 时间字段使用 ISO 8601（建议含时区），示例：`2026-02-07T14:35:00+08:00`

## 2. 顶层结构

```yaml
version: "1.0"
generated_at: "2026-02-07T22:00:00+08:00"
source: "manual-ai整理"
default_status: "pending"
transactions:
  - ...
```

- `version`：规范版本，v1 固定为 `"1.0"`
- `generated_at`：导出/整理时间
- `source`：来源描述（便于审计）
- `default_status`：默认状态（`pending` 或 `confirmed`）
- `transactions`：交易数组

## 3. 单条交易字段

必填字段：

- `idempotency_key`：幂等键（建议：`平台订单号` 或 `hash(账号+基金+动作+时间+金额)`）
- `fund_id`：基金代码
- `action`：`buy | redeem | sip | switch_in | switch_out | dividend`
- `occurred_at`：交易实际发生时间
- `amount_cny`：金额（人民币）

可选字段：

- `fund_name`：基金名称（展示与回填使用）
- `status`：`pending | confirmed`（缺省时使用 `default_status`）
- `confirmed_at`：确认时间（`status=confirmed` 时建议提供）
- `shares`：份额（可留空，后续补全）
- `nav`：成交净值（可留空，后续补全）
- `fee_cny`：手续费
- `external_order_no`：外部订单号
- `note`：备注
- `tags`：标签数组

## 4. 校验规则（v1）

- 缺失必填字段的记录应标记为 `conflicted` 并返回原因。
- `amount_cny <= 0` 应判定为冲突。
- `status=confirmed` 且缺少 `confirmed_at`：允许导入，但返回 `warning`。
- 同一文件内出现重复 `idempotency_key`：仅首条生效，其余记为 `skipped`。

## 5. 幂等与冲突策略

导入时按以下优先级判定：

1. 命中相同 `idempotency_key`：`skipped`
2. 未提供 `idempotency_key` 时，使用指纹回退：
   - `fingerprint = fund_id + action + occurred_at + amount_cny + external_order_no`
   - 指纹重复：`skipped`
3. 命中相同 `external_order_no` 但核心字段不一致：`conflicted`

## 6. 导入结果返回约定

建议返回：

```json
{
  "result": {
    "added": 12,
    "skipped": 3,
    "conflicted": 1,
    "warnings": 2
  },
  "conflicts": [
    {
      "index": 7,
      "idempotency_key": "tx-20260207-001",
      "reason": "amount_cny 必须大于 0"
    }
  ]
}
```

## 7. 最小示例

```yaml
version: "1.0"
generated_at: "2026-02-07T22:00:00+08:00"
source: "manual-ai整理"
default_status: "pending"
transactions:
  - idempotency_key: "alipay-20260207-001"
    external_order_no: "202602070001"
    fund_id: "012345"
    fund_name: "示例纳指基金A"
    action: "buy"
    occurred_at: "2026-02-07T14:35:00+08:00"
    amount_cny: 2000.00
    status: "pending"
    note: "午后补仓"

  - idempotency_key: "bank-20260205-006"
    external_order_no: "B20260205006"
    fund_id: "006543"
    fund_name: "示例沪深300基金B"
    action: "redeem"
    occurred_at: "2026-02-05T10:15:00+08:00"
    amount_cny: 1500.00
    status: "confirmed"
    confirmed_at: "2026-02-06T21:00:00+08:00"
    shares: 980.12
    nav: 1.5312
```

## 8. 与系统口径的关系

- 导入 `pending` 记录后，不直接计入确认收益。
- `sync_pending` 补全后转 `confirmed`，再进入收益主口径。
- 所有交易导入与补全都应反映到 `data_status.note`，用于前端解释当前数据可信度。

---

## 9. JSON 格式导入（等效）

除了 YAML 格式，系统还支持 JSON 格式导入：`POST /api/transactions/import_json`

### JSON 请求示例

```json
{
  "version": "1.0",
  "default_status": "pending",
  "source": "import_json",
  "auto_fetch_nav": true,
  "transactions": [
    {
      "fund_id": "016453",
      "fund_name": "易方达消费行业股票",
      "action": "buy",
      "occurred_at": "2024-01-15T10:30:00",
      "amount_cny": 1000,
      "nav": 1.2345,
      "shares": 810.12
    }
  ]
}
```

### 与 YAML 的差异

| 特性 | YAML | JSON |
|------|------|------|
| 自动补全 NAV | 需手动 | `auto_fetch_nav: true` 自动补全 |
| 幂等性 | `idempotency_key` | `idempotency_key`（可选） |

### 响应说明

```json
{
  "added": 5,
  "skipped": 2,
  "conflicted": 0,
  "warnings_count": 1,
  "completed_count": 3,
  "conflicts": [],
  "warnings": [
    { "index": 1, "message": "NAV 自动补全成功" }
  ],
  "completed": [
    { "index": 0, "transaction_id": "xxx" }
  ]
}
```
