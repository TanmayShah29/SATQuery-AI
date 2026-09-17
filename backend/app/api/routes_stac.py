"""
SatQuery AI - STAC Satellite Query API Router
Connects directly to live AWS Element84 and Microsoft Planetary Computer catalogs.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import requests
from ..config import settings

router = APIRouter(prefix="/api/stac", tags=["stac"])


class STACSearchRequest(BaseModel):
    collection: str = Field(default="sentinel-2-l2a", description="sentinel-2-l2a or sentinel-1-grd")
    lat: float = Field(default=23.03, description="Latitude center point")
    lon: float = Field(default=72.58, description="Longitude center point")
    delta: float = Field(default=0.08, description="Bounding box half-width in degrees")
    datetime: str = Field(default="2024-01-01T00:00:00Z/2024-05-31T23:59:59Z")
    max_cloud_cover: float = Field(default=15.0, description="Max optical cloud cover %")
    limit: int = Field(default=3, ge=1, le=10)


def sign_planetary_url(href: str) -> str:
    """Signs Planetary Computer SAS URLs."""
    try:
        sign_url = f"{settings.planetary_sas_url}?href={href}"
        r = requests.get(sign_url, timeout=6)
        if r.status_code == 200:
            return r.json().get("href", href)
    except Exception:
        pass
    return href


@router.post("/search")
def search_stac(req: STACSearchRequest):
    """Executes live STAC search against open satellite registries."""
    bbox = [req.lon - req.delta, req.lat - req.delta, req.lon + req.delta, req.lat + req.delta]
    
    if req.collection == "sentinel-2-l2a":
        payload = {
            "collections": ["sentinel-2-l2a"],
            "bbox": bbox,
            "datetime": req.datetime,
            "query": {"eo:cloud_cover": {"lt": req.max_cloud_cover}},
            "limit": req.limit,
            "sortby": [{"field": "properties.datetime", "direction": "desc"}]
        }
        try:
            resp = requests.post(settings.stac_element84_url, json=payload, timeout=12)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            
            results = []
            for f in features:
                props = f.get("properties", {})
                assets = f.get("assets", {})
                results.append({
                    "id": f.get("id"),
                    "sensor": "Sentinel-2 MSI",
                    "datetime": props.get("datetime"),
                    "cloud_cover": props.get("eo:cloud_cover", 0.0),
                    "thumbnail_url": assets.get("thumbnail", {}).get("href"),
                    "visual_cog_url": assets.get("visual", {}).get("href"),
                    "red_cog_url": assets.get("red", {}).get("href"),
                    "nir_cog_url": assets.get("nir", {}).get("href"),
                    "bbox": f.get("bbox", bbox)
                })
            return {"status": "success", "count": len(results), "scenes": results}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Sentinel-2 STAC Query failed: {str(e)}")
            
    elif req.collection == "sentinel-1-grd":
        payload = {
            "collections": ["sentinel-1-grd"],
            "bbox": bbox,
            "datetime": req.datetime,
            "limit": req.limit
        }
        try:
            resp = requests.post(settings.stac_planetary_url, json=payload, timeout=12)
            resp.raise_for_status()
            features = resp.json().get("features", [])
            
            results = []
            for f in features:
                props = f.get("properties", {})
                assets = f.get("assets", {})
                vv_raw = assets.get("vv", {}).get("href", "")
                vh_raw = assets.get("vh", {}).get("href", "")
                quicklook = assets.get("thumbnail", {}).get("href", "")
                
                results.append({
                    "id": f.get("id"),
                    "sensor": "Sentinel-1 C-SAR (Radar)",
                    "datetime": props.get("datetime"),
                    "polarizations": ["VV", "VH"],
                    "quicklook_url": sign_planetary_url(quicklook) if quicklook else None,
                    "vv_stream_url": sign_planetary_url(vv_raw) if vv_raw else None,
                    "vh_stream_url": sign_planetary_url(vh_raw) if vh_raw else None,
                    "bbox": f.get("bbox", bbox)
                })
            return {"status": "success", "count": len(results), "scenes": results}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Sentinel-1 SAR STAC Query failed: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported collection: {req.collection}")


@router.get("/quick-search")
def quick_stac_search(
    lat: float = 23.03,
    lon: float = 72.58,
    collection: str = "sentinel-2-l2a",
    delta: float = 0.08,
    limit: int = 3
):
    """Convenience GET endpoint for live STAC satellite pass queries."""
    req = STACSearchRequest(
        lat=lat,
        lon=lon,
        collection=collection,
        delta=delta,
        limit=limit
    )
    return search_stac(req)
