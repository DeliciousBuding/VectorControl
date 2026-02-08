from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from pydantic import BaseModel

from app.api.deps import (
    build_data_status,
    get_config,
    get_snapshot_user_id,
    get_username,
    is_admin,
    map_confirm_state_to_data_status,
)
from app.data_sources.eastmoney import EastMoneyQuoteProvider
from app.storage.db import (
    append_fund_source_job_log,
    create_fund_source_job,
    finish_fund_source_job,
    get_fund_catalog_item,
    get_fund_source_job,
    get_latest_fund_nav_daily,
    list_fund_catalog_ids,
    list_fund_nav_daily,
    list_fund_nav_history_from_snapshots,
    list_fund_suggestions,
    sync_fund_catalog_from_config,
    upsert_fund_nav_daily,
)

router = APIRouter(prefix="/api/funds", tags=["基金"])

SYNC_QUOTE_MAX_ATTEMPTS = 3
SYNC_QUOTE_RETRY_BACKOFF_SECONDS = 0.2
SYNC_QUOTE_REQUEST_GAP_SECONDS = 0.05
DETAIL_HISTORY_LIMIT = 600


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _history_nav_value(row: dict[str, Any]) -> float | None:
    unit_nav = _to_float(row.get("unit_nav"))
    if unit_nav is not None and unit_nav > 0:
        return unit_nav
    estimate_nav = _to_float(row.get("estimate_nav"))
    if estimate_nav is not None and estimate_nav > 0:
        return estimate_nav
    return None


def _safe_pct_change(current: float | None, base: float | None) -> float | None:
    if current is None or base is None or base <= 0:
        return None
    return round(((current / base) - 1.0) * 100.0, 4)


def _pick_window_base(
    rows: list[dict[str, Any]],
    latest_day: date,
    days: int,
) -> tuple[dict[str, Any] | None, date]:
    target_day = latest_day - timedelta(days=max(1, days) - 1)
    candidate: dict[str, Any] | None = None
    candidate_day: date | None = None
    for row in rows:
        trade_text = str(row.get("trade_date") or "").strip()
        if len(trade_text) != 10:
            continue
        try:
            trade_day = date.fromisoformat(trade_text)
        except ValueError:
            continue
        if trade_day > latest_day:
            continue
        if trade_day <= target_day:
            candidate = row
            candidate_day = trade_day
        else:
            break
    return candidate, candidate_day or target_day


