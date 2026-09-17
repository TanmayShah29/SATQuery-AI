import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import type { ModalityMode, TimeRangeOption, StudioRoute } from '../types';

export interface TacticalUrlState {
  lat: number;
  lon: number;
  zoom: number;
  timeRange: TimeRangeOption;
  layers: string[];
  sector: string;
  modality: ModalityMode;
  curtain: number;
  view: 'global' | 'tactical';
}

const DEFAULT_URL_STATE: TacticalUrlState = {
  lat: 23.03,
  lon: 72.58,
  zoom: 3.5,
  timeRange: '7d',
  layers: ['sentinel2', 'sentinel1', 'change', 'hotspots'],
  sector: 'isro-sac',
  modality: 'cross_modal',
  curtain: 50,
  view: 'global',
};

export function useTacticalUrlState() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract active studio route from pathname (e.g. /dashboard -> 'dashboard')
  const currentStudio: StudioRoute = (() => {
    const path = location.pathname.replace(/^\//, '').toLowerCase();
    if (['dashboard', 'bitemporal', 'crossmodal', 'grounding', 'benchmarks', 'ingestion', 'audit'].includes(path)) {
      return path as StudioRoute;
    }
    return 'dashboard';
  })();

  // Parse state from current URL search params with fallbacks
  const parseUrlState = useCallback((): TacticalUrlState => {
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');
    const zoomStr = searchParams.get('zoom');
    const timeRangeStr = searchParams.get('timeRange') as TimeRangeOption | null;
    const layersStr = searchParams.get('layers');
    const sectorStr = searchParams.get('sector');
    const modalityStr = searchParams.get('modality') as ModalityMode | null;
    const curtainStr = searchParams.get('curtain');
    const viewStr = searchParams.get('view') as 'global' | 'tactical' | null;

    return {
      lat: latStr ? parseFloat(latStr) : DEFAULT_URL_STATE.lat,
      lon: lonStr ? parseFloat(lonStr) : DEFAULT_URL_STATE.lon,
      zoom: zoomStr ? parseFloat(zoomStr) : DEFAULT_URL_STATE.zoom,
      timeRange: timeRangeStr && ['24h', '7d', '30d', '1y', 'all'].includes(timeRangeStr)
        ? timeRangeStr
        : DEFAULT_URL_STATE.timeRange,
      layers: layersStr ? layersStr.split(',').filter(Boolean) : DEFAULT_URL_STATE.layers,
      sector: sectorStr || DEFAULT_URL_STATE.sector,
      modality: modalityStr && ['single_image', 'cross_modal', 'bitemporal'].includes(modalityStr)
        ? modalityStr
        : DEFAULT_URL_STATE.modality,
      curtain: curtainStr ? parseInt(curtainStr, 10) : DEFAULT_URL_STATE.curtain,
      view: viewStr === 'tactical' ? 'tactical' : DEFAULT_URL_STATE.view,
    };
  }, [searchParams]);

  const [state, setState] = useState<TacticalUrlState>(parseUrlState);
  const rafId = useRef<number | null>(null);

  // Throttled URL synchronization via window.history.replaceState to prevent UI jitter
  const syncToUrl = useCallback((newState: TacticalUrlState) => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      params.set('lat', newState.lat.toFixed(4));
      params.set('lon', newState.lon.toFixed(4));
      params.set('zoom', newState.zoom.toFixed(1));
      params.set('timeRange', newState.timeRange);
      if (newState.layers.length > 0) {
        params.set('layers', newState.layers.join(','));
      } else {
        params.delete('layers');
      }
      params.set('sector', newState.sector);
      params.set('modality', newState.modality);
      if (newState.curtain !== 50) {
        params.set('curtain', newState.curtain.toString());
      } else {
        params.delete('curtain');
      }
      params.set('view', newState.view);

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    });
  }, []);

  const updateState = useCallback(
    (updates: Partial<TacticalUrlState>) => {
      setState((prev) => {
        const next = { ...prev, ...updates };
        syncToUrl(next);
        return next;
      });
    },
    [syncToUrl]
  );

  const navigateToStudio = useCallback(
    (studio: StudioRoute) => {
      const params = new URLSearchParams(window.location.search);
      navigate(`/${studio}?${params.toString()}`);
    },
    [navigate]
  );

  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return {
    state,
    currentStudio,
    updateState,
    navigateToStudio,
  };
}
