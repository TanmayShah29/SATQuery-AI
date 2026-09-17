"""
SatQuery AI - Canonical Model & Tool Registry
Target: SIH26167 (ISRO / Space Applications Centre) §4, §6

Provides a single authoritative registry for all operational specialist algorithms,
neural foundation backbones, and digital signal processing (DSP) pipelines.
Eliminates fabricated model provenance, ensuring 100% honesty across DAG planning,
evidence synthesis, telemetry, and frontend HUD displays.
"""

from typing import Dict, Any


MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "optical_vqa": {
        "id": "remote_clip_vit_b32_vqa",
        "canonical_name": "RemoteCLIP-ViT-B/32 (RS Foundation Backbone + BigEarthNet VQA Adapter)",
        "short_name": "RemoteCLIP-ViT-B/32 VQA",
        "task": "Single-Image Optical Visual Question Answering",
        "modality": "single_image",
        "algorithm_type": "Neural Dual-Tower Transformer (ViT-B/32 + Text Transformer)",
        "provenance": "RemoteCLIP-ViT-B/32 remote-sensing foundation backbone + BigEarthNet domain adapter fine-tuned on 84 real samples (58 train / 26 eval; see data/weights/training_metrics.json)",
        "grounding_tool": "Adaptive Connected-Component Spatial Vectorizer",
    },
    "visual_grounding": {
        "id": "remote_clip_visual_grounding",
        "canonical_name": "Text-Guided Region Grounding & Shapely Topological Vectorizer",
        "short_name": "Text-Guided Visual Grounding",
        "task": "Text-Guided Bounding Box & Polygon Region Grounding",
        "modality": "single_image",
        "algorithm_type": "Cross-Attention Feature Heatmap & Topological Contour Boundary Extraction",
        "provenance": "Multi-spectral class-activation thresholding + Shapely morphological contour extraction; no supervised grounding fine-tune",
        "grounding_tool": "Shapely Boundary Contour Vectorizer",
    },
    "scene_captioning": {
        "id": "remote_clip_scene_captioner",
        "canonical_name": "Remote-Sensing Scene Captioning & Land-Cover Multi-Spectral Profiler",
        "short_name": "Scene Description Engine",
        "task": "Single-Image Scene Description & Multi-Spectral Band Profiling",
        "modality": "single_image",
        "algorithm_type": "Generative Vision-Language Feature Synthesis + Band Ratio Analyzer",
        "provenance": "Local Qwen2.5-3B (Ollama) narrative synthesis over measured multi-spectral + RemoteCLIP features; DSP-only when Ollama is offline (no scripted template)",
        "grounding_tool": "Adaptive Connected-Component Spatial Vectorizer",
    },
    "bitemporal_change": {
        "id": "bitemporal_radiometric_otsu",
        "canonical_name": "Bi-Temporal Radiometric Differencing & Otsu Adaptive Clustering",
        "short_name": "BiTemporal Differencing (Otsu DSP)",
        "task": "Multi-Image Temporal Change Detection & Surface Quantification",
        "modality": "bitemporal",
        "algorithm_type": "Classical Radiometric Differencing & Otsu Inter-Class Variance Optimization",
        "provenance": "Luminance ITU-R BT.601 Differencing with Adaptive Histogram Binarization",
        "grounding_tool": "Adaptive Connected-Component Spatial Vectorizer",
    },
    "crossmodal_fusion": {
        "id": "sar_lee_speckle_fusion",
        "canonical_name": "Adaptive 5x5 Lee Speckle Filter & Dual-Pol (VV/VH) Scatterer Isolation",
        "short_name": "SAR Cloud Piercing (5x5 Lee Filter)",
        "task": "Cross-Modal Optical + SAR Cloud Penetration & Dielectric Target Isolation",
        "modality": "cross_modal",
        "algorithm_type": "Microwave Minimum Mean Square Error (MMSE) Filtering & Dielectric Backscatter Extraction",
        "provenance": "5x5 Adaptive Lee Speckle Filter with Sentinel-1 Dual-Pol Ratio Analysis",
        "grounding_tool": "Adaptive Connected-Component Spatial Vectorizer",
    },
    "sar_vqa": {
        "id": "sar_polarimetric_analysis",
        "canonical_name": "Adaptive 5x5 Lee Speckle Filter & Dual-Pol (VV/VH) Scatterer Isolation",
        "short_name": "SAR Microwave Polarimetry",
        "task": "Synthetic Aperture Radar Backscatter & Structural VQA",
        "modality": "cross_modal",
        "algorithm_type": "Microwave Radar Backscatter Analysis (sigma0 in dB)",
        "provenance": "Sentinel-1 IW GRD Dual-Pol (VV/VH) Radiometric Backscatter Head",
        "grounding_tool": "Adaptive Connected-Component Spatial Vectorizer",
    },
    "spatial_vectorizer": {
        "id": "spatial_vectorizer",
        "canonical_name": "Adaptive Connected-Component Spatial Vectorizer",
        "short_name": "Spatial Mask Vectorizer",
        "task": "Raster-to-Vector Georeferenced Polygon Delineation",
        "modality": "all",
        "algorithm_type": "Shapely Topological Delineation with Ground Sample Distance (GSD) Area Integration",
        "provenance": "Metric polygon delineation in AOI bounding-box coordinate frame (WGS84 degrees); image-space alignment, not CRS-reprojected when raster lacks georeferencing",
        "grounding_tool": "Shapely & OpenCV Boundary Polygonizer",
    }
}
