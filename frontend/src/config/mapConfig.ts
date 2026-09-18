import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapMode, ProjectionMode } from '../types';

export const TILE_SOURCES = {
  esriDarkGray: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  esriDarkLabels: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  esriSatellite: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  esriSatLabels: 'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  // Sentinel-2 L2A optical simulation or false color IR
  sentinelOpticalT1: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export const INITIAL_MAP_STATE = {
  lng: 78.9629,
  lat: 20.5937,
  zoom: 3.5,
  pitch: 35,
  bearing: 0,
};

export function createMapLibreStyle(mode: BasemapMode, projectionType: ProjectionMode = 'globe'): StyleSpecification {
  const isDark = mode === 'dark';

  return {
    version: 8,
    name: isDark ? 'SatQuery AI Dark Canvas' : 'SatQuery AI High-Res Imagery',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    projection: { type: projectionType },
    sources: {
      'base-tiles': {
        type: 'raster',
        tiles: [
          isDark
            ? TILE_SOURCES.esriDarkGray
            : TILE_SOURCES.esriSatellite,
        ],
        tileSize: 256,
        attribution: isDark ? 'Esri, HERE, Garmin, © OpenStreetMap' : 'Esri, Maxar, Earthstar Geographics',
        maxzoom: 19,
      },
      'reference-tiles': {
        type: 'raster',
        tiles: [
          isDark
            ? TILE_SOURCES.esriDarkLabels
            : TILE_SOURCES.esriSatLabels,
        ],
        tileSize: 256,
        attribution: '',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'base-space-background',
        type: 'background',
        paint: {
          'background-color': '#080A0F',
          'background-opacity': 1.0,
        },
      },
      {
        id: 'base-tiles-layer',
        type: 'raster',
        source: 'base-tiles',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': 1.0,
          'raster-contrast': isDark ? 0.15 : 0.14,
          'raster-saturation': isDark ? -0.2 : 0.35,
          'raster-brightness-min': isDark ? 0.0 : 0.04,
          'raster-brightness-max': 1.0,
        },
      },
      {
        id: 'reference-tiles-layer',
        type: 'raster',
        source: 'reference-tiles',
        minzoom: 1,
        maxzoom: 22,
        paint: {
          'raster-opacity': isDark ? 0.75 : 0.65,
        },
      },
    ],
  };
}

/**
 * Bi-temporal T1 Baseline Style (Pre-Event Epoch)
 *
 * Plain, non-hue-rotated basemap used as the backdrop under the swipe map's
 * real T1 sector raster overlay. The old raster-hue-rotate(160) "CIR
 * simulation" was standing in for real T1 imagery and is removed — the real
 * T1 raster is now loaded directly as an 'image' source (see MapCanvas.tsx
 * effect #7). If a CIR/NIR toggle is desired it must be an explicit user
 * choice, not the default when comparing T1 vs T2.
 */
export function createBitemporalBaselineStyle(projectionType: ProjectionMode = 'globe'): StyleSpecification {
  return {
    version: 8,
    name: 'SatQuery Bi-Temporal Basemap Context',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    projection: { type: projectionType },
    sources: {
      't1-base-tiles': {
        type: 'raster',
        tiles: [
          TILE_SOURCES.esriSatellite,
        ],
        tileSize: 256,
        attribution: 'Esri, Maxar, Earthstar Geographics (context basemap)',
        maxzoom: 19,
      },
      't1-reference-tiles': {
        type: 'raster',
        tiles: [
          TILE_SOURCES.esriSatLabels,
        ],
        tileSize: 256,
        attribution: '',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 't1-space-background',
        type: 'background',
        paint: {
          'background-color': '#080A0F',
          'background-opacity': 1.0,
        },
      },
      {
        id: 't1-base-tiles-layer',
        type: 'raster',
        source: 't1-base-tiles',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': 1.0,
          'raster-contrast': 0.14,
          'raster-saturation': 0.35,
          'raster-brightness-min': 0.04,
          'raster-brightness-max': 1.0,
        },
      },
      {
        id: 't1-reference-tiles-layer',
        type: 'raster',
        source: 't1-reference-tiles',
        minzoom: 1,
        maxzoom: 22,
        paint: {
          'raster-opacity': 0.65,
        },
      },
    ],
  };
}

