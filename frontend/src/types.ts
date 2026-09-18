export type CategoryType = 'satellite' | 'disaster' | 'base' | 'radar' | 'nuclear' | 'maritime' | 'world';

export type ModalityMode = 'single_image' | 'cross_modal' | 'bitemporal';

export type SensorBand = 'RGB' | 'NIR' | 'SAR';

export interface SatellitePass {
  id: string;
  datetime: string;
  formattedDate: string;
  formattedTime: string;
  sensor: string;
  modality: 'RGB' | 'NIR' | 'SAR' | 'THERMAL';
  cloudCover: number;
  deltaPercent: number;
  changeDescription: string;
  orbit?: string;
  resolution?: string;
  is_simulated?: boolean;
  acquisition_type?: string;
}

export interface TacticalGlobePin {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  badge: string;
  category: 'satellite' | 'disaster' | 'base' | 'radar' | 'nuclear' | 'maritime';
  pinColor: string;
  symbol: string;
  recommendedQuery: string;
  description: string;
  activePasses?: string;
  defcon?: number;
  country?: string;
  region?: string;
  temporalDelta?: string;
  supportedModalities?: ModalityMode[];
  optical_t1_date?: string;
  optical_t2_date?: string;
  is_simulated?: boolean;
  is_real_image?: boolean;
}

export interface AgentExecutionNode {
  id: string;
  label: string;
  type: 'intent_parser' | 'band_dispatcher' | 'specialist_model' | 'spatial_vectorizer' | 'ui_actuation';
  status: 'completed' | 'processing' | 'idle' | 'not_implemented' | 'failed' | 'pending';
  modelUsed: string;
  latencyMs?: number | null;
  details: string;
  outputPayload?: string | null;
  /** Filled in by the frontend with the REAL outcome of each proposed action. */
  uiActionResults?: ActionResult[];
}

/**
 * Grounded UI actions (Mission: agent control of map & dashboard).
 *
 * The backend proposes an action only when its target provably exists in the
 * same response; the frontend is the only party allowed to report it as
 * executed, and only after the real store/map call succeeded.
 */
export type UIActionType =
  | 'fly_to_sector'
  | 'fly_to_bbox'
  | 'set_modality'
  | 'set_sensor_band'
  | 'set_swipe_curtain'
  | 'toggle_layer'
  | 'set_layer_opacity'
  | 'toggle_projection'
  | 'toggle_basemap'
  | 'open_panel'
  | 'open_studio'
  | 'highlight_feature'
  | 'toggle_live_stream'
  | 'run_benchmark';

export type UIActionOutcome = 'executed' | 'failed' | 'skipped';

export interface UIAction {
  type: UIActionType;
  params: Record<string, any>;
  reason: string;
  /** The backend always emits "pending"; only the frontend may change it. */
  status: 'pending';
}

export interface ActionResult {
  type: UIActionType;
  status: UIActionOutcome;
  detail: string;
}

export type StudioRoute = 'dashboard' | 'bitemporal' | 'crossmodal' | 'grounding' | 'benchmarks' | 'ingestion' | 'audit';

export type TimeRangeOption = '24h' | '7d' | '30d' | '1y' | 'all';

export interface QueryTelemetry {
  models_executed: string[];
  execution_plan: Record<string, any>;
  bbox_evaluated?: [number, number, number, number] | null;
  crs: string;
  timestamp_iso: string;
  gsd?: string;
  spectral_bands?: string[];
  polarization?: string;
  pipeline_status?: string;
  audit_hash?: string;
  sector_id?: string;
  sector_name?: string;
  sector_region?: string;
  active_passes?: string;
  sensors?: string[];
  total_latency_ms?: number;
  live_satellite_stream?: any;
  ai_engine_active?: string;
  imagery_origin?: string | null;
  imagery_distinct?: boolean | null;
  raster_is_georeferenced?: boolean | null;
  geographic_extent_verified?: boolean | null;
}

