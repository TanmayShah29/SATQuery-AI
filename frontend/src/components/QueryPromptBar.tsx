import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  HelpCircle,
  Eye,
  Radar,
  Split,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Minus,
  Flame,
  Check,
  Copy,
  MapPin,
  Network,
  Cpu,
  RefreshCw,
  X,
  AlertTriangle,
  ExternalLink,
  Satellite,
  Globe,
} from 'lucide-react';
import type { ModalityMode, BenchmarkQuery, QueryResponse } from '../types';
import { OFFICIAL_BENCHMARK_QUERIES } from '../config/tacticalData';

export interface QueryPromptBarProps {
  activeModality: ModalityMode;
  onChangeModality: (mode: ModalityMode) => void;
  onExecuteQuery: (query: string, modality?: ModalityMode, targetPinId?: string) => void;
  isProcessing: boolean;
  activeSectorName: string;
  isFullView?: boolean;
  queryResponse?: QueryResponse | null;
  queryError?: string | null;
  onOpenDeckTab?: (tab: 'dag' | 'evidence' | 'telemetry') => void;
  onFlyToSector?: () => void;
  liveStreamEnabled?: boolean;
  onToggleLiveStream?: () => void;
}

export const QueryPromptBar: React.FC<QueryPromptBarProps> = ({
  activeModality,
  onChangeModality,
  onExecuteQuery,
  isProcessing,
  activeSectorName,
  isFullView = false,
  queryResponse = null,
  queryError = null,
  onOpenDeckTab,
  onFlyToSector,
  liveStreamEnabled = false,
  onToggleLiveStream,
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showNotification, setShowNotification] = useState(true);

  useEffect(() => {
    if (queryResponse) {
      setShowNotification(true);
    }
  }, [queryResponse]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = queryInput.trim();
    if (!text || isProcessing) return;

    setLastSubmittedQuery(text);
    // Do NOT forward the current modality: the operator's words carry the intent
    // ("SAR radar pierce monsoon cloud" must reach the cross-modal pipeline even
    // while the toggle still reads bitemporal). The app resolves the modality from
    // the text and falls back to the active toggle when the text is neutral.
    onExecuteQuery(text);
    setQueryInput('');
  };

  const handleSelectBenchmark = (bench: BenchmarkQuery) => {
    setLastSubmittedQuery(bench.query);
    onChangeModality(bench.suggestedModality);
    onExecuteQuery(bench.query, bench.suggestedModality, bench.targetPinId);
    setQueryInput('');
    setShowSuggestions(false);
  };

  const findings = queryResponse?.findings;

  // --------------------------------------------------------------------------
  // Mobile / Full-Page View (Rendered when mobile bottom nav "Ask AI" is open)
  // --------------------------------------------------------------------------
  if (isFullView) {
    return (
      <div className="w-full h-full p-4 overflow-y-auto bg-gradient-to-b from-[#131822] via-[#0E121B] to-[#090C12] text-slate-200">
        <div className="max-w-xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#20293A]">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold font-mono text-slate-100 uppercase tracking-wide">
                SatQuery AI // Divya-Drishti VLM
              </h2>
            </div>
            <button
              type="button"
              onClick={onFlyToSector}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1A2233] border border-[#27354E] text-slate-300 hover:text-white flex items-center space-x-1 transition-colors"
            >
              <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[120px]">{activeSectorName}</span>
            </button>
          </div>

          {/* Modality Selector */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 font-semibold mb-1.5 block">
              PIPELINE MODALITY ARCHETYPE:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeModality('single_image')}
                className={`p-2.5 rounded-lg border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 ${
                  activeModality === 'single_image'
                    ? 'bg-[#1F2B3E] border-slate-400 text-white shadow-md'
                    : 'bg-[#121622] border-[#222B3D] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-mono text-xs font-semibold">
                  <Eye className="w-3.5 h-3.5 text-slate-300" />
                  <span>SINGLE OPTICAL</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Scene captioning & bounding box grounding</p>
              </button>

              <button
                type="button"
                onClick={() => onChangeModality('cross_modal')}
                className={`p-2.5 rounded-lg border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 ${
                  activeModality === 'cross_modal'
                    ? 'bg-[#1F2B3E] border-slate-400 text-white shadow-md'
                    : 'bg-[#121622] border-[#222B3D] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-mono text-xs font-semibold">
                  <Radar className="w-3.5 h-3.5 text-slate-300" />
                  <span>CROSS-MODAL</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Optical + SAR radar cloud-piercing fusion</p>
              </button>

              <button
                type="button"
                onClick={() => onChangeModality('bitemporal')}
                className={`p-2.5 rounded-lg border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 ${
                  activeModality === 'bitemporal'
                    ? 'bg-[#1F2B3E] border-slate-400 text-white shadow-md'
                    : 'bg-[#121622] border-[#222B3D] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-mono text-xs font-semibold">
                  <Split className="w-3.5 h-3.5 text-slate-300" />
                  <span>BI-TEMPORAL</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">T1 vs T2 delta change detection</p>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-mono text-slate-400 font-semibold mb-1 block">
                QUERY OR INSTRUCTION:
              </label>
              <textarea
                rows={3}
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Ask SatQuery in plain English... (e.g. 'Pierce monsoon cloud cover with Sentinel-1 SAR and identify new construction at Ahmedabad SAC')"
                disabled={isProcessing}
                className="w-full p-3 rounded-lg bg-[#0C1018] border border-[#263145] text-xs text-slate-100 placeholder-slate-400 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:border-blue-400"
              />
            </div>

            <button
              type="submit"
              disabled={!queryInput.trim() || isProcessing}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-b from-[#2A5288] to-[#1E3B63] hover:from-[#3564A3] hover:to-[#254A7C] border border-blue-400/40 text-white font-mono text-xs font-semibold shadow-md flex items-center justify-center space-x-2 transition-colors duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>ORCHESTRATING VLM AGENT...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>EXECUTE SATQUERY PIPELINE</span>
                </>
              )}
            </button>
          </form>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-3 rounded-lg bg-blue-950/60 border border-blue-500/40 flex items-center space-x-2.5 animate-pulse text-xs font-mono text-blue-200">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
              <span>Orchestrating specialist models across {activeSectorName}...</span>
            </div>
          )}

          {/* Error Banner */}
          {queryError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 flex items-center space-x-2.5 text-xs font-mono text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Backend Request Error: {queryError}</span>
            </div>
          )}

          {/* Live In-App AI Response Card (Mobile) */}
          {queryResponse && (
            <div className="p-4 rounded-xl bg-[#0F1420] border border-[#232F46] shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E283C]">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-mono text-xs font-bold text-slate-100">AI MISSION RESPONSE</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                    {(queryResponse.confidence * 100).toFixed(1)}% CONF
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {queryResponse.latency_ms} ms
                </span>
              </div>

              {queryResponse.query && (
                <div className="text-[11px] font-mono text-slate-400 italic">
                  &ldquo;{queryResponse.query}&rdquo;
                </div>
              )}

              {/* Live Satellite Stream Ingestion & Active AI Engine (Mobile) */}
              {queryResponse.live_satellite_stream && (
                <div className="p-2.5 rounded-lg bg-[#0C121E] border border-[#1D293D] flex items-center justify-between gap-2 text-[10px] font-mono">
                  <div className="flex items-center space-x-2 min-w-0">
                    {queryResponse.live_satellite_stream.thumbnail_url ? (
                      <a
                        href={queryResponse.live_satellite_stream.visual_cog_url || queryResponse.live_satellite_stream.thumbnail_url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative shrink-0 block"
                      >
                        <img
                          src={queryResponse.live_satellite_stream.thumbnail_url}
                          alt="Live Scene"
                          className="w-8 h-8 rounded object-cover border border-cyan-500/40"
                        />
                      </a>
                    ) : (
                      <div className="w-8 h-8 rounded bg-[#162032] border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Satellite className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-slate-200 font-semibold truncate text-[10px]">
                        {queryResponse.live_satellite_stream.scene_id}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        Cloud: {queryResponse.live_satellite_stream.cloud_cover_pct}%
                      </div>
                    </div>
                  </div>
                  {queryResponse.ai_engine_active && (
                    <span className="px-1.5 py-0.5 rounded bg-[#131B2C] border border-amber-500/30 text-amber-300 text-[9px] font-semibold shrink-0 truncate max-w-[120px]">
                      {queryResponse.ai_engine_active}
                    </span>
                  )}
                </div>
              )}

              <div className="text-xs text-slate-200 leading-relaxed font-sans bg-[#090C12] p-3 rounded-lg border border-[#1A2234]">
                {queryResponse.answer}
              </div>

              {/* Vector Evidence Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {findings?.changeClass && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141A28] border border-[#222E45] text-amber-300">
                    Class: {findings.changeClass}
                  </span>
                )}
                {findings?.surfaceAreaModifiedKm2 != null && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141A28] border border-[#222E45] text-cyan-300">
                    Area: +{findings.surfaceAreaModifiedKm2} km²
                  </span>
                )}
                {findings?.piercedCloudPercent != null && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141A28] border border-[#222E45] text-emerald-300">
                    Pierced: {findings.piercedCloudPercent}%
                  </span>
                )}
                {queryResponse.geojson?.features?.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141A28] border border-[#222E45] text-indigo-300">
                    {queryResponse.geojson.features.length} Grounded Vectors
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Preset Benchmarks */}
          <div className="pt-3 border-t border-[#20293A]">
            <div className="flex items-center space-x-2 mb-2">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-mono text-slate-300 font-semibold uppercase">
                Official SIH26167 Benchmark Queries
              </span>
            </div>
            <div className="space-y-2">
              {OFFICIAL_BENCHMARK_QUERIES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectBenchmark(item)}
                  className="w-full p-2.5 rounded-lg bg-[#111622] hover:bg-[#182030] border border-[#222B3D] text-left transition-colors duration-150 flex flex-col space-y-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-amber-400 font-semibold uppercase">
                      {item.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-500">{item.paperRef}</span>
                  </div>
                  <p className="text-xs text-slate-200">&ldquo;{item.query}&rdquo;</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Desktop / Tablet Minimized State
  // --------------------------------------------------------------------------
  if (isMinimized) {
    return (
      <div
        id="query-prompt-bar-minimized"
        className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 md:left-[calc((100%-416px)/2)] md:-translate-x-1/2 z-40 pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#0C1017]/95 hover:bg-[#141A26] border border-[#1E2638] hover:border-slate-500 text-slate-200 text-xs font-mono shadow-xl backdrop-blur-md transition-all active:scale-[0.98] cursor-pointer group"
          title="Expand SatQuery AI Prompt Bar"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform shrink-0" />
          <span className="font-semibold tracking-wide text-slate-100">Ask SatQuery AI</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[11px] truncate max-w-[130px]">{activeSectorName}</span>
          <span className="px-1.5 py-0.5 rounded bg-[#161D2B] border border-[#232F45] text-[9px] text-slate-300 font-mono uppercase ml-0.5">
            {activeModality.replace('_', ' ')}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 ml-1" />
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Desktop Primary Interactive Prompt Bar + In-Prompt AI Response Card
  // --------------------------------------------------------------------------
  return (
    <div
      id="query-prompt-bar-container"
      className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 md:left-[calc((100%-416px)/2)] md:-translate-x-1/2 w-[calc(100%-1.5rem)] md:w-[calc(100%-432px)] max-w-2xl lg:max-w-3xl px-1 sm:px-2 z-40 pointer-events-auto select-none transition-all duration-200"
    >
      <div className="flex flex-col space-y-2">
        {/* 1. Live Processing Indicator Pill */}
        {isProcessing && (
          <div className="p-2.5 rounded-xl bg-[#0A1220]/95 border border-cyan-500/50 shadow-[0_0_24px_rgba(6,182,212,0.25)] backdrop-blur-md flex items-center justify-between text-xs font-mono text-cyan-200 animate-pulse">
            <div className="flex items-center space-x-2 min-w-0">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                VLM Pipeline Active:
              </span>
              <span className="truncate text-slate-300 text-[11px]">
                Dispatching multi-modal reasoner across <span className="text-cyan-300 font-semibold">{activeSectorName}</span>
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#101E36] border border-cyan-500/40 text-[9px] text-cyan-300 font-mono uppercase shrink-0 ml-2">
              {activeModality.replace('_', ' ')}
            </span>
          </div>
        )}

        {/* 2. Error Notification Banner */}
        {queryError && (
          <div className="p-2.5 rounded-xl bg-red-950/90 border border-red-500/50 shadow-xl backdrop-blur-md flex items-center justify-between text-xs font-mono text-red-200">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate">
                Query Error: <span className="text-white">{queryError}</span>
              </span>
            </div>
            {lastSubmittedQuery && (
              <button
                type="button"
                onClick={() => onExecuteQuery(lastSubmittedQuery)}
                className="px-2 py-0.5 rounded bg-red-900/80 hover:bg-red-800 border border-red-500/40 text-[10px] text-white font-mono shrink-0 ml-2 cursor-pointer transition-colors"
              >
                RETRY
              </button>
            )}
          </div>
        )}

        {/* 3. Subtle Notification / Status when query is complete */}
        {queryResponse && !isProcessing && showNotification && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0C121E]/80 border border-[#1E273A] text-[10px] font-mono backdrop-blur-md">
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Grounded in <span className="text-cyan-300 font-bold">{queryResponse.telemetry?.sector_name || activeSectorName}</span> ({(queryResponse.confidence * 100).toFixed(0)}% Conf)</span>
            </div>
            <div className="flex items-center space-x-2">
              {onOpenDeckTab && (
                <button
                  type="button"
                  onClick={() => onOpenDeckTab('evidence')}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <span>View in Evidence Deck →</span>
                </button>
              )}
              <button
                type="button"
                id="close-query-notification-btn"
                onClick={() => setShowNotification(false)}
                title="Close notification bubble"
                className="p-0.5 rounded hover:bg-[#1E273A] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* 4. Primary Interactive Prompt Input Bar */}
        <div className="bg-[#0C1017]/95 border border-[#1E2638] hover:border-slate-500/60 rounded-xl p-2 sm:p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-colors duration-150">
          {/* Top Header: Active Target & Modality Mode Badge */}
          <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-[#1E2738] text-[10px] font-mono text-slate-400">
            <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
              <span className="flex items-center text-slate-200 font-semibold shrink-0">
                <Sparkles className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">SatQuery AI //</span>{' '}
                <span className="whitespace-nowrap ml-0.5">Divya-Drishti</span>
              </span>
              <span className="text-slate-600 shrink-0">|</span>
              <button
                type="button"
                onClick={onFlyToSector}
                title="Click to fly to active sector"
                className="whitespace-nowrap font-mono text-slate-300 truncate hover:text-cyan-400 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <span>Target:</span>{' '}
                <span className="text-slate-100 font-bold truncate max-w-[140px] sm:max-w-[220px]">
                  {activeSectorName}
                </span>
              </button>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0 ml-2">
              {/* Benchmark Suggestions Toggle */}
              <button
                type="button"
                id="toggle-benchmark-suggestions-btn"
                onClick={() => setShowSuggestions((prev) => !prev)}
                title="Toggle Official Benchmark Queries (VRSBench, BigEarthNet, CDVQA)"
                className={`px-2 py-0.5 rounded text-[9px] font-mono flex items-center space-x-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 cursor-pointer ${
                  showSuggestions
                    ? 'bg-[#1E2738] text-amber-300 border border-amber-500/40'
                    : 'bg-[#121824] text-slate-400 hover:text-slate-200 border border-[#202B3D]'
                }`}
              >
                <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span>Benchmarks (5)</span>
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform ${showSuggestions ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Opt-in live STAC scene ingestion (off by default; no fabricated scene when off) */}
              <button
                type="button"
                id="toggle-live-stream-btn"
                onClick={onToggleLiveStream}
                aria-pressed={liveStreamEnabled}
                title="Opt in to fetching a real live Sentinel scene from the STAC registry for this query (slower; off by default)"
                className={`px-2 py-0.5 rounded text-[9px] font-mono flex items-center space-x-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 cursor-pointer ${
                  liveStreamEnabled
                    ? 'bg-[#1E2738] text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#121824] text-slate-400 hover:text-slate-200 border border-[#202B3D]'
                }`}
              >
                <Satellite className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span>LIVE STAC {liveStreamEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {/* Modality Mode Badge with Click-to-Cycle */}
              <button
                type="button"
                onClick={() => {
                  if (activeModality === 'single_image') onChangeModality('cross_modal');
                  else if (activeModality === 'cross_modal') onChangeModality('bitemporal');
                  else onChangeModality('single_image');
                }}
                title="Click to switch pipeline modality"
                className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#141A26] hover:bg-[#1A2234] text-slate-200 border border-[#232D3F] flex items-center space-x-1 shrink-0 whitespace-nowrap cursor-pointer transition-colors"
              >
                {activeModality === 'single_image' && (
                  <>
                    <Eye className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">SINGLE VQA</span>
                    <span className="sm:hidden whitespace-nowrap">OPTICAL</span>
                  </>
                )}
                {activeModality === 'cross_modal' && (
                  <>
                    <Radar className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">CROSS-MODAL</span>
                    <span className="sm:hidden whitespace-nowrap">OPT+SAR</span>
                  </>
                )}
                {activeModality === 'bitemporal' && (
                  <>
                    <Split className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">BI-TEMPORAL</span>
                    <span className="sm:hidden whitespace-nowrap">T1 vs T2</span>
                  </>
                )}
              </button>

              {/* Minimize / Collapse Button */}
              <button
                type="button"
                id="minimize-prompt-bar-btn"
                onClick={() => setIsMinimized(true)}
                title="Minimize AI prompt bar to view unobstructed globe"
                className="w-5 h-5 rounded hover:bg-[#1E2738] text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors active:scale-95 cursor-pointer ml-1"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Primary Prompt Form */}
          <form onSubmit={handleSubmit} className="flex items-center space-x-2 mt-2">
            <div className="relative flex-1">
              <input
                id="satquery-prompt-input"
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={
                  lastSubmittedQuery
                    ? `Ask another question... (e.g. 'Pierce clouds with SAR')`
                    : `Ask SatQuery in plain English... (e.g. 'Pierce monsoon clouds at Ahmedabad SAC')`
                }
                disabled={isProcessing}
                className="w-full h-10 sm:h-11 pl-3 sm:pl-4 pr-12 rounded-lg bg-[#070A10] border border-[#1E273A] text-xs text-slate-100 placeholder-slate-400 font-sans transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:border-blue-400"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => setQueryInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>

            <button
              id="satquery-submit-btn"
              type="submit"
              disabled={!queryInput.trim() || isProcessing}
              className="h-10 sm:h-11 px-3 sm:px-5 rounded-lg bg-gradient-to-b from-[#2A5288] to-[#1E3B63] hover:from-[#3564A3] hover:to-[#254A7C] border border-blue-400/40 disabled:opacity-40 disabled:hover:from-[#2A5288] disabled:hover:to-[#1E3B63] text-white font-mono text-xs font-semibold transition-all duration-150 active:scale-[0.98] flex items-center space-x-1.5 sm:space-x-2 shrink-0 shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span className="hidden sm:inline">ORCHESTRATING...</span>
                </>
              ) : (
                <>
                  <span>RUN</span>
                  <Send className="w-3 h-3" />
                </>
              )}
            </button>
          </form>

          {/* Collapsible Benchmark Chips Carousel */}
          {showSuggestions && (
            <div className="mt-2 pt-1.5 border-t border-[#1C2433] flex items-center space-x-1.5 sm:space-x-2">
              <div className="flex items-center space-x-1 text-[9px] font-mono text-slate-400 font-semibold shrink-0 uppercase tracking-wider whitespace-nowrap">
                <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">BENCHMARKS:</span>
              </div>

              <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
                {OFFICIAL_BENCHMARK_QUERIES.map((item) => (
                  <button
                    key={item.id}
                    id={`benchmark-chip-${item.id}`}
                    onClick={() => handleSelectBenchmark(item)}
                    title={`${item.paperRef} • Category: ${item.category}`}
                    className="px-2.5 py-1 rounded-full bg-[#121824] hover:bg-[#1A2234] border border-[#202B3D] hover:border-slate-400 text-[9px] sm:text-[10px] text-slate-300 hover:text-white whitespace-nowrap transition-colors duration-150 active:scale-[0.98] flex items-center space-x-1.5 shrink-0 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 font-semibold whitespace-nowrap">
                      {item.category === 'land_cover' && 'LAND-COVER'}
                      {item.category === 'flood_water' && 'WATER/SAR'}
                      {item.category === 'bitemporal_change' && 'T1 vs T2'}
                      {item.category === 'sar_cloud_penetration' && 'CLOUD'}
                      {item.category === 'urban_infrastructure' && 'BUILT-UP'}
                    </span>
                    <span className="text-slate-300 whitespace-nowrap font-normal">
                      &ldquo;{item.query}&rdquo;
                    </span>
                    <ChevronRight className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
