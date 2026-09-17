"""Benchmark API schemas — Agent B (B-3)."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Tuple


class BenchmarkRequest(BaseModel):
    dataset: str = Field("internal_validation", description="Dataset identifier")
    n_bootstrap: int = Field(1000, ge=100, le=10000, description="Bootstrap resampling iterations for CI")


class BenchmarkResponse(BaseModel):
    top1_accuracy: float
    top1_ci_95: Tuple[float, float]
    top3_accuracy: float
    f1_macro: float
    f1_ci_95: Tuple[float, float]
    precision_macro: float
    recall_macro: float
    n_samples: int
    n_classes: int
    methodology: str
