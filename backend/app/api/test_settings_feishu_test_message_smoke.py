from __future__ import annotations

import json
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class SettingsFeishuTestMessageSmokeTest(unittest.TestCase):
    def _register_headers(self, client: TestClient, prefix: str = "fshtst") -> dict[str, str]:
        username = f"{prefix}_{uuid.uuid4().hex[:10]}"
        resp = client.post("/api/auth/register", json={"username": username, "password": "pass_123456"})
        self.assertEqual(resp.status_code, 200, resp.text)
        token = str(resp.json()["token"])
        return {"Authorization": f"Bearer {token}"}

    def test_post_feishu_test_message_success_and_no_webhook_echo(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            webhook_url = "https://open.feishu.cn/REDACTED"

            cred_resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            with patch("app.api.routers.settings.feishu_mod._http_post_json") as mocked_post:
                mocked_post.return_value = (200, {"StatusCode": 0, "StatusMessage": "success", "data": {"message_id": "m1"}})
                resp = client.post(
                    "/api/settings/notifications/feishu/test_message",
                    headers=headers,
                )

            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), True)
            self.assertEqual(bool(body.get("sent")), True)
            self.assertIsNone(body.get("error"))
            self.assertNotIn(webhook_url, json.dumps(body, ensure_ascii=False))

    def test_post_feishu_test_message_unauthorized_is_explainable(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            webhook_url = "https://open.feishu.cn/REDACTED"

            cred_resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            with patch("app.api.routers.settings.feishu_mod._http_post_json") as mocked_post:
                mocked_post.return_value = (401, {"code": 401, "msg": "Unauthorized"})
                resp = client.post(
                    "/api/settings/notifications/feishu/test_message",
                    headers=headers,
                )

            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), False)
            self.assertEqual(bool(body.get("sent")), False)
            self.assertEqual(str(body.get("error", {}).get("category")), "unauthorized")
            self.assertTrue(str(body.get("error", {}).get("message", "")).strip())
            self.assertNotIn(webhook_url, json.dumps(body, ensure_ascii=False))

    def test_post_feishu_test_message_missing_credential_is_422(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            resp = client.post(
                "/api/settings/notifications/feishu/test_message",
                headers=headers,
            )
            self.assertEqual(resp.status_code, 422, resp.text)


    def test_post_feishu_test_message_invalid_scheme_is_handled(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            # Use http instead of https
            webhook_url = "http://open.feishu.cn/REDACTED"

            cred_resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            # _http_post_json won't be called if validation fails early.
            # No need to patch it here.
            resp = client.post(
                "/api/settings/notifications/feishu/test_message",
                headers=headers,
            )
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), False)
            self.assertEqual(bool(body.get("sent")), False)
            self.assertEqual(str(body.get("error", {}).get("category")), "invalid_webhook_url")
            self.assertTrue(str(body.get("error", {}).get("message", "")).strip())


    def test_post_feishu_test_message_invalid_host_is_handled(self) -> None:
        with TestClient(app) as client:
            headers = self._register_headers(client)
            # Use wrong host
            webhook_url = "https://wrong.feishu.cn/REDACTED"

            cred_resp = client.put(
                "/api/settings/notifications/feishu/webhook",
                headers=headers,
                json={"webhook_url": webhook_url},
            )
            self.assertEqual(cred_resp.status_code, 200, cred_resp.text)

            # _http_post_json won't be called if validation fails early.
            # No need to patch it here.
            resp = client.post(
                "/api/settings/notifications/feishu/test_message",
                headers=headers,
            )
            self.assertEqual(resp.status_code, 200, resp.text)
            body = resp.json()
            self.assertEqual(bool(body.get("ok")), False)
            self.assertEqual(bool(body.get("sent")), False)
            self.assertEqual(str(body.get("error", {}).get("category")), "invalid_webhook_url")
            self.assertTrue(str(body.get("error", {}).get("message", "")).strip())


if __name__ == "__main__":
    unittest.main()
