#!/usr/bin/env python3
"""
本地性能基线脚本 (perf_smoke)

功能：
- 跑关键页面计时并落地本地基线文件
- 支持多次运行取平均值
- 输出 JSON 格式的性能报告

用法：
    python scripts/perf_smoke.py [--runs N] [--output FILE]

示例：
    python scripts/perf_smoke.py --runs 3 --output perf_baseline.json
"""
from __future__ import annotations

import argparse
import json
import logging
import statistics
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
import urllib.request
import urllib.error
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
LOGGER = logging.getLogger("perf_smoke")

DEFAULT_BASE_URL = "http://localhost:21345"
DEFAULT_TIMEOUT = 30.0
DEFAULT_RUNS = 3


@dataclass
class EndpointMetric:
    """端点性能指标"""
    name: str
    url: str
    method: str = "GET"
    status_code: int = 0
    success: bool = False
    elapsed_ms: float = 0.0
    error: str = ""


@dataclass
class PerfRunResult:
    """单次运行结果"""
    run_index: int
    total_time_ms: float
    endpoints: list[EndpointMetric] = field(default_factory=list)


@dataclass
class PerfBaseline:
    """性能基线"""
    generated_at: str
    base_url: str
    runs: int
    total_runs: int
    successful_runs: int
    failed_runs: int
    avg_total_time_ms: float
    min_total_time_ms: float
    max_total_time_ms: float
    std_total_time_ms: float
    endpoints: dict[str, dict[str, Any]] = field(default_factory=dict)
    runs_detail: list[PerfRunResult] = field(default_factory=list)


class PerfSmoke:
    """性能烟雾测试"""

    CRITICAL_ENDPOINTS = [
        {"name": "healthz", "path": "/api/healthz", "method": "GET", "auth_required": False},
        {"name": "health", "path": "/api/health", "method": "GET", "auth_required": False},
        {"name": "config", "path": "/api/config", "method": "GET", "auth_required": True},
        {"name": "estimate", "path": "/api/estimate", "method": "GET", "auth_required": True},
        {"name": "holdings", "path": "/api/holdings", "method": "GET", "auth_required": True},
        {"name": "advice", "path": "/api/advice", "method": "GET", "auth_required": True},
        {"name": "funds_search", "path": "/api/funds/search?q=000001", "method": "GET", "auth_required": True},
        {"name": "benchmark_list", "path": "/api/benchmark/list", "method": "GET", "auth_required": True},
        {"name": "system_status", "path": "/api/system/status", "method": "GET", "auth_required": True},
    ]

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        auth_token: Optional[str] = None,
    ):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._auth_token = auth_token

    def _get_auth_token(self) -> Optional[str]:
        """获取认证令牌"""
        if self._auth_token:
            return self._auth_token

        token_file = Path(__file__).parent.parent / "backend" / "data" / "runtime_token.txt"
        if token_file.exists():
            try:
                return token_file.read_text().strip()
            except Exception:
                pass
        return None

    def _make_request(
        self,
        path: str,
        method: str = "GET",
        auth_required: bool = False,
    ) -> tuple[int, float, str]:
        """发起 HTTP 请求

        Returns:
            (status_code, elapsed_ms, error_message)
        """
        url = f"{self._base_url}{path}"
        headers = {"Content-Type": "application/json"}

        if auth_required:
            token = self._get_auth_token()
            if token:
                headers["Authorization"] = f"Bearer {token}"
            else:
                return 0, 0.0, "no_auth_token"

        start = time.perf_counter()
        try:
            req = urllib.request.Request(
                url=url,
                method=method,
                headers=headers,
            )
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                status_code = int(getattr(resp, "status", 200))
                _ = resp.read()
        except urllib.error.HTTPError as e:
            status_code = int(e.code)
        except urllib.error.URLError as e:
            return 0, 0.0, f"url_error: {e.reason}"
        except TimeoutError:
            return 0, 0.0, "timeout"
        except Exception as e:
            return 0, 0.0, f"error: {e}"
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000

        return status_code, elapsed_ms, ""

    def run_single(self, run_index: int) -> PerfRunResult:
        """执行单次性能测试"""
        LOGGER.info("开始第 %d 次运行...", run_index + 1)

        endpoints: list[EndpointMetric] = []
        total_time_ms = 0.0

        for ep in self.CRITICAL_ENDPOINTS:
            status_code, elapsed_ms, error = self._make_request(
                path=ep["path"],
                method=ep["method"],
                auth_required=ep["auth_required"],
            )

            success = status_code == 200 and not error
            metric = EndpointMetric(
                name=ep["name"],
                url=f"{self._base_url}{ep['path']}",
                method=ep["method"],
                status_code=status_code,
                success=success,
                elapsed_ms=elapsed_ms,
                error=error,
            )
            endpoints.append(metric)
            total_time_ms += elapsed_ms

            status = "✓" if success else "✗"
            LOGGER.info(
                "  %s %s: %.1fms (status=%d)",
                status,
                ep["name"],
                elapsed_ms,
                status_code,
            )

        return PerfRunResult(
            run_index=run_index,
            total_time_ms=total_time_ms,
            endpoints=endpoints,
        )

    def run(self, runs: int = DEFAULT_RUNS) -> PerfBaseline:
        """执行多次性能测试并计算基线"""
        LOGGER.info("开始性能基线测试 (base_url=%s, runs=%d)", self._base_url, runs)

        results: list[PerfRunResult] = []
        for i in range(runs):
            result = self.run_single(i)
            results.append(result)
            LOGGER.info("第 %d 次运行完成: 总耗时 %.1fms", i + 1, result.total_time_ms)

        successful_runs = [r for r in results if all(e.success for e in r.endpoints)]
        failed_runs = [r for r in results if r not in successful_runs]

        total_times = [r.total_time_ms for r in successful_runs] if successful_runs else [0.0]

        avg_total = statistics.mean(total_times) if total_times else 0.0
        min_total = min(total_times) if total_times else 0.0
        max_total = max(total_times) if total_times else 0.0
        std_total = statistics.stdev(total_times) if len(total_times) > 1 else 0.0

        endpoints_stats: dict[str, dict[str, Any]] = {}
        for ep in self.CRITICAL_ENDPOINTS:
            name = ep["name"]
            times = []
            success_count = 0
            for r in results:
                for e in r.endpoints:
                    if e.name == name:
                        times.append(e.elapsed_ms)
                        if e.success:
                            success_count += 1

            if times:
                endpoints_stats[name] = {
                    "avg_ms": statistics.mean(times),
                    "min_ms": min(times),
                    "max_ms": max(times),
                    "std_ms": statistics.stdev(times) if len(times) > 1 else 0.0,
                    "success_rate": success_count / len(times),
                    "path": ep["path"],
                }

        baseline = PerfBaseline(
            generated_at=datetime.now().astimezone().isoformat(timespec="seconds"),
            base_url=self._base_url,
            runs=runs,
            total_runs=len(results),
            successful_runs=len(successful_runs),
            failed_runs=len(failed_runs),
            avg_total_time_ms=avg_total,
            min_total_time_ms=min_total,
            max_total_time_ms=max_total,
            std_total_time_ms=std_total,
            endpoints=endpoints_stats,
            runs_detail=results,
        )

        LOGGER.info(
            "性能基线测试完成: 平均 %.1fms, 最小 %.1fms, 最大 %.1fms, 标准差 %.1fms",
            avg_total,
            min_total,
            max_total,
            std_total,
        )

        return baseline


