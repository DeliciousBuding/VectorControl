from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

import yaml
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from app.api.deps import (
    build_data_status,
    get_holdings_user_id,
    get_snapshot_user_id,
    get_user_id,
    get_username,
)
from app.storage.db import (
    clear_estimate_snapshots,
    confirm_fund_transaction,
    get_latest_fund_nav_daily,
    get_nav_for_transaction_sync,
    list_audit_logs,
    list_fund_transactions,
    list_pending_fund_transactions_for_sync_by_fund,
    patch_fund_transaction,
    save_fund_transaction,
    summarize_fund_transactions_by_fund,
)
from app.data_sources.eastmoney import EastMoneyQuoteProvider

router = APIRouter(prefix="/api/transactions", tags=["交易流水"])

_ALLOWED_ACTIONS = {"buy", "redeem", "sip", "switch_in", "switch_out", "dividend"}


class TransactionImportIn(BaseModel):
    idempotency_key: str | None = None
    external_order_no: str | None = None
    fund_id: str
    fund_name: str | None = ""
    action: str
    occurred_at: str
    amount_cny: float
    status: str = "pending"
    confirmed_at: str | None = ""
    shares: float = 0.0
    nav: float = 0.0
    fee_cny: float = 0.0
    note: str = ""
    tags: list[str] = []
    source: str = "api_import"


class TransactionsImportYamlIn(BaseModel):
    yaml: str | None = None
    yaml_text: str | None = None
    source: str | None = None


class TransactionItem(BaseModel):
    """单条交易记录"""
    idempotency_key: str | None = None
    external_order_no: str | None = None
    fund_id: str
    fund_name: str | None = ""
    action: str
    occurred_at: str
    amount_cny: float
    status: str = "pending"
    confirmed_at: str | None = ""
    shares: float = 0.0
    nav: float = 0.0
    fee_cny: float = 0.0
    note: str = ""
    tags: list[str] = []
    source: str = "import_json"


class TransactionsImportJsonIn(BaseModel):
    """JSON批量导入请求体"""
    version: str = "1.0"
    default_status: str = "pending"
    source: str = "import_json"
    auto_fetch_nav: bool = True
    transactions: list[TransactionItem]


class SyncPendingIn(BaseModel):
    limit: int = 500
    fund_id: str | None = None


class TransactionPatchIn(BaseModel):
    occurred_at: str | None = None
    status: str | None = None
    confirmed_at: str | None = None
    amount_cny: float | None = None
    shares: float | None = None
    nav: float | None = None
    fee_cny: float | None = None
    note: str | None = None
    audit_note: str | None = None


def _normalize_iso_datetime(raw: str | None) -> str:
    text = str(raw or "").strip()
    if not text:
        raise ValueError("时间不能为空")
    normalized = text.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return dt.astimezone().isoformat(timespec="seconds")


def _status_from_summary(summary: dict[str, Any]) -> tuple[str, str]:
    total_count = int(summary.get("total_count") or 0)
    pending_count = int(summary.get("pending_count") or 0)
    confirmed_count = int(summary.get("confirmed_count") or 0)
    if total_count <= 0:
        return "confirmed", "暂无交易流水"
    if pending_count <= 0:
        return "confirmed", "交易流水均已确认"
    if confirmed_count <= 0:
        return "estimating", f"当前含 {pending_count} 笔 pending 交易待确认"
    return "partial", f"当前含 {pending_count} 笔 pending / {confirmed_count} 笔 confirmed 交易"


def _build_transaction_data_status(summary: dict[str, Any]) -> dict[str, str]:
    status, note = _status_from_summary(summary)
    asof = str(summary.get("last_occurred_at") or "").strip() or datetime.now().astimezone().isoformat()
    return build_data_status(status=status, asof=asof, note=note)


def _fallback_idempotency_key(
    fund_id: str,
    action: str,
    occurred_at: str,
    amount_cny: float,
    external_order_no: str,
) -> str:
    content = "|".join([fund_id, action, occurred_at, f"{amount_cny:.6f}", external_order_no])
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return f"fp-{digest[:24]}"


def _safe_float(value: Any, field_name: str) -> tuple[float, str | None]:
    try:
        return float(value or 0), None
    except Exception:
        return 0.0, f"{field_name} 必须为数字"


