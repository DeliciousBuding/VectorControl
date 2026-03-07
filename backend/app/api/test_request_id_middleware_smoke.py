from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import REQUEST_DURATION_HEADER, REQUEST_ID_HEADER, app


class RequestIdMiddlewareSmokeTest(unittest.TestCase):
    def test_public_api_sets_request_id_header(self) -> None:
        with TestClient(app) as client:
            resp = client.get("/api/health")
            self.assertEqual(resp.status_code, 200, resp.text)
            request_id = str(resp.headers.get(REQUEST_ID_HEADER, "")).strip()
            elapsed_ms = str(resp.headers.get(REQUEST_DURATION_HEADER, "")).strip()
            self.assertTrue(request_id)
            self.assertGreaterEqual(len(request_id), 8)
            self.assertTrue(elapsed_ms)
            self.assertTrue(elapsed_ms.isdigit())

    def test_request_id_header_echoes_client_value(self) -> None:
        with TestClient(app) as client:
            incoming = "trace-client-001"
            resp = client.get("/api/health", headers={REQUEST_ID_HEADER: incoming})
            self.assertEqual(resp.status_code, 200, resp.text)
            self.assertEqual(str(resp.headers.get(REQUEST_ID_HEADER, "")), incoming)

    def test_unauthorized_response_also_has_request_id(self) -> None:
        with TestClient(app) as client:
            resp = client.get("/api/config")
            self.assertEqual(resp.status_code, 401, resp.text)
            request_id = str(resp.headers.get(REQUEST_ID_HEADER, "")).strip()
            self.assertTrue(request_id)

    def test_generated_request_id_is_not_reused_between_requests(self) -> None:
        with TestClient(app) as client:
            first = client.get("/api/health")
            second = client.get("/api/healthz")
            self.assertEqual(first.status_code, 200, first.text)
            self.assertEqual(second.status_code, 200, second.text)
            first_id = str(first.headers.get(REQUEST_ID_HEADER, "")).strip()
            second_id = str(second.headers.get(REQUEST_ID_HEADER, "")).strip()
            self.assertTrue(first_id)
            self.assertTrue(second_id)
            self.assertNotEqual(first_id, second_id)


if __name__ == "__main__":
    unittest.main()
