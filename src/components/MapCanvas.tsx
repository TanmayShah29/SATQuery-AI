import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import type {
  TacticalGlobePin,
  CategoryType,
  BasemapMode,
  ProjectionMode,
  QueryResponse,
  LayerConfig,
  SensorBand,
  SatellitePass,
  PixelInspectResult,
} from '../types';
import { createMapLibreStyle, createBitemporalBaselineStyle, TILE_SOURCES } from '../config/mapConfig';
import { getSectorGeoJSON } from '../config/tacticalData';
import { inspectPixelPoint } from '../services/api';
import {
  type MapCanvasHandle,
} from '../services/mapHandle';
import {
  Compass,
  Eye,
  Radio,
  Shield,
  Sparkles,
  Plus,
  Minus,
  Crosshair,
  Layers,
  SplitSquareVertical,
  Globe,
  Map as MapIcon,
  Satellite,
  Moon,
  Locate,
  X,
  MapPin,
  Square,
  FileText,
  Target,
} from 'lucide-react';
import { ProvenanceBadge } from './ui/ProvenanceBadge';
import { AoiDrawTool } from './AoiDrawTool';
import { FeatureInspectModal, type InspectedFeatureData } from './FeatureInspectModal';
import { TacticalBriefingModal } from './TacticalBriefingModal';

interface MapCanvasProps {
  pins: TacticalGlobePin[];
  selectedCategory: CategoryType;
  selectedPin: TacticalGlobePin | null;
  onSelectPin: (pin: TacticalGlobePin) => void;
  basemap: BasemapMode;
  projection: ProjectionMode;
  swipeActive: boolean;
  queryResponse: QueryResponse | null;
  layers: LayerConfig[];
  onViewportChange: (viewport: { lat: number; lng: number; zoom: number }) => void;
  onToggleLayersDrawer?: () => void;
  layersDrawerOpen?: boolean;
  activeLayersCount?: number;
  onToggleSwipe?: () => void;
  onToggleProjection?: () => void;
  onToggleBasemap?: () => void;
  hideSwipeBadges?: boolean;
  sliderPercent?: number;
  onSliderChange?: (val: number) => void;
  t1Date?: string;
  t2Date?: string;
  activeSensorBand?: SensorBand;
  onChangeSensorBand?: (band: SensorBand) => void;
  activePass?: SatellitePass | null;
  temporalProgress?: number;
  isLandingMode?: boolean;
  isLaunching?: boolean;
  isDrawingAoi?: boolean;
  onToggleDrawAoi?: () => void;
  drawnAoi?: [number, number, number, number] | null;
  onDrawnAoiChange?: (aoi: [number, number, number, number] | null) => void;
  onQueryFollowup?: (query: string) => void;
  isBriefingModalOpen?: boolean;
  onCloseBriefingModal?: () => void;
}

interface TooltipInfo {
  x: number;
  y: number;
  pin: TacticalGlobePin;
}

const SECTOR_BOUNDS_MAP: Record<string, { lonSpan: number; latSpan: number }> = {
  'brahmaputra-flood': { lonSpan: 0.05, latSpan: 0.035 },
  'isro-sac': { lonSpan: 0.016, latSpan: 0.012 },
  'sdsc-sriharikota': { lonSpan: 0.025, latSpan: 0.020 },
  'galwan-sar': { lonSpan: 0.035, latSpan: 0.025 },
  'delhi-urban-sprawl': { lonSpan: 0.04, latSpan: 0.03 },
  'vizag-port': { lonSpan: 0.03, latSpan: 0.025 },
  'pokhran-range': { lonSpan: 0.03, latSpan: 0.025 },
  'malacca-chokepoint': { lonSpan: 0.04, latSpan: 0.03 },
  'malacca-strait': { lonSpan: 0.04, latSpan: 0.03 },
  'suez-canal': { lonSpan: 0.035, latSpan: 0.025 },
  'diego-garcia': { lonSpan: 0.030, latSpan: 0.022 },
  'taiwan-strait': { lonSpan: 0.045, latSpan: 0.035 },
  'tarapur-npp': { lonSpan: 0.020, latSpan: 0.015 },
  'bab-el-mandeb': { lonSpan: 0.040, latSpan: 0.030 },
  'joshimath-subsidence': { lonSpan: 0.020, latSpan: 0.016 },
  'siachen-glacier': { lonSpan: 0.035, latSpan: 0.028 },
};

function getSectorRasterCoordinates(pin: TacticalGlobePin): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const span = SECTOR_BOUNDS_MAP[pin.id] || { lonSpan: 0.02, latSpan: 0.015 };
  return [
    [pin.lon - span.lonSpan, pin.lat + span.latSpan], // Top-Left [lng, lat]
    [pin.lon + span.lonSpan, pin.lat + span.latSpan], // Top-Right [lng, lat]
    [pin.lon + span.lonSpan, pin.lat - span.latSpan], // Bottom-Right [lng, lat]
    [pin.lon - span.lonSpan, pin.lat - span.latSpan], // Bottom-Left [lng, lat]
  ];
}

function getSectorRasterUrl(pin: TacticalGlobePin, band: SensorBand): string {
  return `/api/samples/sector-asset/${pin.id}/${band.toLowerCase()}`;
}

function scaleRing(ring: [number, number][], scale: number): [number, number][] {
  if (!ring || ring.length === 0) return ring;
  let sumX = 0;
  let sumY = 0;
  const count = ring.length;
  for (let i = 0; i < count; i++) {
    sumX += ring[i][0];
    sumY += ring[i][1];
  }
  const cX = sumX / count;
  const cY = sumY / count;

  return ring.map(([x, y]) => [
    cX + (x - cX) * scale,
    cY + (y - cY) * scale,
  ]);
}

function scaleGeoJSONFeatures(
  fc: GeoJSON.FeatureCollection,
  progressRatio: number
): GeoJSON.FeatureCollection {
  const clampedRatio = Math.max(0, Math.min(1, progressRatio));
  const deltaScale = 0.10 + 0.90 * clampedRatio;

  return {
    ...fc,
    features: (fc.features || []).map((feature) => {
      if (!feature.geometry) return feature;

      const featName = String(feature.properties?.name || '').toLowerCase();
      const featClass = String(feature.properties?.class || '').toLowerCase();

      // Check if feature is a static baseline facility or a temporal change/inundation feature
      const isStaticBaseline =
        (featClass.includes('institutional building') || featClass.includes('secure perimeter')) &&
        !featName.includes('delta') &&
        !featClass.includes('delta') &&
        !featClass.includes('expansion');

      const effectiveScale = isStaticBaseline ? 0.90 + 0.10 * clampedRatio : deltaScale;

      if (feature.geometry.type === 'Polygon') {
        const rings = feature.geometry.coordinates as [number, number][][];
        const scaledRings = rings.map((r, idx) => (idx === 0 ? scaleRing(r, effectiveScale) : r));
        return {
          ...feature,
          properties: {
            ...feature.properties,
            temporalProgress: Math.round(clampedRatio * 100),
          },
          geometry: {
            ...feature.geometry,
            coordinates: scaledRings,
          },
        };
      }

      if (feature.geometry.type === 'MultiPolygon') {
        const polys = feature.geometry.coordinates as [number, number][][][];
        const scaledPolys = polys.map((poly) =>
          poly.map((r, idx) => (idx === 0 ? scaleRing(r, effectiveScale) : r))
        );
        return {
          ...feature,
          properties: {
            ...feature.properties,
            temporalProgress: Math.round(clampedRatio * 100),
          },
          geometry: {
            ...feature.geometry,
            coordinates: scaledPolys,
          },
        };
      }

      return feature;
    }),
  };
}

const CANVAS_PADDING = { top: 0, bottom: 80, left: 0, right: 0 };

// Subdued, physically-plausible atmosphere for the 3D globe — a thin limb haze
// consistent with real satellite/ISS footage of Earth, not a decorative sci-fi glow.
// Kept deliberately faint (low horizon-blend, low star-intensity) so the real
// Esri satellite imagery basemap stays the visual focus. Professional/ISRO-appropriate.
const GLOBE_ATMOSPHERE_FOG = {
  range: [0.8, 10] as [number, number],
  color: 'rgba(180, 199, 222, 0.10)',
  'horizon-blend': 0.012,
  'high-color': '#0c1e3c',
  'space-color': ['interpolate', ['linear'], ['zoom'], 1, '#000000', 3, '#020509', 6, '#05080f'],
  'star-intensity': 0.04,
};

