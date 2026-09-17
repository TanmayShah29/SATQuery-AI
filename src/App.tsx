import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Map as MapIcon,
  Network,
  Cpu,
  Send,
  ChevronRight,
  Activity,
  Layers,
  X,
  Satellite,
  Square,
  FileText,
} from 'lucide-react';
import { ProvenanceBadge } from './components/ui/ProvenanceBadge';
import type {
  CategoryType,
  TacticalGlobePin,
  SectorTarget,
  ModalityMode,
  GeoTIFFMetadata,
  BenchmarkQuery,
  AIStatusResponse,
  TimeRangeOption,
  SatellitePass,
  QueryResponse,
  SensorBand,
} from './types';
import {
  TACTICAL_PINS,
  SECTOR_TARGETS,
  SAMPLE_GEOTIFFS,
} from './config/tacticalData';
import { submitSatQuery, fetchHealth, fetchAIStatus } from './services/api';
import { executeUIActions, applyActuationReport } from './services/actionExecutor';
import { HeaderHUD } from './components/HeaderHUD';
import { MapCanvas } from './components/MapCanvas';
import { LayersPanel } from './components/LayersPanel';
import { RightOperationalPanel } from './components/RightOperationalPanel';
import { SearchModal } from './components/SearchModal';
import { QueryPromptBar } from './components/QueryPromptBar';
import { GeoTIFFModal } from './components/GeoTIFFModal';
import { BenchmarkModal } from './components/BenchmarkModal';
import { ModelStatusModal } from './components/ModelStatusModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTacticalUrlState } from './hooks/useTacticalUrlState';
import { useMapStore } from './stores/mapStore';
import { useUIStore } from './stores/uiStore';
import { useQueryStore } from './stores/queryStore';
import { setMapHandle, type MapCanvasHandle } from './services/mapHandle';
import { TemporalScrubber } from './components/TemporalScrubber';
import { SituationalFeedDrawer } from './components/SituationalFeedDrawer';
import { BitemporalStudio } from './pages/BitemporalStudio';
import { CrossmodalStudio } from './pages/CrossmodalStudio';
import { GroundingStudio } from './pages/GroundingStudio';
import { BenchmarkStudio } from './pages/BenchmarkStudio';
import { IngestionStudio } from './pages/IngestionStudio';
import { AuditStudio } from './pages/AuditStudio';
import Landing from './pages/Landing';

function computeEpochDates(t2DateStr: string, timeRange: TimeRangeOption): { t1Date: string; t2Date: string; deltaLabel: string } {
  const t2 = new Date(t2DateStr || '2024-05-01');
  const validT2 = isNaN(t2.getTime()) ? new Date('2024-05-01') : t2;

  let daysPrior = 7;
  let deltaLabel = '7-Day Orbital Revisit';
  if (timeRange === '24h') {
    daysPrior = 1;
    deltaLabel = '24-Hour Rapid Revisit';
  } else if (timeRange === '7d') {
    daysPrior = 7;
    deltaLabel = '7-Day Orbital Revisit';
  } else if (timeRange === '30d') {
    daysPrior = 30;
    deltaLabel = '30-Day Monthly Cadence';
  } else if (timeRange === '1y') {
    daysPrior = 365;
    deltaLabel = '1-Year Seasonal Baseline';
  } else if (timeRange === 'all') {
    daysPrior = 850;
    deltaLabel = 'Multi-Mission Historical Baseline';
  }

  const t1 = new Date(validT2.getTime() - daysPrior * 24 * 60 * 60 * 1000);
  return {
    t1Date: t1.toISOString().split('T')[0],
    t2Date: validT2.toISOString().split('T')[0],
    deltaLabel,
  };
}