def main():
    parser = argparse.ArgumentParser(
        description="本地性能基线脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"后端服务地址 (默认: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=DEFAULT_RUNS,
        help=f"运行次数 (默认: {DEFAULT_RUNS})",
    )
    parser.add_argument(
        "--output",
        default="perf_baseline.json",
        help="输出文件名 (默认: perf_baseline.json)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help=f"请求超时时间 (默认: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="认证令牌 (可选，默认从 runtime_token.txt 读取)",
    )

    args = parser.parse_args()

    perf = PerfSmoke(
        base_url=args.base_url,
        timeout=args.timeout,
        auth_token=args.token,
    )

    baseline = perf.run(runs=args.runs)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    baseline_dict = asdict(baseline)

    baseline_dict["runs_detail"] = [
        {
            "run_index": r["run_index"],
            "total_time_ms": r["total_time_ms"],
            "endpoints": [
                {
                    "name": e["name"],
                    "url": e["url"],
                    "method": e["method"],
                    "status_code": e["status_code"],
                    "success": e["success"],
                    "elapsed_ms": e["elapsed_ms"],
                    "error": e["error"],
                }
                for e in r["endpoints"]
            ],
        }
        for r in baseline_dict["runs_detail"]
    ]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(baseline_dict, f, ensure_ascii=False, indent=2)

    LOGGER.info("性能基线已保存到: %s", output_path.absolute())

    if baseline.failed_runs > 0:
        LOGGER.warning("存在 %d 次失败运行", baseline.failed_runs)
        sys.exit(1)

    print("\n" + "=" * 60)
    print("性能基线摘要")
    print("=" * 60)
    print(f"生成时间: {baseline.generated_at}")
    print(f"服务地址: {baseline.base_url}")
    print(f"运行次数: {baseline.total_runs} (成功: {baseline.successful_runs}, 失败: {baseline.failed_runs})")
    print(f"平均总耗时: {baseline.avg_total_time_ms:.1f}ms")
    print(f"最小总耗时: {baseline.min_total_time_ms:.1f}ms")
    print(f"最大总耗时: {baseline.max_total_time_ms:.1f}ms")
    print(f"标准差: {baseline.std_total_time_ms:.1f}ms")
    print()
    print("端点性能:")
    for name, stats in baseline.endpoints.items():
        print(f"  {name}: {stats['avg_ms']:.1f}ms (成功率: {stats['success_rate']*100:.0f}%)")


if __name__ == "__main__":
    main()