def _build_fund_detail_stage2(
    nav_rows: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    if not nav_rows:
        return (
            {
                "d7": {"available": False, "return_pct": None, "from_trade_date": None, "to_trade_date": None},
                "d30": {"available": False, "return_pct": None, "from_trade_date": None, "to_trade_date": None},
                "d90": {"available": False, "return_pct": None, "from_trade_date": None, "to_trade_date": None},
                "d180": {"available": False, "return_pct": None, "from_trade_date": None, "to_trade_date": None},
                "d365": {"available": False, "return_pct": None, "from_trade_date": None, "to_trade_date": None},
                "ytd": {"available": False, "return_pct": None, "from_trade_date": None, "to_trade_date": None},
            },
            {
                "status": "missing",
                "history_days": 0,
                "latest_trade_date": None,
                "latest_confirm_state": None,
                "recent_30d_coverage": 0.0,
                "recent_30d_expected_days": 30,
                "recent_30d_available_days": 0,
            },
            [
                {
                    "type": "nav_missing",
                    "severity": "high",
                    "message": "暂无可用净值数据",
                }
            ],
        )

    sorted_rows: list[dict[str, Any]] = []
    for row in nav_rows:
        trade_text = str(row.get("trade_date") or "").strip()
        if len(trade_text) != 10:
            continue
        nav_value = _history_nav_value(row)
        if nav_value is None:
            continue
        sorted_rows.append(
            {
                **row,
                "_trade_date": trade_text,
                "_nav_value": nav_value,
            }
        )

    if not sorted_rows:
        return _build_fund_detail_stage2([])

    sorted_rows.sort(key=lambda item: (str(item.get("_trade_date")), str(item.get("asof") or "")))
    latest = sorted_rows[-1]
    latest_trade_text = str(latest.get("_trade_date"))
    latest_trade_day = date.fromisoformat(latest_trade_text)
    latest_nav = _to_float(latest.get("_nav_value"))

    performance_ranges: dict[str, Any] = {}
    for key, days in (("d7", 7), ("d30", 30), ("d90", 90), ("d180", 180), ("d365", 365)):
        base_row, base_day = _pick_window_base(sorted_rows, latest_trade_day, days)
        base_nav = _history_nav_value(base_row) if isinstance(base_row, dict) else None
        perf = _safe_pct_change(latest_nav, base_nav)
        performance_ranges[key] = {
            "available": perf is not None,
            "return_pct": perf,
            "from_trade_date": str(base_day) if perf is not None else None,
            "to_trade_date": latest_trade_text if perf is not None else None,
        }

    ytd_start = date(latest_trade_day.year, 1, 1)
    ytd_base_row: dict[str, Any] | None = None
    for row in sorted_rows:
        trade_text = str(row.get("_trade_date") or "")
        if not trade_text:
            continue
        trade_day = date.fromisoformat(trade_text)
        if trade_day >= ytd_start:
            ytd_base_row = row
            break
    ytd_base = _history_nav_value(ytd_base_row) if isinstance(ytd_base_row, dict) else None
    ytd_perf = _safe_pct_change(latest_nav, ytd_base)
    performance_ranges["ytd"] = {
        "available": ytd_perf is not None,
        "return_pct": ytd_perf,
        "from_trade_date": str(ytd_base_row.get("_trade_date")) if ytd_perf is not None and ytd_base_row else None,
        "to_trade_date": latest_trade_text if ytd_perf is not None else None,
    }

    recent_cutoff = latest_trade_day - timedelta(days=29)
    recent_30d_available = 0
    for row in sorted_rows:
        trade_day = date.fromisoformat(str(row.get("_trade_date")))
        if trade_day >= recent_cutoff:
            recent_30d_available += 1
    recent_coverage = round(min(1.0, recent_30d_available / 30.0), 4)
    integrity_status = "complete"
    if recent_coverage < 0.2:
        integrity_status = "missing"
    elif recent_coverage < 0.6:
        integrity_status = "partial"

    integrity = {
        "status": integrity_status,
        "history_days": len(sorted_rows),
        "latest_trade_date": latest_trade_text,
        "latest_confirm_state": str(latest.get("confirm_state") or ""),
        "recent_30d_coverage": recent_coverage,
        "recent_30d_expected_days": 30,
        "recent_30d_available_days": recent_30d_available,
    }

    anomalies: list[dict[str, Any]] = []
    if recent_coverage < 0.4:
        anomalies.append(
            {
                "type": "recent_data_sparse",
                "severity": "medium",
                "message": f"近30天净值覆盖较低（{recent_30d_available}/30）",
            }
        )

    stale_days = (date.today() - latest_trade_day).days
    if stale_days > 5:
        anomalies.append(
            {
                "type": "stale_nav",
                "severity": "medium",
                "message": f"最近净值距今 {stale_days} 天，可能存在滞后",
                "latest_trade_date": latest_trade_text,
            }
        )

    confirm_states = {str(row.get("confirm_state") or "").strip() for row in sorted_rows if row.get("confirm_state")}
    if len(confirm_states) > 1:
        anomalies.append(
            {
                "type": "mixed_confirm_state",
                "severity": "low",
                "message": "历史净值包含多种确认状态，口径可能混合",
                "states": sorted(confirm_states),
            }
        )

    prev_row: dict[str, Any] | None = None
    for row in sorted_rows:
        if prev_row is None:
            prev_row = row
            continue
        prev_nav = _history_nav_value(prev_row)
        curr_nav = _history_nav_value(row)
        jump_pct = _safe_pct_change(curr_nav, prev_nav)
        if jump_pct is not None and abs(jump_pct) >= 8.0:
            anomalies.append(
                {
                    "type": "nav_jump",
                    "severity": "high" if abs(jump_pct) >= 15.0 else "medium",
                    "message": "相邻净值波动较大，请关注数据源或除权事件",
                    "trade_date": str(row.get("_trade_date") or ""),
                    "change_pct": jump_pct,
                }
            )
            if len(anomalies) >= 5:
                break
        prev_row = row

    return performance_ranges, integrity, anomalies[:5]


def _parse_date_or_none(raw: str | None, field_name: str) -> date | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} 必须是 YYYY-MM-DD") from exc


class FundSyncIn(BaseModel):
    fund_ids: list[str] | None = None
    limit: int = 120
    async_mode: bool = False


