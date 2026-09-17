/**
 * Map state store — Agent C (C-1)
 *
 * Extended (Mission: agent control of map & dashboard) to be the single source
 * of truth for everything a UIAction can change on the map:
 * camera viewport, modality, sensor band, swipe curtain, layers, time range,
 * projection and basemap.
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  BasemapMode,
  LayerConfig,
  ModalityMode,
  ProjectionMode,
  SensorBand,
  TacticalGlobePin,
  TimeRangeOption,
} from '../types';
import { DEFAULT_LAYERS, TACTICAL_PINS } from '../config/tacticalData';

type Updater<T> = T | ((prev: T) => T);

function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

const INITIAL_PIN = TACTICAL_PINS[0];

interface MapState {
  // Camera
  viewport: MapViewport;
  setViewport: (viewport: MapViewport) => void;

  // Modality / spectral band
  modality: ModalityMode;
  setModality: (mode: ModalityMode) => void;
  sensorBand: SensorBand;
  setSensorBand: (band: SensorBand) => void;

  // Swipe curtain
  swipeActive: boolean;
  setSwipeActive: (active: Updater<boolean>) => void;
  curtainPercent: number;
  setCurtainPercent: (percent: number) => void;

  // Layers
  layers: LayerConfig[];
  toggleLayer: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;

  // Temporal range
  timeRange: TimeRangeOption;
  setTimeRange: (range: TimeRangeOption) => void;

  // Projection / basemap
  projection: ProjectionMode;
  setProjection: (mode: Updater<ProjectionMode>) => void;
  basemap: BasemapMode;
  setBasemap: (mode: Updater<BasemapMode>) => void;

  // Selected operational sector
  selectedPin: TacticalGlobePin | null;
  setSelectedPin: (pin: TacticalGlobePin | null) => void;
}

export const useMapStore = create<MapState>()(
  devtools(
    (set) => ({
      viewport: {
        lat: INITIAL_PIN.lat,
        lng: INITIAL_PIN.lon,
        zoom: INITIAL_PIN.zoom,
      },
      setViewport: (viewport) => set({ viewport }),

      modality: 'cross_modal',
      setModality: (modality) => set({ modality }),
      sensorBand: 'RGB',
      setSensorBand: (sensorBand) => set({ sensorBand }),

      swipeActive: false,
      setSwipeActive: (active) =>
        set((state) => ({ swipeActive: resolve(state.swipeActive, active) })),
      curtainPercent: 50,
      setCurtainPercent: (curtainPercent) =>
        set({ curtainPercent: Math.max(0, Math.min(100, curtainPercent)) }),

      layers: DEFAULT_LAYERS,
      toggleLayer: (layerId) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layerId ? { ...l, visible: !l.visible } : l
          ),
        })),
      setLayerOpacity: (layerId, opacity) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layerId ? { ...l, opacity } : l
          ),
        })),

      timeRange: '7d',
      setTimeRange: (timeRange) => set({ timeRange }),

      projection: 'globe',
      setProjection: (mode) =>
        set((state) => ({ projection: resolve(state.projection, mode) })),
      basemap: 'satellite',
      setBasemap: (mode) =>
        set((state) => ({ basemap: resolve(state.basemap, mode) })),

      selectedPin: INITIAL_PIN,
      setSelectedPin: (selectedPin) => set({ selectedPin }),
    }),
    { name: 'map-store' }
  )
);