def _validate_and_normalize_transaction_item(
    item: dict[str, Any],
    default_status: str,
    default_source: str,
) -> tuple[dict[str, Any] | None, str | None, str | None]:
    action = str(item.get("action") or "").strip().lower()
    fund_id = str(item.get("fund_id") or "").strip()
    occurred_at_raw = item.get("occurred_at")
    amount_raw = item.get("amount_cny")
    external_order_no = str(item.get("external_order_no") or "").strip()

    if not fund_id:
        return None, None, "fund_id 不能为空"
    if action not in _ALLOWED_ACTIONS:
        return None, None, "action 不在允许范围"

    try:
        occurred_at = _normalize_iso_datetime(occurred_at_raw)
    except Exception as exc:
        return None, None, f"occurred_at 格式不正确: {exc}"

    try:
        amount_cny = float(amount_raw)
    except Exception:
        return None, None, "amount_cny 必须为数字"
    if amount_cny <= 0:
        return None, None, "amount_cny 必须大于 0"

    status = str(item.get("status") or default_status or "pending").strip().lower()
    if status not in {"pending", "confirmed"}:
        return None, None, "status 仅支持 pending/confirmed"

    warning_msg: str | None = None
    confirmed_at_raw = item.get("confirmed_at")
    confirmed_at = ""
    if confirmed_at_raw:
        try:
            confirmed_at = _normalize_iso_datetime(str(confirmed_at_raw))
        except Exception as exc:
            return None, None, f"confirmed_at 格式不正确: {exc}"
    elif status == "confirmed":
        warning_msg = "status=confirmed 但缺少 confirmed_at"

    idempotency_key = str(item.get("idempotency_key") or "").strip()
    if not idempotency_key:
        idempotency_key = _fallback_idempotency_key(
            fund_id=fund_id,
            action=action,
            occurred_at=occurred_at,
            amount_cny=amount_cny,
            external_order_no=external_order_no,
        )
        extra = "缺少 idempotency_key，已按指纹回退生成"
        warning_msg = f"{warning_msg}; {extra}" if warning_msg else extra

    tags_raw = item.get("tags")
    tags = [str(tag).strip() for tag in tags_raw if str(tag).strip()] if isinstance(tags_raw, list) else []
    source = str(item.get("source") or default_source or "").strip() or "import_yaml"

    shares, shares_err = _safe_float(item.get("shares"), "shares")
    if shares_err:
        return None, None, shares_err
    nav, nav_err = _safe_float(item.get("nav"), "nav")
    if nav_err:
        return None, None, nav_err
    fee_cny, fee_err = _safe_float(item.get("fee_cny"), "fee_cny")
    if fee_err:
        return None, None, fee_err

    payload = {
        "idempotency_key": idempotency_key,
        "external_order_no": external_order_no,
        "fund_id": fund_id,
        "fund_name": str(item.get("fund_name") or "").strip(),
        "action": action,
        "occurred_at": occurred_at,
        "amount_cny": amount_cny,
        "status": status,
        "confirmed_at": confirmed_at,
        "shares": shares,
        "nav": nav,
        "fee_cny": fee_cny,
        "note": str(item.get("note") or "").strip(),
        "tags": tags,
        "source": source,
    }
    return payload, warning_msg, None


def _get_nav_from_db(fund_id: str, occurred_at: str) -> float | None:
    """从fund_nav_daily表获取指定日期的净值"""
    nav_row = get_nav_for_transaction_sync(fund_id=fund_id, occurred_at=occurred_at)
    if nav_row:
        nav = float(nav_row.get("nav") or 0)
        if nav > 0:
            return nav
    return None


def _fetch_nav_from_crawler(fund_id: str) -> float | None:
    """从东方财富爬取最新净值"""
    try:
        provider = EastMoneyQuoteProvider(timeout_seconds=5.0)
        quote = provider.get_fund_quote(fund_id)
        if quote:
            # 优先使用实际净值，其次使用估算净值
            nav = quote.get("nav")
            if nav and float(nav) > 0:
                return float(nav)
            estimate_nav = quote.get("estimate_nav")
            if estimate_nav and float(estimate_nav) > 0:
                return float(estimate_nav)
    except Exception:
        pass
    return None


