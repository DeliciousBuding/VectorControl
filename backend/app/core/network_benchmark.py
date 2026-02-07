from __future__ import annotations

import socket
import ssl
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

DEFAULT_TIMEOUT_SECONDS = 6.0
MAX_TIMEOUT_SECONDS = 12.0
MAX_WORKERS = 6

SITE_PROFILES: dict[str, list[str]] = {
    "cn_fund": [
        "fund.eastmoney.com",
        "fundmobapi.eastmoney.com",
        "api.fund.eastmoney.com",
        "www.1234567.com.cn",
        "finance.sina.com.cn",
        "hq.sinajs.cn",
        "www.csindex.com.cn",
        "www.sse.com.cn",
        "www.szse.cn",
        "www.baidu.com",
    ],
    "global": [
        "google.com",
        "github.com",
        "cloudflare.com",
        "wikipedia.org",
    ],
}


@dataclass
class BenchmarkResult:
    site: str
    ok: bool
    error: str
    ip: str
    status_code: int
    dns_ms: float
    tcp_ms: float
    tls_ms: float
    ttfb_ms: float
    total_ms: float
    checked_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "site": self.site,
            "ok": self.ok,
            "error": self.error,
            "ip": self.ip,
            "status_code": self.status_code,
            "dns_ms": self.dns_ms,
            "tcp_ms": self.tcp_ms,
            "tls_ms": self.tls_ms,
            "ttfb_ms": self.ttfb_ms,
            "total_ms": self.total_ms,
            "checked_at": self.checked_at,
        }


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _round_ms(value: float) -> float:
    if value < 0:
        return 0.0
    return round(value, 2)


def _measure_dns(host: str) -> tuple[float, str]:
    start = time.perf_counter()
    infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    elapsed_ms = _round_ms((time.perf_counter() - start) * 1000)
    ip = infos[0][4][0] if infos else ""
    return elapsed_ms, ip


def _measure_tcp(host: str, timeout_seconds: float) -> float:
    start = time.perf_counter()
    sock = socket.create_connection((host, 443), timeout=timeout_seconds)
    sock.close()
    return _round_ms((time.perf_counter() - start) * 1000)


def _measure_tls(host: str, timeout_seconds: float) -> float:
    context = ssl.create_default_context()
    start = time.perf_counter()
    raw_sock = socket.create_connection((host, 443), timeout=timeout_seconds)
    tls_sock = context.wrap_socket(raw_sock, server_hostname=host)
    tls_sock.close()
    return _round_ms((time.perf_counter() - start) * 1000)


def _measure_http(site: str, timeout_seconds: float) -> tuple[int, float, float]:
    url = f"https://{site}"
    request = urllib.request.Request(
        url=url,
        headers={
            "User-Agent": "VectorControl-NetworkBenchmark/1.0",
            "Accept": "*/*",
            "Connection": "close",
        },
        method="GET",
    )

    start = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        ttfb_ms = _round_ms((time.perf_counter() - start) * 1000)
        # 读取首块响应，避免只测握手不测真实业务返回。
        response.read(4096)
        total_ms = _round_ms((time.perf_counter() - start) * 1000)
        status_code = int(getattr(response, "status", 0) or 0)
    return status_code, ttfb_ms, total_ms


def _check_single_site(site: str, timeout_seconds: float) -> BenchmarkResult:
    try:
        dns_ms, ip = _measure_dns(site)
        tcp_ms = _measure_tcp(site, timeout_seconds)
        tls_ms = _measure_tls(site, timeout_seconds)
        status_code, ttfb_ms, total_ms = _measure_http(site, timeout_seconds)
        return BenchmarkResult(
            site=site,
            ok=200 <= status_code < 500,
            error="",
            ip=ip,
            status_code=status_code,
            dns_ms=dns_ms,
            tcp_ms=tcp_ms,
            tls_ms=tls_ms,
            ttfb_ms=ttfb_ms,
            total_ms=total_ms,
            checked_at=_now_iso(),
        )
    except (socket.timeout, TimeoutError):
        return BenchmarkResult(
            site=site,
            ok=False,
            error="请求超时",
            ip="",
            status_code=0,
            dns_ms=0.0,
            tcp_ms=0.0,
            tls_ms=0.0,
            ttfb_ms=0.0,
            total_ms=0.0,
            checked_at=_now_iso(),
        )
    except urllib.error.URLError as exc:
        return BenchmarkResult(
            site=site,
            ok=False,
            error=f"网络错误: {exc.reason}",
            ip="",
            status_code=0,
            dns_ms=0.0,
            tcp_ms=0.0,
            tls_ms=0.0,
            ttfb_ms=0.0,
            total_ms=0.0,
            checked_at=_now_iso(),
        )
    except Exception as exc:  # noqa: BLE001
        return BenchmarkResult(
            site=site,
            ok=False,
            error=f"异常: {exc}",
            ip="",
            status_code=0,
            dns_ms=0.0,
            tcp_ms=0.0,
            tls_ms=0.0,
            ttfb_ms=0.0,
            total_ms=0.0,
            checked_at=_now_iso(),
        )


def run_network_benchmark(profile: str, timeout_seconds: float) -> dict[str, Any]:
    chosen_profile = profile if profile in SITE_PROFILES else "cn_fund"
    timeout = max(1.0, min(float(timeout_seconds or DEFAULT_TIMEOUT_SECONDS), MAX_TIMEOUT_SECONDS))
    sites = SITE_PROFILES[chosen_profile]

    started = time.perf_counter()
    results: list[BenchmarkResult] = []
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(sites))) as executor:
        futures = {executor.submit(_check_single_site, site, timeout): site for site in sites}
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda item: item.site)
    ok_items = [item for item in results if item.ok]
    fail_items = [item for item in results if not item.ok]
    avg_total_ms = _round_ms(sum(item.total_ms for item in ok_items) / len(ok_items)) if ok_items else 0.0

    summary = {
        "site_count": len(results),
        "success_count": len(ok_items),
        "failed_count": len(fail_items),
        "avg_total_ms": avg_total_ms,
        "elapsed_ms": _round_ms((time.perf_counter() - started) * 1000),
    }

    return {
        "profile": chosen_profile,
        "timeout_seconds": timeout,
        "generated_at": _now_iso(),
        "summary": summary,
        "results": [item.to_dict() for item in results],
        "profiles": list(SITE_PROFILES.keys()),
    }