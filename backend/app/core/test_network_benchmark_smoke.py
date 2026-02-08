from __future__ import annotations

import unittest
from unittest.mock import patch

from app.core import network_benchmark as nb


class NetworkBenchmarkSmokeTest(unittest.TestCase):
    def test_normalize_target_defaults_to_https(self) -> None:
        target = nb._normalize_target("fund.eastmoney.com")
        self.assertEqual(target.site, "fund.eastmoney.com")
        self.assertEqual(target.scheme, "https")
        self.assertEqual(target.port, 443)
        self.assertEqual(target.host, "fund.eastmoney.com")
        self.assertTrue(target.url.startswith("https://fund.eastmoney.com"))

    def test_normalize_target_supports_explicit_http_url(self) -> None:
        target = nb._normalize_target({"site": "hq.sinajs.cn", "url": "http://hq.sinajs.cn/list=s_sh000001"})
        self.assertEqual(target.site, "hq.sinajs.cn")
        self.assertEqual(target.scheme, "http")
        self.assertEqual(target.port, 80)
        self.assertEqual(target.host, "hq.sinajs.cn")
        self.assertIn("list=s_sh000001", target.url)

    def test_https_tls_eof_should_fallback_to_http(self) -> None:
        target = nb._normalize_target("fundmobapi.eastmoney.com")
        failed = nb.BenchmarkResult(
            site=target.site,
            ok=False,
            error="异常: [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred",
            ip="",
            status_code=0,
            dns_ms=0.0,
            tcp_ms=0.0,
            tls_ms=0.0,
            ttfb_ms=0.0,
            total_ms=0.0,
            checked_at="",
        )
        recovered = nb.BenchmarkResult(
            site=target.site,
            ok=True,
            error="",
            ip="1.2.3.4",
            status_code=200,
            dns_ms=1.0,
            tcp_ms=2.0,
            tls_ms=0.0,
            ttfb_ms=3.0,
            total_ms=4.0,
            checked_at="",
        )
        with patch("app.core.network_benchmark._probe_target", side_effect=[failed, recovered]) as mocked:
            result = nb._check_single_site(target, 6.0)

        self.assertTrue(result.ok)
        self.assertEqual(mocked.call_count, 2)
        fallback_target = mocked.call_args_list[1].args[0]
        self.assertEqual(fallback_target.scheme, "http")
        self.assertEqual(fallback_target.port, 80)


if __name__ == "__main__":
    unittest.main()