def _normalize_sync_fund_ids(raw_ids: list[str] | None) -> list[str]:
    if not raw_ids:
        return []
    deduped: list[str] = []
    seen: set[str] = set()
    for item in raw_ids:
        text = str(item or "").strip()
        if len(text) != 6 or not text.isdigit():
            continue
        if text in seen:
            continue
        seen.add(text)
        deduped.append(text)
    return deduped


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def _sleep(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def _fetch_quote_with_retry(provider: EastMoneyQuoteProvider, fund_id: str) -> tuple[dict | None, int, str, str]:
    last_reason_code = "quote_unavailable"
    last_reason = "无报价"
    for attempt in range(1, SYNC_QUOTE_MAX_ATTEMPTS + 1):
        try:
            quote = provider.get_fund_quote(fund_id)
        except Exception as exc:  # noqa: BLE001
            last_reason_code = "fetch_exception"
            last_reason = f"抓取异常: {exc.__class__.__name__}"
            quote = None

        if isinstance(quote, dict):
            estimate_nav = quote.get("estimate_nav")
            unit_nav = quote.get("nav")
            if estimate_nav is not None or unit_nav is not None:
                return quote, attempt, "", ""
            last_reason_code = "nav_missing"
            last_reason = "缺少净值字段"
        elif quote is not None:
            last_reason_code = "quote_format_invalid"
            last_reason = "报价格式异常"

        if attempt < SYNC_QUOTE_MAX_ATTEMPTS:
            _sleep(SYNC_QUOTE_RETRY_BACKOFF_SECONDS * attempt)

    return None, SYNC_QUOTE_MAX_ATTEMPTS, last_reason_code, last_reason


def _run_fund_sync_job(job_id: str, fund_ids: list[str]) -> None:
    provider = EastMoneyQuoteProvider()
    success_count = 0
    failed_count = 0
    errors: list[str] = []

    for index, fund_id in enumerate(fund_ids):
        if index > 0:
            _sleep(SYNC_QUOTE_REQUEST_GAP_SECONDS)

        quote, attempts, fail_code, fail_reason = _fetch_quote_with_retry(provider, fund_id)
        if not isinstance(quote, dict):
            failed_count += 1
            if len(errors) < 20:
                errors.append(f"{fund_id}: {fail_code}: {fail_reason}")
            append_fund_source_job_log(
                job_id=job_id,
                fund_id=fund_id,
                status=fail_code,
                attempts=attempts,
                message=fail_reason,
            )
            continue

        estimate_nav = quote.get("estimate_nav")
        unit_nav = quote.get("nav")
        asof = str(quote.get("asof") or datetime.now().astimezone().isoformat())
        trade_date = asof[:10] if len(asof) >= 10 else datetime.now().date().isoformat()
        try:
            upsert_fund_nav_daily(
                fund_id=fund_id,
                trade_date=trade_date,
                estimate_nav=estimate_nav,
                unit_nav=unit_nav,
                asof=asof,
                source=str(quote.get("source") or "fund_sync"),
                confirm_state="estimated",
            )
        except Exception as exc:  # noqa: BLE001
            failed_count += 1
            if len(errors) < 20:
                errors.append(f"{fund_id}: persist_failed: {exc.__class__.__name__}")
            append_fund_source_job_log(
                job_id=job_id,
                fund_id=fund_id,
                status="persist_failed",
                attempts=attempts,
                message=f"写入失败: {exc.__class__.__name__}",
                source=str(quote.get("source") or "fund_sync"),
                asof=asof,
            )
            continue

        success_count += 1
        append_fund_source_job_log(
            job_id=job_id,
            fund_id=fund_id,
            status="success",
            attempts=attempts,
            message="写入成功（幂等 upsert）",
            source=str(quote.get("source") or "fund_sync"),
            asof=asof,
        )

    job_status = "done"
    if success_count == 0 and failed_count > 0:
        job_status = "failed"
    elif success_count > 0 and failed_count > 0:
        job_status = "partial"

    error_summary = "; ".join(errors[:20])
    finish_fund_source_job(
        job_id=job_id,
        status=job_status,
        success_count=success_count,
        failed_count=failed_count,
        error_summary=error_summary,
    )


def _data_status_for_fund_rows(rows: list[dict], note: str) -> dict:
    if not rows:
        return build_data_status(status="partial", asof="", note=note)
    latest_asof = ""
    has_partial = False
    has_estimated = False
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_asof = str(row.get("asof") or "").strip()
        if row_asof and row_asof > latest_asof:
            latest_asof = row_asof
        state = map_confirm_state_to_data_status(row.get("confirm_state"))
        if state == "partial":
            has_partial = True
        elif state == "estimating":
            has_estimated = True
    status = "partial" if has_partial else ("estimating" if has_estimated else "confirmed")
    return build_data_status(status=status, asof=latest_asof, note=note)


@router.get("/suggest")
async def suggest_funds(
    request: Request,
    keyword: str = Query(default="", description="支持基金代码前缀和名称模糊匹配"),
    limit: int = Query(default=10, ge=1, le=50),
) -> dict:
    config = get_config(request)
    sync_fund_catalog_from_config(config)
    candidates = list_fund_suggestions(keyword=keyword, limit=limit)
    return {
        "keyword": keyword,
        "limit": limit,
        "count": len(candidates),
        "items": candidates,
        "candidates": candidates,
        "data_status": build_data_status(
            status="confirmed",
            asof=_now_iso(),
            note="检索结果来自基金目录库",
        ),
    }


@router.get("/search")
async def search_funds(
    request: Request,
    q: str = Query(default="", description="支持基金代码/名称/拼音/简称/别名模糊匹配"),
    limit: int = Query(default=10, ge=1, le=50),
) -> dict:
    config = get_config(request)
    sync_fund_catalog_from_config(config)
    items = list_fund_suggestions(keyword=q, limit=limit)
    return {
        "q": q,
        "limit": limit,
        "count": len(items),
        "items": items,
        "data_status": build_data_status(
            status="confirmed",
            asof=_now_iso(),
            note="搜索结果来自基金目录库",
        ),
    }


@router.post("/sync")
async def post_fund_sync(request: Request, payload: FundSyncIn, background_tasks: BackgroundTasks) -> dict:
    if not is_admin(request):
        raise HTTPException(status_code=403, detail="仅管理员可执行基金同步")

    config = get_config(request)
    sync_fund_catalog_from_config(config)

    requested_ids = _normalize_sync_fund_ids(payload.fund_ids)
    if requested_ids:
        fund_ids = requested_ids
    else:
        fund_ids = list_fund_catalog_ids(limit=max(1, min(int(payload.limit), 500)))
    if not fund_ids:
        raise HTTPException(status_code=400, detail="无可同步的基金代码")

    requested_by = get_username(request) or "admin"
    job_id = create_fund_source_job("fund_sync", requested_by=requested_by, total_count=len(fund_ids))
    if payload.async_mode:
        append_fund_source_job_log(
            job_id=job_id,
            fund_id="",
            status="job_scheduled",
            attempts=1,
            message=f"任务已入队，基金数量: {len(fund_ids)}",
        )
        background_tasks.add_task(_run_fund_sync_job, job_id, fund_ids)
        note = "同步任务已入队，后台执行中"
    else:
        _run_fund_sync_job(job_id, fund_ids)
        note = "同步任务已执行，结果可继续刷新确认"
    return {
        "job": get_fund_source_job(job_id),
        "data_status": build_data_status(
            status="estimating",
            asof=_now_iso(),
            note=note,
        ),
    }


@router.get("/sync/jobs/{job_id}")
async def get_fund_sync_job(request: Request, job_id: str) -> dict:
    if not is_admin(request):
        raise HTTPException(status_code=403, detail="仅管理员可查看同步任务")
    job = get_fund_source_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="同步任务不存在")
    job_status = str(job.get("status") or "")
    data_status = "confirmed"
    note = "同步任务状态快照"
    if job_status == "running":
        data_status = "estimating"
        note = "同步任务执行中"
    elif job_status in {"partial", "failed"}:
        data_status = "partial"
        note = "同步任务存在失败项，请查看 recent_logs/error_summary"
    return {
        "job": job,
        "data_status": build_data_status(
            status=data_status,
            asof=str(job.get("finished_at") or job.get("started_at") or ""),
            note=note,
        ),
    }