def _auto_complete_nav(
    fund_id: str,
    occurred_at: str,
    auto_fetch: bool = True,
) -> tuple[float | None, str | None]:
    """
    自动补全缺失的NAV
    1. 优先从fund_nav_daily表查询
    2. 如未找到且auto_fetch=True，则实时爬取
    返回: (nav_value, source_info)
    """
    # 1. 尝试从数据库获取
    db_nav = _get_nav_from_db(fund_id, occurred_at)
    if db_nav and db_nav > 0:
        return db_nav, "fund_nav_daily"

    # 2. 尝试实时爬取
    if auto_fetch:
        crawled_nav = _fetch_nav_from_crawler(fund_id)
        if crawled_nav and crawled_nav > 0:
            return crawled_nav, "crawler_eastmoney"

    return None, None


def _calculate_shares(amount_cny: float, nav: float) -> float:
    """根据金额和净值计算份额"""
    if nav > 0 and amount_cny > 0:
        return round(amount_cny / nav, 4)
    return 0.0


def _validate_and_complete_transaction(
    item: dict[str, Any],
    default_status: str,
    default_source: str,
    auto_fetch_nav: bool = True,
) -> tuple[dict[str, Any] | None, str | None, str | None, dict[str, Any] | None]:
    """
    验证并补全交易记录
    返回: (payload, warning_msg, error_msg, completion_info)
    completion_info: 包含数据补全的详细信息
    """
    completion_info: dict[str, Any] = {
        "nav_filled": False,
        "nav_source": None,
        "shares_calculated": False,
        "original_nav": None,
        "original_shares": None,
    }

    # 基础验证
    result = _validate_and_normalize_transaction_item(item, default_status, default_source)
    payload, warning_msg, error_msg = result

    if error_msg or not payload:
        return payload, warning_msg, error_msg, None

    # 记录原始值
    completion_info["original_nav"] = payload.get("nav")
    completion_info["original_shares"] = payload.get("shares")

    # NAV补全逻辑
    nav = payload.get("nav", 0.0)
    if not nav or nav <= 0:
        fund_id = payload.get("fund_id", "")
        occurred_at = payload.get("occurred_at", "")

        filled_nav, nav_source = _auto_complete_nav(fund_id, occurred_at, auto_fetch_nav)
        if filled_nav and filled_nav > 0:
            payload["nav"] = filled_nav
            completion_info["nav_filled"] = True
            completion_info["nav_source"] = nav_source

            # 添加警告信息
            nav_warning = f"nav 已自动补全: {filled_nav} (来源: {nav_source})"
            warning_msg = f"{warning_msg}; {nav_warning}" if warning_msg else nav_warning

    # Shares计算逻辑（如果nav已确定但shares为空）
    final_nav = payload.get("nav", 0.0)
    shares = payload.get("shares", 0.0)
    amount_cny = payload.get("amount_cny", 0.0)

    if (not shares or shares <= 0) and final_nav > 0 and amount_cny > 0:
        calculated_shares = _calculate_shares(amount_cny, final_nav)
        payload["shares"] = calculated_shares
        completion_info["shares_calculated"] = True

        shares_warning = f"shares 已根据 amount/nav 自动计算: {calculated_shares}"
        warning_msg = f"{warning_msg}; {shares_warning}" if warning_msg else shares_warning

    return payload, warning_msg, None, completion_info


