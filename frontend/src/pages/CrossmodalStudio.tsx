import React, { useState } from 'react';
import {
  Radar,
  Eye,
  Sliders,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  X,
  ChevronRight,
  HelpCircle,
  Cpu,
} from 'lucide-react';
import type { QueryResponse, TacticalGlobePin } from '../types';

interface CrossmodalStudioProps {
  queryResponse: QueryResponse | null;
  selectedPin: TacticalGlobePin | null;
  onExecuteQuery: (query: string, modality?: 'cross_modal') => void;
  isAnalyzing: boolean;
  onClose?: () => void;
}

const CROSSMODAL_PRESETS = [
  'Use the optical and SAR images together to identify built-up and water-covered regions.',
  'Pierce monsoon cloud cover and isolate dielectric double-bounce structures.',
  'Evaluate radar backscatter dB histogram across this sector.',
  'Extract flood water inundation boundary through heavy cloud cover.',
];

export const CrossmodalStudio: React.FC<CrossmodalStudioProps> = ({
  queryResponse,
  selectedPin,
  onExecuteQuery,
  isAnalyzing,
  onClose,
}) => {
  const [cloudPiercePercent, setCloudPiercePercent] = useState<number>(85);
  const [leeFilterSize, setLeeFilterSize] = useState<number>(5);
  const [activeQuestion, setActiveQuestion] = useState(CROSSMODAL_PRESETS[0]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const findings = queryResponse?.findings;
  const piercedPct = findings?.piercedCloudPercent ?? null;
  const radarHist = (findings as any)?.radar_histogram;
  const waterPct = radarHist?.water_specular_pct ?? null;
  const vegPct = radarHist?.vegetation_pct ?? null;
  const builtPct = radarHist?.built_double_bounce_pct ?? null;
  const meanDb = radarHist?.mean_backscatter_db ?? null;

  return (
    <div
      id="crossmodal-studio-overlay"
      className="absolute top-3 left-3 right-3 sm:right-auto sm:w-[460px] max-h-[calc(100vh-140px)] bg-gradient-to-b from-[#141926]/95 via-[#0D121C]/95 to-[#080B12]/95 backdrop-blur-md border border-[#232F44] rounded-xl shadow-2xl flex flex-col z-20 text-slate-200 select-none overflow-hidden"
    >
      {/* Studio Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-b from-[#1A2334] to-[#101624] border-b border-[#202C40] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Radar className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-100 tracking-wide">
            OPTICAL–SAR FUSION // RADAR STUDIO
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-bold">
            SIH26167 §4.4
          </span>
          {onClose && (
            <button
              type="button"
              id="close-crossmodal-studio-btn"
              onClick={onClose}
              title="Close Optical-SAR Studio (Esc)"
              className="p-1 rounded hover:bg-[#1E293C] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3 overflow-y-auto">
        {/* Sensor Pair Details */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-[#0A0E16] border border-[#1E283C] space-y-0.5">
            <span className="text-[9px] text-cyan-400 font-bold uppercase block">Optical Modality</span>
            <span className="text-slate-100 font-bold">Sentinel-2 L2A</span>
            <span className="text-[9px] text-slate-400 block truncate">10m B2-B8 (True/NIR)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#0A0E16] border border-[#1E283C] space-y-0.5">
            <span className="text-[9px] text-amber-400 font-bold uppercase block">Radar Modality</span>
            <span className="text-slate-100 font-bold">Sentinel-1 / RISAT-1A</span>
            <span className="text-[9px] text-slate-400 block truncate">C-SAR VV+VH Dual-Pol</span>
          </div>
        </div>

        {/* Polarimetric Radar Backscatter Spectrogram (dB Histogram) */}
        <div className="p-2.5 rounded-lg bg-[#090D15] border border-[#1C2538] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="font-bold text-slate-200">RADAR BACKSCATTER (σ° dB)</span>
            <span className="text-cyan-400 font-bold">{meanDb != null ? `Mean: ${typeof meanDb === 'number' ? `${meanDb.toFixed(1)} dB` : meanDb}` : 'Awaiting SAR Overpass'}</span>
          </div>

          {/* Graphical dB Distribution Bars */}
          <div className="space-y-1 text-[9px] font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span className="w-28">Water Specular:</span>
              <div className="flex-1 mx-2 h-2 bg-[#121824] rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${waterPct ?? 0}%` }} />
              </div>
              <span className="text-slate-300 font-bold">{waterPct != null ? `${waterPct}%` : '--'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="w-28">Vegetation Canopy:</span>
              <div className="flex-1 mx-2 h-2 bg-[#121824] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${vegPct ?? 0}%` }} />
              </div>
              <span className="text-slate-300 font-bold">{vegPct != null ? `${vegPct}%` : '--'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="w-28">Built Double-Bounce:</span>
              <div className="flex-1 mx-2 h-2 bg-[#121824] rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${builtPct ?? 0}%` }} />
              </div>
              <span className="text-slate-300 font-bold">{builtPct != null ? `${builtPct}%` : '--'}</span>
            </div>
          </div>
        </div>

        {/* Cloud Penetration & Speckle Filter Controls */}
        <div className="p-2.5 rounded-lg bg-[#0D121B] border border-[#1C2638] space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span>CLOUD PENETRATION EFFICIENCY:</span>
            </span>
            <span className="text-cyan-300 font-bold">{cloudPiercePercent}%</span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            value={cloudPiercePercent}
            onChange={(e) => setCloudPiercePercent(Number(e.target.value))}
            className="w-full h-1.5 bg-[#141C2B] rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="pt-1.5 border-t border-[#1C2538] flex items-center justify-between text-[10px]">
            <span className="text-slate-400">5x5 Adaptive Lee Speckle Filter:</span>
            <span className="text-emerald-400 font-bold">ACTIVE (DAMPING: 1.0)</span>
          </div>
        </div>

        {/* Query Presets */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400 font-semibold uppercase">
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            <span>Cross-Modal Synthesis Queries</span>
          </div>

          <div className="space-y-1">
            {CROSSMODAL_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveQuestion(preset);
                  onExecuteQuery(preset, 'cross_modal');
                }}
                disabled={isAnalyzing}
                className={`w-full text-left p-2 rounded-md border text-[11px] font-mono transition-all flex items-center justify-between group cursor-pointer ${
                  activeQuestion === preset
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 font-semibold'
                    : 'bg-[#0B0F17] hover:bg-[#121824] border-[#1C2638] text-slate-300'
                }`}
              >
                <span className="truncate pr-2">{preset}</span>
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Grounded Result Card */}
        <div className="p-2.5 rounded-lg bg-[#070A10] border border-[#1A2232] space-y-1">
          <div className="text-[9px] font-mono text-slate-400 uppercase">Optical–SAR Fused Intelligence</div>
          <p className="text-xs text-slate-200 font-sans leading-relaxed">
            {isAnalyzing ? (
              <span className="text-cyan-400 font-mono animate-pulse">Piercing clouds with Sentinel-1 C-SAR...</span>
            ) : queryResponse?.answer ? (
              queryResponse.answer
            ) : (
              <span className="text-slate-400 italic">
                Select a cross-modal preset above to execute optical–SAR fusion.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