export interface LiveSatelliteStream {
  source: string;
  scene_id: string;
  acquisition_date: string;
  cloud_cover_pct: number;
  thumbnail_url?: string;
  visual_cog_url?: string;
  spectral_metrics?: {
    mean_albedo?: number;
    ndvi_proxy?: number;
    ndwi_proxy?: number;
    structural_density?: number;
  };
}

export interface AIStatusResponse {
  active_mode: 'air_gapped_offline' | 'local';
  active_model: string;
  isro_sac_compliant?: boolean;
  disqualification_safeguard?: string;
  hardware_acceleration?: string;
  live_data_sources: Array<{
    name: string;
    status: string;
    resolution: string;
  }>;
  local_engines?: Record<string, string>;
}

export interface QueryResponse {
  query: string;
  modality: ModalityMode;
  intent: 'optical_vqa' | 'sar_cloud_penetration' | 'bitemporal_change' | 'stac_discovery' | 'cross_modal_fusion' | string;
  answer: string;
  confidence: number;
  latency_ms: number;
  audit_hash?: string;
  benchmarkSource?: string;
  geojson?: GeoJSON.FeatureCollection;
  telemetry: QueryTelemetry;
  dagNodes: AgentExecutionNode[];
  live_satellite_stream?: LiveSatelliteStream | null;
  ai_engine_active?: string | null;
  /** Grounded actions the backend proposes; frontend executes and acks. */
  ui_actions?: UIAction[];
  ui_actions_source?: 'rule_based' | 'llm_planned' | string | null;
  findings?: {
    surfaceAreaModifiedKm2?: number | null;
    changeClass?: string | null;
    temporalInterval?: string | null;
    anomalyScore?: number | null;
    evidenceChips?: string[];
    piercedCloudPercent?: number | null;
    otsu_threshold?: number | null;
  };
}

export interface LayerConfig {
  id: string;
  name: string;
  category: string;
  color: string;
  assetCount?: number;
  description: string;
  visible: boolean;
  opacity: number;
  bandInfo?: string;
}

export interface SectorTarget {
  id: string;
  name: string;
  region: string;
  group: 'India Strategic' | 'Global Chokepoints' | 'Critical Infrastructure' | 'Polar & Oceanic';
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  category: 'satellite' | 'disaster' | 'base' | 'radar' | 'nuclear' | 'maritime';
  badge: string;
  is_simulated?: boolean;
  is_real_image?: boolean;
}

export interface GeoTIFFMetadata {
  id: string;
  fileName: string;
  sensor: string;
  modality: ModalityMode;
  gsd: string;
  crs: string;
  radiometric: string;
  cloudCoverPercent?: number | null;
  bands: string[];
  polarization?: string;
  acquiredAt: string;
  bbox?: [number, number, number, number] | null;
  previewUrl: string;
  locationName: string;
  isGeotiff?: boolean;
  validationNotes?: string[];
  validationPassed?: boolean;
}

export interface BenchmarkQuery {
  id: string;
  query: string;
  category: 'land_cover' | 'flood_water' | 'bitemporal_change' | 'sar_cloud_penetration' | 'urban_infrastructure';
  dataset: 'BigEarthNet.txt (arXiv:2603.29630)' | 'VRSBench' | 'RSVQA' | 'CDVQA' | 'ISRO SAC Cartosat/RISAT';
  suggestedModality: ModalityMode;
  targetPinId: string;
  paperRef?: string;
  description: string;
}

export type BasemapMode = 'dark' | 'satellite';
export type ProjectionMode = 'globe' | 'mercator';

export interface PixelInspectResult {
  coordinates: { lat: number; lon: number };
  pixel: { x: number; y: number; width: number; height: number };
  rgb: [number, number, number];
  indices: {
    albedo: number;
    ndvi: number;
    ndwi: number;
    ndbi: number;
    sar_backscatter_db: number;
  };
  land_cover_class: string;
}


