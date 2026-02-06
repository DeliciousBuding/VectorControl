from __future__ import annotations

from fastapi import APIRouter, Query, Request

from app.api.deps import get_config
from app.storage.db import list_fund_suggestions, sync_fund_catalog_from_config

router = APIRouter(prefix="/api/funds", tags=["基金"])


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
        "candidates": candidates,
    }
