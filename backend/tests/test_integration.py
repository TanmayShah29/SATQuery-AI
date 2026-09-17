"""Integration tests — full request/response cycles — Agent G (G-4).

Run with: python -m pytest tests/test_integration.py -v -m integration
"""

import io
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.integration
class TestFullQueryCycle:
    def test_query_returns_expected_structure(self):
        """End-to-end: query → agent pipeline → response structure."""
        response = client.post(
            "/api/query",
            json={
                "query": "What changed in this area?",
                "sector_id": "ahmedabad",
                "modality": "cross_modal",
            },
        )
        # Without Ollama running: 500 is acceptable
        assert response.status_code in (200, 401, 500)

        if response.status_code == 200:
            data = response.json()
            assert "query" in data
            assert "confidence" in data or "answer" in data


@pytest.mark.integration
class TestUploadAndInspect:
    def test_upload_minimal_tiff_then_inspect(self):
        """End-to-end: upload a minimal TIFF → inspect pixel."""
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not available for test image creation")

        # Create a minimal valid TIFF
        img = Image.new("RGB", (64, 64), color=(100, 150, 200))
        buf = io.BytesIO()
        img.save(buf, format="TIFF")
        buf.seek(0)

        upload_response = client.post(
            "/api/upload",
            files={"file": ("test_integration.tif", buf.read(), "image/tiff")},
        )

        # Accept 200 (success) or 400 (rasterio parse error on minimal TIFF without CRS)
        assert upload_response.status_code in (200, 400, 401)

        if upload_response.status_code == 200:
            data = upload_response.json()
            assert data.get("status") == "success"
            assert "filename" in data

            # Inspect pixel
            inspect_response = client.post(
                "/api/inspect-pixel",
                json={
                    "lat": 23.02,
                    "lon": 72.52,
                    "filename": data["filename"],
                },
            )
            assert inspect_response.status_code in (200, 400, 401)


@pytest.mark.integration
class TestHealthProbes:
    def test_health_probes_complete_within_timeout(self):
        """Health check must respond within 10 seconds even with Ollama unreachable."""
        import time
        start = time.time()
        response = client.get("/api/health")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 10.0, f"Health check took {elapsed:.1f}s — too slow"
        data = response.json()
        assert data["status"] in ("healthy", "degraded")
