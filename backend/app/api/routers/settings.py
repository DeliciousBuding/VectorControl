from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.deps import get_holdings_user_id
from app.core.network_benchmark import run_network_benchmark
from app.storage.db import get_user_settings, upsert_user_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])
# Compatibility routes for historical service paths like `/api/network-benchmark/*`.
compat_router = APIRouter(prefix="/api", tags=["settings-compat"], include_in_schema=False)


class SettingsIn(BaseModel):
    settings: dict[str, Any]


class NetworkBenchmarkRunIn(BaseModel):
    profile: str = "cn_fund"
    timeout_seconds: float = 6.0
    persist: bool = True


@router.get("")
async def get_settings(request: Request) -> dict:
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    return {"settings": settings, "user_id": user_id}


@router.put("")
async def put_settings(request: Request, payload: SettingsIn) -> dict:
    user_id = get_holdings_user_id(request)
    settings = upsert_user_settings(user_id, payload.settings)
    return {"settings": settings, "user_id": user_id}


@router.get("/network-benchmark/latest")
async def get_network_benchmark_latest(request: Request) -> dict:
    user_id = get_holdings_user_id(request)
    settings = get_user_settings(user_id)
    section = settings.get("network_benchmark", {}) if isinstance(settings, dict) else {}
    result = section.get("last_result") if isinstance(section, dict) else None
    return {
        "user_id": user_id,
        "available": isinstance(result, dict),
        "result": result if isinstance(result, dict) else None,
    }


# Legacy compatibility: /network_benchmark/latest
@router.get("/network_benchmark/latest", include_in_schema=False)
async def get_network_benchmark_latest_legacy(request: Request) -> dict:
    return await get_network_benchmark_latest(request)


@router.post("/network-benchmark/run")
async def post_network_benchmark_run(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    user_id = get_holdings_user_id(request)
    result = run_network_benchmark(payload.profile, payload.timeout_seconds)

    if payload.persist:
        upsert_user_settings(
            user_id,
            {
                "network_benchmark": {
                    "default_profile": result.get("profile", payload.profile),
                    "timeout_seconds": result.get("timeout_seconds", payload.timeout_seconds),
                    "last_run_at": result.get("generated_at", ""),
                    "last_result": result,
                }
            },
        )

    return {"user_id": user_id, "result": result}


# Legacy compatibility: /network_benchmark/run
@router.post("/network_benchmark/run", include_in_schema=False)
async def post_network_benchmark_run_legacy(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    return await post_network_benchmark_run(request, payload)


@compat_router.get("/network-benchmark/latest")
async def get_network_benchmark_latest_compat(request: Request) -> dict:
    return await get_network_benchmark_latest(request)


@compat_router.get("/network_benchmark/latest")
async def get_network_benchmark_latest_compat_legacy(request: Request) -> dict:
    return await get_network_benchmark_latest(request)


@compat_router.post("/network-benchmark/run")
async def post_network_benchmark_run_compat(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    return await post_network_benchmark_run(request, payload)


@compat_router.post("/network_benchmark/run")
async def post_network_benchmark_run_compat_legacy(request: Request, payload: NetworkBenchmarkRunIn) -> dict:
    return await post_network_benchmark_run(request, payload)
