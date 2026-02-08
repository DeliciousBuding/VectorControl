from __future__ import annotations

import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

DEFAULT_TIMEOUT_SECONDS = 6.0
MAX_TIMEOUT_SECONDS = 12.0
MAX_WORKERS = 6

SITE_PROFILES: dict[str, list[str | dict[str, str]]] = {
    "cn_fund": [
        "fund.eastmoney.com",
        "fundmobapi.eastmoney.com",
        "api.fund.eastmoney.com",
        "www.1234567.com.cn",
        "finance.sina.com.cn",
        # 新浪行情域名默认更稳定于 HTTP，保留显式 URL。
        {"site": "hq.sinajs.cn", "url": "http://hq.sinajs.cn/list=s_sh000001"},
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


@dataclass(frozen=True)
class BenchmarkTarget:
    site: str
    url: str
    host: str
    port: int
    scheme: str


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _round_ms(value: float) -> float:
    if value < 0:
        return 0.0
    return round(value, 2)


def _normalize_target(entry: str | dict[str, str]) -> BenchmarkTarget:
    if isinstance(entry, dict):
        site = str(entry.get("site") or entry.get("host") or "").strip()
        raw_url = str(entry.get("url") or site).strip()
    else:
        site = str(entry or "").strip()
        raw_url = site

    if not raw_url:
        raise ValueError("站点地址为空")

    if "://" not in raw_url:
        raw_url = f"https://{raw_url}"
    parsed = urllib.parse.urlsplit(raw_url)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        raise ValueError(f"不支持的协议: {scheme}")

    host = str(parsed.hostname or "").strip()
    if not host:
        raise ValueError("缺少 host")

    port = int(parsed.port or (443 if scheme == "https" else 80))
    path = parsed.path or "/"
    netloc = parsed.netloc or host
    normalized_url = urllib.parse.urlunsplit((scheme, netloc, path, parsed.query, ""))
    return BenchmarkTarget(
        site=site or host,
        url=normalized_url,
        host=host,
        port=port,
        scheme=scheme,
    )


def _to_http_fallback(target: BenchmarkTarget) -> BenchmarkTarget | None:
    if target.scheme != "https":
        return None
    parsed = urllib.parse.urlsplit(target.url)
    fallback_url = urllib.parse.urlunsplit(("http", target.host, parsed.path or "/", parsed.query, ""))
    return BenchmarkTarget(
        site=target.site,
        url=fallback_url,
        host=target.host,
        port=80,
        scheme="http",
    )


def _measure_dns(host: str, port: int) -> tuple[float, str]:
    start = time.perf_counter()
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    elapsed_ms = _round_ms((time.perf_counter() - start) * 1000)
    ip = infos[0][4][0] if infos else ""
    return elapsed_ms, ip


def _measure_tcp(host: str, port: int, timeout_seconds: float) -> float:
    start = time.perf_counter()
    sock = socket.create_connection((host, port), timeout=timeout_seconds)
    sock.close()
    return _round_ms((time.perf_counter() - start) * 1000)


def _measure_tls(host: str, port: int, timeout_seconds: float) -> float:
    context = ssl.create_default_context()
    start = time.perf_counter()
    raw_sock = socket.create_connection((host, port), timeout=timeout_seconds)
    tls_sock = context.wrap_socket(raw_sock, server_hostname=host)
    tls_sock.close()
    return _round_ms((time.perf_counter() - start) * 1000)


def _measure_http(url: str, timeout_seconds: float) -> tuple[int, float, float]:
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


def _build_failed_result(
    target: BenchmarkTarget,
    error: str,
    *,
    ip: str = "",
    dns_ms: float = 0.0,
    tcp_ms: float = 0.0,
    tls_ms: float = 0.0,
    ttfb_ms: float = 0.0,
    total_ms: float = 0.0,
) -> BenchmarkResult:
    return BenchmarkResult(
        site=target.site,
        ok=False,
        error=error,
        ip=ip,
        status_code=0,
        dns_ms=dns_ms,
        tcp_ms=tcp_ms,
        tls_ms=tls_ms,
        ttfb_ms=ttfb_ms,
        total_ms=total_ms,
        checked_at=_now_iso(),
    )


def _probe_target(target: BenchmarkTarget, timeout_seconds: float) -> BenchmarkResult:
    dns_ms = 0.0
    tcp_ms = 0.0
    tls_ms = 0.0
    ip = ""
    try:
        dns_ms, ip = _measure_dns(target.host, target.port)
        tcp_ms = _measure_tcp(target.host, target.port, timeout_seconds)
        if target.scheme == "https":
            tls_ms = _measure_tls(target.host, target.port, timeout_seconds)
        status_code, ttfb_ms, total_ms = _measure_http(target.url, timeout_seconds)
        return BenchmarkResult(
            site=target.site,
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
        return _build_failed_result(
            target,
            "请求超时",
            ip=ip,
            dns_ms=dns_ms,
            tcp_ms=tcp_ms,
            tls_ms=tls_ms,
        )
    except urllib.error.URLError as exc:
        return _build_failed_result(
            target,
            f"网络错误: {exc.reason}",
            ip=ip,
            dns_ms=dns_ms,
            tcp_ms=tcp_ms,
            tls_ms=tls_ms,
        )
    except Exception as exc:  # noqa: BLE001
        return _build_failed_result(
            target,
            f"异常: {exc}",
            ip=ip,
            dns_ms=dns_ms,
            tcp_ms=tcp_ms,
            tls_ms=tls_ms,
        )


def _needs_http_fallback(error: str) -> bool:
    text = str(error or "").lower()
    markers = (
        "unexpected_eof_while_reading",
        "wrong version number",
        "tlsv1 alert protocol version",
        "connection reset by peer",
        "ssleoferror",
    )
    return any(marker in text for marker in markers)


def _check_single_site(target: BenchmarkTarget, timeout_seconds: float) -> BenchmarkResult:
    primary = _probe_target(target, timeout_seconds)
    if primary.ok:
        return primary

    fallback = _to_http_fallback(target)
    if not fallback or not _needs_http_fallback(primary.error):
        return primary

    recovered = _probe_target(fallback, timeout_seconds)
    if recovered.ok:
        return recovered

    return _build_failed_result(
        target,
        f"{primary.error}；HTTP 回退失败: {recovered.error}",
        ip=primary.ip or recovered.ip,
        dns_ms=max(primary.dns_ms, recovered.dns_ms),
        tcp_ms=max(primary.tcp_ms, recovered.tcp_ms),
        tls_ms=primary.tls_ms,
        ttfb_ms=max(primary.ttfb_ms, recovered.ttfb_ms),
        total_ms=max(primary.total_ms, recovered.total_ms),
    )


def run_network_benchmark(profile: str, timeout_seconds: float) -> dict[str, Any]:
    chosen_profile = profile if profile in SITE_PROFILES else "cn_fund"
    timeout = max(1.0, min(float(timeout_seconds or DEFAULT_TIMEOUT_SECONDS), MAX_TIMEOUT_SECONDS))
    site_entries = SITE_PROFILES[chosen_profile]

    started = time.perf_counter()
    results: list[BenchmarkResult] = []
    targets: list[BenchmarkTarget] = []
    for entry in site_entries:
        try:
            targets.append(_normalize_target(entry))
        except Exception as exc:  # noqa: BLE001
            results.append(
                BenchmarkResult(
                    site=str(entry),
                    ok=False,
                    error=f"站点配置错误: {exc}",
                    ip="",
                    status_code=0,
                    dns_ms=0.0,
                    tcp_ms=0.0,
                    tls_ms=0.0,
                    ttfb_ms=0.0,
                    total_ms=0.0,
                    checked_at=_now_iso(),
                )
            )

    if targets:
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(targets))) as executor:
            futures = {executor.submit(_check_single_site, target, timeout): target.site for target in targets}
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
