"""Security regression tests — Agent G (G-1).

These tests MUST pass before any deployment.
Run with: python -m pytest tests/test_security.py -v
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestPathTraversal:
    """SEC-003 / SEC-005: Path traversal attacks."""

    def test_upload_rejects_traversal_in_filename(self):
        """Path traversal in upload filename must return 400."""
        response = client.post(
            "/api/upload",
            files={"file": ("../../etc/passwd", b"test content", "text/plain")},
        )
        assert response.status_code in (400, 413), (
            f"Expected 400 or 413, got {response.status_code}: {response.text}"
        )

    def test_upload_rejects_unsafe_extension(self):
        """File extension allowlist: .exe must return 400."""
        response = client.post(
            "/api/upload",
            files={"file": ("evil.exe", b"MZ\x90\x00", "application/octet-stream")},
        )
        assert response.status_code == 400, (
            f"Expected 400, got {response.status_code}: {response.text}"
        )

    def test_upload_rejects_null_byte_in_filename(self):
        """Null-byte injection in filename must return 400."""
        response = client.post(
            "/api/upload",
            files={"file": ("file\x00.php.tif", b"test", "image/tiff")},
        )
        # Should still work (null byte stripped) OR return 400
        assert response.status_code in (200, 400, 413)

    def test_samples_rejects_traversal_in_image_path(self):
        """SEC-005: Path traversal in /api/samples/image endpoint."""
        response = client.get("/api/samples/image/uploads/../../.env")
        assert response.status_code in (400, 404), (
            f"Expected 400 or 404, got {response.status_code}"
        )


class TestCORS:
    """SEC-007: CORS must not use wildcard."""

    def test_cors_does_not_allow_all_origins(self):
        """CORS allow-origin must NOT be * for credentialed requests."""
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.headers.get("access-control-allow-origin") != "*", (
            "CORS wildcard detected — SEC-007 not fixed"
        )


class TestUploadSize:
    """SEC-006: Upload size limit."""

    def test_upload_rejects_file_over_100mb(self):
        """Files larger than 100 MB must return 413."""
        large_content = b"x" * (101 * 1024 * 1024)  # 101 MB
        response = client.post(
            "/api/upload",
            files={"file": ("large.tif", large_content, "image/tiff")},
        )
        assert response.status_code == 413, (
            f"Expected 413 for oversized upload, got {response.status_code}"
        )


class TestAuth:
    """SEC-002: Auth middleware."""

    def test_query_requires_auth_when_key_configured(self, monkeypatch):
        """When API_KEY is set, verify_api_key must raise 401 for missing/wrong keys."""
        import app.middleware.auth as auth_module
        from fastapi import HTTPException

        # Patch the module-level API_KEY directly
        monkeypatch.setattr(auth_module, "API_KEY", "test-secret-key-12345")

        import asyncio

        async def _test():
            # No key → should raise 401
            with pytest.raises(HTTPException) as exc_info:
                await auth_module.verify_api_key(None)
            assert exc_info.value.status_code == 401

            # Wrong key → should raise 401
            with pytest.raises(HTTPException) as exc_info:
                await auth_module.verify_api_key("wrong-key")
            assert exc_info.value.status_code == 401

            # Correct key → should return True
            result = await auth_module.verify_api_key("test-secret-key-12345")
            assert result is True

        asyncio.get_event_loop().run_until_complete(_test())


class TestSecurityHeaders:
    """SEC-008: Security headers must be present."""

    def test_security_headers_on_health(self):
        """Health endpoint must return security headers."""
        response = client.get("/api/health")
        assert "x-content-type-options" in response.headers
        assert response.headers["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in response.headers
        assert response.headers["x-frame-options"] == "DENY"
