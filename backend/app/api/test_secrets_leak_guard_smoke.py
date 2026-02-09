from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


class SecretsLeakGuardSmokeTest(unittest.TestCase):
    def test_detects_fake_secrets_without_echoing_plaintext(self) -> None:
        # Build at runtime so the repo itself doesn't contain contiguous fake secrets.
        fake_tg = "1234567890" + ":" + ("A" * 20) + ("b" * 15) + "_-"
        fake_fs = "https://open.feishu.cn/open-apis/bot/v2/hook/" + "01234567-89ab-cdef-0123-456789abcdef"
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "leak.txt"
            p.write_text(f"tg={fake_tg}\nfs={fake_fs}\n", encoding="utf-8")

            proc = subprocess.run(
                [sys.executable, "scripts/check_secrets_leak.py", "--paths", str(p)],
                cwd=ROOT_DIR,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertNotEqual(proc.returncode, 0, (proc.stdout or "") + "\n" + (proc.stderr or ""))
            merged = (proc.stdout or "") + "\n" + (proc.stderr or "")
            self.assertIn("telegram_bot_token", merged)
            self.assertIn("feishu_webhook_url", merged)
            self.assertNotIn(fake_tg, merged)
            self.assertNotIn(fake_fs, merged)


if __name__ == "__main__":
    unittest.main()
