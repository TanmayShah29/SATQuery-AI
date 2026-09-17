import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Download,
  FileCode,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
  ShieldCheck,
  Zap,
  Network,
  CheckCircle2,
  Clock,
  Code2,
  CloudRain,
  Eye,
  Radar,
  Split,
  FileSpreadsheet,
  Satellite,
  Loader2,
} from 'lucide-react';
import { TelemetryGauge } from './ui/TelemetryGauge';
import { StatusBadge } from './ui/StatusBadge';
import type { TacticalGlobePin, QueryResponse, AgentExecutionNode, ModalityMode } from '../types';
import { searchLiveSTAC } from '../services/api';

interface RightOperationalPanelProps {
  selectedPin: TacticalGlobePin | null;
  queryResponse: QueryResponse | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  activeModality: ModalityMode;
  onHighlightEvidence?: (chip: string) => void;
  forcedTab?: 'dag' | 'evidence' | 'telemetry';
  onTabChange?: (tab: 'dag' | 'evidence' | 'telemetry') => void;
  isMobileModal?: boolean;
  onCloseMobileModal?: () => void;
  activeSensorBand?: 'RGB' | 'NIR' | 'SAR';
  onChangeSensorBand?: (band: 'RGB' | 'NIR' | 'SAR') => void;
}