export default function App() {
  // SatQuery AI — bidirectional deep-linking & URL state hook
  const {
    state: urlState,
    currentStudio,
    updateState: updateUrlState,
    navigateToStudio,
  } = useTacticalUrlState();

  const location = useLocation();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Store-backed actuation state (Mission: agent control of map & dashboard).
  // Aliased to the original local names so every existing call site is unchanged.
  // ---------------------------------------------------------------------------
  const {
    viewport,
    setViewport,
    modality: activeModality,
    setModality: setActiveModality,
    sensorBand: activeSensorBand,
    setSensorBand: setActiveSensorBand,
    swipeActive,
    setSwipeActive,
    curtainPercent,
    setCurtainPercent,
    layers,
    toggleLayer,
    setLayerOpacity,
    timeRange: activeTimeRange,
    setTimeRange: setActiveTimeRange,
    projection,
    setProjection,
    basemap,
    setBasemap,
    selectedPin,
    setSelectedPin,
  } = useMapStore();

  const {
    deckOpen: operationalDeckOpen,
    setDeckOpen: setOperationalDeckOpen,
    deckTab: operationalDeckTab,
    setDeckTab: setOperationalDeckTab,
    mobileTab,
    setMobileTab,
    layersDrawerOpen,
    setLayersDrawerOpen,
    situationalFeedOpen,
    setSituationalFeedOpen,
  } = useUIStore();

  const {
    response: queryResponse,
    setResponse: setQueryResponse,
    error: queryError,
    setError: setQueryError,
    isLoading: isAnalyzing,
    setIsLoading: setIsAnalyzing,
    liveStreamEnabled,
    setLiveStreamEnabled,
  } = useQueryStore();

  const didInitUrlStoreRef = useRef(false);
  useEffect(() => {
    if (didInitUrlStoreRef.current) return;
    didInitUrlStoreRef.current = true;
    if (urlState.modality) {
      setActiveModality(urlState.modality);
      setSwipeActive(urlState.modality === 'bitemporal');
    }
    if (typeof urlState.curtain === 'number') {
      setCurtainPercent(urlState.curtain);
    }
    if (urlState.timeRange) {
      setActiveTimeRange(urlState.timeRange);
    }
    // One-time hydration from the URL on mount; store defaults cover the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRootRoute = location.pathname === '/';

  // Agent-proposed UI act. The backend ships a typed, grounded UIAction[] next to
  // the evidence; only the frontend can decide whether each action really took
  // effect, so we execute them here and fold the TRUE outcome back into the DAG
  // (node-5-ui-actuation arrives "pending" and must never stay pending).
  //
  // This runs as an effect rather than inline in executeQuery on purpose: child
  // effects (MapCanvas rebuilding its evidence source from the new response) run
  // before the parent's, so by the time we touch the camera/highlight the map
  // already holds the data the actions were grounded against.
  const actuatedResponseRef = useRef<QueryResponse | null>(null);
  useEffect(() => {
    if (!queryResponse) return;
    if (actuatedResponseRef.current === queryResponse) return; // already acted on this exact object
    if (!queryResponse.ui_actions || queryResponse.ui_actions.length === 0) return;
    if (queryResponse.dagNodes?.some((n) => n.id === 'node-5-ui-actuation' && n.uiActionResults?.length)) return;

    let cancelled = false;
    (async () => {
      const report = await executeUIActions(queryResponse.ui_actions);
      if (cancelled) return;
      const patched = applyActuationReport(queryResponse, report);
      actuatedResponseRef.current = patched; // guard the patched object too
      setQueryResponse(patched);
      if (report.failed > 0) {
        useUIStore
          .getState()
          .addToast(
            `UI actuation: ${report.failed} of ${report.results.length} agent action(s) failed`,
            'error'
          );
      }
    })();

    return () => {
      cancelled = true;
    };
    // Actuation is keyed on the response object identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryResponse]);

  // Publish the live map handle to the action layer; cleared on unmount so the
  // executor never drives a stale/detached map.
  const publishMapHandle = useCallback((handle: MapCanvasHandle | null) => {
    setMapHandle(handle);
  }, []);
  const [isLandingMode, setIsLandingMode] = useState<boolean>(isRootRoute);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [launchPhase, setLaunchPhase] = useState<'idle' | 'zoom-in' | 'glide-left'>('idle');
  const [landingScrollTop, setLandingScrollTop] = useState<number>(0);
  const [heroScrollPast, setHeroScrollPast] = useState<boolean>(false);
  // Brief pre-flight "ignition" beat: chrome dims and a single scanline sweeps
  // through before the camera starts moving (see handleLaunchConsole).
  const [ignitionActive, setIgnitionActive] = useState<boolean>(false);
  // Plays a one-shot pulse on the coordinate HUD bubble the instant the
  // console finishes docking into dashboard mode.
  const [justDocked, setJustDocked] = useState<boolean>(false);

  // Tactical Improvements State: AOI Drawing & Tactical Mission Briefing Export
  const [isDrawingAoi, setIsDrawingAoi] = useState<boolean>(false);
  const [drawnAoi, setDrawnAoi] = useState<[number, number, number, number] | null>(null);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState<boolean>(false);

  // Active dashboard UI is visible when not in landing mode OR when the launch transition is running.
  // This allows the full workspace layout to be physically established BEFORE camera flight,
  // preventing any sudden viewport resizing or layout snapping when flight completes.
  const isDashboardActive = !isLandingMode || isLaunching;

  useEffect(() => {
    if (!isLandingMode) {
      setJustDocked(true);
      const dockTimer = setTimeout(() => setJustDocked(false), 650);
      return () => clearTimeout(dockTimer);
    }
  }, [isLandingMode]);

  useEffect(() => {
    if (location.pathname === '/') {
      setIsLandingMode(true);
      setProjection('globe');
      setBasemap('satellite');
      setIsLaunching(false);
      setLaunchPhase('idle');
      setLandingScrollTop(0);
      setHeroScrollPast(false);

      const scrollContainer = document.getElementById('landing-scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 0;

      const map = (window as any).__MAP__;
      if (map) {
        try {
          map.flyTo({
            center: [78.9629, 20.5937],
            zoom: 1.35, // Show entire Earth globe
            pitch: 0,
            bearing: 0,
            duration: 800,
            essential: true,
          });
        } catch (err) {
          console.warn('Reset to landing globe failed:', err);
        }

        const startResize = performance.now();
        const resizeLoop = () => {
          if ((window as any).__MAP__) {
            try { (window as any).__MAP__.resize(); } catch {}
          }
          if (performance.now() - startResize < 800) {
            requestAnimationFrame(resizeLoop);
          }
        };
        requestAnimationFrame(resizeLoop);
      }
    } else {
      setIsLandingMode(false);
    }
  }, [location.pathname]);

  // State definitions
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('world');

  // Synchronize pin when URL sector query param changes
  useEffect(() => {
    if (urlState.sector && (!selectedPin || selectedPin.id !== urlState.sector)) {
      const match = TACTICAL_PINS.find((p) => p.id === urlState.sector);
      if (match) {
        setSelectedPin(match);
      }
    }
  }, [urlState.sector, selectedPin]);
  const [showTelemetryPill, setShowTelemetryPill] = useState<boolean>(true);

  // Compute dynamic bi-temporal epochs based on selected sector and active time range
  const { t1Date, t2Date } = useMemo(() => {
    const baseTargetDate = selectedPin?.optical_t2_date || '2024-05-01';
    return computeEpochDates(baseTargetDate, activeTimeRange);
  }, [selectedPin?.optical_t2_date, activeTimeRange]);

  const [activeTimelinePass, setActiveTimelinePass] = useState<SatellitePass | null>(null);

  const handleCurtainChange = useCallback((val: number) => {
    setCurtainPercent(val);
    updateUrlState({ curtain: val });
  }, [updateUrlState]);

  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [geoTIFFModalOpen, setGeoTIFFModalOpen] = useState<boolean>(false);
  const [benchmarkModalOpen, setBenchmarkModalOpen] = useState<boolean>(false);
  const [modelStatusModalOpen, setModelStatusModalOpen] = useState<boolean>(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [usingFallbackData, setUsingFallbackData] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);

  // Live viewport coordinates are store-backed (see useMapStore above)

  // Current Query Response: starts empty (honest: clean operational HUD ready to analyze).
  // queryResponse / queryError / isAnalyzing / liveStreamEnabled are store-backed (useQueryStore).
  const [activeUploadedRaster, setActiveUploadedRaster] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);
  const [iouThreshold, setIouThreshold] = useState<number>(0.50);
  const [radarThreshold, setRadarThreshold] = useState<number>(0.65);


  // Identical queries were being fired twice per sector/modality activation
  // (once directly by the pin/modality handlers, once by the synchronizer effect
  // below). The duplicates raced, arrived out of order, and each one re-actuated
  // the map — so the visible camera/highlight could end up reflecting a request
  // nobody asked for. Collapse concurrent identical requests instead.
  const inFlightQueriesRef = useRef<Set<string>>(new Set());
  // Which (sector, modality) pair was last analyzed, and which sector's prompt it
  // was — written by executeQuery itself so the synchronizer effect below never
  // re-issues a query the user has already triggered.
  const lastAnalyzedSectorRef = useRef<string | null>(null);
  const lastAnalyzedPinRef = useRef<string | null>(null);

  // Core Real Query Execution Engine with 30s Timeout Guard
  const executeQuery = useCallback(
    async (
      queryText: string,
      targetPin?: TacticalGlobePin | null,
      modality?: ModalityMode,
      silent: boolean = false
    ) => {
      const pin = targetPin || selectedPin || TACTICAL_PINS[0];
      const activeMode = modality || activeModality;
      const requestKey = `${pin.id}|${activeMode}|${queryText}`;
      if (inFlightQueriesRef.current.has(requestKey)) {
        return;
      }
      inFlightQueriesRef.current.add(requestKey);
      lastAnalyzedSectorRef.current = `${pin.id}-${activeMode}`;
      lastAnalyzedPinRef.current = pin.id;
      if (!silent) {
        setIsAnalyzing(true);
      }

      const bbox: [number, number, number, number] = [
        Number((pin.lon - 0.02).toFixed(4)),
        Number((pin.lat - 0.02).toFixed(4)),
        Number((pin.lon + 0.02).toFixed(4)),
        Number((pin.lat + 0.02).toFixed(4)),
      ];

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('SatQuery Inference Timeout: Hardware engine took longer than 30s.'));
        }, 30000);
      });

      try {
        const response = await Promise.race([
          submitSatQuery(queryText, {
            bbox,
            modality: activeMode,
            sectorId: pin.id,
            uploadedFile: activeUploadedRaster || undefined,
            confidenceThreshold,
            iouThreshold,
            radarThreshold,
            contextHints: { live_stream: liveStreamEnabled },
          }),
          timeoutPromise,
        ]);
        setQueryResponse(response);
        setQueryError(null);
      } catch (err: any) {
        console.error('Error executing SatQuery:', err);
        setQueryError(err?.message || 'Backend request failed.');
      } finally {
        inFlightQueriesRef.current.delete(requestKey);
        if (!silent) {
          setIsAnalyzing(false);
          setOperationalDeckOpen(true);
          setOperationalDeckTab('evidence');
        }
      }
    },
    [selectedPin, activeModality, activeUploadedRaster, confidenceThreshold, iouThreshold, radarThreshold, liveStreamEnabled]
  );

  const refreshAIStatus = useCallback(() => {
    fetchAIStatus().then((status) => {
      setAiStatus(status);
    }).catch((err) => {
      console.warn('Failed to fetch AI status:', err);
    });
  }, []);

  // Initial mount health check & live server verification
  useEffect(() => {
    fetchHealth().then((health) => {
      const isHealthy = health?.status === 'healthy' || health?.status === 'healthy_local' || health?.status === 'degraded';
      setBackendHealthy(isHealthy);
      setUsingFallbackData(!isHealthy);
    }).catch(() => {
      setBackendHealthy(false);
      setUsingFallbackData(true);
    });

    refreshAIStatus();
  }, [refreshAIStatus]);

  // Synchronize sector deep links without firing unwanted auto-queries
  useEffect(() => {
    // Wait for hydration to settle if URL has a sector
    if (urlState.sector && selectedPin?.id !== urlState.sector) {
      const match = TACTICAL_PINS.find((p) => p.id === urlState.sector);
      if (match) {
        setSelectedPin(match);
      }
    }
  }, [urlState.sector, selectedPin?.id]);

  // Handler to reset analysis and return to the Target Overview Start State
  const handleResetAnalysis = useCallback(() => {
    setQueryResponse(null);
    const map = (window as any).__MAP__;
    if (map && selectedPin) {
      try {
        map.flyTo({
          center: [selectedPin.lon, selectedPin.lat],
          zoom: selectedPin.zoom || 11.5,
          pitch: selectedPin.pitch || 30,
          duration: 1000,
          essential: true,
        });
      } catch {}
    }
  }, [selectedPin, setQueryResponse]);

  // Instantly switch modality with smooth, non-blocking background data sync
  const handleModalityChange = (mode: ModalityMode) => {
    if (mode === activeModality) return;
    setActiveModality(mode);
    setSwipeActive(mode === 'bitemporal');

    if (selectedPin) {
      executeQuery(
        queryResponse?.query || selectedPin.recommendedQuery,
        selectedPin,
        mode,
        true // silent background update: eliminates UI lockup & loading flicker
      );
    }
  };

  // Synchronize Studio route with modality and swipe curtain
  useEffect(() => {
    if (currentStudio === 'bitemporal') {
      setActiveModality('bitemporal');
      setSwipeActive(true);
    } else if (currentStudio === 'crossmodal') {
      setActiveModality('cross_modal');
      setSwipeActive(false);
    } else if (currentStudio === 'grounding') {
      setActiveModality('single_image');
      setSwipeActive(false);
    } else if (currentStudio === 'dashboard') {
      if (urlState.modality) {
        setActiveModality(urlState.modality);
        setSwipeActive(urlState.modality === 'bitemporal');
      }
    }
  }, [currentStudio, urlState.modality]);

  // Global keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Camera flight + panel docking sequence, run after the ignition beat below.
  // Defined ahead of handleLaunchConsole so it can be a safe dependency of it.
  const runLaunchFlight = useCallback(
    (targetPin: TacticalGlobePin) => {
      setLaunchPhase('zoom-in');

      const map = (window as any).__MAP__;
      if (map) {
        const targetZoom = targetPin.zoom ? Math.min(targetPin.zoom, 4.2) : 3.8;
        const targetPitch = targetPin.pitch ? Math.min(targetPin.pitch, 32) : 26;

        // Resize once as the container layout takes its exact dashboard dimensions
        setTimeout(() => {
          try {
            map.resize();
          } catch {}
        }, 50);

        // Single continuous, silky-smooth orbital flight path directly into the target tactical sector.
        // Because the workspace layout (map on left, deck on right) is physically mounted from t=0 of launch,
        // target coordinates center directly in the visible map area with no camera snapping.
        try {
          map.flyTo({
            center: [targetPin.lon, targetPin.lat],
            zoom: targetZoom,
            pitch: targetPitch,
            bearing: -4,
            duration: 1800,
            curve: 1.42,
            speed: 0.85,
            essential: true,
          });
        } catch (err) {
          console.warn('Cinematic launch flight failed:', err);
        }

        // At 1850ms, complete the transition seamlessly into active dashboard mode
        setTimeout(() => {
          setIsLaunching(false);
          setLaunchPhase('idle');
          setIsLandingMode(false);
          updateUrlState({
            sector: targetPin.id,
            lat: targetPin.lat,
            lon: targetPin.lon,
            zoom: targetZoom,
          });
          navigate(`/dashboard?zoom=${targetZoom}&sector=${targetPin.id}&lat=${targetPin.lat}&lon=${targetPin.lon}`);
        }, 1850);
      }
    },
    [updateUrlState, navigate]
  );

  // Cinematic Launch Console Transition: Scroll to hero if scrolled down -> Ignition beat ->
  // Zoom into India -> Zoom out -> Glide container to left -> Enter dashboard
  const handleLaunchConsole = useCallback(
    (targetPinId?: string) => {
      if (isLaunching) return;

      let targetPin = selectedPin;
      if (targetPinId) {
        const found = TACTICAL_PINS.find((p) => p.id === targetPinId);
        if (found) {
          targetPin = found;
          setSelectedPin(found);
        }
      }
      if (!targetPin) targetPin = TACTICAL_PINS[0];

      const scrollContainer = document.getElementById('landing-scroll-container');
      const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
      const isScrolledDown = currentScrollTop > 30;
      const scrollDuration = isScrolledDown
        ? Math.min(650, Math.max(350, Math.round(currentScrollTop * 0.35)))
        : 0;

      if (isScrolledDown && scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const finalTargetPin = targetPin;

      // Execute cinematic sequence once the viewport is back at the hero section
      setTimeout(() => {
        // Ignition beat: dim the chrome and sweep a scanline for ~220ms before
        // the camera moves at all — UI reacts first, then the flight begins.
        setIsLaunching(true);
        setIgnitionActive(true);
        setLandingScrollTop(0);
        setHeroScrollPast(false);

        setTimeout(() => {
          setIgnitionActive(false);
          runLaunchFlight(finalTargetPin);
        }, 220);
      }, scrollDuration);
    },
    [isLaunching, selectedPin, runLaunchFlight]
  );

  // Handle Select Pin from Map
  const handleSelectPin = useCallback(
    (pin: TacticalGlobePin, autoRun: boolean = false) => {
      setActiveUploadedRaster(null);
      setSelectedPin(pin);
      setShowTelemetryPill(true);
      updateUrlState({ sector: pin.id, lat: pin.lat, lon: pin.lon, zoom: pin.zoom });

      const map = (window as any).__MAP__;
      if (map) {
        try {
          map.flyTo({
            center: [pin.lon, pin.lat],
            zoom: pin.zoom ? Math.min(pin.zoom, 12) : 10.5,
            pitch: pin.pitch || 28,
            duration: 1200,
            essential: true,
          });
        } catch (e) {
          console.warn('Fly to pin failed:', e);
        }
      }

      if (autoRun) {
        executeQuery(pin.recommendedQuery, pin, activeModality);
      } else {
        // Reset query response to present the clear Target Dossier Start State
        setQueryResponse(null);
      }
    },
    [activeModality, executeQuery, updateUrlState, setQueryResponse]
  );

  // Handle Jump to Sector from Scope Selector
  const handleJumpToSector = useCallback(
    (sector: SectorTarget, autoRun: boolean = false) => {
      setActiveUploadedRaster(null);
      const matchingPin = TACTICAL_PINS.find((p) => p.id === sector.id) || {
        id: sector.id,
        name: sector.name,
        state: 'ACTIVE MONITORING',
        lat: sector.lat,
        lon: sector.lon,
        zoom: sector.zoom,
        pitch: sector.pitch,
        badge: sector.badge,
        category: sector.category,
        pinColor: '#3B82F6',
        symbol: '🎯',
        recommendedQuery: `Analyze high-resolution optical and SAR imagery at ${sector.name}.`,
        description: `Tactical sector: ${sector.region}`,
        activePasses: 'Sentinel-2A & Sentinel-1 SAR constellation',
        defcon: 4,
        country: sector.region,
      };

      setSelectedPin(matchingPin);
      updateUrlState({ sector: matchingPin.id, lat: matchingPin.lat, lon: matchingPin.lon, zoom: matchingPin.zoom });

      const map = (window as any).__MAP__;
      if (map) {
        try {
          map.flyTo({
            center: [matchingPin.lon, matchingPin.lat],
            zoom: matchingPin.zoom ? Math.min(matchingPin.zoom, 12) : 10.5,
            pitch: matchingPin.pitch || 28,
            duration: 1200,
            essential: true,
          });
        } catch (e) {
          console.warn('Fly to sector failed:', e);
        }
      }

      if (autoRun) {
        executeQuery(matchingPin.recommendedQuery, matchingPin, activeModality);
      } else {
        setQueryResponse(null);
      }
    },
    [activeModality, executeQuery, updateUrlState, setQueryResponse]
  );

  // Handle Open Deck Tab from in-prompt action buttons
  const handleOpenDeckTab = useCallback((tab: 'dag' | 'evidence' | 'telemetry') => {
    setOperationalDeckTab(tab);
    setOperationalDeckOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (tab === 'dag') setMobileTab('dag');
      else if (tab === 'telemetry') setMobileTab('telemetry');
      else setMobileTab('intelligence');
    }
  }, []);

  // Handle Fly to Active Sector
  const handleFlyToActiveSector = useCallback(() => {
    if (selectedPin) {
      handleSelectPin(selectedPin);
    }
  }, [selectedPin, handleSelectPin]);

  // Handle Execute Query from Prompt Bar, Benchmark Chips, or Spotlight Search
  const handleExecuteQuery = useCallback(
    (query: string, modality?: ModalityMode, targetPinOrId?: TacticalGlobePin | string) => {
      // 1. Resolve target pin from argument if provided
      let targetPin: TacticalGlobePin | undefined;
      if (typeof targetPinOrId === 'string') {
        targetPin = TACTICAL_PINS.find((p) => p.id === targetPinOrId);
      } else if (targetPinOrId) {
        targetPin = targetPinOrId;
      }

      // 2. Explicit Natural-Language Sector Auto-Detection (only if targetPin not provided and no uploaded raster is active)
      if (!targetPin && !activeUploadedRaster) {
        const q = query.toLowerCase();
        if (q.includes('at joshimath') || q.includes('in joshimath')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'joshimath-subsidence');
        } else if (q.includes('at siachen') || q.includes('in siachen')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'siachen-glacier');
        } else if (q.includes('at pokhran') || q.includes('in pokhran')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'pokhran-range');
        } else if (q.includes('in brahmaputra') || q.includes('at kaziranga')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'brahmaputra-flood');
        } else if (q.includes('at galwan') || q.includes('in galwan')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'galwan-sar');
        } else if (q.includes('at sriharikota') || q.includes('in sriharikota') || q.includes('at shar')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'sdsc-sriharikota');
        } else if (q.includes('at malacca') || q.includes('in malacca')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'malacca-chokepoint');
        } else if (q.includes('at suez') || q.includes('in suez')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'suez-canal');
        } else if (q.includes('taiwan strait')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'taiwan-strait');
        } else if (q.includes('at tarapur') || q.includes('in tarapur')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'tarapur-npp');
        } else if (q.includes('at isro') || q.includes('at sac') || q.includes('in ahmedabad')) {
          targetPin = TACTICAL_PINS.find((p) => p.id === 'isro-sac');
        }
      }

      if (!targetPin) {
        targetPin = selectedPin || TACTICAL_PINS[0];
      }

      // 3. Modality Auto-Detection if not explicitly supplied
      let targetModality = modality;
      if (!targetModality) {
        const q = query.toLowerCase();
        if (
          q.includes('between') ||
          q.includes('change') ||
          q.includes('t1') ||
          q.includes('t2') ||
          q.includes('delta') ||
          q.includes('differencing')
        ) {
          targetModality = 'bitemporal';
        } else if (
          q.includes('cloud') ||
          q.includes('sar') ||
          q.includes('radar') ||
          q.includes('pierce') ||
          q.includes('penetrate') ||
          q.includes('monsoon') ||
          q.includes('dielectric')
        ) {
          targetModality = 'cross_modal';
        } else {
          targetModality = activeModality;
        }
      }

      // Update selected target and modality
      setSelectedPin(targetPin);
      if (targetModality && targetModality !== activeModality) {
        setActiveModality(targetModality);
        setSwipeActive(targetModality === 'bitemporal');
      }

      setOperationalDeckTab('evidence');
      executeQuery(query, targetPin, targetModality);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setMobileTab('intelligence');
      }
    },
    [selectedPin, activeModality, activeUploadedRaster, executeQuery]
  );

  // Handle Select GeoTIFF from Ingestion Modal or Studio
  const handleSelectGeoTIFF = (tiff: GeoTIFFMetadata) => {
    setActiveUploadedRaster(tiff.fileName);

    const lat = (tiff.bbox[1] + tiff.bbox[3]) / 2;
    const lon = (tiff.bbox[0] + tiff.bbox[2]) / 2;

    const matchingPin: TacticalGlobePin = {
      id: tiff.id,
      name: tiff.locationName || tiff.fileName,
      state: 'GEOTIFF INGESTED',
      lat,
      lon,
      zoom: 14.5,
      pitch: 45,
      badge: tiff.sensor,
      category: 'satellite',
      pinColor: '#10B981',
      symbol: '🛰️',
      recommendedQuery: `Analyze raster ${tiff.fileName} (${tiff.sensor}) for surface segmentation.`,
      description: `Ingested GeoTIFF with CRS ${tiff.crs}, GSD ${tiff.gsd}.`,
      activePasses: `${tiff.sensor} Acquired at ${tiff.acquiredAt}`,
      defcon: 4,
      country: 'India',
    };

    setSelectedPin(matchingPin);
    setActiveModality(tiff.modality);
    setSwipeActive(tiff.modality === 'bitemporal');
    setViewport({
      lat,
      lng: lon,
      zoom: 14.5,
    });

    executeQuery(
      `Ingest and analyze calibrated raster ${tiff.fileName} from ${tiff.sensor}.`,
      matchingPin,
      tiff.modality
    );
  };

  // Handle Run Benchmark Challenge
  const handleRunBenchmark = (bench: BenchmarkQuery) => {
    setActiveModality(bench.suggestedModality);
    setSwipeActive(bench.suggestedModality === 'bitemporal');

    // Map benchmark target pin accurately
    const targetPin = (bench.targetPinId && TACTICAL_PINS.find((p) => p.id === bench.targetPinId)) || selectedPin || TACTICAL_PINS[0];

    setSelectedPin(targetPin);
    executeQuery(bench.query, targetPin, bench.suggestedModality);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileTab('intelligence');
    }
  };

  // Handle Re-run Analysis from Operational Deck
  const handleRunAnalysis = useCallback(() => {
    if (!selectedPin) return;
    const currentQuery = queryResponse?.query || selectedPin.recommendedQuery;
    executeQuery(currentQuery, selectedPin, activeModality);
  }, [selectedPin, queryResponse, activeModality, executeQuery]);

  // Layer toggles (store-backed so the agent action layer can drive them)
  const handleToggleLayer = (id: string) => {
    toggleLayer(id);
  };

  const handleOpacityChange = (id: string, opacity: number) => {
    setLayerOpacity(id, opacity);
  };

  const activeLayersCount = layers.filter((l) => l.visible).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080A0F] text-slate-100 overflow-hidden font-sans select-none relative">
      {/* Launch Console Ignition Beat: single scanline sweep, ~220ms, before the camera moves */}
      {ignitionActive && (
        <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent shadow-[0_0_14px_2px_rgba(103,232,249,0.35)] sq-ignition-scanline" />
        </div>
      )}

      {/* Scrollable Landing Page View when in Landing Mode */}
      {isLandingMode && (
        <div
          id="landing-scroll-container"
          className={`fixed inset-0 overflow-y-auto z-40 select-auto transition-opacity duration-500 ${isLaunching ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          onScroll={(e) => {
            const st = e.currentTarget.scrollTop;
            setLandingScrollTop(st);
            setHeroScrollPast(st > 250);
          }}
        >
          <Landing onLaunch={handleLaunchConsole} isLaunching={isLaunching} />
        </div>
      )}

      {/* 1. Top Navigation HUD with ISRO SAC branding and Modality Switcher (Dashboard mode) */}
      {isDashboardActive && (
        <motion.div
          initial={isLaunching ? { y: -80, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 z-30 flex flex-col"
        >
          <HeaderHUD
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onJumpToSector={handleJumpToSector}
            basemap={basemap}
            onToggleBasemap={() => setBasemap((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
            onOpenSearch={() => setSearchModalOpen(true)}
            activeModality={activeModality}
            onChangeModality={handleModalityChange}
            onOpenGeoTIFFModal={() => navigateToStudio('ingestion')}
            onOpenBenchmarkModal={() => navigateToStudio('benchmarks')}
            onOpenModelStatusModal={() => navigateToStudio('audit')}
            isBackendHealthy={backendHealthy}
            aiStatus={aiStatus}
            currentStudio={currentStudio}
            onNavigateStudio={navigateToStudio}
            onToggleSituationalFeed={() => setSituationalFeedOpen((prev) => !prev)}
            situationalFeedOpen={situationalFeedOpen}
            onNavigateHome={() => navigate('/')}
          />

          {/* Fallback Mode Banner — shown when backend is unreachable and we're serving cached/sample data */}
          {!backendHealthy && usingFallbackData && (
            <div className="w-full bg-amber-950/30 border-b border-amber-500/30 px-3 sm:px-4 py-1.5 shrink-0">
              <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center space-x-2 text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>BACKEND UNREACHABLE — Showing cached sample sectors & simulated constellation timeline</span>
                  <ProvenanceBadge variant="SIMULATED" size="xs" />
                </div>
                <span className="text-slate-500">Live queries & real STAC passes unavailable</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Secondary Header Subordinate Strip (Dashboard mode utility controls) */}
      {!isLandingMode && currentStudio === 'dashboard' && (
        <div
          id="secondary-header-strip"
          className="w-full h-8 bg-sq-bg-1 border-b border-sq-border-1 px-3 sm:px-4 flex items-center justify-between text-[10px] font-mono text-slate-400 select-none shrink-0"
        >
          {/* Left: Model status badge */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id="secondary-model-status-btn"
              onClick={() => navigateToStudio('audit')}
              title="Inspect ISRO SAC Compliant Model Registry (live backend status)"
              className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer hover:scale-[1.01] ${
                backendHealthy
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              }`}
            >
              <Cpu className="w-2.5 h-2.5 shrink-0" />
              <span className="w-[180px] sm:w-[220px] truncate text-left">
                {aiStatus?.active_model || (backendHealthy ? 'Checking model status…' : 'Model Unavailable')}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-0.5" />
            </button>
          </div>

          {/* Middle: Spectral Band Switcher, AOI Draw, & Briefing Report Export */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Spectral Band Switcher */}
            <div className="flex items-center space-x-1 bg-[#0D121B] p-0.5 rounded border border-[#1E2638]">
              {(['RGB', 'NIR', 'SAR'] as SensorBand[]).map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setActiveSensorBand(band)}
                  title={`Switch active sensor band to ${band}`}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all cursor-pointer ${
                    activeSensorBand === band
                      ? band === 'SAR'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-xs'
                        : band === 'NIR'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-xs'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {band === 'RGB' ? 'RGB' : band === 'NIR' ? 'NIR (CIR)' : 'SAR (RADAR)'}
                </button>
              ))}
            </div>

            {/* Custom AOI Drawing Button */}
            <button
              type="button"
              id="top-aoi-draw-btn"
              onClick={() => setIsDrawingAoi((prev) => !prev)}
              title={isDrawingAoi ? 'Drawing Active: Click & drag on map' : 'Draw Custom Area of Interest (AOI)'}
              className={`h-6 flex items-center space-x-1.5 px-2 rounded font-mono text-[9px] border transition-colors cursor-pointer ${
                isDrawingAoi
                  ? 'bg-amber-500/20 border-amber-500/70 text-amber-200 font-bold shadow-xs'
                  : drawnAoi
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                  : 'bg-sq-bg-2 hover:bg-sq-bg-3 border-sq-border-2 text-slate-300 hover:text-white'
              }`}
            >
              <Square className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{isDrawingAoi ? 'DRAWING AOI...' : drawnAoi ? 'AOI ACTIVE' : 'DRAW AOI'}</span>
            </button>

            {/* Tactical Briefing Report Export */}
            <button
              type="button"
              id="top-briefing-export-btn"
              onClick={() => setIsBriefingModalOpen(true)}
              title="Generate & Export Cryptographic Tactical Briefing Report"
              className="h-6 flex items-center space-x-1.5 px-2 bg-sq-bg-2 hover:bg-sq-bg-3 border border-sq-border-2 hover:border-blue-500/50 rounded font-mono text-[9px] text-cyan-300 hover:text-white transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>BRIEFING</span>
            </button>
          </div>

          {/* Right: Situational Incident Feed & Basemap Toggles */}
          <div className="flex items-center space-x-2">
            {/* Situational Incident Feed Toggle */}
            <button
              type="button"
              id="secondary-feed-toggle-btn"
              onClick={() => setSituationalFeedOpen((prev) => !prev)}
              title="Toggle Live GEOINT Alerts & Constellation Passes"
              className={`h-6 flex items-center space-x-1.5 px-2 rounded font-mono text-[9px] transition-colors cursor-pointer border ${
                situationalFeedOpen
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                  : 'bg-sq-bg-2 hover:bg-sq-bg-3 border-sq-border-2 text-slate-300'
              }`}
            >
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>Feed</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </button>

            {/* Basemap Toggle */}
            <button
              type="button"
              id="secondary-basemap-toggle-btn"
              onClick={() => setBasemap((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
              title={`Switch Basemap (Current: ${basemap.toUpperCase()})`}
              className="h-6 flex items-center space-x-1.5 px-2 bg-sq-bg-2 hover:bg-sq-bg-3 border border-sq-border-2 hover:border-slate-500 rounded text-slate-300 hover:text-white transition-colors duration-150 font-mono text-[9px] cursor-pointer"
            >
              {basemap === 'dark' ? (
                <>
                  <MapIcon className="w-3 h-3 text-slate-300 shrink-0" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Satellite className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Sat</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Honest error banner: shown with explicit Retry and Dismiss controls */}
      {queryError && (
        <div className="px-4 py-2 bg-red-950/80 border-b border-red-500/40 text-red-200 text-xs font-mono flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>Query execution failed: <strong>{queryError}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            {selectedPin && (
              <button
                onClick={() => handleExecuteQuery(selectedPin.recommendedQuery)}
                className="px-2.5 py-1 bg-red-900/80 hover:bg-red-800 border border-red-500/50 rounded text-[11px] font-semibold text-white transition-colors cursor-pointer"
              >
                RETRY QUERY
              </button>
            )}
            <button
              onClick={() => setQueryError(null)}
              className="p-1 hover:bg-red-900/50 rounded text-red-400 hover:text-white transition-colors cursor-pointer"
              title="Dismiss Error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )}

      {/* 2. Main Workspace: Edge-to-Edge Canvas + Floating Tactical Tools + Right Operational Deck */}
      <div className={`flex-1 relative flex overflow-hidden ${isLandingMode && !isLaunching ? 'pointer-events-none' : ''}`}>
        {/* Core Unified Map Viewport (Animates smoothly from right hero globe to left dashboard canvas) */}
        <div
          id="tactical-map-viewport"
          style={
            isLandingMode && launchPhase === 'idle'
              ? {
                  position: 'fixed',
                  left: 'calc(100% - min(700px, 48vw) - 2%)',
                  top: '50%',
                  transform: `translate3d(0, calc(-50% - ${landingScrollTop}px), 0)`,
                  width: 'min(700px, 48vw)',
                  height: 'min(700px, 48vw)',
                  zIndex: 0,
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }
              : launchPhase === 'zoom-in' || launchPhase === 'glide-left'
              ? {
                  position: 'fixed',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 30,
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }
              : undefined
          }
          className={`border-none shadow-none rounded-none overflow-hidden ${
            isLandingMode && launchPhase === 'idle'
              ? `hidden lg:block pointer-events-none select-none transition-[opacity] duration-500 ease-out ${
                  heroScrollPast ? 'opacity-0' : 'opacity-100'
                }`
              : launchPhase === 'zoom-in'
              ? 'block opacity-100 pointer-events-none'
              : launchPhase === 'glide-left'
              ? 'block opacity-100 pointer-events-auto'
              : isLaunching
              ? 'fixed inset-0 z-30 opacity-100 pointer-events-auto'
              : 'flex-1 relative h-full w-full pointer-events-auto'
          }`}
        >
          {/* Exactly ONE MapCanvas instance rendered across entire app */}
          <MapCanvas
            ref={publishMapHandle}
            pins={TACTICAL_PINS}
            selectedCategory={selectedCategory}
            selectedPin={selectedPin}
            onSelectPin={handleSelectPin}
            basemap={basemap}
            projection={projection}
            swipeActive={swipeActive}
            queryResponse={queryResponse}
            layers={layers}
            onViewportChange={setViewport}
            onToggleLayersDrawer={() => setLayersDrawerOpen((prev) => !prev)}
            layersDrawerOpen={layersDrawerOpen}
            activeLayersCount={activeLayersCount}
            onToggleSwipe={() => setSwipeActive((prev) => !prev)}
            onToggleProjection={() => setProjection((prev) => (prev === 'globe' ? 'mercator' : 'globe'))}
            onToggleBasemap={() => setBasemap((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
            hideSwipeBadges={!!currentStudio || isLandingMode}
            sliderPercent={curtainPercent}
            onSliderChange={handleCurtainChange}
            t1Date={t1Date}
            t2Date={t2Date}
            activeSensorBand={activeSensorBand}
            onChangeSensorBand={setActiveSensorBand}
            activePass={activeTimelinePass}
            temporalProgress={curtainPercent}
            isLandingMode={isLandingMode}
            isLaunching={isLaunching}
            isDrawingAoi={isDrawingAoi}
            onToggleDrawAoi={() => setIsDrawingAoi((prev) => !prev)}
            drawnAoi={drawnAoi}
            onDrawnAoiChange={setDrawnAoi}
            onQueryFollowup={(q) => handleExecuteQuery(q)}
            isBriefingModalOpen={isBriefingModalOpen}
            onCloseBriefingModal={() => setIsBriefingModalOpen(false)}
          />
        </div>

        {/* Operational Deck "Docking" Entrance: renders a preview of the deck sliding in
            from the right, timed to the glide-left phase, so it arrives at the same moment
            the map docks to the left instead of popping in after the fact. Handed off
            seamlessly to the real deck below once isLandingMode flips false. */}
        {isLandingMode && launchPhase === 'glide-left' && (
          <div className="hidden md:block fixed inset-y-0 right-0 z-30 pointer-events-none">
            <motion.div
              className="h-full"
              initial={{ x: 384, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            >
              <RightOperationalPanel
                selectedPin={selectedPin}
                queryResponse={queryResponse}
                isOpen={true}
                onToggleOpen={() => {}}
                onRunAnalysis={() => {}}
                isAnalyzing={isAnalyzing}
                activeModality={activeModality}
                forcedTab={operationalDeckTab}
                onTabChange={() => {}}
                activeSensorBand={activeSensorBand}
                onChangeSensorBand={setActiveSensorBand}
              />
            </motion.div>
          </div>
        )}

        {/* Dashboard Tools & Overlays */}
        {!isLandingMode && (
          <>
            {/* Tactical Over-the-Map HUD: Coordinate Telemetry & AI Model Bubble */}
            <div className="absolute top-3 left-3 sm:left-4 z-20 pointer-events-auto select-none max-w-[calc(100%-416px)]">
              {/* Unified Telemetry + AI Model HUD Strip — single visual object with internal divider */}
              <div
                id="tactical-hud-strip"
                className={`flex items-center bg-sq-bg-1/90 border border-sq-border-1 backdrop-blur-md rounded-lg shadow-xl overflow-hidden ${justDocked ? 'sq-dock-pulse' : ''}`}
              >
                {/* Left: Coordinate Telemetry */}
                <div
                  id="tactical-coordinate-bubble"
                  className="flex items-center space-x-2 px-3 py-1.5 text-[10px] font-mono text-slate-300 whitespace-nowrap"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-bold text-slate-100 tracking-tight truncate max-w-[150px] sm:max-w-[200px]">
                    {selectedPin?.name || 'ISRO SAC Ahmedabad'}
                  </span>
                  <span className="text-slate-600 shrink-0">|</span>
                  <span className="text-slate-300 shrink-0">
                    {Math.abs(viewport.lat).toFixed(4)}° {viewport.lat >= 0 ? 'N' : 'S'} / {Math.abs(viewport.lng).toFixed(4)}° {viewport.lng >= 0 ? 'E' : 'W'}
                  </span>
                  <span className="text-slate-600 shrink-0">|</span>
                  <span className="text-cyan-400 font-bold shrink-0">Z: {viewport.zoom.toFixed(1)}</span>
                  {selectedPin?.badge && (
                    <>
                      <span className="text-slate-600 shrink-0">|</span>
                      <span className="px-1.5 py-0.5 rounded bg-sq-bg-2 border border-sq-border-2 text-[9px] text-amber-300/90 font-mono shrink-0 hidden md:inline">
                        {selectedPin.badge}
                      </span>
                    </>
                  )}
                </div>

                {/* Internal divider */}
                <div className="w-px h-5 bg-sq-border-1 shrink-0" />

                {/* Right: AI Model Intelligence */}
                <button
                  type="button"
                  id="tactical-ai-bubble"
                  onClick={() => navigateToStudio(currentStudio === 'audit' ? 'dashboard' : 'audit')}
                  title={currentStudio === 'audit' ? "Close Auditable Execution Ledger" : "Active Local Neural Inference (Qwen2.5-3B Local Ollama / MPS) - Click to Inspect"}
                  className={`flex items-center space-x-2 px-2.5 py-1.5 text-[10px] font-mono whitespace-nowrap cursor-pointer transition-all active:scale-95 group ${
                    currentStudio === 'audit'
                      ? 'text-cyan-200 bg-[#142033]'
                      : 'text-cyan-200 hover:bg-[#121824]'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse group-hover:rotate-12 transition-transform" />
                  <span className="font-bold text-cyan-300 truncate max-w-[180px]">
                    {aiStatus?.active_model || 'Qwen2.5-3B (Local Ollama / MPS)'}
                  </span>
                  <span className="text-cyan-700 shrink-0">|</span>
                  <span className="text-[9px] text-emerald-400 font-semibold shrink-0">LOCAL MPS</span>
                </button>
              </div>
            </div>
            {/* Vision-Language Query Prompt Bar (Desktop) */}
          <div className="hidden md:block">
            <QueryPromptBar
              activeModality={activeModality}
              onChangeModality={handleModalityChange}
              onExecuteQuery={handleExecuteQuery}
              isProcessing={isAnalyzing}
              activeSectorName={selectedPin?.name || 'Selected Sector'}
              queryResponse={queryResponse}
              queryError={queryError}
              onOpenDeckTab={handleOpenDeckTab}
              onFlyToSector={handleFlyToActiveSector}
              liveStreamEnabled={liveStreamEnabled}
              onToggleLiveStream={() => setLiveStreamEnabled((prev) => !prev)}
              activeAoi={drawnAoi}
              onClearAoi={() => setDrawnAoi(null)}
            />
          </div>

          {/* Mobile Tactical Quick-Info HUD Card (Only visible when mobileTab is 'map') */}
          {mobileTab === 'map' && (
            <div className="md:hidden absolute top-2 left-2 right-2 z-20 pointer-events-auto select-none">
              <div className="bg-gradient-to-b from-[#161C28]/95 via-[#10141E]/95 to-[#0B0E14]/95 border border-[#263248] rounded-xl p-2.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between text-[10px] font-mono pb-1.5 border-b border-[#1E273A]">
                  <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                    <span className="font-bold text-slate-100 truncate">{selectedPin?.name || 'Active Operational Sector'}</span>
                  </div>
                  <span className="text-cyan-400 font-bold shrink-0">Z: {viewport.zoom.toFixed(1)}</span>
                </div>

                <div className="py-1.5 flex items-center justify-between text-[11px] gap-2">
                  <div className="text-slate-300 font-mono text-[10px] pr-1 flex items-center flex-wrap gap-x-1.5 gap-y-0.5 min-w-0">
                    <span className="whitespace-nowrap"><span className="text-slate-400">Class:</span> <span className="text-slate-100 font-semibold">{queryResponse?.findings?.changeClass || 'N/A'}</span></span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="whitespace-nowrap"><span className="text-slate-400">Area:</span> <span className="text-slate-100 font-semibold">{queryResponse?.findings?.surfaceAreaModifiedKm2 != null ? `+${queryResponse.findings.surfaceAreaModifiedKm2} km²` : 'N/A'}</span></span>
                  </div>
                  <button
                    onClick={() => setMobileTab('intelligence')}
                    className="px-2 py-1 bg-gradient-to-b from-[#2A5288] to-[#1E3B63] hover:from-[#3564A3] hover:to-[#254A7C] border border-blue-400/40 text-white rounded text-[10px] font-mono font-semibold shrink-0 flex items-center space-x-1 active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    <span className="whitespace-nowrap">REPORT</span>
                    <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                  </button>
                </div>

                {/* Mini quick pills */}
                <div className="flex items-center space-x-1.5 pt-1 border-t border-[#1C2436] text-[9px] font-mono text-slate-400 overflow-x-auto no-scrollbar">
                  <span className="text-slate-400 shrink-0">Sensor:</span>
                  <span className="text-slate-300 shrink-0">{selectedPin?.activePasses?.split('&')[0] || 'N/A'}</span>
                  <span className="text-slate-600 shrink-0">•</span>
                  <span className="text-slate-400 shrink-0">Modality:</span>
                  <span className="text-slate-300 shrink-0 uppercase">{activeModality.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Left Mission Layers Drawer (Shared for Desktop & Mobile) */}
          <LayersPanel
            isOpen={layersDrawerOpen}
            onClose={() => setLayersDrawerOpen(false)}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            onOpacityChange={handleOpacityChange}
          />

          {/* Collapsible Left Situational Feed Drawer (Alerts, Overpasses, Layers) */}
          <SituationalFeedDrawer
            isOpen={situationalFeedOpen}
            onClose={() => setSituationalFeedOpen(false)}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            onOpacityChange={handleOpacityChange}
            pins={TACTICAL_PINS}
            selectedPin={selectedPin}
            onSelectPin={handleSelectPin}
            onExecuteQueryForSector={(pin) => executeQuery(pin.recommendedQuery, pin, activeModality)}
          />

          {/* Active Dedicated Studio Overlays */}
          {currentStudio === 'bitemporal' && (
            <BitemporalStudio
              queryResponse={queryResponse}
              selectedPin={selectedPin}
              onExecuteQuery={(q) => handleExecuteQuery(q, 'bitemporal')}
              sliderPercent={curtainPercent}
              onSliderChange={handleCurtainChange}
              isAnalyzing={isAnalyzing}
              t1Date={t1Date}
              t2Date={t2Date}
              onClose={() => navigateToStudio('dashboard')}
            />
          )}

          {currentStudio === 'crossmodal' && (
            <CrossmodalStudio
              queryResponse={queryResponse}
              selectedPin={selectedPin}
              onExecuteQuery={(q) => handleExecuteQuery(q, 'cross_modal')}
              isAnalyzing={isAnalyzing}
              onClose={() => navigateToStudio('dashboard')}
            />
          )}

          {currentStudio === 'grounding' && (
            <GroundingStudio
              queryResponse={queryResponse}
              selectedPin={selectedPin}
              onExecuteQuery={(q) => handleExecuteQuery(q, 'single_image')}
              isAnalyzing={isAnalyzing}
              confidenceThreshold={confidenceThreshold}
              onConfidenceChange={setConfidenceThreshold}
              iouThreshold={iouThreshold}
              onIouChange={setIouThreshold}
              onClose={() => navigateToStudio('dashboard')}
            />
          )}

          {currentStudio === 'benchmarks' && (
            <BenchmarkStudio
              onRunBenchmarkQuery={handleRunBenchmark}
              onClose={() => navigateToStudio('dashboard')}
            />
          )}

          {currentStudio === 'ingestion' && (
            <IngestionStudio
              onSelectGeoTIFF={handleSelectGeoTIFF}
              onClose={() => navigateToStudio('dashboard')}
            />
          )}

          {currentStudio === 'audit' && (
            <AuditStudio
              queryResponse={queryResponse}
              aiStatus={aiStatus}
              isBackendHealthy={backendHealthy}
              onClose={() => navigateToStudio('dashboard')}
            />
          )}

        {/* Desktop Operational Intelligence Deck with Agent DAG */}
        <div className="hidden md:block h-full">
          <RightOperationalPanel
            selectedPin={selectedPin}
            queryResponse={queryResponse}
            isOpen={operationalDeckOpen}
            onToggleOpen={() => setOperationalDeckOpen((prev) => !prev)}
            onRunAnalysis={handleRunAnalysis}
            onExecutePrompt={(prompt, mod) => executeQuery(prompt, selectedPin, mod || activeModality, false)}
            onResetAnalysis={handleResetAnalysis}
            isAnalyzing={isAnalyzing}
            activeModality={activeModality}
            forcedTab={operationalDeckTab}
            onTabChange={(t) => setOperationalDeckTab(t)}
            activeSensorBand={activeSensorBand}
            onChangeSensorBand={setActiveSensorBand}
            onHighlightEvidence={(chip) => {
              console.log('Highlighting evidence chip:', chip);
            }}
          />
        </div>

        {/* Mobile Full-Screen Overlays (Only active when mobileTab is not 'map') */}
        <div className="md:hidden">
          {mobileTab === 'intelligence' && (
            <div className="absolute inset-0 z-30 bg-[#080A0F]">
              <RightOperationalPanel
                selectedPin={selectedPin}
                queryResponse={queryResponse}
                isOpen={true}
                onToggleOpen={() => setMobileTab('map')}
                onRunAnalysis={handleRunAnalysis}
                onExecutePrompt={(prompt, mod) => executeQuery(prompt, selectedPin, mod || activeModality, false)}
                onResetAnalysis={handleResetAnalysis}
                isAnalyzing={isAnalyzing}
                activeModality={activeModality}
                forcedTab="evidence"
                onTabChange={(tab) => setMobileTab(tab === 'evidence' ? 'intelligence' : tab)}
                activeSensorBand={activeSensorBand}
                onChangeSensorBand={setActiveSensorBand}
                isMobileModal={true}
                onCloseMobileModal={() => setMobileTab('map')}
              />
            </div>
          )}

          {mobileTab === 'dag' && (
            <div className="absolute inset-0 z-30 bg-[#080A0F]">
              <RightOperationalPanel
                selectedPin={selectedPin}
                queryResponse={queryResponse}
                isOpen={true}
                onToggleOpen={() => setMobileTab('map')}
                onRunAnalysis={handleRunAnalysis}
                onExecutePrompt={(prompt, mod) => executeQuery(prompt, selectedPin, mod || activeModality, false)}
                onResetAnalysis={handleResetAnalysis}
                isAnalyzing={isAnalyzing}
                activeModality={activeModality}
                forcedTab="dag"
                onTabChange={(tab) => setMobileTab(tab === 'evidence' ? 'intelligence' : tab)}
                activeSensorBand={activeSensorBand}
                onChangeSensorBand={setActiveSensorBand}
                isMobileModal={true}
                onCloseMobileModal={() => setMobileTab('map')}
              />
            </div>
          )}

          {mobileTab === 'telemetry' && (
            <div className="absolute inset-0 z-30 bg-[#080A0F]">
              <RightOperationalPanel
                selectedPin={selectedPin}
                queryResponse={queryResponse}
                isOpen={true}
                onToggleOpen={() => setMobileTab('map')}
                onRunAnalysis={handleRunAnalysis}
                onExecutePrompt={(prompt, mod) => executeQuery(prompt, selectedPin, mod || activeModality, false)}
                onResetAnalysis={handleResetAnalysis}
                isAnalyzing={isAnalyzing}
                activeModality={activeModality}
                forcedTab="telemetry"
                onTabChange={(tab) => setMobileTab(tab === 'evidence' ? 'intelligence' : tab)}
                activeSensorBand={activeSensorBand}
                onChangeSensorBand={setActiveSensorBand}
                isMobileModal={true}
                onCloseMobileModal={() => setMobileTab('map')}
              />
            </div>
          )}

          {mobileTab === 'query' && (
            <div className="absolute inset-0 z-30 bg-[#0A0D14] overflow-y-auto">
              <QueryPromptBar
                activeModality={activeModality}
                onChangeModality={handleModalityChange}
                onExecuteQuery={handleExecuteQuery}
                isProcessing={isAnalyzing}
                activeSectorName={selectedPin?.name || 'Selected Sector'}
                isFullView={true}
                queryResponse={queryResponse}
                queryError={queryError}
                onOpenDeckTab={handleOpenDeckTab}
                onFlyToSector={handleFlyToActiveSector}
              liveStreamEnabled={liveStreamEnabled}
              onToggleLiveStream={() => setLiveStreamEnabled((prev) => !prev)}
              />
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Interactive temporal scrubber bar */}
      {!isLandingMode && (
        <TemporalScrubber
          timeRange={activeTimeRange}
          onChangeTimeRange={(r) => {
            setActiveTimeRange(r);
            updateUrlState({ timeRange: r });
          }}
          sliderValue={curtainPercent}
          onSliderChange={handleCurtainChange}
          sectorId={selectedPin?.id || 'isro-sac'}
          sectorName={selectedPin?.name}
          onPassChange={setActiveTimelinePass}
          isCurtainMode={swipeActive}
          onToggleCurtainMode={() => setSwipeActive((prev) => !prev)}
          isBitemporal={currentStudio === 'bitemporal' || activeModality === 'bitemporal'}
          t1Date={t1Date}
          t2Date={t2Date}
        />
      )}

      {/* Mobile Bottom Tactical Navigation Bar */}
      {!isLandingMode && (
        <nav
          id="mobile-bottom-nav"
          className="md:hidden h-14 bg-gradient-to-b from-[#141926] to-[#0A0D14] border-t border-[#1F273A] z-40 flex items-center justify-around px-1 select-none shrink-0 shadow-2xl"
        >
          <button
            onClick={() => setMobileTab('map')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              mobileTab === 'map' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span className="text-[10px] font-mono mt-0.5">Map</span>
          </button>

          <button
            onClick={() => setMobileTab('intelligence')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
              mobileTab === 'intelligence' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-mono mt-0.5">Report</span>
            {queryResponse && (
              <span className="absolute top-2 right-5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-[#141926]" />
            )}
          </button>

          <button
            onClick={() => setMobileTab('dag')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              mobileTab === 'dag' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-4 h-4" />
            <span className="text-[10px] font-mono mt-0.5">DAG</span>
          </button>

          <button
            onClick={() => setMobileTab('telemetry')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              mobileTab === 'telemetry' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span className="text-[10px] font-mono mt-0.5">Sensors</span>
          </button>

          <button
            onClick={() => setMobileTab('query')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              mobileTab === 'query' ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span className="text-[10px] font-mono mt-0.5">Ask AI</span>
          </button>
        </nav>
      )}

      {/* GeoTIFF / TIFF Ingestion Modal */}
      <GeoTIFFModal
        isOpen={geoTIFFModalOpen}
        onClose={() => setGeoTIFFModalOpen(false)}
        onSelectGeoTIFF={handleSelectGeoTIFF}
      />

      {/* Official SIH26167 Benchmark Suite Modal */}
      <BenchmarkModal
        isOpen={benchmarkModalOpen}
        onClose={() => setBenchmarkModalOpen(false)}
        onRunBenchmark={handleRunBenchmark}
      />

      {/* Specialist Model Registry & Status Modal */}
      <ModelStatusModal
        isOpen={modelStatusModalOpen}
        onClose={() => setModelStatusModalOpen(false)}
        isBackendHealthy={backendHealthy}
        aiStatus={aiStatus}
        onRefreshAIStatus={refreshAIStatus}
      />

      {/* Spotlight Search Modal (Cmd+K / Ctrl+K) */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onExecuteQuery={(q, pin) => handleExecuteQuery(q, activeModality, pin)}
      />

    </div>
  );
}