@router.get("/{fund_id}")
async def get_fund_detail(request: Request, fund_id: str) -> dict:
    config = get_config(request)
    sync_fund_catalog_from_config(config)
    fund = get_fund_catalog_item(fund_id)
    if not fund:
        raise HTTPException(status_code=404, detail="基金不存在或尚未收录")
    clean_fund_id = str(fund.get("fund_id") or fund_id)
    nav_rows = list_fund_nav_daily(
        fund_id=clean_fund_id,
        date_from=None,
        date_to=None,
        limit=DETAIL_HISTORY_LIMIT,
    )
    if not nav_rows:
        snapshot_user_id = get_snapshot_user_id(request)
        nav_rows = list_fund_nav_history_from_snapshots(snapshot_user_id, clean_fund_id, limit=DETAIL_HISTORY_LIMIT)
    performance_ranges, integrity, anomalies = _build_fund_detail_stage2(nav_rows)
    return {
        "fund": fund,
        "performance_ranges": performance_ranges,
        "integrity": integrity,
        "anomalies": anomalies,
        "data_status": build_data_status(
            status="confirmed",
            asof=str(fund.get("updated_at") or ""),
            note="基金主档案来自目录库",
        ),
    }


@router.get("/{fund_id}/nav/latest")
async def get_fund_nav_latest(request: Request, fund_id: str) -> dict:
    config = get_config(request)
    sync_fund_catalog_from_config(config)

    fund = get_fund_catalog_item(fund_id)
    if not fund:
        raise HTTPException(status_code=404, detail="基金不存在或尚未收录")

    latest_from_db = get_latest_fund_nav_daily(str(fund["fund_id"]))
    if isinstance(latest_from_db, dict):
        return {
            "fund_id": str(fund["fund_id"]),
            "available": True,
            "latest": latest_from_db,
            "data_status": _data_status_for_fund_rows([latest_from_db], "最新净值优先来自本地时序库"),
        }

    snapshot_user_id = get_snapshot_user_id(request)
    history = list_fund_nav_history_from_snapshots(snapshot_user_id, fund_id, limit=400)
    if history:
        latest = history[-1]
        return {
            "fund_id": str(fund["fund_id"]),
            "available": True,
            "latest": latest,
            "data_status": _data_status_for_fund_rows(history, "最新净值来自估值快照回退"),
        }

    provider = EastMoneyQuoteProvider()
    try:
        quote = provider.get_fund_quote(str(fund["fund_id"]))
    except Exception:  # noqa: BLE001
        quote = None
    if isinstance(quote, dict):
        estimate_nav = quote.get("estimate_nav")
        unit_nav = quote.get("nav")
        if estimate_nav is not None or unit_nav is not None:
            asof = str(quote.get("asof") or datetime.now().astimezone().isoformat())
            latest = {
                "fund_id": str(fund["fund_id"]),
                "trade_date": asof[:10],
                "estimate_nav": estimate_nav,
                "unit_nav": unit_nav,
                "asof": asof,
                "source": str(quote.get("source") or "live_quote"),
                "confirm_state": "estimated",
            }
            upsert_fund_nav_daily(
                fund_id=str(fund["fund_id"]),
                trade_date=str(latest["trade_date"]),
                estimate_nav=latest["estimate_nav"],
                unit_nav=latest["unit_nav"],
                asof=str(latest["asof"]),
                source=str(latest["source"]),
                confirm_state=str(latest["confirm_state"]),
            )
            return {
                "fund_id": str(fund["fund_id"]),
                "available": True,
                "latest": latest,
                "data_status": _data_status_for_fund_rows([latest], "最新净值来自实时抓取"),
            }

    return {
        "fund_id": str(fund["fund_id"]),
        "available": False,
        "latest": None,
        "data_status": build_data_status(
            status="partial",
            asof="",
            note="暂无可用净值数据",
        ),
    }


