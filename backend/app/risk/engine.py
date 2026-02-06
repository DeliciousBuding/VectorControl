from __future__ import annotations

import math
from typing import Any


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3 or n != len(ys):
        return None
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - x_mean) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - y_mean) ** 2 for y in ys))
    den = den_x * den_y
    if den <= 0:
        return None
    return max(-1.0, min(1.0, num / den))


def _build_bucket_allocation(funds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    total = sum(max(_to_float(row.get("market_value_cny")), 0.0) for row in funds)
    if total <= 0:
        return []
    bucket_sum: dict[str, float] = {}
    for row in funds:
        bucket = str(row.get("bucket", "")).strip() or "unknown"
        bucket_sum[bucket] = bucket_sum.get(bucket, 0.0) + max(_to_float(row.get("market_value_cny")), 0.0)
    return [
        {
            "bucket": bucket,
            "market_value_cny": round(value, 2),
            "weight_pct": round(value / total * 100, 2),
        }
        for bucket, value in sorted(bucket_sum.items(), key=lambda item: item[1], reverse=True)
    ]


def _build_concentration(funds: list[dict[str, Any]]) -> dict[str, Any]:
    total = sum(max(_to_float(row.get("market_value_cny")), 0.0) for row in funds)
    if total <= 0:
        return {
            "total_market_value_cny": 0.0,
            "hhi": 0.0,
            "top1_weight_pct": 0.0,
            "top3_weight_pct": 0.0,
            "top_positions": [],
        }

    ranked = sorted(
        funds,
        key=lambda row: max(_to_float(row.get("market_value_cny")), 0.0),
        reverse=True,
    )
    weighted = []
    for row in ranked:
        value = max(_to_float(row.get("market_value_cny")), 0.0)
        weight = value / total
        weighted.append(
            {
                "fund_id": str(row.get("fund_id", "")),
                "name": str(row.get("name", "")),
                "market_value_cny": round(value, 2),
                "weight_pct": round(weight * 100, 2),
            }
        )

    hhi = sum((item["weight_pct"] / 100.0) ** 2 for item in weighted)
    top1 = weighted[0]["weight_pct"] if weighted else 0.0
    top3 = sum(item["weight_pct"] for item in weighted[:3])
    return {
        "total_market_value_cny": round(total, 2),
        "hhi": round(hhi, 4),
        "top1_weight_pct": round(top1, 2),
        "top3_weight_pct": round(top3, 2),
        "top_positions": weighted[:5],
    }


def _build_overlap_warnings(
    funds: list[dict[str, Any]],
    concentration: dict[str, Any],
    bucket_allocation: list[dict[str, Any]],
) -> list[str]:
    warnings: list[str] = []
    if float(concentration.get("top1_weight_pct", 0.0)) >= 35:
        warnings.append("单基金权重超过 35%，存在集中度过高风险。")
    if float(concentration.get("top3_weight_pct", 0.0)) >= 75:
        warnings.append("前 3 大持仓合计超过 75%，建议评估分散配置。")

    bucket_map = {str(item.get("bucket")): _to_float(item.get("weight_pct")) for item in bucket_allocation}
    if bucket_map.get("tech", 0.0) >= 60:
        warnings.append("科技船权重超过 60%，组合对单一风格暴露偏高。")

    qdii_weight = 0.0
    qdii_count = 0
    total = _to_float(concentration.get("total_market_value_cny"))
    for row in funds:
        tags = row.get("tags") or []
        tag_set = {str(tag).lower() for tag in tags if str(tag).strip()}
        if "qdii" in tag_set or str(row.get("market_group")) == "us_overseas":
            qdii_count += 1
            qdii_weight += max(_to_float(row.get("market_value_cny")), 0.0)

    if total > 0 and qdii_count >= 3 and qdii_weight / total >= 0.5:
        warnings.append("海外/QDII 持仓占比较高且数量集中，需关注同质化波动。")

    return warnings


def _build_stress_test(funds: list[dict[str, Any]]) -> dict[str, Any]:
    total = sum(max(_to_float(row.get("market_value_cny")), 0.0) for row in funds)
    scenarios = [
        {"name": "温和回撤", "cn_hk": -0.04, "us_overseas": -0.06},
        {"name": "中等冲击", "cn_hk": -0.08, "us_overseas": -0.12},
        {"name": "极端压力", "cn_hk": -0.15, "us_overseas": -0.22},
    ]

    results: list[dict[str, Any]] = []
    for scenario in scenarios:
        loss = 0.0
        for row in funds:
            group = str(row.get("market_group", "cn_hk"))
            shock = scenario["us_overseas"] if group == "us_overseas" else scenario["cn_hk"]
            loss += max(_to_float(row.get("market_value_cny")), 0.0) * shock

        drawdown_pct = (loss / total * 100) if total > 0 else 0.0
        results.append(
            {
                "scenario": scenario["name"],
                "projected_pnl_cny": round(loss, 2),
                "projected_drawdown_pct": round(drawdown_pct, 2),
            }
        )

    max_drawdown = min((row["projected_drawdown_pct"] for row in results), default=0.0)
    return {
        "base_market_value_cny": round(total, 2),
        "scenarios": results,
        "worst_drawdown_pct": round(max_drawdown, 2),
    }


def _build_correlation(funds: list[dict[str, Any]], snapshots: list[dict[str, Any]]) -> dict[str, Any]:
    # 仅计算当前持仓基金，避免历史脏数据造成维度膨胀
    id_to_name = {str(row.get("fund_id", "")): str(row.get("name", "")) for row in funds}
    fund_ids = [fid for fid in id_to_name.keys() if fid]

    if len(fund_ids) < 2 or len(snapshots) < 8:
        return {
            "status": "insufficient_data",
            "note": "历史快照不足，至少需要 8 个时间点才能计算相关性。",
            "points": len(snapshots),
            "labels": fund_ids,
            "matrix": [],
            "top_pairs": [],
        }

    per_snapshot: list[dict[str, float]] = []
    for snap in snapshots:
        payload = snap.get("payload")
        if not isinstance(payload, dict):
            continue
        rows = payload.get("funds", [])
        if not isinstance(rows, list):
            continue
        mapping: dict[str, float] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            fid = str(row.get("fund_id", ""))
            if fid not in id_to_name:
                continue
            val = row.get("estimate_pct")
            if val is None:
                continue
            try:
                mapping[fid] = float(val)
            except Exception:
                continue
        if mapping:
            per_snapshot.append(mapping)

    if len(per_snapshot) < 8:
        return {
            "status": "insufficient_data",
            "note": "有效估值快照不足，暂无法计算相关性。",
            "points": len(per_snapshot),
            "labels": fund_ids,
            "matrix": [],
            "top_pairs": [],
        }

    matrix: list[list[float | None]] = []
    top_pairs: list[dict[str, Any]] = []
    for fid_a in fund_ids:
        row_values: list[float | None] = []
        for fid_b in fund_ids:
            if fid_a == fid_b:
                row_values.append(1.0)
                continue

            xs: list[float] = []
            ys: list[float] = []
            for snap in per_snapshot:
                if fid_a in snap and fid_b in snap:
                    xs.append(snap[fid_a])
                    ys.append(snap[fid_b])

            corr = _pearson(xs, ys)
            rounded = round(corr, 3) if corr is not None else None
            row_values.append(rounded)
            if corr is not None and fid_a < fid_b:
                top_pairs.append(
                    {
                        "fund_a": {"fund_id": fid_a, "name": id_to_name.get(fid_a, fid_a)},
                        "fund_b": {"fund_id": fid_b, "name": id_to_name.get(fid_b, fid_b)},
                        "corr": rounded,
                        "points": len(xs),
                    }
                )

        matrix.append(row_values)

    top_pairs_sorted = sorted(top_pairs, key=lambda row: abs(_to_float(row.get("corr"))), reverse=True)
    return {
        "status": "ok",
        "note": "基于历史估值快照计算皮尔逊相关系数。",
        "points": len(per_snapshot),
        "labels": fund_ids,
        "matrix": matrix,
        "top_pairs": top_pairs_sorted[:8],
    }


def build_risk_overview(
    funds: list[dict[str, Any]],
    snapshots: list[dict[str, Any]],
) -> dict[str, Any]:
    concentration = _build_concentration(funds)
    bucket_allocation = _build_bucket_allocation(funds)
    warnings = _build_overlap_warnings(funds, concentration, bucket_allocation)
    stress_test = _build_stress_test(funds)
    correlation = _build_correlation(funds, snapshots)

    return {
        "version": "risk-v0",
        "concentration": concentration,
        "bucket_allocation": bucket_allocation,
        "overlap_warnings": warnings,
        "stress_test": stress_test,
        "correlation": correlation,
    }