export const RightOperationalPanel: React.FC<RightOperationalPanelProps> = ({
  selectedPin,
  queryResponse,
  isOpen,
  onToggleOpen,
  onRunAnalysis,
  isAnalyzing,
  activeModality,
  onHighlightEvidence,
  forcedTab,
  onTabChange,
  isMobileModal = false,
  onCloseMobileModal,
  activeSensorBand,
  onChangeSensorBand,
}) => {
  const [internalTab, setInternalTab] = useState<'dag' | 'evidence' | 'telemetry'>('evidence');

  useEffect(() => {
    if (forcedTab) {
      setInternalTab(forcedTab);
    }
  }, [forcedTab]);

  const activeTab = internalTab;

  const handleTabChange = (tab: 'dag' | 'evidence' | 'telemetry') => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const [streamPlaying, setStreamPlaying] = useState(true);
  const [selectedBand, setSelectedBand] = useState<'RGB' | 'NIR' | 'SAR'>('RGB');

  const currentBand = activeSensorBand || selectedBand;

  const handleBandSelect = (band: 'RGB' | 'NIR' | 'SAR') => {
    setSelectedBand(band);
    onChangeSensorBand?.(band);
  };

  const [stacScenes, setStacScenes] = useState<any[]>([]);
  const [isSearchingStac, setIsSearchingStac] = useState(false);
  const [stacStatus, setStacStatus] = useState<'idle' | 'loading' | 'online' | 'empty' | 'error'>('idle');

  const pin = selectedPin;

  // Load real STAC satellite passes whenever pin or band changes
  useEffect(() => {
    if (!pin) return;
    let isMounted = true;
    setIsSearchingStac(true);
    setStacStatus('loading');
    searchLiveSTAC({
      lat: pin.lat,
      lon: pin.lon,
      collection: currentBand === 'SAR' ? 'sentinel-1-grd' : 'sentinel-2-l2a',
      limit: 2,
    }).then((res) => {
      if (isMounted && res && res.scenes) {
        setStacScenes(res.scenes);
        setStacStatus(res.scenes.length ? 'online' : 'empty');
      }
    }).catch((err) => {
      console.warn('STAC fetch warning:', err);
      if (isMounted) {
        setStacScenes([]);
        setStacStatus('error');
      }
    }).finally(() => {
      if (isMounted) setIsSearchingStac(false);
    });

    return () => {
      isMounted = false;
    };
  }, [pin?.id, currentBand]);

  const findings = queryResponse?.findings;
  const telemetry = queryResponse?.telemetry;
  // No fabricated fallback DAG: if no query has run yet, show nothing rather than
  // invented nodes with fake confidence/IoU numbers.
  const dagNodes: AgentExecutionNode[] = queryResponse?.dagNodes || [];
  const auditHash = queryResponse?.audit_hash || queryResponse?.telemetry?.audit_hash || null;

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    if (!queryResponse?.geojson) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(queryResponse.geojson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${pin?.id || 'evidence'}_satquery_vectors.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export ISRO Mission Technical Report (PDF / Printable)
  const handleExportPDFReport = () => {
    if (!queryResponse) return;
    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ISRO SAC Technical Mission Report - SatQuery AI</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .badge { background: #0284c7; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
          .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6; }
          .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
          .metric-card { background: #fff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; }
          .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; }
          .metric-val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 2px; }
          .audit { font-family: monospace; font-size: 11px; background: #0f172a; color: #38bdf8; padding: 10px; border-radius: 4px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">INDIAN SPACE RESEARCH ORGANISATION</div>
            <div class="subtitle">Space Applications Centre (SAC) - SatQuery AI Mission Intelligence Report</div>
          </div>
          <div class="badge">ISRO TECHNICAL REPORT</div>
        </div>

        <div class="section">
          <div class="section-title">1. Operational Overview & Target AOI</div>
          <div class="box">
            <strong>Target Sector:</strong> ${pin?.name || 'User AOI'} (${pin?.region || pin?.state || 'Remote Sensing Target'})<br/>
            <strong>Coordinates:</strong> ${pin ? `${pin.lat.toFixed(4)}°N, ${pin.lon.toFixed(4)}°E` : 'Evaluated Bounding Box'}<br/>
            <strong>Task Modality:</strong> ${queryResponse.modality.toUpperCase()}<br/>
            <strong>Natural Language Query:</strong> "${queryResponse.query}"
          </div>
        </div>

        <div class="section">
          <div class="section-title">2. Vision-Language Executive Findings</div>
          <div class="box">
            ${queryResponse.answer}
          </div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Model Confidence</div>
              <div class="metric-val">${queryResponse.confidence != null ? `${(queryResponse.confidence * 100).toFixed(1)}%` : 'N/A (model did not run)'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Features Grounded</div>
              <div class="metric-val">${queryResponse.geojson?.features?.length || 0} Polygons</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Inference Latency</div>
              <div class="metric-val">${queryResponse.latency_ms != null ? `${queryResponse.latency_ms.toFixed(0)} ms` : 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">3. Provenance & Cryptographic Audit Hash</div>
          <div class="audit">
            AUDIT_HASH: ${auditHash || 'UNAVAILABLE'}<br/>
            PRIMARY_MODEL: ${queryResponse.telemetry?.models_executed?.join(', ') || 'UNAVAILABLE (no engine telemetry)'}<br/>
            CRS: ${queryResponse.telemetry?.crs || 'EPSG:4326 (WGS84)'}
          </div>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  // Export Auditable Execution Trace DAG
  const handleExportAuditTrace = () => {
    if (!queryResponse && dagNodes.length === 0) return;
    const trace = {
      project: 'SatQuery AI: Divya-Drishti (ISRO SAC SIH26167)',
      query: queryResponse?.query || null,
      modality: queryResponse?.modality || activeModality,
      benchmarkSource: queryResponse?.benchmarkSource || null,
      confidence: queryResponse?.confidence ?? null,
      latency_ms: queryResponse?.latency_ms ?? null,
      audit_hash: auditHash,
      telemetry: queryResponse?.telemetry || null,
      dagNodes,
      timestamp: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trace, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `satquery_audit_trace_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen && !isMobileModal) {
    return (
      <div className="absolute top-3 right-0 z-20 hidden md:flex items-start p-2 pointer-events-none">
        <button
          id="open-operational-deck-btn"
          onClick={onToggleOpen}
          className="pointer-events-auto flex items-center space-x-1.5 px-3 py-1.5 bg-[#141A26] border border-[#232D3F] hover:border-slate-400 rounded-l-lg text-slate-200 hover:text-white shadow-xl transition-colors active:scale-[0.98] font-mono text-xs cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-slate-300" />
          <span>VLM ORCHESTRATOR</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      id="right-operational-deck"
      className={
        isMobileModal
          ? 'w-full h-full bg-[#0A0D15] flex flex-col z-20 select-none overflow-hidden text-slate-200'
          : 'w-full md:w-[380px] lg:w-[420px] h-full bg-[#0A0D15] border-l border-[#1A2232] hidden md:flex flex-col z-20 shrink-0 select-none overflow-hidden text-slate-200 shadow-xl'
      }
    >
      {/* Deck Header */}
      <div className="px-3.5 py-2.5 bg-[#0E121B] border-b border-[#1A2232] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-100">
            SatQuery AI // Divya-Drishti
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#141A26] text-slate-300 border border-[#232D3F]">
            SIH26167
          </span>
        </div>
        <button
          id="minimize-operational-deck-btn"
          onClick={isMobileModal && onCloseMobileModal ? onCloseMobileModal : onToggleOpen}
          className="p-1 rounded hover:bg-[#1E2536] text-slate-400 hover:text-slate-200 transition-colors"
          title={isMobileModal ? 'Back to Map' : 'Collapse Operational Deck'}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Selector Ribbon */}
      <div className="flex border-b border-[#1A2232] bg-[#0A0D15] text-[11px] font-mono">
        <button
          id="tab-evidence-btn"
          onClick={() => handleTabChange('evidence')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
            activeTab === 'evidence'
              ? 'border-slate-300 text-white bg-[#141A26] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#101520]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-300" />
          <span>EVIDENCE</span>
        </button>
        <button
          id="tab-dag-btn"
          onClick={() => handleTabChange('dag')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
            activeTab === 'dag'
              ? 'border-slate-300 text-white bg-[#141A26] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#101520]'
          }`}
        >
          <Network className="w-3.5 h-3.5 text-slate-300" />
          <span>AGENT DAG</span>
        </button>
        <button
          id="tab-sensors-btn"
          onClick={() => handleTabChange('telemetry')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
            activeTab === 'telemetry'
              ? 'border-slate-300 text-white bg-[#141A26] font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#101520]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-slate-300" />
          <span>SENSORS</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* TAB 1: AGENT DAG ORCHESTRATION */}
        {activeTab === 'dag' && (
          <div className="space-y-3">
            {/* Header info box */}
            <div className="p-2.5 rounded-lg bg-gradient-to-b from-[#161C28] to-[#0E121B] border border-[#222A3B] space-y-2 text-xs font-mono shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[10px] block">TOTAL EXECUTION LATENCY</span>
                  <span className="text-slate-100 font-bold text-sm">
                    {queryResponse?.latency_ms != null ? `${queryResponse.latency_ms} ms` : 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block">NODES EXECUTED</span>
                  <span className="text-slate-300 text-xs">
                    {dagNodes.length > 0 ? `${dagNodes.filter((n) => n.status === 'completed').length} / ${dagNodes.length}` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-[#1F2738] flex items-center justify-between">
                <span className="text-slate-500 text-[10px] block">AUDIT HASH</span>
                <span className="text-slate-300 text-xs font-mono">
                  {auditHash || 'N/A'}
                </span>
              </div>
            </div>

            {dagNodes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#1E273A] bg-[#0A0D15]/60 p-6 text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#131A26] border border-[#222E42] flex items-center justify-center text-slate-400">
                  <Network className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-xs font-mono font-medium text-slate-300">
                    No Execution Trace Available
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 font-sans max-w-xs mx-auto leading-relaxed">
                    Submit a query via the prompt bar or select an operational target to inspect the agentic orchestration graph and specialist model telemetry.
                  </p>
                </div>
                <div className="pt-1 text-[10px] font-mono text-slate-600">
                  Awaiting query dispatch...
                </div>
              </div>
            ) : (
              <>
                {/* Auditable DAG Nodes Sequence */}
                <div className="space-y-2.5 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[#1E2638]">
                  {dagNodes.map((node, index) => (
                    <div
                      key={node.id}
                      className="relative pl-8 bg-[#0E131E] border border-[#1E273A] hover:border-slate-500/60 rounded-lg p-3 transition-colors shadow-sm"
                    >
                      {/* Step indicator node icon */}
                      <div className={`absolute -left-0.5 top-3.5 w-7 h-7 rounded-full bg-[#151D2A] border flex items-center justify-center text-[11px] font-mono font-bold shadow-sm ${
                        node.status === 'completed'
                          ? 'border-emerald-500/60 text-emerald-400'
                          : node.status === 'not_implemented'
                          ? 'border-amber-500/50 text-amber-400/80'
                          : 'border-slate-600 text-slate-300'
                      }`}>
                        {index + 1}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="font-mono text-xs font-semibold text-slate-100">
                          {node.label.replace(/^\d+\.\s*/, '')}
                        </div>
                        <StatusBadge
                          variant={
                            node.status === 'completed'
                              ? 'success'
                              : node.status === 'failed'
                              ? 'error'
                              : node.status === 'not_implemented'
                              ? 'warning'
                              : 'neutral'
                          }
                          label={
                            node.latencyMs != null
                              ? `${node.latencyMs} ms`
                              : node.status === 'not_implemented'
                              ? 'Not Run'
                              : node.status === 'failed'
                              ? 'Failed'
                              : 'Pending'
                          }
                          pulsing={node.status === 'completed'}
                          size="xs"
                        />
                      </div>

                      <div className="mt-1 text-[11px] font-mono text-slate-400 font-medium">
                        Model: <span className="text-slate-200">{node.modelUsed}</span>
                      </div>

                      <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                        {node.details}
                      </p>

                      {node.outputPayload && (
                        <div className="mt-2 p-1.5 rounded bg-[#07090E] border border-[#1A2232] font-mono text-[10px] text-slate-300 break-words">
                          &gt; {node.outputPayload}
                        </div>
                      )}

                      {/* Per-action truth: what the agent proposed vs. what the
                          map/dashboard actually did, including honest failures. */}
                      {node.uiActionResults && node.uiActionResults.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {node.uiActionResults.map((result, i) => (
                            <div
                              key={`${result.type}-${i}`}
                              className="flex items-start gap-1.5 font-mono text-[10px] leading-snug"
                            >
                              <span
                                className={
                                  result.status === 'executed'
                                    ? 'text-emerald-400'
                                    : result.status === 'failed'
                                    ? 'text-red-400'
                                    : 'text-amber-400/80'
                                }
                              >
                                {result.status === 'executed' ? '✓' : result.status === 'failed' ? '✕' : '·'}
                              </span>
                              <span className="text-slate-200">{result.type}</span>
                              <span className="text-slate-500">{result.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Export Audit Trace Button */}
                <button
                  onClick={handleExportAuditTrace}
                  className="w-full py-2 px-3 bg-[#131A26] hover:bg-[#1A2334] border border-[#232F42] hover:border-slate-400 rounded-md text-xs font-mono text-slate-200 hover:text-white flex items-center justify-center space-x-2 transition-colors shadow-sm cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-slate-300" />
                  <span>EXPORT AUDITABLE EXECUTION DAG (JSON)</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* TAB 2: EVIDENCE & FINDINGS */}
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            {/* VLM Grounded Response Narrative */}
            <div className="bg-sq-bg-2 border border-sq-border-1 rounded-lg p-3 space-y-2.5 shadow-sm border-l-2 border-l-sq-brand-400">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                  Evidence-Grounded Answer
                </span>
                {queryResponse?.confidence != null ? (
                  <StatusBadge
                    variant="success"
                    label={`${(queryResponse.confidence * 100).toFixed(1)}%`}
                    sublabel="Confidence"
                    size="sm"
                  />
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141A26] text-slate-400 border border-[#222B3D]">
                    Awaiting Query
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-200 leading-relaxed font-sans bg-[#07090E] p-3 rounded-md border border-[#1A2232]">
                {isAnalyzing ? (
                  <div className="flex items-center space-x-2 text-slate-300 font-mono text-xs py-3">
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                    <span>Executing multi-modal vision-language reasoning...</span>
                  </div>
                ) : (
                  queryResponse?.answer ||
                  'No analysis has been run yet. Submit a query to see results.'
                )}
              </div>

              {queryResponse?.benchmarkSource && (
                <div className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                  <span className="text-slate-500">Benchmark Grounding:</span>
                  <span className="font-semibold text-slate-300">{queryResponse.benchmarkSource}</span>
                </div>
              )}
            </div>

            {/* Live Planetary Satellite Scene & Multi-Modal Engine */}
            {queryResponse?.live_satellite_stream && (
              <div className="bg-[#0C111B] border border-cyan-500/30 rounded-lg p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-semibold">
                    <Satellite className="w-3.5 h-3.5" />
                    <span className="uppercase">Live Satellite Scene Ingested</span>
                  </div>
                  {queryResponse.ai_engine_active && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                      {queryResponse.ai_engine_active}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  {queryResponse.live_satellite_stream.thumbnail_url && (
                    <a
                      href={queryResponse.live_satellite_stream.visual_cog_url || queryResponse.live_satellite_stream.thumbnail_url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block shrink-0 group cursor-pointer"
                      title="Click to view Sentinel-2 Cloud-Optimized GeoTIFF"
                    >
                      <img
                        src={queryResponse.live_satellite_stream.thumbnail_url}
                        alt="Sentinel-2 Scene"
                        className="w-16 h-16 rounded-md object-cover border border-cyan-500/50 group-hover:border-cyan-300 transition-colors shadow"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4 text-white" />
                      </div>
                    </a>
                  )}

                  <div className="space-y-1 text-[10px] font-mono min-w-0 flex-1">
                    <div className="text-slate-200 font-bold truncate text-[11px]">
                      {queryResponse.live_satellite_stream.scene_id}
                    </div>
                    <div className="text-slate-400">
                      Sensor: <span className="text-slate-300">{queryResponse.live_satellite_stream.source}</span>
                    </div>
                    <div className="text-slate-400">
                      Captured: <span className="text-slate-300">{queryResponse.live_satellite_stream.acquisition_date ? new Date(queryResponse.live_satellite_stream.acquisition_date).toLocaleString() : 'Unknown'}</span>
                    </div>
                    <div className="text-slate-400">
                      Cloud Cover: <span className="text-cyan-300 font-semibold">{queryResponse.live_satellite_stream.cloud_cover_pct}%</span>
                    </div>
                  </div>
                </div>

                {queryResponse.live_satellite_stream.spectral_metrics && (
                  <div className="pt-2 border-t border-[#1C2538] grid grid-cols-4 gap-1 text-[9px] font-mono text-center">
                    <div className="p-1 rounded bg-[#070A10] border border-[#182132]">
                      <span className="text-slate-500 block">ALBEDO</span>
                      <span className="text-slate-200 font-bold">{queryResponse.live_satellite_stream.spectral_metrics.mean_albedo?.toFixed(3) ?? 'N/A'}</span>
                    </div>
                    <div className="p-1 rounded bg-[#070A10] border border-[#182132]">
                      <span className="text-slate-500 block">NDVI</span>
                      <span className="text-emerald-400 font-bold">{queryResponse.live_satellite_stream.spectral_metrics.ndvi_proxy != null ? (queryResponse.live_satellite_stream.spectral_metrics.ndvi_proxy > 0 ? `+${queryResponse.live_satellite_stream.spectral_metrics.ndvi_proxy.toFixed(3)}` : queryResponse.live_satellite_stream.spectral_metrics.ndvi_proxy.toFixed(3)) : 'N/A'}</span>
                    </div>
                    <div className="p-1 rounded bg-[#070A10] border border-[#182132]">
                      <span className="text-slate-500 block">NDWI</span>
                      <span className="text-cyan-400 font-bold">{queryResponse.live_satellite_stream.spectral_metrics.ndwi_proxy != null ? (queryResponse.live_satellite_stream.spectral_metrics.ndwi_proxy > 0 ? `+${queryResponse.live_satellite_stream.spectral_metrics.ndwi_proxy.toFixed(3)}` : queryResponse.live_satellite_stream.spectral_metrics.ndwi_proxy.toFixed(3)) : 'N/A'}</span>
                    </div>
                    <div className="p-1 rounded bg-[#070A10] border border-[#182132]">
                      <span className="text-slate-500 block">STRUCT</span>
                      <span className="text-amber-400 font-bold">{queryResponse.live_satellite_stream.spectral_metrics.structural_density?.toFixed(3) ?? 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tactical Confidence Telemetry Gauge (Grounded in real inference) */}
            {queryResponse?.confidence != null && (
              <TelemetryGauge
                value={queryResponse.confidence * 100}
                label="VLM Grounding Confidence"
                sublabel={queryResponse.benchmarkSource ? `Verified via ${queryResponse.benchmarkSource}` : "Model-reported (no external benchmark)"}
                variant="emerald"
                segments={10}
                size="sm"
              />
            )}

            {/* SAR Cloud Piercing Metric if applicable */}
            {findings?.piercedCloudPercent != null ? (
              <TelemetryGauge
                value={findings.piercedCloudPercent}
                label="SAR Cloud Penetration"
                sublabel="Sentinel-1 C-Band Polarization Ratio"
                variant="cyan"
                segments={10}
                size="sm"
              />
            ) : null}

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2.5 bg-[#0E131E] rounded-lg border border-[#1E273A]">
                <span className="text-slate-500 block">SURFACE AREA EVALUATED</span>
                <div className="text-slate-100 font-bold text-xs mt-0.5">
                  {findings?.surfaceAreaModifiedKm2 != null ? `+${findings.surfaceAreaModifiedKm2} km²` : 'N/A'}
                </div>
              </div>
              <div className="p-2.5 bg-[#0E131E] rounded-lg border border-[#1E273A]">
                <span className="text-slate-500 block">SEMANTIC CLASS</span>
                <div className="text-slate-200 font-bold text-xs mt-0.5 leading-tight break-words">
                  {findings?.changeClass || 'N/A'}
                </div>
              </div>
            </div>

            {/* Evidence Vector Chips */}
            {findings?.evidenceChips && (
              <div className="p-3 bg-[#0E131E] rounded-lg border border-[#1E273A] space-y-2">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Spatial Evidence Chips (Click to locate)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {findings.evidenceChips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => onHighlightEvidence?.(chip)}
                      className="px-2 py-1 rounded bg-[#131A26] hover:bg-[#1A2334] border border-[#232F42] hover:border-slate-400 text-[10px] font-mono text-slate-300 hover:text-white transition-colors flex items-center space-x-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Export Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportGeoJSON}
                className="py-2 px-2 bg-[#172338] hover:bg-[#1F304C] border border-[#293E62] text-white rounded-lg font-mono text-[11px] font-semibold transition-colors flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                title="Export georeferenced GeoJSON polygon boundaries"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>GEOJSON</span>
                <Download className="w-3 h-3 text-slate-400" />
              </button>

              <button
                onClick={handleExportPDFReport}
                className="py-2 px-2 bg-[#1B291A] hover:bg-[#253B24] border border-[#2E522B] text-emerald-200 rounded-lg font-mono text-[11px] font-semibold transition-colors flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                title="Export publication-ready ISRO Technical Mission Report"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>ISRO REPORT</span>
                <Download className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SENSOR DATA & HARDWARE */}
        {activeTab === 'telemetry' && (
          <div className="space-y-3">
            {/* Sensor Band Simulator */}
            <div className="bg-gradient-to-b from-[#171D2A] to-[#111520] border border-[#232C3E] rounded-lg overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-[#0C1017] border-b border-[#202838] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">SPECTRAL BAND SIMULATOR</span>
                <div className="flex items-center space-x-1">
                  {(['RGB', 'NIR', 'SAR'] as const).map((band) => (
                    <button
                      key={band}
                      id={`sensor-band-${band.toLowerCase()}-btn`}
                      onClick={() => handleBandSelect(band)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                        currentBand === band
                          ? 'bg-gradient-to-b from-[#2B4C7E] to-[#1C3355] text-white font-bold border border-blue-400/60 shadow-xs'
                          : 'bg-[#10141E] text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {band}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real Satellite Sector Raster Chip Viewport */}
              <div className="relative h-44 bg-[#080A10] overflow-hidden flex items-center justify-center border-b border-[#202838]">
                <img
                  key={`${pin?.id || 'isro-sac'}-${currentBand}`}
                  src={`/api/samples/sector-asset/${pin?.id || 'isro-sac'}/${currentBand.toLowerCase()}`}
                  alt={`${currentBand} Satellite Imagery Chip`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.indexOf('/t2') === -1) {
                      target.src = `/api/samples/sector-asset/${pin?.id || 'isro-sac'}/t2`;
                    }
                  }}
                />

                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none" />

                {/* Top Badge: Band Formula */}
                <div className="absolute top-2 left-2 text-[9px] font-mono text-cyan-300 bg-black/80 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>
                    {currentBand === 'RGB' && 'TRUE COLOR: B4(R) + B3(G) + B2(B)'}
                    {currentBand === 'NIR' && 'FALSE COLOR CIR: B8(NIR) + B4(R) + B3(G)'}
                    {currentBand === 'SAR' && 'SENTINEL-1 C-SAR DUAL-POL (VV/VH)'}
                  </span>
                </div>

                {/* Bottom Channel Tag */}
                <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-300 bg-black/90 px-2 py-0.5 rounded border border-white/10 flex items-center space-x-1.5">
                  <span className="text-slate-400">CHANNEL:</span>
                  <span className={`font-bold ${
                    currentBand === 'NIR' ? 'text-rose-400' : currentBand === 'SAR' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {currentBand === 'RGB' && 'OPTICAL VNIR (490 - 665 nm)'}
                    {currentBand === 'NIR' && 'NEAR-INFRARED (842 nm / NDVI)'}
                    {currentBand === 'SAR' && 'C-BAND MICROWAVE (σ° RADAR)'}
                  </span>
                </div>

                <div className="absolute bottom-2 right-2 text-[9px] font-mono text-slate-300 bg-black/90 px-1.5 py-0.5 rounded border border-white/10">
                  {currentBand === 'SAR' ? '10m IW GRD' : '10m GSD'}
                </div>
              </div>
            </div>

            {/* Dynamic Spectral Telemetry Specs */}
            <div className="p-3 bg-gradient-to-b from-[#171D2A] to-[#111520] border border-[#232C3E] rounded-lg space-y-2.5 font-mono text-xs shadow-sm">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Spectral & Sensor Physics</span>
                <span className="text-cyan-400 font-bold">{currentBand} BANDPASS</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-[#0A0D14] p-2 rounded border border-[#1E2536]">
                  <span className="text-slate-500 block">
                    {currentBand === 'SAR' ? 'RADAR FREQUENCY:' : 'WAVELENGTH (λ):'}
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {currentBand === 'RGB' && '490 - 665 nm'}
                    {currentBand === 'NIR' && '842 nm (B8)'}
                    {currentBand === 'SAR' && '5.405 GHz (C-Band)'}
                  </span>
                </div>
                <div className="bg-[#0A0D14] p-2 rounded border border-[#1E2536]">
                  <span className="text-slate-500 block">
                    {currentBand === 'SAR' ? 'POLARIZATION:' : 'SPECTRAL RESPONSE:'}
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {currentBand === 'RGB' && 'Visible BOA Reflectance'}
                    {currentBand === 'NIR' && 'NDVI Vegetative Vigor'}
                    {currentBand === 'SAR' && 'Dual-Pol VV + VH'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-[#0A0D14] p-2 rounded border border-[#1E2536]">
                  <span className="text-slate-500 block">CLOUD COVER INTERACTION:</span>
                  <span className={`font-semibold ${currentBand === 'SAR' ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {currentBand === 'SAR'
                      ? 'Cloud-independent (C-band)'
                      : 'Cloud-affected (optical)'}
                  </span>
                </div>
                <div className="bg-[#0A0D14] p-2 rounded border border-[#1E2536]">
                  <span className="text-slate-500 block">CALIBRATED GSD:</span>
                  <span className="text-slate-200 font-semibold">{telemetry?.gsd || 'Not provided'}</span>
                </div>
              </div>

              <div className="bg-[#0A0D14] p-2 rounded border border-[#1E2536] text-[10px]">
                <span className="text-slate-500 block mb-1">TARGET AOI COORDINATES:</span>
                <span className="text-slate-300 break-all">
                  {telemetry?.bbox_evaluated ? `[${telemetry.bbox_evaluated.join(', ')}]` : (pin ? `[${pin.lon}, ${pin.lat}]` : 'No AOI selected')}
                </span>
              </div>
            </div>

            {/* Live STAC Constellation Stream Passes */}
            <div className="p-3 bg-gradient-to-b from-[#171D2A] to-[#111520] border border-[#232C3E] rounded-lg space-y-2 font-mono text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-[10px] text-slate-300 font-semibold uppercase">
                  <Satellite className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live STAC Satellite Registry</span>
                </div>
                {isSearchingStac ? (
                  <div className="flex items-center space-x-1 text-cyan-400 text-[10px]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Querying...</span>
                  </div>
                ) : (
                  <StatusBadge
                    variant={
                      stacStatus === 'online' ? 'satellite' : stacStatus === 'error' ? 'error' : 'neutral'
                    }
                    label={
                      stacStatus === 'online'
                        ? 'ONLINE'
                        : stacStatus === 'empty'
                        ? 'NO SCENES'
                        : stacStatus === 'error'
                        ? 'UNREACHABLE'
                        : 'IDLE'
                    }
                    sublabel="STAC API"
                    size="xs"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                {stacScenes.map((scene, idx) => (
                  <div
                    key={scene.id || idx}
                    className="p-2 rounded bg-[#0A0D14] border border-[#1E2536] flex items-center space-x-2 text-[10px]"
                  >
                    {scene.thumbnail_url || scene.quicklook_url ? (
                      <img
                        src={scene.thumbnail_url || scene.quicklook_url}
                        alt="Scene Thumbnail"
                        className="w-10 h-10 object-cover rounded border border-[#26354C] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#121824] rounded border border-[#20293B] flex items-center justify-center shrink-0">
                        <Satellite className="w-4 h-4 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 font-semibold truncate">
                        {scene.sensor || 'Sentinel-2 L2A'}
                      </div>
                      <div className="text-slate-400 text-[9px] truncate">
                        ID: {scene.id}
                      </div>
                      <div className="text-slate-500 text-[9px] flex items-center space-x-2">
                        <span>{scene.datetime ? new Date(scene.datetime).toLocaleDateString() : 'Recent Pass'}</span>
                        {typeof scene.cloud_cover === 'number' && (
                          <span>• Cloud: {scene.cloud_cover.toFixed(1)}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!stacScenes.length && !isSearchingStac && (
                  <div className="text-[10px] text-slate-500 italic py-1">
                    No active satellite passes found in target window.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
