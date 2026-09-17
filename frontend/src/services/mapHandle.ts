/**
 * Map handle registry (Mission: agent control of map & dashboard).
 *
 * The agent action layer is not a React child of App, so it cannot receive
 * MapCanvas' imperative handle through props. MapCanvas exposes its handle via
 * forwardRef; App publishes it here on mount/unmount. The action executor calls
 * getMapHandle() and treats a null/missing map as an honest `status: "failed"`.
 *
 * Handle methods return `false` when the map is not ready or the request is
 * invalid, so callers never have to guess whether an action actually landed.
 */

export interface MapViewportSnapshot {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface FlyToOptions {
  center: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  duration?: number;
}

export interface FlyToBoundsOptions {
  padding?: number;
  maxZoom?: number;
  duration?: number;
}

export interface MapCanvasHandle {
  /** True once the underlying MapLibre map instance exists. */
  isReady(): boolean;
  /** Current real camera state, or null when the map is not ready. */
  getViewport(): MapViewportSnapshot | null;
  /** Fly the camera to a center. Returns false if the map is unavailable. */
  flyTo(opts: FlyToOptions): boolean;
  /** Fit a real [minLng, minLat, maxLng, maxLat] bbox. Returns false if invalid/unavailable. */
  flyToBounds(bbox: [number, number, number, number], opts?: FlyToBoundsOptions): boolean;
  /** Filter evidence layers to one feature id that exists in the current response. */
  highlightFeature(featureId: string): boolean;
  /** Restore the unfiltered evidence layers. */
  clearHighlight(): boolean;
}

let currentHandle: MapCanvasHandle | null = null;

export function setMapHandle(handle: MapCanvasHandle | null): void {
  currentHandle = handle;
}

export function getMapHandle(): MapCanvasHandle | null {
  return currentHandle;
}
