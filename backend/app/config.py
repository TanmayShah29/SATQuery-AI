"""Application configuration using pydantic-settings — Agent B (B-2).

Falls back to python-dotenv manual parsing when pydantic-settings is not installed,
so the app still works before requirements are updated.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
SAMPLE_DIR = DATA_DIR / "sample"
BENCHMARK_DIR = DATA_DIR / "benchmarks"
CACHE_DIR = DATA_DIR / "cache"
WEIGHTS_DIR = DATA_DIR / "weights"

# Load backend/.env if present (manual fallback for environments without pydantic-settings)
_env_file = BASE_DIR / "backend" / ".env"
if _env_file.exists():
    with open(_env_file, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

try:
    from functools import lru_cache
    from pydantic_settings import BaseSettings  # type: ignore[import]
    from pydantic import Field

    class Settings(BaseSettings):
        # App
        app_name: str = "SatQuery AI"
        version: str = "1.0.0"
        description: str = "Satellite Intelligence Platform — SIH26167"
        environment: str = Field(default="development", alias="SATQUERY_ENV")

        # Server
        host: str = "0.0.0.0"
        port: int = 8080

        # Paths
        base_dir: Path = BASE_DIR
        data_dir: Path = DATA_DIR
        sample_dir: Path = SAMPLE_DIR
        benchmark_dir: Path = BENCHMARK_DIR
        cache_dir: Path = CACHE_DIR
        weights_dir: Path = WEIGHTS_DIR
        upload_dir: Path = SAMPLE_DIR / "uploads"

        # External APIs
        bhuvan_api_key: str = Field(default="", alias="BHUVAN_API_KEY")
        bhuvan_theme: str = Field(default="LULC_AOI_Wise", alias="BHUVAN_THEME")
        mosdac_username: str = Field(default="", alias="MOSDAC_USERNAME")
        mosdac_password: str = Field(default="", alias="MOSDAC_PASSWORD")
        hf_token: str = Field(default="", alias="HF_TOKEN")

        # STAC
        stac_element84_url: str = "https://earth-search.aws.element84.com/v1/search"
        stac_planetary_url: str = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
        planetary_sas_url: str = "https://planetarycomputer.microsoft.com/api/sas/v1/sign"

        # ML / Ollama
        ollama_url: str = Field(default="http://127.0.0.1:11434", alias="OLLAMA_HOST")
        ollama_model: str = Field(default="qwen2.5:3b", alias="OLLAMA_MODEL")

        # Auth
        api_key: str = Field(default="", alias="SATQUERY_API_KEY")

        # Upload limits
        max_upload_size_mb: int = 100

        model_config = {
            "env_file": str(BASE_DIR / "backend" / ".env"),
            "env_file_encoding": "utf-8",
            "populate_by_name": True,
        }

    @lru_cache
    def get_settings() -> Settings:
        return Settings()

    settings = get_settings()

except ImportError:
    # Fallback when pydantic-settings is not yet installed
    from pydantic import BaseModel

    class Settings(BaseModel):  # type: ignore[no-redef]
        app_name: str = "SatQuery AI"
        version: str = "1.0.0"
        description: str = "Agentic Vision-Language Assistant for Multimodal Remote Sensing (SIH26167)"
        port: int = 8080
        host: str = "0.0.0.0"
        environment: str = os.getenv("SATQUERY_ENV", "development")

        # STAC Endpoints
        stac_element84_url: str = os.getenv(
            "STAC_ELEMENT84_URL", "https://earth-search.aws.element84.com/v1/search"
        )
        stac_planetary_url: str = os.getenv(
            "STAC_PLANETARY_URL",
            "https://planetarycomputer.microsoft.com/api/stac/v1/search",
        )
        planetary_sas_url: str = os.getenv(
            "PLANETARY_SAS_URL",
            "https://planetarycomputer.microsoft.com/api/sas/v1/sign",
        )

        # External APIs
        bhuvan_api_key: str = os.getenv("BHUVAN_API_KEY", "")
        bhuvan_theme: str = os.getenv("BHUVAN_THEME", "LULC_AOI_Wise")
        mosdac_username: str = os.getenv("MOSDAC_USERNAME", "")
        mosdac_password: str = os.getenv("MOSDAC_PASSWORD", "")
        hf_token: str = os.getenv("HF_TOKEN", "")

        # ML / Ollama
        ollama_url: str = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
        ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

        # Auth
        api_key: str = os.getenv("SATQUERY_API_KEY", "")

        # Upload limits
        max_upload_size_mb: int = 100

        # Paths
        base_dir: Path = BASE_DIR
        data_dir: Path = DATA_DIR
        sample_dir: Path = SAMPLE_DIR
        benchmark_dir: Path = BENCHMARK_DIR
        cache_dir: Path = CACHE_DIR
        weights_dir: Path = WEIGHTS_DIR
        upload_dir: Path = SAMPLE_DIR / "uploads"

    settings = Settings()
