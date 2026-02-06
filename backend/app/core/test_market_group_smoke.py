from __future__ import annotations

import unittest

from app.core.market_group import decide_market_group


class MarketGroupSmokeTest(unittest.TestCase):
    def test_qdii_should_be_overseas(self) -> None:
        self.assertEqual(decide_market_group(name="摩根纳斯达克100指数(QDII)A"), "us_overseas")
        self.assertEqual(decide_market_group(name="测试基金", tags=["qdii"]), "us_overseas")

    def test_market_and_currency_priority(self) -> None:
        self.assertEqual(decide_market_group(name="测试", market="us"), "us_overseas")
        self.assertEqual(decide_market_group(name="测试", currency="USD"), "us_overseas")
        self.assertEqual(decide_market_group(name="测试", market="hk"), "cn_hk")
        self.assertEqual(decide_market_group(name="测试", currency="HKD"), "cn_hk")

    def test_default_is_cn_hk(self) -> None:
        self.assertEqual(decide_market_group(name="普通国内基金"), "cn_hk")


if __name__ == "__main__":
    unittest.main()

