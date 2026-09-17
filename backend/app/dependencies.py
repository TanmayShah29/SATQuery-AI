"""FastAPI dependency injection — Agent B (B-5)."""
from functools import lru_cache
from .services.query_service import QueryService


@lru_cache
def get_query_service() -> QueryService:
    return QueryService()