function applyAtmosphereFog(map: MapLibreMap, projectionType: ProjectionMode) {
  try {
    if (typeof (map as any).setFog !== 'function') return;
    if (projectionType === 'globe') {
      (map as any).setFog(GLOBE_ATMOSPHERE_FOG);
    } else {
      (map as any).setFog(null);
    }
  } catch (err) {
    console.warn('Atmosphere fog not applied:', err);
  }
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({
  pins,
  selectedCategory,
  selectedPin,
  onSelectPin,
  basemap,
  projection,
  swipeActive,
  queryResponse,
  layers,
  onViewportChange,
  onToggleLayersDrawer,
  layersDrawerOpen,
  activeLayersCount,
  onToggleSwipe,
  onToggleProjection,
  onToggleBasemap,
  hideSwipeBadges = false,
  sliderPercent: propSliderPercent,
  onSliderChange,
  t1Date,
  t2Date,
  activeSensorBand = 'RGB',
  onChangeSensorBand,
  activePass,
  temporalProgress,
  isLandingMode = false,
  isLaunching = false,
  isDrawingAoi: propIsDrawingAoi,
  onToggleDrawAoi,
  drawnAoi: propDrawnAoi,
  onDrawnAoiChange,
  onQueryFollowup,
  isBriefingModalOpen: propIsBriefingOpen,
  onCloseBriefingModal: propOnCloseBriefing,
}, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const swipeOverlayContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const swipeMapRef = useRef<MapLibreMap | null>(null);

  const [internalDrawingAoi, setInternalDrawingAoi] = useState<boolean>(false);
  const isDrawingAoi = propIsDrawingAoi !== undefined ? propIsDrawingAoi : internalDrawingAoi;
  const toggleDrawingAoi = onToggleDrawAoi || (() => setInternalDrawingAoi((prev) => !prev));

  const [internalDrawnAoi, setInternalDrawnAoi] = useState<[number, number, number, number] | null>(null);
  const drawnAoi = propDrawnAoi !== undefined ? propDrawnAoi : internalDrawnAoi;
  const handleDrawnAoiChange = useCallback((val: [number, number, number, number] | null) => {
    setInternalDrawnAoi(val);
    onDrawnAoiChange?.(val);
  }, [onDrawnAoiChange]);

  const [selectedFeatureData, setSelectedFeatureData] = useState<InspectedFeatureData | null>(null);

  const [internalBriefingOpen, setInternalBriefingOpen] = useState<boolean>(false);
  const isBriefingOpen = propIsBriefingOpen !== undefined ? propIsBriefingOpen : internalBriefingOpen;
  const closeBriefing = propOnCloseBriefing || (() => setInternalBriefingOpen(false));

  // Last evidence FeatureCollection written to 'evidence-source' (MapLibre has
  // no public getData), plus the feature id currently isolated by highlight.
  const evidenceDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const highlightedFeatureIdRef = useRef<string | null>(null);

  const applyEvidenceHighlightFilter = useCallback((featureId: string | null) => {
    const map = mapInstanceRef.current;
    if (!map) return false;
    const filter = (featureId ? ['==', ['id'], featureId] : null) as unknown as Parameters<
      MapLibreMap['setFilter']
    >[1];
    let applied = false;
    ['evidence-layer-fill', 'evidence-layer-line', 'evidence-layer-glow'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filter);
        applied = true;
      }
    });
    highlightedFeatureIdRef.current = featureId;
    return applied;
  }, []);

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const tooltipRef = useRef<TooltipInfo | null>(null);
  useEffect(() => {
    tooltipRef.current = tooltip;
  }, [tooltip]);

  const selectedPinRef = useRef<TacticalGlobePin | null>(selectedPin);
  useEffect(() => {
    selectedPinRef.current = selectedPin;
  }, [selectedPin]);

  const [localSliderPercent, setLocalSliderPercent] = useState<number>(propSliderPercent ?? 50);
  const sliderPercent = propSliderPercent !== undefined ? propSliderPercent : localSliderPercent;

  useEffect(() => {
    if (propSliderPercent !== undefined) {
      setLocalSliderPercent(propSliderPercent);
    }
  }, [propSliderPercent]);

  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [swipeMapReady, setSwipeMapReady] = useState<boolean>(false);
  // T1/T2 epoch dates are now embedded in the swipe handle pill (showT1Badge/showT2Badge removed)
  const [pinsVisible, setPinsVisible] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [pixelInspectData, setPixelInspectData] = useState<PixelInspectResult | null>(null);
  const [isInspectingPixel, setIsInspectingPixel] = useState<boolean>(false);
  const [inspectorDockPosition, setInspectorDockPosition] = useState<'bottom-left' | 'bottom-right'>('bottom-left');

  const handleToggleNorthOrPitch = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    if (Math.abs(currentPitch) < 2 && Math.abs(currentBearing) < 2) {
      map.easeTo({ pitch: 45, bearing: -15, duration: 800, essential: true });
    } else {
      map.resetNorthPitch({ duration: 800 });
    }
  }, []);

  const handleLocateOrRecenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setIsLocating(true);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 14,
            pitch: 30,
            duration: 1600,
            essential: true,
          });
        },
        () => {
          setIsLocating(false);
          const targetLon = selectedPin ? selectedPin.lon : 72.5074;
          const targetLat = selectedPin ? selectedPin.lat : 23.0225;
          const targetZoom = selectedPin?.zoom ? Math.max(selectedPin.zoom, 13.5) : 13.5;
          map.flyTo({
            center: [targetLon, targetLat],
            zoom: targetZoom,
            pitch: 40,
            duration: 1600,
            essential: true,
          });
        },
        { timeout: 3500, enableHighAccuracy: false }
      );
    } else {
      setIsLocating(false);
      const targetLon = selectedPin ? selectedPin.lon : 72.5074;
      const targetLat = selectedPin ? selectedPin.lat : 23.0225;
      const targetZoom = selectedPin?.zoom ? Math.max(selectedPin.zoom, 13.5) : 13.5;
      map.flyTo({
        center: [targetLon, targetLat],
        zoom: targetZoom,
        pitch: 40,
        duration: 1600,
        essential: true,
      });
    }
  }, [selectedPin]);

  // Close tooltip / bubble on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTooltip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync cursor and dragPan when AOI drawing mode is toggled
  const isDrawingAoiRef = useRef<boolean>(isDrawingAoi);
  isDrawingAoiRef.current = isDrawingAoi;

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isDrawingAoi) {
      map.getCanvas().style.cursor = 'crosshair';
      try {
        map.dragPan.disable();
      } catch {}
    } else {
      map.getCanvas().style.cursor = '';
      try {
        map.dragPan.enable();
      } catch {}
    }
  }, [isDrawingAoi]);

  // Handle click-drag-release on map to draw custom bounding box
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let isDragging = false;
    let startPoint: [number, number] | null = null;

    const onMouseDown = (e: any) => {
      if (!isDrawingAoiRef.current) return;
      isDragging = true;
      startPoint = [e.lngLat.lng, e.lngLat.lat];
    };

    const onMouseMove = (e: any) => {
      if (!isDrawingAoiRef.current || !isDragging || !startPoint) return;
      const curLng = e.lngLat.lng;
      const curLat = e.lngLat.lat;
      const minX = Math.min(startPoint[0], curLng);
      const maxX = Math.max(startPoint[0], curLng);
      const minY = Math.min(startPoint[1], curLat);
      const maxY = Math.max(startPoint[1], curLat);

      const aoiPoly = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [
                [
                  [minX, minY],
                  [maxX, minY],
                  [maxX, maxY],
                  [minX, maxY],
                  [minX, minY],
                ],
              ],
            },
            properties: {},
          },
        ],
      };

      const src = map.getSource('drawn-aoi-source') as GeoJSONSource;
      if (src) src.setData(aoiPoly as any);
    };

    const onMouseUp = (e: any) => {
      if (!isDrawingAoiRef.current || !isDragging || !startPoint) return;
      isDragging = false;
      const curLng = e.lngLat.lng;
      const curLat = e.lngLat.lat;
      const minX = Math.min(startPoint[0], curLng);
      const maxX = Math.max(startPoint[0], curLng);
      const minY = Math.min(startPoint[1], curLat);
      const maxY = Math.max(startPoint[1], curLat);

      if (Math.abs(maxX - minX) > 0.001 && Math.abs(maxY - minY) > 0.001) {
        handleDrawnAoiChange([minX, minY, maxX, maxY]);
        toggleDrawingAoi();
      }
      startPoint = null;
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
  }, [toggleDrawingAoi, handleDrawnAoiChange]);

  // Synchronize drawnAoi state with map source
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const src = map.getSource('drawn-aoi-source') as GeoJSONSource;
    if (!src) return;

    if (drawnAoi) {
      const [minX, minY, maxX, maxY] = drawnAoi;
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [minX, minY],
                  [maxX, minY],
                  [maxX, maxY],
                  [minX, maxY],
                  [minX, minY],
                ],
              ],
            },
            properties: {},
          },
        ],
      });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [drawnAoi]);

  // Filter pins based on category
  const filteredPins = pins.filter((p) => {
    if (selectedCategory === 'world') return true;
    if (selectedCategory === 'nuclear') return p.category === 'nuclear';
    return p.category === selectedCategory;
  });

  // Convert pins to GeoJSON
  const pinsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: filteredPins.map((p) => ({
      type: 'Feature' as const,
      properties: {
        id: p.id,
        name: p.name,
        badge: p.badge,
        category: p.category,
        pinColor: p.pinColor,
        symbol: p.symbol,
        activePasses: p.activePasses,
        defcon: p.defcon,
        country: p.country,
        state: p.state,
        recommendedQuery: p.recommendedQuery,
        description: p.description,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lon, p.lat],
      },
    })),
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter = selectedPin && !isLandingMode
      ? [selectedPin.lon, selectedPin.lat]
      : [78.9629, 20.5937];
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlZoom = urlParams?.get('zoom') ? parseFloat(urlParams.get('zoom')!) : null;
    const initialZoom = isLandingMode ? 1.35 : (urlZoom ?? 3.5);
    const initialPitch = selectedPin && !isLandingMode ? (urlZoom ? (selectedPin.pitch || 35) : 30) : (isLandingMode ? 0 : 30);

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: mapContainerRef.current,
        style: createMapLibreStyle(basemap, projection),
        center: initialCenter as [number, number],
        zoom: initialZoom,
        pitch: initialPitch,
        bearing: 0,
        attributionControl: false,
      });
      (window as any).__MAP__ = map;
      setMapError(null);
    } catch (err: any) {
      console.error('MapLibre GL failed to initialize (WebGL unavailable/sandboxed):', err);
      setMapError(err?.message || 'WebGL acceleration not available in preview container');
      return;
    }

    map.on('error', (e) => {
      if (e?.error?.message?.includes('WebGL') || e?.error?.message?.includes('GPU')) {
        setMapError(e.error.message);
      }
    });

    // Operational layers (tactical pins, sector overlay, evidence source/layers)
    // must be attachable even when a basemap tile source stalls: `load` only fires
    // once every source settles, so a single unreachable tile source would hide the
    // entire operational layer stack — and with it every agent action that targets
    // those layers (e.g. highlight_feature). `styledata` fires as soon as a style is
    // present, so bind both handlers and stay idempotent.
    let operationalLayersReady = false;
    const initOperationalLayers = () => {
      if (operationalLayersReady || !map.getStyle()) return;
      try {
        if (typeof (map as any).setPadding === 'function') {
          (map as any).setPadding(CANVAS_PADDING);
        }
      } catch (err) {
        // ignore
      }

      try {
        if (typeof (map as any).setProjection === 'function') {
          (map as any).setProjection({ type: projection });
        }
      } catch (err) {
        console.warn('MapLibre projection not applied:', err);
      }

      applyAtmosphereFog(map, projection);

      try {
        // Add Tactical Pins Source
        map.addSource('tactical-pins-source', {
          type: 'geojson',
          data: pinsGeoJSON,
        });

        // Outer Concentric Marker Ring (Matte Clean Precision)
        map.addLayer({
          id: 'pins-outer-pulse',
          type: 'circle',
          source: 'tactical-pins-source',
          paint: {
            'circle-radius': 12,
            'circle-color': ['get', 'pinColor'],
            'circle-opacity': 0.18,
            'circle-stroke-width': 1,
            'circle-stroke-color': ['get', 'pinColor'],
            'circle-stroke-opacity': 0.6,
          },
        });

        // Inner Solid Core
        map.addLayer({
          id: 'pins-inner-core',
          type: 'circle',
          source: 'tactical-pins-source',
          paint: {
            'circle-radius': 5,
            'circle-color': ['get', 'pinColor'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#E2E8F0',
          },
        });

        // Add High-Resolution Calibrated Sector Raster Ground Overlay
        if (selectedPin) {
          try {
            const rasterCoords = getSectorRasterCoordinates(selectedPin);
            const rasterUrl = getSectorRasterUrl(selectedPin, activeSensorBand);
            map.addSource('sector-raster-overlay-source', {
              type: 'image',
              url: rasterUrl,
              coordinates: rasterCoords,
            });
            map.addLayer({
              id: 'sector-raster-overlay-layer',
              type: 'raster',
              source: 'sector-raster-overlay-source',
              paint: {
                'raster-opacity': 0.90,
                'raster-fade-duration': 250,
              },
            });
          } catch (rErr) {
            console.warn('Could not initialize sector ground raster:', rErr);
          }
        }

        // Dynamic Evidence Source & Layers (Initialized with Sector Baseline / Temporal Data)
        const initialBaseData =
          queryResponse?.geojson && queryResponse.geojson.features?.length > 0
            ? queryResponse.geojson
            : selectedPin
            ? getSectorGeoJSON(selectedPin.id, selectedPin.lat, selectedPin.lon)
            : { type: 'FeatureCollection' as const, features: [] };

        const initialRatio = activePass
          ? activePass.deltaPercent / 100
          : temporalProgress !== undefined
          ? temporalProgress / 100
          : 0.5;

        const initialScaledData = scaleGeoJSONFeatures(initialBaseData, initialRatio);

        map.addSource('evidence-source', {
          type: 'geojson',
          data: initialScaledData,
        });

        // Outer Glow Halo
        map.addLayer({
          id: 'evidence-layer-glow',
          type: 'line',
          source: 'evidence-source',
          paint: {
            'line-color': ['coalesce', ['get', 'borderColor'], ['get', 'stroke'], '#60A5FA'],
            'line-width': 5,
            'line-opacity': 0.35,
            'line-blur': 3,
          },
        });

        map.addLayer({
          id: 'evidence-layer-fill',
          type: 'fill',
          source: 'evidence-source',
          paint: {
            'fill-color': ['coalesce', ['get', 'fillColor'], ['get', 'fill'], '#3B82F6'],
            'fill-opacity': ['coalesce', ['get', 'fillOpacity'], ['get', 'fill-opacity'], 0.32],
          },
        });

        map.addLayer({
          id: 'evidence-layer-line',
          type: 'line',
          source: 'evidence-source',
          paint: {
            'line-color': ['coalesce', ['get', 'borderColor'], ['get', 'stroke'], '#60A5FA'],
            'line-width': ['coalesce', ['get', 'borderWidth'], ['get', 'stroke-width'], 2],
            'line-dasharray': [2, 1],
          },
        });

        // Drawn Area of Interest (AOI) Source and Layers
        if (!map.getSource('drawn-aoi-source')) {
          map.addSource('drawn-aoi-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'drawn-aoi-layer-fill',
            type: 'fill',
            source: 'drawn-aoi-source',
            paint: {
              'fill-color': '#F59E0B',
              'fill-opacity': 0.22,
            },
          });
          map.addLayer({
            id: 'drawn-aoi-layer-line',
            type: 'line',
            source: 'drawn-aoi-source',
            paint: {
              'line-color': '#FBBF24',
              'line-width': 2,
              'line-dasharray': [3, 2],
            },
          });
        }
      } catch (layerErr) {
        console.warn('Error attaching map layers:', layerErr);
      }
      operationalLayersReady = true;
    };
    map.on('load', initOperationalLayers);
    map.on('styledata', initOperationalLayers);

    // Viewport tracker
    const updateViewport = () => {
      try {
        const center = map.getCenter();
        const z = map.getZoom();
        onViewportChange({
          lat: center.lat,
          lng: center.lng,
          zoom: z,
        });
      } catch {
        // ignore
      }
    };

    // Keep active tooltip anchored to pin location during pan / zoom
    const updateTooltipPosition = () => {
      if (tooltipRef.current) {
        try {
          const pt = map.project([tooltipRef.current.pin.lon, tooltipRef.current.pin.lat]);
          setTooltip((prev) => (prev ? { ...prev, x: pt.x, y: pt.y } : null));
        } catch {}
      }
    };

    map.on('move', updateViewport);
    map.on('move', updateTooltipPosition);


    // Hover tooltip handlers
    const handlePinHover = (e: any) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features[0]) {
        const props = e.features[0].properties;
        const matchingPin = pins.find((p) => p.id === props?.id);
        if (matchingPin) {
          setTooltip({
            x: e.point.x,
            y: e.point.y,
            pin: matchingPin,
          });
        }
      }
    };

    const handlePinLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('mousemove', 'pins-inner-core', handlePinHover);
    map.on('mousemove', 'pins-outer-pulse', handlePinHover);
    map.on('mouseleave', 'pins-inner-core', handlePinLeave);
    map.on('mouseleave', 'pins-outer-pulse', handlePinLeave);

    // Click handler on pin
    const handlePinClick = (e: any) => {
      if (e.features && e.features[0]) {
        const props = e.features[0].properties;
        const matchingPin = pins.find((p) => p.id === props?.id);
        if (matchingPin) {
          onSelectPin(matchingPin);
          setTooltip({
            x: e.point.x,
            y: e.point.y,
            pin: matchingPin,
          });
          map.flyTo({
            center: [matchingPin.lon, matchingPin.lat],
            zoom: matchingPin.zoom,
            pitch: matchingPin.pitch,
            offset: [0, -35],
            duration: 1600,
            essential: true,
          });
        }
      }
    };

    map.on('click', 'pins-inner-core', handlePinClick);
    map.on('click', 'pins-outer-pulse', handlePinClick);

    // Interactive Grounded Feature Inspection (Click vector feature on map)
    const handleFeatureClick = (e: any) => {
      if (e.features && e.features[0]) {
        const feat = e.features[0];
        const props = feat.properties || {};
        setSelectedFeatureData({
          id: String(feat.id || props.id || 'FEATURE-01'),
          properties: props,
          geometryType: feat.geometry?.type || 'Polygon',
          areaKm2: props.areaKm2 ? Number(props.areaKm2) : 0.048,
          confidence: props.confidence ? Number(props.confidence) : 0.94,
        });
      }
    };

    map.on('click', 'evidence-layer-fill', handleFeatureClick);
    map.on('mouseenter', 'evidence-layer-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'evidence-layer-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    // Dismiss tooltip bubble & trigger pixel inspection when clicking canvas
    map.on('click', (e) => {
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ];
      try {
        const features = map.queryRenderedFeatures(bbox, {
          layers: ['pins-inner-core', 'pins-outer-pulse', 'evidence-layer-fill'],
        });
        if (!features || features.length === 0) {
          setTooltip(null);
          setSelectedFeatureData(null);
          const activeBbox: [number, number, number, number] = selectedPinRef.current
            ? [
                selectedPinRef.current.lon - 0.02,
                selectedPinRef.current.lat - 0.015,
                selectedPinRef.current.lon + 0.02,
                selectedPinRef.current.lat + 0.015,
              ]
            : [72.5, 23.015, 72.54, 23.035];

          setIsInspectingPixel(true);
          inspectPixelPoint({ lat: e.lngLat.lat, lon: e.lngLat.lng, bbox: activeBbox }).then((res) => {
            setIsInspectingPixel(false);
            if (res) {
              setPixelInspectData(res);
            }
          });
        }
      } catch {
        // ignore
      }
    });

    // Resize observer to ensure both main and swipe map canvases fill parent container cleanly
    const resizeObserver = new ResizeObserver(() => {
      try {
        map.resize();
        swipeMapRef.current?.resize();
      } catch {
        // ignore
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    mapInstanceRef.current = map;

    return () => {
      resizeObserver.disconnect();
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
    };
  }, [basemap]);

  // Disable scrollZoom in landing mode so mouse wheel scrolls the landing page
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (isLandingMode) {
      try { map.scrollZoom.disable(); } catch {}
    } else {
      try { map.scrollZoom.enable(); } catch {}
    }
  }, [isLandingMode]);

  // Reset camera to full rotating Earth globe whenever in Landing Mode and not launching
  useEffect(() => {
    if (isLandingMode && !isLaunching) {
      const map = mapInstanceRef.current;
      if (map) {
        try {
          map.jumpTo({
            center: [78.9629, 20.5937],
            zoom: 1.35, // Full spherical Earth view showing the entire globe
            pitch: 0,
            bearing: 0,
          });
          map.resize();
        } catch {}
      }
    }
  }, [isLandingMode, isLaunching]);

  // Smooth idle rotation around India on the Landing Page
  useEffect(() => {
    if (!isLandingMode || isLaunching) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    let userInteracting = false;
    let resumeTimeout: any = null;
    const onUserInteractStart = () => {
      userInteracting = true;
      if (resumeTimeout) clearTimeout(resumeTimeout);
    };
    const onUserInteractEnd = () => {
      if (resumeTimeout) clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(() => {
        userInteracting = false;
      }, 2500);
    };

    map.on('mousedown', onUserInteractStart);
    map.on('mouseup', onUserInteractEnd);
    map.on('touchstart', onUserInteractStart);
    map.on('touchend', onUserInteractEnd);

    let rafId: number;
    let lastTime = performance.now();
    const spinGlobe = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // clamp to avoid big jump after tab switch
      lastTime = currentTime;

      if (!userInteracting && mapInstanceRef.current) {
        try {
          const center = mapInstanceRef.current.getCenter();
          // 4.8 degrees per second is ~0.08 deg per frame at 60fps, perfectly silky and frame-rate independent
          center.lng += 4.8 * dt;
          if (center.lng > 180) center.lng -= 360;
          mapInstanceRef.current.jumpTo({
            center: [center.lng, center.lat],
            zoom: 1.35,
            pitch: 0,
            bearing: 0,
          });
        } catch {}
      }
      rafId = requestAnimationFrame(spinGlobe);
    };
    rafId = requestAnimationFrame(spinGlobe);

    return () => {
      cancelAnimationFrame(rafId);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      map.off('mousedown', onUserInteractStart);
      map.off('mouseup', onUserInteractEnd);
      map.off('touchstart', onUserInteractStart);
      map.off('touchend', onUserInteractEnd);
    };
  }, [isLandingMode, isLaunching]);

  // 2. Update projection
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map) {
      try {
        if (typeof (map as any).setProjection === 'function') {
          (map as any).setProjection({ type: projection });
        }
      } catch (err) {
        console.warn('Could not switch projection:', err);
      }
      applyAtmosphereFog(map, projection);
    }
    const swipeMap = swipeMapRef.current;
    if (swipeMap) {
      try {
        if (typeof (swipeMap as any).setProjection === 'function') {
          (swipeMap as any).setProjection({ type: projection });
        }
        if (map) {
          swipeMap.jumpTo({
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
            padding: CANVAS_PADDING,
          });
        }
      } catch {
        // ignore
      }
    }
  }, [projection]);

  // 3. Update pins data when category changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const source = map.getSource('tactical-pins-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData(pinsGeoJSON);
    }
  }, [selectedCategory, pinsGeoJSON]);

  // 4. Dynamic Ground Feature Evolution Pipeline (Temporal Scrubber + Query Overlay)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const source = map.getSource('evidence-source') as GeoJSONSource | undefined;
    if (!source) return;

    // A. Base Data Resolution: Prioritize query response features, otherwise sector baseline change polygons
    const baseData =
      queryResponse?.geojson && queryResponse.geojson.features && queryResponse.geojson.features.length > 0
        ? queryResponse.geojson
        : selectedPin
        ? getSectorGeoJSON(selectedPin.id, selectedPin.lat, selectedPin.lon)
        : { type: 'FeatureCollection' as const, features: [] };

    // B. Calculate Active Temporal Progress Ratio (0.0 = T0 Baseline, 1.0 = Peak Change Extent)
    const progressRatio = activePass
      ? activePass.deltaPercent / 100
      : temporalProgress !== undefined
      ? temporalProgress / 100
      : 1.0;

    // C. Physical Coordinate Scaling based on progression
    const scaledData = scaleGeoJSONFeatures(baseData, progressRatio);
    source.setData(scaledData);
    evidenceDataRef.current = scaledData;

    // If the previously highlighted feature no longer exists in this response,
    // drop the stale filter instead of leaving every polygon hidden.
    if (
      highlightedFeatureIdRef.current &&
      !scaledData.features?.some(
        (f, i) => String((f as { id?: unknown }).id ?? `feature-${i + 1}`) === highlightedFeatureIdRef.current
      )
    ) {
      applyEvidenceHighlightFilter(null);
    }

    // D. Dynamic Opacity and Line Width Response
    try {
      if (map.getLayer('evidence-layer-fill')) {
        const fillOpacity = Math.max(0.06, Math.min(0.68, 0.08 + 0.48 * progressRatio));
        map.setPaintProperty('evidence-layer-fill', 'fill-opacity', fillOpacity);
      }
      if (map.getLayer('evidence-layer-line')) {
        const lineOpacity = Math.max(0.20, Math.min(1.0, 0.25 + 0.75 * progressRatio));
        const lineWidth = 1.5 + 1.5 * progressRatio;
        map.setPaintProperty('evidence-layer-line', 'line-opacity', lineOpacity);
        map.setPaintProperty('evidence-layer-line', 'line-width', lineWidth);
      }
      if (map.getLayer('evidence-layer-glow')) {
        const glowOpacity = Math.max(0.10, Math.min(0.60, 0.15 + 0.40 * progressRatio));
        map.setPaintProperty('evidence-layer-glow', 'line-opacity', glowOpacity);
      }
    } catch {
      // Layer may be in middle of styledata reload
    }

    // Smoothly frame detected evidence clusters if present from query
    const feats = queryResponse?.geojson?.features;
    if (feats && feats.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      feats.forEach((f) => {
        if (f.geometry?.type === 'Polygon') {
          (f.geometry.coordinates[0] as [number, number][]).forEach(([x, y]) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
        }
      });
      if (minX !== Infinity && maxX !== -Infinity && Math.abs(maxX - minX) < 1.0) {
        map.fitBounds(
          [[minX - 0.003, minY - 0.003], [maxX + 0.003, maxY + 0.003]],
          { padding: 80, maxZoom: 15.5, duration: 1200 }
        );
      }
    }
  }, [queryResponse, selectedPin, activePass, temporalProgress]);

  // 4b. Imperative handle — the ONLY supported way for the agent action layer to
  // drive the map. Every method reports real success/failure from the live map.
  useImperativeHandle(ref, () => ({
    isReady: () => Boolean(mapInstanceRef.current),
    getViewport: () => {
      const map = mapInstanceRef.current;
      if (!map) return null;
      const center = map.getCenter();
      return {
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
    },
    flyTo: ({ center, zoom, pitch, bearing, duration }) => {
      const map = mapInstanceRef.current;
      if (!map) return false;
      map.flyTo({
        center,
        zoom: zoom ?? map.getZoom(),
        pitch: pitch ?? map.getPitch(),
        bearing: bearing ?? map.getBearing(),
        duration: duration ?? 1600,
        essential: true,
      });
      return true;
    },
    flyToBounds: (bbox, opts) => {
      const map = mapInstanceRef.current;
      if (!map) return false;
      const [minLng, minLat, maxLng, maxLat] = bbox;
      if (![minLng, minLat, maxLng, maxLat].every((n) => Number.isFinite(n))) return false;
      if (minLng >= maxLng || minLat >= maxLat) return false;
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        {
          padding: opts?.padding ?? 64,
          maxZoom: opts?.maxZoom ?? 10,
          duration: opts?.duration ?? 1600,
        }
      );
      return true;
    },
    highlightFeature: (featureId) => {
      const data = evidenceDataRef.current;
      if (!featureId || !data?.features || data.features.length === 0) return false;
      const match = data.features.find(
        (f, i) => String((f as { id?: unknown }).id ?? `feature-${i + 1}`) === String(featureId)
      );
      if (!match) return false;
      return applyEvidenceHighlightFilter(String(featureId));
    },
    clearHighlight: () => applyEvidenceHighlightFilter(null),
  }), [applyEvidenceHighlightFilter]);

  // 5. Camera flight when selectedPin changes (only on user sector selection, not on landing/launch)
  const prevPinIdRef = useRef<string | null>(selectedPin?.id || null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPin || isLandingMode || isLaunching) return;

    if (prevPinIdRef.current === selectedPin.id) {
      return;
    }
    prevPinIdRef.current = selectedPin.id;

    map.flyTo({
      center: [selectedPin.lon, selectedPin.lat],
      zoom: selectedPin.zoom,
      pitch: selectedPin.pitch,
      offset: [0, -35],
      duration: 1800,
      essential: true,
    });

    if (swipeMapRef.current) {
      try {
        swipeMapRef.current.flyTo({
          center: [selectedPin.lon, selectedPin.lat],
          zoom: selectedPin.zoom,
          pitch: selectedPin.pitch,
          offset: [0, -35],
          duration: 1800,
          essential: true,
          padding: CANVAS_PADDING,
        });
      } catch {
        try {
          swipeMapRef.current.jumpTo({
            center: [selectedPin.lon, selectedPin.lat],
            zoom: selectedPin.zoom,
            pitch: selectedPin.pitch,
            padding: CANVAS_PADDING,
          });
        } catch {}
      }
    }
  }, [selectedPin?.id, isLandingMode, isLaunching]);

  // 6. Handle layer visibility and opacity
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    layers.forEach((layer) => {
      const visibility = layer.visible ? 'visible' : 'none';
      const opacity = layer.opacity / 100;

      if (layer.id === 'intel-hotspots') {
        if (map.getLayer('pins-inner-core')) {
          map.setLayoutProperty('pins-inner-core', 'visibility', visibility);
          map.setLayoutProperty('pins-outer-pulse', 'visibility', visibility);
          map.setLayoutProperty('pins-text-label', 'visibility', visibility);
          map.setPaintProperty('pins-inner-core', 'circle-opacity', opacity);
        }
      }

      if (layer.id === 'bitemporal-structural-change' || layer.id === 'flood-inundation') {
        if (map.getLayer('evidence-layer-fill')) {
          map.setLayoutProperty('evidence-layer-fill', 'visibility', visibility);
          map.setLayoutProperty('evidence-layer-line', 'visibility', visibility);
          map.setPaintProperty('evidence-layer-fill', 'fill-opacity', 0.25 * opacity);
          map.setPaintProperty('evidence-layer-line', 'line-opacity', opacity);
        }
      }
    });
  }, [layers]);

  // 6b. Handle global pins visibility toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      const visibility = pinsVisible ? 'visible' : 'none';
      if (map.getLayer('pins-inner-core')) {
        map.setLayoutProperty('pins-inner-core', 'visibility', visibility);
      }
      if (map.getLayer('pins-outer-pulse')) {
        map.setLayoutProperty('pins-outer-pulse', 'visibility', visibility);
      }
    } catch {
      // ignore
    }
  }, [pinsVisible]);

  // 6c. Dynamic Sensor Band Spectral Filter Transformation (RGB vs NIR vs SAR)
  const applySensorFilter = useCallback((band: SensorBand) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      if (map.getLayer('base-tiles-layer')) {
        if (band === 'NIR') {
          // False Color Color-Infrared (CIR): Chlorophyll/vegetation glows crimson/red, water black, soil/urban cyan
          map.setPaintProperty('base-tiles-layer', 'raster-hue-rotate', 155);
          map.setPaintProperty('base-tiles-layer', 'raster-saturation', 0.85);
          map.setPaintProperty('base-tiles-layer', 'raster-contrast', 0.40);
        } else if (band === 'SAR') {
          // Synthetic Aperture Radar microwave backscatter: pure monochrome grayscale with high specular contrast
          map.setPaintProperty('base-tiles-layer', 'raster-hue-rotate', 0);
          map.setPaintProperty('base-tiles-layer', 'raster-saturation', -1.0);
          map.setPaintProperty('base-tiles-layer', 'raster-contrast', 0.85);
        } else {
          // Standard Natural RGB Optical Reflectance
          map.setPaintProperty('base-tiles-layer', 'raster-hue-rotate', 0);
          map.setPaintProperty('base-tiles-layer', 'raster-saturation', basemap === 'dark' ? -0.2 : 0.05);
          map.setPaintProperty('base-tiles-layer', 'raster-contrast', basemap === 'dark' ? 0.15 : 0.08);
        }
        map.triggerRepaint();
      }
    } catch (err) {
      console.warn('Failed to update spectral raster filter:', err);
    }
  }, [basemap]);

  useEffect(() => {
    applySensorFilter(activeSensorBand);
    const map = mapInstanceRef.current;
    if (!map) return;
    const onReady = () => applySensorFilter(activeSensorBand);
    map.on('styledata', onReady);
    map.on('load', onReady);
    return () => {
      map.off('styledata', onReady);
      map.off('load', onReady);
    };
  }, [activeSensorBand, applySensorFilter]);

  // 6d. Dynamic Sector Ground Raster Overlay Synchronization (RGB / NIR / SAR)
  const updateSectorGroundRaster = useCallback((pin: TacticalGlobePin | null, band: SensorBand) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!pin) {
      if (map.getLayer('sector-raster-overlay-layer')) {
        map.setLayoutProperty('sector-raster-overlay-layer', 'visibility', 'none');
      }
      return;
    }

    const coordinates = getSectorRasterCoordinates(pin);
    const url = getSectorRasterUrl(pin, band);

    try {
      if (map.getLayer('sector-raster-overlay-layer')) {
        map.removeLayer('sector-raster-overlay-layer');
      }
      if (map.getSource('sector-raster-overlay-source')) {
        map.removeSource('sector-raster-overlay-source');
      }

      map.addSource('sector-raster-overlay-source', {
        type: 'image',
        url,
        coordinates,
      });

      const beforeId = map.getLayer('evidence-layer-glow')
        ? 'evidence-layer-glow'
        : map.getLayer('evidence-layer-fill')
        ? 'evidence-layer-fill'
        : undefined;

      map.addLayer(
        {
          id: 'sector-raster-overlay-layer',
          type: 'raster',
          source: 'sector-raster-overlay-source',
          paint: {
            'raster-opacity': 0.90,
            'raster-fade-duration': 250,
          },
        },
        beforeId
      );
      map.triggerRepaint();
    } catch (err) {
      console.warn('Could not update sector ground raster overlay:', err);
    }
  }, []);

  useEffect(() => {
    updateSectorGroundRaster(selectedPin, activeSensorBand);
    const map = mapInstanceRef.current;
    if (!map) return;
    const onReady = () => updateSectorGroundRaster(selectedPin, activeSensorBand);
    map.on('styledata', onReady);
    map.on('load', onReady);
    return () => {
      map.off('styledata', onReady);
      map.off('load', onReady);
    };
  }, [selectedPin, activeSensorBand, updateSectorGroundRaster]);

  // 7. Secondary Map for Bi-Temporal Swipe Curtain (T1 Baseline Epoch)
  useEffect(() => {
    if (!swipeActive) {
      setSwipeMapReady(false);
      if (swipeMapRef.current) {
        try {
          swipeMapRef.current.remove();
        } catch {}
        swipeMapRef.current = null;
      }
      return;
    }

    if (!swipeOverlayContainerRef.current) return;

    const mainMap = mapInstanceRef.current;
    if (!mainMap) return;

    let swipeMap: MapLibreMap;
    try {
      swipeMap = new MapLibreMap({
        container: swipeOverlayContainerRef.current,
        style: createBitemporalBaselineStyle(projection),
        center: mainMap.getCenter(),
        zoom: mainMap.getZoom(),
        pitch: mainMap.getPitch(),
        bearing: mainMap.getBearing(),
        interactive: false,
        attributionControl: false,
      });
    } catch (err) {
      console.warn('Could not initialize secondary bi-temporal map:', err);
      return;
    }

    // Synchronize secondary swipe map seamlessly with main map movements
    const syncMaps = () => {
      if (!swipeMapRef.current || !mainMap) return;
      try {
        swipeMapRef.current.jumpTo({
          center: mainMap.getCenter(),
          zoom: mainMap.getZoom(),
          pitch: mainMap.getPitch(),
          bearing: mainMap.getBearing(),
          padding: CANVAS_PADDING,
        });
      } catch {}
    };

    // Apply projection, identical padding, and sync on initial style load
    let readyTimer: any = null;
    const handleReady = () => {
      try {
        if (typeof (swipeMap as any).setPadding === 'function') {
          (swipeMap as any).setPadding(CANVAS_PADDING);
        }
      } catch {}
      try {
        if (typeof (swipeMap as any).setProjection === 'function') {
          (swipeMap as any).setProjection({ type: projection });
        }
      } catch {}
      try {
        swipeMap.resize();
        syncMaps();
      } catch {}
      setSwipeMapReady(true);
    };

    if (swipeMap.isStyleLoaded() || swipeMap.loaded()) {
      handleReady();
    } else {
      swipeMap.once('load', handleReady);
      swipeMap.once('styledata', () => {
        if (swipeMap.isStyleLoaded()) handleReady();
      });
      readyTimer = setTimeout(handleReady, 200);
    }


    mainMap.on('move', syncMaps);
    mainMap.on('render', syncMaps);
    mainMap.on('zoom', syncMaps);
    mainMap.on('rotate', syncMaps);
    mainMap.on('pitch', syncMaps);
    mainMap.on('moveend', syncMaps);
    mainMap.on('zoomend', syncMaps);
    swipeMapRef.current = swipeMap;

    return () => {
      mainMap.off('move', syncMaps);
      mainMap.off('render', syncMaps);
      mainMap.off('zoom', syncMaps);
      mainMap.off('rotate', syncMaps);
      mainMap.off('pitch', syncMaps);
      mainMap.off('moveend', syncMaps);
      mainMap.off('zoomend', syncMaps);
      if (readyTimer) clearTimeout(readyTimer);
      setSwipeMapReady(false);
      try {
        swipeMap.remove();
      } catch {}
      swipeMapRef.current = null;
    };
  }, [swipeActive, projection]);

  // Handle Dragging Bi-Temporal Slider
  const handleMouseDownSlider = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSlider(true);
  };

  const handleMouseMoveSlider = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDraggingSlider || !mapContainerRef.current) return;
      e.preventDefault();
      const rect = mapContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const offset = clientX - rect.left;
      const percent = Math.max(1, Math.min(99, (offset / rect.width) * 100));
      setLocalSliderPercent(percent);
      onSliderChange?.(percent);
    },
    [isDraggingSlider, onSliderChange]
  );

  const handleMouseUpSlider = useCallback(() => {
    setIsDraggingSlider(false);
  }, []);

  useEffect(() => {
    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleMouseMoveSlider, { passive: false });
      window.addEventListener('mouseup', handleMouseUpSlider);
      window.addEventListener('touchmove', handleMouseMoveSlider, { passive: false });
      window.addEventListener('touchend', handleMouseUpSlider);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveSlider);
      window.removeEventListener('mouseup', handleMouseUpSlider);
      window.removeEventListener('touchmove', handleMouseMoveSlider);
      window.removeEventListener('touchend', handleMouseUpSlider);
    };
  }, [isDraggingSlider, handleMouseMoveSlider, handleMouseUpSlider]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080A0F]">
      {/* Primary Map Canvas */}
      <div
        ref={mapContainerRef}
        id="primary-geospatial-canvas"
        className={`w-full h-full outline-none ${mapError ? 'hidden' : 'block'}`}
      />

      {/* High-Fidelity Tactical 2D Radar Fallback (if WebGL is restricted/sandboxed) */}
      {mapError && (
        <div id="tactical-2d-canvas-fallback" className="absolute inset-0 bg-[#080A0F] flex flex-col items-center justify-center p-6 select-none overflow-hidden">
          {/* Tactical Grid Background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#1E2533_1px,transparent_1px)] [background-size:24px_24px]" />
          
          {/* Radar Sweep Ring Graphic */}
          <div className="absolute w-[600px] h-[600px] rounded-full border border-emerald-500/20 pointer-events-none flex items-center justify-center">
            <div className="w-[450px] h-[450px] rounded-full border border-emerald-500/30" />
            <div className="w-[300px] h-[300px] rounded-full border border-emerald-500/40" />
            <div className="w-[150px] h-[150px] rounded-full border border-emerald-500/50" />
            <div className="absolute inset-0 rounded-full animate-radar bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#10B98133_360deg)] pointer-events-none" />
          </div>

          {/* Interactive World Tactical Node Map */}
          <div className="relative z-10 w-full max-w-4xl h-[400px] border border-[#1E2533] bg-[#0D1117]/80 backdrop-blur-md rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2533]">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-emerald-400">TACTICAL 2D VECTOR RADAR ACTIVE</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161B22] border border-[#1E2533] text-slate-400">EQUIPROJECTION EPSG:4326</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                <span>ACTIVE HOTSPOTS: </span>
                <span className="text-white font-bold">{filteredPins.length} TARGETS</span>
              </div>
            </div>

            {/* Relative World Canvas with Tactical Pins */}
            <div className="relative flex-1 w-full my-3 border border-[#1E2533]/50 rounded bg-[#080A0F]/60 overflow-hidden">
              {/* Latitude / Longitude Guide Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-25">
                <div className="border-b border-dashed border-cyan-500/40 w-full h-0" />
                <div className="border-b border-dashed border-cyan-500/40 w-full h-0" />
                <div className="border-b border-dashed border-cyan-500/40 w-full h-0" />
              </div>
              <div className="absolute inset-0 flex justify-between pointer-events-none opacity-25">
                <div className="border-r border-dashed border-cyan-500/40 h-full w-0" />
                <div className="border-r border-dashed border-cyan-500/40 h-full w-0" />
                <div className="border-r border-dashed border-cyan-500/40 h-full w-0" />
              </div>

              {/* Pin Beacons */}
              {filteredPins.map((pin) => {
                const xPercent = Math.min(95, Math.max(5, ((pin.lon + 180) / 360) * 100));
                const yPercent = Math.min(92, Math.max(8, ((90 - pin.lat) / 180) * 100));
                const isSelected = selectedPin?.id === pin.id;

                return (
                  <button
                    key={pin.id}
                    onClick={() => {
                      onSelectPin(pin);
                      onViewportChange({ lat: pin.lat, lng: pin.lon, zoom: pin.zoom });
                    }}
                    style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus:outline-none"
                    title={`${pin.name} (${pin.badge})`}
                  >
                    <div className="relative flex items-center justify-center">
                      <span
                        className={`absolute w-7 h-7 rounded-full transition-transform ${
                          isSelected ? 'scale-150 animate-ping opacity-75' : 'opacity-30 group-hover:scale-125'
                        }`}
                        style={{ backgroundColor: pin.pinColor }}
                      />
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg z-10`}
                        style={{ backgroundColor: pin.pinColor }}
                      />
                      <div className="absolute top-4 flex items-center space-x-1">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#0D1117] border border-[#1E2533] text-slate-200 group-hover:text-cyan-300">
                          {pin.badge}
                        </span>
                        {pin.is_real_image && (
                          <ProvenanceBadge variant="VERIFIED" size="xs" />
                        )}
                        {pin.is_simulated && !pin.is_real_image && (
                          <ProvenanceBadge variant="SIMULATED" size="xs" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Status Footer & Retry WebGL Button */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1E2533] text-xs font-mono">
              <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                <span>STATUS:</span>
                <span className="text-emerald-400">TELEMETRY STREAM SYNCHRONIZED</span>
              </div>
              <button
                onClick={() => {
                  setMapError(null);
                  window.location.reload();
                }}
                className="px-3 py-1 rounded bg-[#161B22] border border-[#2D3748] hover:border-emerald-500 text-slate-200 hover:text-emerald-300 transition-colors text-xs"
              >
                ↻ RE-INITIALIZE 3D GLOBE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bi-Temporal Split Screen Secondary Map Curtain (T1: Baseline Epoch) */}
      {swipeActive && (
        <div
          id="bitemporal-swipe-wrapper"
          className={`absolute inset-0 pointer-events-none overflow-hidden select-none transition-opacity duration-300 ease-out ${
            swipeMapReady ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            clipPath: `polygon(0 0, ${sliderPercent}% 0, ${sliderPercent}% 100%, 0 100%)`,
          }}
        >
          <div
            ref={swipeOverlayContainerRef}
            id="swipe-secondary-canvas"
            className="w-full h-full pointer-events-none"
          />

          {/* T1 Watermark HUD Indicator */}
          <div className="absolute bottom-6 left-6 z-20 pointer-events-none select-none">
            <div className="px-2.5 py-1 rounded bg-[#0A0E16]/80 border border-amber-500/40 backdrop-blur-md text-[9px] font-mono text-amber-300 font-bold tracking-wider shadow-lg flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>T1 BASELINE ARCHIVE ({t1Date || 'MAR 2024'})</span>
            </div>
          </div>
        </div>
      )}

      {/* Bi-Temporal Drag Active Glass Shield (prevents map from capturing mouse while dragging) */}
      {isDraggingSlider && (
        <div
          className="fixed inset-0 z-50 cursor-ew-resize select-none"
          onMouseMove={(e) => handleMouseMoveSlider(e.nativeEvent)}
          onMouseUp={handleMouseUpSlider}
          onTouchMove={(e) => handleMouseMoveSlider(e.nativeEvent)}
          onTouchEnd={handleMouseUpSlider}
        />
      )}


      {/* Bi-Temporal Swipe Handle & Interactive Curtain Divider — with embedded T1/T2 epoch dates */}
      {swipeActive && (
        <div
          id="swipe-curtain-divider"
          onMouseDown={handleMouseDownSlider}
          onTouchStart={handleMouseDownSlider}
          onDoubleClick={() => {
            setLocalSliderPercent(50);
            onSliderChange?.(50);
          }}
          title="Drag left/right to compare T1 Baseline vs T2 Post-Event (Double-click to reset 50%)"
          className={`absolute inset-y-0 z-10 w-8 -ml-4 flex items-center justify-center cursor-ew-resize select-none group transition-opacity duration-300 ease-out ${
            swipeMapReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ left: `${sliderPercent}%` }}
        >
          {/* Vertical Divider Line with Glow */}
          <div className="w-[2px] h-full bg-gradient-to-b from-amber-400/90 via-white to-blue-400/90 shadow-[0_0_8px_rgba(255,255,255,0.4)] group-hover:w-[3px] transition-all" />

          {/* Draggable Handle Pill — T1 date / arrows+% / T2 date */}
          <div
            id="swipe-drag-pill"
            className="absolute top-1/2 -translate-y-1/2 w-12 h-20 bg-gradient-to-b from-[#222B3D] via-[#141B26] to-[#0D121B] border border-slate-300/70 group-hover:border-white rounded-lg shadow-2xl flex flex-col items-center justify-center cursor-ew-resize transition-transform group-active:scale-95 px-1 py-1"
          >
            {/* T1 epoch date */}
            <span className="text-[8px] font-mono text-amber-300 font-bold leading-tight text-center truncate w-full">
              {t1Date ? new Date(t1Date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() : 'T1'}
            </span>
            <div className="w-5 h-px bg-slate-500/40 rounded-full my-0.5" />
            <div className="flex items-center space-x-0.5 text-[9px] font-mono text-slate-200 font-bold tracking-tight">
              <span className="text-amber-400 text-[10px]">◄</span>
              <span className="text-slate-500 text-[9px]">|</span>
              <span className="text-blue-400 text-[10px]">►</span>
            </div>
            <span className="text-[8px] font-mono text-slate-300 font-semibold">{Math.round(sliderPercent)}%</span>
            <div className="w-5 h-px bg-slate-500/40 rounded-full my-0.5" />
            {/* T2 epoch date */}
            <span className="text-[8px] font-mono text-blue-300 font-bold leading-tight text-center truncate w-full">
              {t2Date ? new Date(t2Date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() : 'T2'}
            </span>
          </div>
        </div>
      )}

      {/* Tactical Beacon Hover / Click Popup Bubble */}
      {tooltip && (
        <div
          id="wm-tooltip"
          className="absolute z-50 pointer-events-auto select-none mb-3"
          style={{
            left: `${Math.max(155, Math.min((mapContainerRef.current?.clientWidth || 800) - 155, tooltip.x))}px`,
            top: `${Math.max(220, tooltip.y)}px`,
            transform: 'translate(-50%, -100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-72 p-3 rounded-xl bg-gradient-to-b from-[#161D2B]/95 to-[#0E121B]/95 backdrop-blur-md border border-[#2E3B52] shadow-2xl text-slate-100 relative">
            {/* Explicit Close Bubble Button */}
            <button
              id="close-tooltip-bubble-btn"
              onClick={(e) => {
                e.stopPropagation();
                setTooltip(null);
              }}
              title="Close Bubble (Esc)"
              className="absolute top-2.5 right-2.5 p-1 rounded-md bg-[#1B2436] hover:bg-[#25324A] text-slate-400 hover:text-white border border-[#2E3B52] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center pb-2 border-b border-[#20293A] pr-7">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-lg shrink-0">{tooltip.pin.symbol}</span>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block leading-tight truncate">
                    {tooltip.pin.name}
                  </span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0E121B] border border-[#222B3B] text-amber-300 font-semibold inline-block">
                      {tooltip.pin.badge}
                    </span>
                    {tooltip.pin.is_real_image && (
                      <ProvenanceBadge variant="VERIFIED" size="xs" />
                    )}
                    {tooltip.pin.is_simulated && !tooltip.pin.is_real_image && (
                      <ProvenanceBadge variant="SIMULATED" size="xs" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>COORDINATES:</span>
                <span className="text-slate-200 font-semibold">
                  {tooltip.pin.lat.toFixed(4)}°, {tooltip.pin.lon.toFixed(4)}°
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>STATUS:</span>
                <span className="text-emerald-400 font-semibold">{tooltip.pin.state}</span>
              </div>
              {tooltip.pin.activePasses && (
                <div className="pt-1.5 border-t border-[#20293A] text-[10px] text-slate-300">
                  <span className="text-slate-500 block text-[9px]">SATELLITE PASS:</span>
                  <span className="font-mono text-cyan-300 truncate block">{tooltip.pin.activePasses}</span>
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#20293A] flex items-center justify-between gap-2">
              <button
                type="button"
                id="tooltip-select-pin-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPin(tooltip.pin);
                  setTooltip(null);
                }}
                className="flex-1 py-1 px-2 rounded bg-[#1A263B] hover:bg-[#233452] border border-blue-500/30 text-cyan-200 text-[10px] font-mono font-semibold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
              >
                <span>SELECT SECTOR</span>
              </button>
              <button
                type="button"
                id="tooltip-dismiss-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltip(null);
                }}
                className="py-1 px-2 rounded bg-[#141A26] hover:bg-[#1E273A] border border-[#26334A] text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pixel Probe Inspector Floating Card */}
      {(pixelInspectData || isInspectingPixel) && (
        <div className={`absolute z-30 w-72 bg-[#0C1017]/95 border border-[#1E2638] backdrop-blur-xl rounded-xl p-3.5 shadow-2xl text-xs space-y-2.5 font-mono text-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
          inspectorDockPosition === 'bottom-left' ? 'left-4 bottom-16' : 'right-16 bottom-16'
        }`}>
          <div className="flex items-center justify-between border-b border-[#1E2638] pb-2">
            <div className="flex items-center space-x-2">
              <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="font-bold text-cyan-200 tracking-wider uppercase text-[11px]">
                ISRO Pixel Inspector
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setInspectorDockPosition((prev) => (prev === 'bottom-left' ? 'bottom-right' : 'bottom-left'))}
                title={`Dock Inspector to ${inspectorDockPosition === 'bottom-left' ? 'Bottom-Right' : 'Bottom-Left'}`}
                className="px-1.5 py-0.5 text-[9px] bg-[#141A24] text-cyan-300 hover:text-white rounded border border-[#232E44] transition-colors cursor-pointer"
              >
                DOCK {inspectorDockPosition === 'bottom-left' ? 'RIGHT' : 'LEFT'}
              </button>
              <button
                onClick={() => setPixelInspectData(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#1E2638] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isInspectingPixel ? (
            <div className="flex items-center space-x-2 text-slate-400 py-2">
              <Radio className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Sampling multi-spectral pixel arrays...</span>
            </div>
          ) : pixelInspectData ? (
            <>
              <div className="space-y-1 bg-[#141A24] p-2 rounded border border-[#1E2638]">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
                  <span>WGS84 Coordinates</span>
                  {pixelInspectData.pixel && (
                    <span className="text-cyan-400">PX [{pixelInspectData.pixel.x}, {pixelInspectData.pixel.y}]</span>
                  )}
                </div>
                <div className="text-white font-semibold text-xs">
                  {pixelInspectData.coordinates.lat.toFixed(4)}°N, {pixelInspectData.coordinates.lon.toFixed(4)}°E
                </div>
                <div className="text-[10px] text-cyan-400 mt-1">
                  Class: <span className="text-white font-medium">{pixelInspectData.land_cover_class}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="bg-[#141A24] p-1.5 rounded border border-[#1E2638]">
                  <span className="text-slate-400 text-[10px] block">NDVI (Vegetation)</span>
                  <span className={`font-bold ${pixelInspectData.indices.ndvi > 0.15 ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {pixelInspectData.indices.ndvi}
                  </span>
                </div>
                <div className="bg-[#141A24] p-1.5 rounded border border-[#1E2638]">
                  <span className="text-slate-400 text-[10px] block">NDWI (Water)</span>
                  <span className={`font-bold ${pixelInspectData.indices.ndwi > 0.05 ? 'text-cyan-400' : 'text-slate-300'}`}>
                    {pixelInspectData.indices.ndwi}
                  </span>
                </div>
                <div className="bg-[#141A24] p-1.5 rounded border border-[#1E2638]">
                  <span className="text-slate-400 text-[10px] block">NDBI (Built-up)</span>
                  <span className={`font-bold ${pixelInspectData.indices.ndbi > 0.08 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {pixelInspectData.indices.ndbi}
                  </span>
                </div>
                <div className="bg-[#141A24] p-1.5 rounded border border-[#1E2638]">
                  <span className="text-slate-400 text-[10px] block">SAR Backscatter</span>
                  <span className="font-bold text-sky-400">
                    {pixelInspectData.indices.sar_backscatter_db} dB
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141A24] px-2 py-1 rounded border border-[#1E2638] text-[10px]">
                <span className="text-slate-400">Sampled RGB Swatch:</span>
                <div className="flex items-center space-x-1.5">
                  <div
                    className="w-3.5 h-3.5 rounded border border-slate-600 shadow-inner"
                    style={{ backgroundColor: `rgb(${pixelInspectData.rgb.join(',')})` }}
                  />
                  <span className="text-slate-200">
                    [{pixelInspectData.rgb.join(', ')}]
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Unified Floating Canvas Tool Dock — grouped: Data overlays | View controls | Navigation */}
      {(!isLandingMode || isLaunching) && (
        <div
          id="canvas-tools-dock"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col select-none bg-[#0C1017]/85 border border-[#1E2638] backdrop-blur-md p-1 rounded-lg shadow-xl transition-opacity duration-500"
        >

        {/* ── Data Overlays ── */}
        {onToggleLayersDrawer && (
          <button
            id="map-layers-toggle-btn"
            onClick={onToggleLayersDrawer}
            title="Toggle Mission Layers (Cartosat, RISAT SAR, Thermal)"
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border ${
              layersDrawerOpen
                ? 'bg-[#1E2738] border-slate-400 text-white shadow-sm'
                : 'bg-transparent hover:bg-[#1A2232] border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Layers className="w-4 h-4 text-slate-300" />
              {activeLayersCount !== undefined && activeLayersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 text-white rounded-full text-[8px] font-mono font-bold flex items-center justify-center">
                  {activeLayersCount}
                </span>
              )}
            </div>
          </button>
        )}

        <button
          id="map-toggle-pins-btn"
          onClick={() => {
            setPinsVisible((prev) => !prev);
            if (pinsVisible) setTooltip(null);
          }}
          title={pinsVisible ? "Hide Location Pin Bubbles" : "Show Location Pin Bubbles"}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border ${
            pinsVisible
              ? 'bg-transparent hover:bg-[#1A2232] border-transparent text-amber-400 hover:text-amber-300'
              : 'bg-transparent hover:bg-[#1A2232] border-transparent text-slate-600 hover:text-slate-400'
          }`}
        >
          <MapPin className="w-4 h-4" />
        </button>

        {onToggleSwipe && (
          <button
            id="map-swipe-toggle-btn"
            onClick={onToggleSwipe}
            title={swipeActive ? 'Disable Swipe Curtain' : 'Enable Bi-Temporal Swipe Curtain'}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border ${
              swipeActive
                ? 'bg-[#2A2216] border-amber-500/60 text-amber-200'
                : 'bg-transparent hover:bg-[#1A2232] border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>
        )}

        {/* ── Divider: Data ↔ View ── */}
        <div className="w-full h-px bg-sq-border-1 my-1" />

        {/* ── View Controls ── */}
        {onToggleProjection && (
          <div className="flex flex-col items-center">
            <button
              id="map-projection-toggle-btn"
              onClick={onToggleProjection}
              title={projection === 'globe' ? '3D Globe Active (Click to switch to 2D Mercator)' : '2D Mercator Active (Click to switch to 3D Globe)'}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border ${
                projection === 'globe'
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50'
                  : 'bg-[#1A2232] border-slate-500/50 text-white hover:bg-[#222E42]'
              }`}
            >
              {projection === 'globe' ? (
                <Globe className="w-4 h-4 text-cyan-400" />
              ) : (
                <MapIcon className="w-4 h-4 text-slate-200" />
              )}
            </button>
            <span className="text-[7px] text-slate-500 font-mono leading-none mt-0.5 select-none">PROJ</span>
          </div>
        )}

        {onToggleBasemap && (
          <button
            id="map-basemap-toggle-btn"
            onClick={onToggleBasemap}
            title={basemap === 'satellite' ? 'Satellite Imagery Active (Click for Dark Vector Map)' : 'Dark Vector Map Active (Click for Satellite Imagery)'}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border ${
              basemap === 'satellite'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
                : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
            }`}
          >
            {basemap === 'satellite' ? (
              <Satellite className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>
        )}

        {/* ── Tactical Action Controls (AOI Draw & Briefing Export) ── */}
        <div className="w-full h-px bg-sq-border-1 my-1" />

        {/* AOI Draw Toggle Button in Dock */}
        <div className="flex flex-col items-center">
          <button
            id="dock-aoi-draw-btn"
            onClick={toggleDrawingAoi}
            title={isDrawingAoi ? 'Drawing Active: Click & drag on map to define AOI' : 'Draw Custom Area of Interest (AOI)'}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border cursor-pointer ${
              isDrawingAoi
                ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : drawnAoi
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-[#1A2232] border-slate-500/50 text-slate-200 hover:bg-[#222E42] hover:text-white'
            }`}
          >
            <Square className="w-4 h-4 text-amber-400" />
          </button>
          <span className="text-[7px] text-slate-500 font-mono leading-none mt-0.5 select-none">AOI</span>
        </div>

        {/* Tactical Mission Briefing Export in Dock */}
        <div className="flex flex-col items-center">
          <button
            id="dock-briefing-export-btn"
            onClick={() => setInternalBriefingOpen(true)}
            title="Generate & Export Tactical Mission Briefing (PDF/JSON)"
            className="w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 border bg-[#1A2232] border-slate-500/50 text-slate-200 hover:bg-[#222E42] hover:text-cyan-400 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
          </button>
          <span className="text-[7px] text-slate-500 font-mono leading-none mt-0.5 select-none">BRIEF</span>
        </div>

        {/* ── Divider: View ↔ Navigation ── */}
        <div className="w-full h-px bg-sq-border-1 my-1" />

        {/* ── Navigation Controls ── */}
        <button
          id="map-zoom-in-btn"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Zoom In (+)"
          className="w-8 h-8 rounded-md hover:bg-[#1A2232] text-slate-200 flex items-center justify-center transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          id="map-zoom-out-btn"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Zoom Out (−)"
          className="w-8 h-8 rounded-md hover:bg-[#1A2232] text-slate-200 flex items-center justify-center transition-all active:scale-95"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          id="map-reset-north-btn"
          onClick={handleToggleNorthOrPitch}
          title="Toggle 3D Pitch / Reset True North"
          className="w-8 h-8 rounded-md hover:bg-[#1A2232] text-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
        >
          <Compass className="w-4 h-4 text-amber-400" />
        </button>

        <button
          id="map-recenter-pin-btn"
          onClick={handleLocateOrRecenter}
          title={selectedPin ? `Locate Position / Recenter on ${selectedPin.name}` : 'Locate Position / Recenter'}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
            isLocating
              ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-300'
              : 'hover:bg-[#1A2232] border-transparent text-slate-200'
          }`}
        >
          <Locate className={`w-4 h-4 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
        </button>
      </div>
      )}

      {/* Interactive Custom Area of Interest (AOI) Drawing HUD Tool */}
      <AoiDrawTool
        isDrawingActive={isDrawingAoi}
        onToggleDrawing={toggleDrawingAoi}
        drawnAoi={drawnAoi}
        onClearAoi={() => handleDrawnAoiChange(null)}
        onQueryAoi={(bbox) => {
          onQueryFollowup?.(`Analyze satellite passes and radiometric signatures within custom AOI [${bbox.map((n) => n.toFixed(4)).join(', ')}]`);
        }}
      />

      {/* Grounded Vector Feature Inspection Modal */}
      <FeatureInspectModal
        feature={selectedFeatureData}
        onClose={() => setSelectedFeatureData(null)}
        onRunFollowupQuery={(q) => {
          onQueryFollowup?.(q);
          setSelectedFeatureData(null);
        }}
      />

      {/* Tactical Mission Briefing PDF/JSON Export Modal */}
      <TacticalBriefingModal
        isOpen={isBriefingOpen}
        onClose={closeBriefing}
        selectedPin={selectedPin}
        activeSectorName={selectedPin?.name || 'Ahmedabad SAC'}
        activeModality={queryResponse?.modality || 'single_image'}
        queryResponse={queryResponse}
      />
    </div>
  );
});
