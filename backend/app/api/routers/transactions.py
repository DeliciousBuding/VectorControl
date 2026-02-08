from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

import yaml
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from starlette.responses import JSONResponse

from app.api.deps import build_data_status, get_holdings_user_id, get_user_id, get_username
from app.storage.db import (
    confirm_fund_transaction,
    get_nav_for_transaction_sync,
    list_fund_transactions,
    list_pending_fund_transactions_for_sync_by_fund,
    patch_fund_transaction,
    save_fund_transaction,
    summarize_fund_transactions_by_fund,
)

router = APIRouter(prefix="/api/transactions", tags=["交易流水"])

_ALLOWED_ACTIONS = {"buy", "redeem", "sip", "switch_in", "switch_out", "dividend"}


class TransactionsImportYamlIn(BaseModel):
    yaml: str | None = None
    yaml_text: str | None = None
    source: str | None = None


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


@router.post("/sync_pending")
async def sync_pending_transactions(request: Request, payload: SyncPendingIn) -> dict[str, Any]:
    user_id = get_holdings_user_id(request)
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