@router.get("/{fund_id}/nav/history")
async def get_fund_nav_history(
    request: Request,
    fund_id: str,
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    limit: int = Query(default=120, ge=1, le=500),
) -> dict:
    config = get_config(request)
    sync_fund_catalog_from_config(config)

    fund = get_fund_catalog_item(fund_id)
    if not fund:
        raise HTTPException(status_code=404, detail="基金不存在或尚未收录")

    from_date = _parse_date_or_none(date_from, "from")
    to_date = _parse_date_or_none(date_to, "to")
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=400, detail="from 不能晚于 to")

    raw_items = list_fund_nav_daily(
        fund_id=str(fund["fund_id"]),
        date_from=from_date.isoformat() if from_date else None,
        date_to=to_date.isoformat() if to_date else None,
        limit=max(limit * 6, 400),
    )
    if not raw_items:
        snapshot_user_id = get_snapshot_user_id(request)
        raw_items = list_fund_nav_history_from_snapshots(snapshot_user_id, fund_id, limit=max(limit * 6, 400))

    items: list[dict] = []
    for row in raw_items:
        trade_date_raw = str(row.get("trade_date") or "").strip()
        if len(trade_date_raw) != 10:
            continue
        try:
            trade_day = date.fromisoformat(trade_date_raw)
        except ValueError:
            continue
        if from_date and trade_day < from_date:
            continue
        if to_date and trade_day > to_date:
            continue
        items.append(row)

    if len(items) > limit:
        items = items[-limit:]

    return {
        "fund_id": str(fund["fund_id"]),
        "from": from_date.isoformat() if from_date else None,
        "to": to_date.isoformat() if to_date else None,
        "count": len(items),
        "items": items,
        "data_status": _data_status_for_fund_rows(items, "历史净值列表按时间窗口返回"),
    }
