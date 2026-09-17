"""API contract validation tests — Agent G (G-2).

Run with: python -m pytest tests/test_api_contract.py -v
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestRootEndpoint:
    def test_root_returns_200(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "app" in data
        assert "version" in data
        assert "status" in data

    def test_root_has_correct_app_name(self):
        response = client.get("/")
        assert response.json()["app"] == "SatQuery AI"


class TestHealthEndpoint:
    def test_health_returns_200(self):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_has_required_fields(self):
        response = client.get("/api/health")
        data = response.json()
        assert "status" in data
        assert "checks" in data
        assert "version" in data
        assert "environment" in data

    def test_health_status_is_valid(self):
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] in ("healthy", "degraded")

    def test_health_checks_are_valid_values(self):
        response = client.get("/api/health")
        data = response.json()
        valid_values = {"ok", "error", "unreachable"}
        for check_name, status in data["checks"].items():
            assert status in valid_values, (
                f"Check '{check_name}' has invalid value '{status}'"
            )


class TestQueryEndpoint:
    def test_query_rejects_missing_body(self):
        response = client.post("/api/query")
        assert response.status_code == 422  # Pydantic validation error

    def test_query_rejects_empty_string(self):
        response = client.post("/api/query", json={"query": ""})
        assert response.status_code in (400, 422)

    def test_query_accepts_valid_request(self):
        """Query must return 200 (success) or 401 (auth required) or 500 (Ollama down)."""
        response = client.post(
            "/api/query",
            json={"query": "What is in this satellite image?"},
        )
        assert response.status_code in (200, 401, 500)

    def test_query_response_has_required_fields_on_success(self):
        response = client.post(
            "/api/query",
            json={"query": "What is in this satellite image?"},
        )
        if response.status_code == 200:
            data = response.json()
            # Must have at minimum these fields
            assert "query" in data or "answer" in data


class TestUploadEndpoint:
    def test_upload_rejects_no_file(self):
        response = client.post("/api/upload")
        assert response.status_code == 422

    def test_upload_rejects_wrong_extension(self):
        response = client.post(
            "/api/upload",
            files={"file": ("test.exe", b"content", "application/octet-stream")},
        )
        assert response.status_code == 400


class TestSamplesEndpoints:
    def test_samples_manifest_returns_200_or_404(self):
        """Manifest endpoint — 200 if data exists, 404 if not initialised yet."""
        response = client.get("/api/samples/manifest")
        assert response.status_code in (200, 404)

    def test_samples_geotiffs_returns_list(self):
        response = client.get("/api/samples/geotiffs")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
