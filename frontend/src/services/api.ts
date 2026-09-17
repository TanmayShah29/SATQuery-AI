/**
 * SatQuery AI - Production Frontend API Client
 * Connects directly to FastAPI backend and live STAC satellite registries.
 *
 * HONESTY NOTE: this file intentionally does NOT fall back to fabricated data when
 * a request fails. Every function here either returns real backend data or throws /
 * returns an explicit error/empty state that the UI must handle honestly.
 */

import type { QueryResponse, ModalityMode } from '../types';

const API_BASE = '/api';

export interface QueryOptions {
  bbox?: [number, number, number, number];
  modality?: ModalityMode;
  sectorId?: string;
  contextHints?: Record<string, any>;
  uploadedFile?: string;
  confidenceThreshold?: number;
  iouThreshold?: number;
  radarThreshold?: number;
}

export async function submitSatQuery(
  query: string,
  options: QueryOptions = {},
  signal?: AbortSignal
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      bbox: options.bbox || null,
      modality: options.modality || 'cross_modal',
      sector_id: options.sectorId || null,
      context_hints: options.contextHints || {},
      uploaded_file: options.uploadedFile || null,
      confidence_threshold: options.confidenceThreshold,
      iou_threshold: options.iouThreshold,
      radar_threshold: options.radarThreshold,
    }),
    signal,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Authentication required. Check X-API-Key header.');
    throw new Error(`Backend error (${res.status}): ${res.statusText}`);
  }

  const payload = (await res.json()) as QueryResponse;

  // HONESTY: the agent's map/dashboard actions are a closed contract. If the
  // backend omits or malforms the field (version skew), surface it instead of
  // letting the DAG actuation node sit on 'pending' with no explanation.
  if (!Array.isArray(payload.ui_actions)) {
    console.warn(
      '[API] /query returned no `ui_actions` array — the agent proposed no map/dashboard actions for this query.'
    );
    payload.ui_actions = [];
  }
  if (payload.ui_actions_source !== 'rule_based' && payload.ui_actions_source !== 'llm_planned') {
    payload.ui_actions_source = undefined;
  }

  return payload;
}

export async function fetchPrecalibratedGeoTIFFs() {
  try {
    const res = await fetch(`${API_BASE}/samples/geotiffs`);
    if (!res.ok) throw new Error('Failed to fetch GeoTIFFs');
    return await res.json();
  } catch (err) {
    console.warn('[API] Failed to fetch precalibrated GeoTIFFs:', err);
    return [];
  }
}

export interface STACSearchOptions {
  lat: number;
  lon: number;
  collection?: 'sentinel-2-l2a' | 'sentinel-1-grd';
  delta?: number;
  datetime?: string;
  limit?: number;
}

export async function searchLiveSTAC(options: STACSearchOptions) {
  try {
    const res = await fetch(`${API_BASE}/stac/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection: options.collection || 'sentinel-2-l2a',
        lat: options.lat,
        lon: options.lon,
        delta: options.delta || 0.08,
        datetime: options.datetime || '2024-01-01T00:00:00Z/2024-05-31T23:59:59Z',
        limit: options.limit || 3,
      }),
    });

    if (!res.ok) {
      throw new Error(`STAC search failed: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.warn('[STAC API] Live STAC query error:', err);
    // Honest empty result: no fabricated scene with a fake ID/thumbnail/cloud cover.
    return { status: 'error', count: 0, scenes: [] };
  }
}

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (!res.ok) throw new Error('Health check error');
    return await res.json();
  } catch (err) {
    // Honest: backend is actually unreachable, do not claim "healthy_local".
    return { status: 'offline' };
  }
}

export async function fetchSampleManifest() {
  try {
    const res = await fetch(`${API_BASE}/samples/manifest`);
    if (!res.ok) throw new Error('Manifest error');
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchBenchmarkCatalog() {
  try {
    const res = await fetch(`${API_BASE}/benchmark/catalog`);
    if (!res.ok) throw new Error('Benchmark catalog error');
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function evaluateBenchmark(payload: {
  query: string;
  groundTruth: string;
  modality?: ModalityMode;
  sectorId?: string;
  bbox?: [number, number, number, number];
}) {
  const res = await fetch(`${API_BASE}/benchmark/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: payload.query,
      ground_truth: payload.groundTruth,
      modality: payload.modality || 'cross_modal',
      sector_id: payload.sectorId,
      bbox: payload.bbox,
    }),
  });

  if (!res.ok) {
    throw new Error('Benchmark evaluation failed');
  }
  return await res.json();
}

export async function uploadDatasetFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errData = await res.json();
      if (errData?.detail) detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      else if (errData?.message) detail = errData.message;
    } catch {
      // not json
    }
    throw new Error(`Upload rejected (${res.status}): ${detail}`);
  }

  return await res.json();
}

export async function fetchAIStatus() {
  try {
    const res = await fetch(`${API_BASE}/settings/ai-status`);
    if (!res.ok) throw new Error('Failed to fetch AI status');
    return await res.json();
  } catch (err) {
    console.warn('[AI API] Failed to fetch AI status:', err);
    return {
      active_mode: 'offline',
      active_model: 'Unavailable (Backend Offline)',
      isro_sac_compliant: false,
      disqualification_safeguard: 'Status Unknown (Backend Unreachable)',
      hardware_acceleration: 'Disconnected',
      live_data_sources: [],
    };
  }
}

export async function inspectPixelPoint(payload: {
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  filename?: string;
}) {
  try {
    const res = await fetch(`${API_BASE}/inspect-pixel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lat: payload.lat,
        lon: payload.lon,
        bbox: payload.bbox,
        filename: payload.filename,
      }),
    });
    if (!res.ok) throw new Error('Pixel inspection failed');
    return await res.json();
  } catch (err) {
    console.warn('[Pixel API] Inspection error:', err);
    return null;
  }
}