@router.get("")
async def get_transactions(
    request: Request,
    status: str = Query(default="all", description="all/pending/confirmed"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    fund_id: str | None = Query(default=None, description="可选，按基金代码过滤"),
    limit: int = Query(default=200, ge=1, le=2000),
) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    summary = summarize_fund_transactions_by_fund(user_id=user_id, fund_id=fund_id)
    items = list_fund_transactions(
        user_id=user_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        fund_id=fund_id,
        limit=limit,
    )
    return {
        "status": status,
        "from": date_from,
        "to": date_to,
        "fund_id": fund_id,
        "count": len(items),
        "items": items,
        "summary": summary,
        "data_status": _build_transaction_data_status(summary),
    }


@router.post("/import_yaml")
async def import_transactions_yaml(request: Request, payload: TransactionsImportYamlIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    raw_yaml = str(payload.yaml or payload.yaml_text or "").strip()
    if not raw_yaml:
        return JSONResponse({"detail": "请提供 yaml 或 yaml_text 字段"}, status_code=400)

    try:
        doc = yaml.safe_load(raw_yaml)
    except Exception as exc:
        return JSONResponse({"detail": f"YAML 解析失败: {exc}"}, status_code=400)

    if not isinstance(doc, dict):
        return JSONResponse({"detail": "YAML 顶层必须是对象"}, status_code=400)

    transactions = doc.get("transactions")
    if not isinstance(transactions, list):
        return JSONResponse({"detail": "YAML 中 transactions 必须是数组"}, status_code=400)

    default_status = str(doc.get("default_status") or "pending").strip().lower()
    if default_status not in {"pending", "confirmed"}:
        default_status = "pending"
    default_source = str(payload.source or doc.get("source") or "import_yaml").strip() or "import_yaml"

    added = 0
    skipped = 0
    conflicted = 0
    warnings_count = 0
    conflicts: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for index, row in enumerate(transactions):
        if not isinstance(row, dict):
            conflicted += 1
            conflicts.append({"index": index, "reason": "交易项必须是对象"})
            continue

        normalized, warning_msg, error_msg = _validate_and_normalize_transaction_item(
            item=row,
            default_status=default_status,
            default_source=default_source,
        )
        if error_msg:
            conflicted += 1
            conflicts.append(
                {
                    "index": index,
                    "idempotency_key": str(row.get("idempotency_key") or ""),
                    "reason": error_msg,
                }
            )
            continue

        if warning_msg:
            warnings_count += 1
            warnings.append(
                {
                    "index": index,
                    "idempotency_key": str(normalized.get("idempotency_key") or ""),
                    "reason": warning_msg,
                }
            )

        save_result = save_fund_transaction(user_id=user_id, payload=normalized or {})
        save_status = str(save_result.get("result") or "").strip().lower()
        if save_status == "added":
            added += 1
        elif save_status == "skipped":
            skipped += 1
        else:
            conflicted += 1
            conflicts.append(
                {
                    "index": index,
                    "idempotency_key": str((normalized or {}).get("idempotency_key") or ""),
                    "reason": str(save_result.get("reason") or "导入冲突"),
                }
            )

    summary = summarize_fund_transactions_by_fund(user_id=user_id, fund_id=None)
    return {
        "result": {
            "added": added,
            "skipped": skipped,
            "conflicted": conflicted,
            "warnings": warnings_count,
        },
        "conflicts": conflicts,
        "warnings": warnings,
        "imported_at": datetime.now().astimezone().isoformat(),
        "data_status": _build_transaction_data_status(summary),
    }


@router.post("/import_json")
async def import_transactions_json(request: Request, payload: TransactionsImportJsonIn) -> dict[str, Any]:
    """
    批量导入交易记录（JSON格式）

    支持自动补全缺失数据：
    - 如nav缺失，自动从fund_nav_daily表或实时爬取获取
    - 如shares缺失，根据amount和nav自动计算

    幂等性保证：
    - 通过idempotency_key防止重复导入
    - 如未提供idempotency_key，系统会根据fund_id+action+occurred_at+amount生成指纹
    """
    user_id = get_holdings_user_id(request)

    # 验证默认状态
    default_status = str(payload.default_status or "pending").strip().lower()
    if default_status not in {"pending", "confirmed"}:
        default_status = "pending"

    default_source = str(payload.source or "import_json").strip() or "import_json"
    auto_fetch_nav = bool(payload.auto_fetch_nav)

    transactions = payload.transactions
    if not isinstance(transactions, list):
        return JSONResponse({"detail": "transactions 必须是数组"}, status_code=400)

    added = 0
    skipped = 0
    conflicted = 0
    warnings_count = 0
    completed_count = 0
    conflicts: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    completed: list[dict[str, Any]] = []

    for index, row in enumerate(transactions):
        if not isinstance(row, dict):
            conflicted += 1
            conflicts.append({"index": index, "reason": "交易项必须是对象"})
            continue

        # 使用验证并补全函数
        normalized, warning_msg, error_msg, completion_info = _validate_and_complete_transaction(
            item=row.model_dump() if hasattr(row, "model_dump") else dict(row),
            default_status=default_status,
            default_source=default_source,
            auto_fetch_nav=auto_fetch_nav,
        )

        if error_msg:
            conflicted += 1
            conflicts.append(
                {
                    "index": index,
                    "idempotency_key": str(row.get("idempotency_key") if isinstance(row, dict) else getattr(row, "idempotency_key", None) or ""),
                    "reason": error_msg,
                }
            )
            continue

        if warning_msg:
            warnings_count += 1
            warnings.append(
                {
                    "index": index,
                    "idempotency_key": str(normalized.get("idempotency_key") or ""),
                    "reason": warning_msg,
                }
            )

        # 记录数据补全信息
        if completion_info and (completion_info.get("nav_filled") or completion_info.get("shares_calculated")):
            completed_count += 1
            completed.append(
                {
                    "index": index,
                    "idempotency_key": str(normalized.get("idempotency_key") or ""),
                    "fund_id": str(normalized.get("fund_id") or ""),
                    "nav_filled": completion_info.get("nav_filled", False),
                    "nav_source": completion_info.get("nav_source"),
                    "nav_value": normalized.get("nav"),
                    "shares_calculated": completion_info.get("shares_calculated", False),
                    "shares_value": normalized.get("shares"),
                }
            )

        save_result = save_fund_transaction(user_id=user_id, payload=normalized or {})
        save_status = str(save_result.get("result") or "").strip().lower()
        if save_status == "added":
            added += 1
        elif save_status == "skipped":
            skipped += 1
        else:
            conflicted += 1
            conflicts.append(
                {
                    "index": index,
                    "idempotency_key": str((normalized or {}).get("idempotency_key") or ""),
                    "reason": str(save_result.get("reason") or "导入冲突"),
                }
            )

    summary = summarize_fund_transactions_by_fund(user_id=user_id, fund_id=None)
    return {
        "result": {
            "added": added,
            "skipped": skipped,
            "conflicted": conflicted,
            "warnings": warnings_count,
            "completed": completed_count,
        },
        "conflicts": conflicts,
        "warnings": warnings,
        "completed_details": completed,
        "imported_at": datetime.now().astimezone().isoformat(),
        "data_status": _build_transaction_data_status(summary),
    }


@router.post("/import")
async def import_transaction(request: Request, payload: TransactionImportIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    idempotency_key = (payload.idempotency_key or "").strip() or request.headers.get("X-Idempotency-Key", "").strip()

    data = payload.model_dump()
    if idempotency_key:
        data["idempotency_key"] = idempotency_key

    # Basic normalization to match YAML import logic
    try:
        data["occurred_at"] = _normalize_iso_datetime(data["occurred_at"])
    except Exception as exc:
        return JSONResponse({"detail": f"occurred_at 格式不正确: {exc}"}, status_code=400)

    if data.get("confirmed_at"):
        try:
            data["confirmed_at"] = _normalize_iso_datetime(str(data["confirmed_at"]))
        except Exception as exc:
            return JSONResponse({"detail": f"confirmed_at 格式不正确: {exc}"}, status_code=400)

    if data.get("action") not in _ALLOWED_ACTIONS:
        return JSONResponse({"detail": "action 不在允许范围"}, status_code=400)

    save_result = save_fund_transaction(user_id=user_id, payload=data)
    save_status = str(save_result.get("result") or "").strip().lower()

    if save_status in {"conflict", "conflicted"}:
        return JSONResponse(
            {
                "detail": str(save_result.get("reason") or "幂等键冲突"),
                "idempotency_key": idempotency_key,
            },
            status_code=409,
        )

    summary = summarize_fund_transactions_by_fund(user_id=user_id, fund_id=payload.fund_id)
    return {
        "status": "success",
        "result": save_status,  # added or skipped
        "transaction": save_result.get("transaction"),
        "data_status": _build_transaction_data_status(summary),
    }


@router.post("/sync_pending")
async def sync_pending_transactions(request: Request, payload: SyncPendingIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    snapshot_user_id = get_snapshot_user_id(request)
    pending_rows = list_pending_fund_transactions_for_sync_by_fund(
        user_id=user_id,
        limit=payload.limit,
        fund_id=payload.fund_id,
    )

    synced = 0
    skipped = 0
    errors = 0
    details: list[dict[str, Any]] = []

    for row in pending_rows:
        tx_id = int(row.get("id") or 0)
        fund_id = str(row.get("fund_id") or "")
        occurred_at = str(row.get("occurred_at") or "")
        nav_row = get_nav_for_transaction_sync(fund_id=fund_id, occurred_at=occurred_at)
        if not nav_row:
            skipped += 1
            details.append(
                {
                    "id": tx_id,
                    "fund_id": fund_id,
                    "status": "skipped",
                    "reason": "未找到可用净值",
                }
            )
            continue

        confirmed_at = str(nav_row.get("asof") or "").strip() or datetime.now().astimezone().isoformat()
        source = f"{str(nav_row.get('source') or 'fund_nav_daily')}|sync_pending"
        updated = confirm_fund_transaction(
            user_id=user_id,
            transaction_id=tx_id,
            nav=float(nav_row.get("nav") or 0),
            confirmed_at=confirmed_at,
            source=source,
        )
        if not updated:
            errors += 1
            details.append(
                {
                    "id": tx_id,
                    "fund_id": fund_id,
                    "status": "error",
                    "reason": "更新确认状态失败",
                }
            )
            continue

        synced += 1
        details.append(
            {
                "id": tx_id,
                "fund_id": fund_id,
                "status": "synced",
                "confirmed_at": str(updated.get("confirmed_at") or ""),
                "nav": float(updated.get("nav") or 0),
                "shares": float(updated.get("shares") or 0),
            }
        )

    if synced > 0:
        for cache_user_id in {str(user_id or "").strip(), str(snapshot_user_id or "").strip()}:
            if cache_user_id:
                clear_estimate_snapshots(cache_user_id)

    summary = summarize_fund_transactions_by_fund(user_id=user_id, fund_id=payload.fund_id)
    return {
        "result": {
            "total_pending": len(pending_rows),
            "synced": synced,
            "skipped": skipped,
            "errors": errors,
        },
        "fund_id": payload.fund_id,
        "details": details,
        "synced_at": datetime.now().astimezone().isoformat(),
        "data_status": _build_transaction_data_status(summary),
    }


@router.patch("/{transaction_id}")
async def patch_transaction(
    request: Request,
    transaction_id: int,
    payload: TransactionPatchIn,
) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    actor_user_id = get_user_id(request)
    actor_username = get_username(request)

    patch_data = payload.model_dump(exclude_none=True)
    audit_note = str(patch_data.pop("audit_note", "")).strip()

    if "occurred_at" in patch_data:
        try:
            patch_data["occurred_at"] = _normalize_iso_datetime(str(patch_data.get("occurred_at")))
        except Exception as exc:
            return JSONResponse({"detail": f"occurred_at 格式不正确: {exc}"}, status_code=400)
    if "confirmed_at" in patch_data:
        confirmed_at = str(patch_data.get("confirmed_at") or "").strip()
        if confirmed_at:
            try:
                patch_data["confirmed_at"] = _normalize_iso_datetime(confirmed_at)
            except Exception as exc:
                return JSONResponse({"detail": f"confirmed_at 格式不正确: {exc}"}, status_code=400)
        else:
            patch_data["confirmed_at"] = ""
    if "status" in patch_data:
        clean_status = str(patch_data.get("status") or "").strip().lower()
        if clean_status not in {"pending", "confirmed"}:
            return JSONResponse({"detail": "status 仅支持 pending/confirmed"}, status_code=400)
        patch_data["status"] = clean_status

    if not patch_data:
        return JSONResponse({"detail": "缺少可更新字段"}, status_code=400)

    try:
        patch_result = patch_fund_transaction(
            user_id=user_id,
            transaction_id=transaction_id,
            patch=patch_data,
            actor_user_id=actor_user_id,
            actor_username=actor_username,
            audit_note=audit_note,
        )
    except ValueError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=400)

    if not patch_result:
        return JSONResponse({"detail": "交易记录不存在"}, status_code=404)

    updated_tx = patch_result.get("transaction") or {}
    summary = summarize_fund_transactions_by_fund(
        user_id=user_id,
        fund_id=str(updated_tx.get("fund_id") or ""),
    )
    return {
        "transaction": updated_tx,
        "changed": bool(patch_result.get("changed")),
        "audit_logged": bool(patch_result.get("audit_logged")),
        "changed_fields": patch_result.get("changed_fields") or [],
        "patched_at": datetime.now().astimezone().isoformat(),
        "data_status": _build_transaction_data_status(summary),
    }


@router.get("/{transaction_id}/audit")
async def get_transaction_audit(
    request: Request,
    transaction_id: int,
    limit: int = Query(default=20, ge=1, le=200),
) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
    tx_id = int(transaction_id)
    if tx_id <= 0:
        return JSONResponse({"detail": "交易 ID 非法"}, status_code=400)

    items = list_audit_logs(
        user_id=user_id,
        entity_type="fund_transaction",
        entity_id=str(tx_id),
        limit=limit,
    )
    return {
        "transaction_id": tx_id,
        "count": len(items),
        "items": items,
        "data_status": build_data_status(
            status="confirmed",
            asof=datetime.now().astimezone().isoformat(),
            note="交易审计记录来自 audit_logs，可用于回放修正过程",
        ),
    }
