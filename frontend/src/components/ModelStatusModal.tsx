import React, { useState } from 'react';
import {
  X,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Radar,
  Eye,
  Split,
  HardDrive,
  Zap,
  Layers,
  Globe,
  Radio,
  Lock,
  ExternalLink,
} from 'lucide-react';
import type { AIStatusResponse } from '../types';

interface ModelStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBackendHealthy: boolean;
  aiStatus?: AIStatusResponse | null;
  onRefreshAIStatus?: () => void;
}

export const ModelStatusModal: React.FC<ModelStatusModalProps> = ({
  isOpen,
  onClose,
  isBackendHealthy,
  aiStatus,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'sac_compliance' | 'domain_heads' | 'live_streams'>('sac_compliance');

  // Honest status derived from the backend probe; never invented here.
  const weightsState = aiStatus?.local_engines?.remoteclip_vit_b32_domain_adapter;
  const remoteclipStatus = !isBackendHealthy
    ? 'OFFLINE'
    : weightsState === 'weights_loaded'
    ? 'OPERATIONAL'
    : weightsState === 'weights_missing'
    ? 'WEIGHTS MISSING'
    : 'UNKNOWN';

  const models = [
    {
      name: 'RemoteCLIP-ViT-B/32',
      category: 'Single-Image Optical VQA & Spatial Grounding',
      adaptation: 'RemoteCLIP RS backbone + BigEarthNet adapter fine-tuned on 84 real samples (58 train / 26 eval)',
      status: remoteclipStatus,
      latency: isBackendHealthy ? 'Measured Per Query (DAG)' : 'Offline',
      bands: 'RGB / Multispectral (Sentinel-2 B2, B3, B4, B8)',
      icon: Eye,
      color: '#3B82F6',
    },
    {
      name: 'BiTemporal Radiometric Difference Head',
      category: 'Multi-Image Change Analysis & Otsu Masking',
      adaptation: 'Radiometric differencing + Otsu adaptive thresholding (classical DSP, no external benchmark)',
      status: isBackendHealthy ? 'OPERATIONAL' : 'OFFLINE',
      latency: isBackendHealthy ? 'Measured Per Query (DAG)' : 'Offline',
      bands: 'Dual-Epoch Optical (T1 Baseline vs T2 Post-Event)',
      icon: Split,
      color: '#10B981',
    },
    {
      name: 'C-SAR Cloud-Piercing & Speckle Filter',
      category: 'Cross-Modal Optical + SAR Fusion',
      adaptation: '5x5 Adaptive Lee Filter + VV/VH Polarimetric Ratio Head',
      status: isBackendHealthy ? 'OPERATIONAL' : 'OFFLINE',
      latency: isBackendHealthy ? 'Measured Per Query (DAG)' : 'Offline',
      bands: 'Sentinel-1 C-Band SAR (VV Dual-Pol, VH Cross-Pol)',
      icon: Radar,
      color: '#06B6D4',
    },
    {
      name: 'Deterministic Agentic Dispatcher',
      category: 'Task Routing & Auditable Trace Synthesis',
      adaptation: 'SHA-256 Cryptographic DAG Provenance Engine',
      status: isBackendHealthy ? 'OPERATIONAL' : 'OFFLINE',
      latency: isBackendHealthy ? 'Measured Per Query (DAG)' : 'Offline',
      bands: 'Telemetry & GeoJSON Vector Protocol',
      icon: Cpu,
      color: '#F59E0B',
    },
  ];

  // Real probed feed status only; no invented fallback when the backend is silent.
  const liveDataFeeds = aiStatus?.live_data_sources || [];

  const activeModelDisplay = isBackendHealthy
    ? (aiStatus?.active_model || 'Detecting Active Model...')
    : 'Unavailable (Backend Offline)';

  return (
    <div
      id="model-status-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
      onClick={onClose}
    >
      <div
        id="model-status-modal-container"
        className="w-full max-w-2xl bg-gradient-to-b from-[#151A26] to-[#0D1018] border border-[#232B3E] rounded-xl shadow-2xl overflow-hidden flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#202838] bg-gradient-to-b from-[#182030] to-[#111622]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-[#161D2C] border border-[#26334A] text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-slate-100 font-mono tracking-wide">
                  SatQuery AI // Specialist Model Registry
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  SAC SECTION 7 COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Challenge: SIH26167 (ISRO Space Applications Centre)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2536] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#1E2638] bg-[#0F1420] px-5 pt-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('sac_compliance')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'sac_compliance'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Air-Gapped Compliance</span>
          </button>
          <button
            onClick={() => setActiveTab('domain_heads')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'domain_heads'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Specialist Neural Heads</span>
          </button>
          <button
            onClick={() => setActiveTab('live_streams')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'live_streams'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Planetary STAC Streams</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: AIR-GAPPED SAC COMPLIANCE */}
          {activeTab === 'sac_compliance' && (
            <div className="space-y-4">
              {/* Mandatory Disqualification Safeguard Banner */}
              <div className="p-4 bg-[#0A121E] border border-emerald-500/40 rounded-xl space-y-2 shadow-sm">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold font-mono text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ISRO SAC SECTION 7 DISQUALIFICATION SAFEGUARD</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Generic, closed-source commercial cloud LLMs/VLMs (Google Gemini, OpenAI ChatGPT, Anthropic Claude) are strictly <strong>prohibited and disqualified</strong> under ISRO SAC evaluation guidelines. Defense satellite imagery must not leave the secure perimeter.
                </p>
                <div className="pt-2 border-t border-[#1C273B] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Foreign Cloud API Dependency:</span>
                  <span className="text-emerald-400 font-bold">0% (EXCLUDED)</span>
                </div>
              </div>

              {/* Active Engine Card */}
              <div className="p-4 bg-[#101726] border border-[#1F2B42] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                      Active Local Neural Backbone
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold">
                    LOCAL MPS / OLLAMA
                  </span>
                </div>
                <div className="text-sm font-semibold text-white font-mono">
                  {activeModelDisplay}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Runs directly on Apple Silicon Metal Performance Shaders (MPS) and multi-core CPU. Deep neural forward passes extract 512-dimensional visual embeddings, compute cosine similarities against domain taxonomy vectors, and ground features via sliding-window Otsu vectorization.
                </p>
              </div>

              {/* System Hardware Acceleration */}
              <div className="p-3 bg-[#0D121B] border border-[#1A2333] rounded-lg flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-300">HARDWARE ACCELERATION:</span>
                  <span className="text-white font-semibold">
                    {aiStatus?.hardware_acceleration || (isBackendHealthy ? 'Local PyTorch Backbone' : 'Backend Offline')}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">ZERO API KEYS NEEDED</span>
              </div>
            </div>
          )}

          {/* TAB 2: SPECIALIST DOMAIN HEADS */}
          {activeTab === 'domain_heads' && (
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                ACTIVE SPECIALIST EXECUTION HEADS (SAC SIH26167)
              </div>

              <div className="space-y-2.5">
                {models.map((m, idx) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 bg-[#101622] hover:bg-[#131B2B] border border-[#1F293D] rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className="p-1.5 rounded-md border"
                            style={{ borderColor: `${m.color}40`, backgroundColor: `${m.color}15`, color: m.color }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white font-mono">{m.name}</div>
                            <div className="text-[10px] text-slate-400">{m.category}</div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono border font-semibold ${
                          m.status === 'OPERATIONAL'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                            : m.status === 'OFFLINE'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                            : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                        }`}>
                          {m.status}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-[#1C2436] grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                        <div>
                          <span className="text-slate-500">Domain Adaptation:</span>{' '}
                          <span className="text-slate-300">{m.adaptation}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">Inference Latency:</span>{' '}
                          <span className="text-emerald-400 font-semibold">{m.latency}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE STAC STREAMS */}
          {activeTab === 'live_streams' && (
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                ACTIVE PLANETARY OBSERVATION STAC STREAMS
              </div>

              <div className="space-y-2">
                {liveDataFeeds.length === 0 && (
                  <div className="p-3.5 bg-[#101622] border border-[#1F293D] rounded-lg text-[11px] font-mono text-slate-400">
                    Stream status unavailable — backend probe not reachable. No status is assumed.
                  </div>
                )}
                {liveDataFeeds.map((feed, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#101622] hover:bg-[#131B2B] border border-[#1F293D] rounded-lg transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-md bg-[#161F2E] text-cyan-400 border border-cyan-500/20">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white font-mono">{feed.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Resolution: {feed.resolution}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono border font-semibold uppercase ${
                      feed.status === 'online' || feed.status === 'connected'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                        : feed.status === 'configured'
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700'
                    }`}>
                      {feed.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[#0D121B] border border-[#1A2333] rounded-lg text-xs font-mono text-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Real STAC Ingestion:</span>
                  <span className="text-white font-semibold">Live AWS Element84 + Planetary Computer</span>
                </div>
                <span className="text-[10px] text-cyan-300">STATUS PROBED LIVE (NO ASSUMED ONLINE)</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1C2536] bg-[#0E131D] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Target PS: SIH26167 // Team Divya Drishti</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#1A2333] hover:bg-[#222E44] text-slate-200 hover:text-white rounded-md transition-colors cursor-pointer"
          >
            Close Registry
          </button>
        </div>
      </div>
    </div>
  );
};


