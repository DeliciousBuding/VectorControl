from __future__ import annotations

from app.risk.engine import build_risk_overview


def _mock_funds() -> list[dict]:
    return [
        {
            "fund_id": "A",
            "name": "基金A",
            "bucket": "tech",
            "market_value_cny": 600.0,
            "tags": ["qdii"],
            "market_group": "us_overseas",
        },
        {
            "fund_id": "B",
            "name": "基金B",
            "bucket": "tech",
            "market_value_cny": 300.0,
            "tags": ["qdii"],
            "market_group": "us_overseas",
        },
        {
            "fund_id": "C",
            "name": "基金C",
            "bucket": "consumer",
            "market_value_cny": 100.0,
            "tags": [],
            "market_group": "cn_hk",
        },
    ]


def _mock_snapshots(points: int) -> list[dict]:
    out: list[dict] = []
    for idx in range(points):
        base = idx * 0.1
        out.append(
            {
                "asof": f"2026-02-06T00:{idx:02d}:00+00:00",
                "payload": {
                    "funds": [
                        {"fund_id": "A", "estimate_pct": base + 0.4},
                        {"fund_id": "B", "estimate_pct": base + 0.35},
                        {"fund_id": "C", "estimate_pct": -base * 0.5},
                    ]
                },
            }
        )
    return out


def test_risk_overview_insufficient_correlation_data() -> None:
    overview = build_risk_overview(_mock_funds(), _mock_snapshots(4))
    assert overview["version"] == "risk-v0"
    assert overview["correlation"]["status"] == "insufficient_data"
    assert overview["concentration"]["top1_weight_pct"] > 0
    assert overview["stress_test"]["worst_drawdown_pct"] < 0


def test_risk_overview_with_correlation() -> None:
    overview = build_risk_overview(_mock_funds(), _mock_snapshots(12))
    corr = overview["correlation"]
    assert corr["status"] == "ok"
    assert corr["points"] >= 8
    assert len(corr["matrix"]) == 3
    assert corr["top_pairs"]
    assert overview["overlap_warnings"]

