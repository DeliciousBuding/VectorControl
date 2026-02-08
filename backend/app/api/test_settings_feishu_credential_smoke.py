from __future__ import annotations

import json
import unittest
import uuid

from fastapi.testclient import TestClient

from app.main import app


class SettingsFeishuCredentialSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "cred") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_put_feishu_webhook_credential_updates_without_plaintext_echo(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            webhook_url = "https://open.feishu.cn/open-apis/bot/v2/hook/example-secret-token"

            resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(body.get("user_id"), client.get("/api/auth/me", headers=headers).json().get("user", {}).get("id"))
            self.assertEqual(bool(body.get("updated")), True)
            self.assertEqual(str(body.get("credential", {}).get("channel")), "feishu")
            self.assertEqual(str(body.get("credential", {}).get("field")), "webhook_url")
            self.assertEqual(bool(body.get("credential", {}).get("configured")), True)
            self.assertNotIn("webhook_url", body.get("notifications", {}).get("feishu", {}))
            self.assertNotIn(webhook_url, json.dumps(body, ensure_ascii=False))

            settings_resp = client.get("/api/settings", headers=headers)
            self.assertEqual(settings_resp.status_code, 200, settings_resp.text)
            saved = settings_resp.json().get("settings", {}).get("notifications", {}).get("feishu", {})
            self.assertEqual(str(saved.get("webhook_url", "")), webhook_url)

            other_headers = self._register_headers(client, prefix="cred_other")
            other_settings = client.get("/api/settings", headers=other_headers).json()
            self.assertEqual(
                str(other_settings.get("settings", {}).get("notifications", {}).get("feishu", {}).get("webhook_url", "")),
                "",
            )

    def test_put_feishu_webhook_credential_validates_non_empty(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": "   "},
            )
            self.assertEqual(resp.status_code, 422, resp.text)

    def test_put_feishu_webhook_credential_keeps_non_secret_fields(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)

            seed_payload = {
                "settings": {
                    "notifications": {
                        "feishu": {
                            "enabled": True,
                            "advice_time": "14:20",
                            "report_time": "15:30",
                            "timeout_seconds": 9,
                            "retry_times": 4,
                            "template": "custom_template",
                        }
                    }
                }
            }
            seed_resp = client.put("/api/settings", headers=headers, json=seed_payload)
            self.assertEqual(seed_resp.status_code, 200, seed_resp.text)

            webhook_url = "https://open.feishu.cn/open-apis/bot/v2/hook/credential-only-update"
            cred_resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            settings_resp = client.get("/api/settings", headers=headers)
            self.assertEqual(settings_resp.status_code, 200, settings_resp.text)
            feishu = settings_resp.json().get("settings", {}).get("notifications", {}).get("feishu", {})
            self.assertEqual(bool(feishu.get("enabled")), True)
            self.assertEqual(str(feishu.get("advice_time", "")), "14:20")
            self.assertEqual(str(feishu.get("report_time", "")), "15:30")
            self.assertEqual(int(feishu.get("timeout_seconds", 0)), 9)
            self.assertEqual(int(feishu.get("retry_times", 0)), 4)
            self.assertEqual(str(feishu.get("template", "")), "custom_template")
            self.assertEqual(str(feishu.get("webhook_url", "")), webhook_url)


if __name__ == "__main__":
    unittest.main()
