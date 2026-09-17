"""API Key authentication middleware — Agent A (A-5)."""
import os
from fastapi import Request, HTTPException, Security
from fastapi.security import APIKeyHeader

API_KEY = os.getenv("SATQUERY_API_KEY", "")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    """Require a valid API key for protected endpoints.

    If SATQUERY_API_KEY is not configured (development), all requests are allowed.
    """
    if not API_KEY:
        # Development mode: no key configured, allow all
        return True
    if api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Provide X-API-Key header.",
        )
    return True
