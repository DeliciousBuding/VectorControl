#!/usr/bin/env python3
"""
Performance Smoke Test - 本地性能基线脚本

功能：跑关键页面计时并落地本地基线文件（不入库）
用法：python scripts/perf_smoke.py
"""

import json
import os
import time
import urllib.request
from datetime import datetime
from pathlib import Path

# 配置
API_BASE = os.environ.get("VC_API_BASE", "http://localhost:8000")
FRONTEND_BASE = os.environ.get("VC_FRONTEND_BASE", "http://localhost:80")
BENCHMARK_FILE = Path.home() / ".vectorcontrol_perf_baseline.json"

# 关键页面/接口
ENDPOINTS = [
    {"name": "health", "url": f"{API_BASE}/api/health", "method": "GET"},
    {"name": "estimate", "url": f"{API_BASE}/api/estimate", "method": "GET"},
    {"name": "holdings", "url": f"{API_BASE}/api/holdings", "method": "GET"},
    {"name": "frontend_home", "url": FRONTEND_BASE, "method": "GET"},
]


def measure_endpoint(name: str, url: str, method: str = "GET") -> dict:
    """测量单个接口的响应时间"""
    start = time.time()
    try:
        if method == "GET":
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp.read()
        elapsed = (time.time() - start) * 1000  # ms
        return {"name": name, "url": url, "elapsed_ms": elapsed, "ok": True}
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return {"name": name, "url": url, "elapsed_ms": elapsed, "ok": False, "error": str(e)}


def load_baseline() -> dict:
    """加载历史基线"""
    if BENCHMARK_FILE.exists():
        try:
            return json.loads(BENCHMARK_FILE.read_text())
        except Exception:
            pass
    return {}


def save_baseline(data: dict):
    """保存基线到文件"""
    BENCHMARK_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"基线已保存到: {BENCHMARK_FILE}")


def main():
    print("=" * 50)
    print("VectorControl Performance Smoke Test")
    print("=" * 50)
    print(f"时间: {datetime.now().isoformat()}")
    print(f"API Base: {API_BASE}")
    print(f"Frontend Base: {FRONTEND_BASE}")
    print("-" * 50)

    # 测量各接口
    results = []
    for ep in ENDPOINTS:
        print(f"测试 {ep['name']}...", end=" ")
        result = measure_endpoint(ep["name"], ep["url"], ep["method"])
        results.append(result)
        status = "OK" if result["ok"] else "FAIL"
        print(f"{result['elapsed_ms']:.0f}ms [{status}]")

    # 对比基线
    print("-" * 50)
    baseline = load_baseline()
    baseline_time = datetime.fromisoformat(baseline.get("timestamp", "2020-01-01T00:00:00"))
    print(f"基线时间: {baseline_time.isoformat()}")

    # 构建当前结果
    current_data = {
        "timestamp": datetime.now().isoformat(),
        "results": {r["name"]: r["elapsed_ms"] for r in results if r["ok"]},
    }

    # 对比
    print("\n对比基线:")
    all_ok = True
    for r in results:
        if not r["ok"]:
            print(f"  {r['name']}: FAIL")
            all_ok = False
            continue
        baseline_ms = baseline.get("results", {}).get(r["name"])
        if baseline_ms:
            diff = r["elapsed_ms"] - baseline_ms
            diff_pct = (diff / baseline_ms) * 100
            sign = "+" if diff > 0 else ""
            flag = ""
            if diff_pct > 50:
                flag = " ⚠️ 显著变慢"
            elif diff_pct < -20:
                flag = " ✅ 显著变快"
            print(f"  {r['name']}: {r['elapsed_ms']:.0f}ms ({sign}{diff:.0f}ms, {sign}{diff_pct:.1f}%){flag}")
        else:
            print(f"  {r['name']}: {r['elapsed_ms']:.0f}ms (无基线)")

    # 保存当前结果为新基线
    print("-" * 50)
    if all_ok:
        save_baseline(current_data)
        print("✅ 性能测试通过")
    else:
        print("❌ 部分测试失败，未更新基线")

    print("=" * 50)
    return 0 if all_ok else 1


if __name__ == "__main__":
    exit(main())
