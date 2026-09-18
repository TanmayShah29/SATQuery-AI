import React, { useState, useEffect } from 'react';
import {
  Split,
  Layers,
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Maximize2,
  Download,
  AlertCircle,
  HelpCircle,
  FileCode,
  Sliders,
  Flame,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { X } from 'lucide-react';
import type { QueryResponse, TacticalGlobePin } from '../types';
import { fetchSectorDiffHeatmap } from '../services/api';

interface BitemporalStudioProps {
  queryResponse: QueryResponse | null;
  selectedPin: TacticalGlobePin | null;
  onExecuteQuery: (query: string, modality?: 'bitemporal') => void;
  sliderPercent: number;
  onSliderChange: (val: number) => void;
  isAnalyzing: boolean;
  t1Date?: string;
  t2Date?: string;
  onClose?: () => void;
}

const CDVQA_PRESETS = [
  'Has the built-up area increased, decreased, or remained unchanged?',
  'What changed between these two dates, and where did the change occur?',
  'Identify all newly excavated foundations and groundworks.',
  'Calculate the total vegetation canopy lost between T1 and T2 epochs.',
];

export const BitemporalStudio: React.FC<BitemporalStudioProps> = ({
  queryResponse,
  selectedPin,
  onExecuteQuery,
  sliderPercent,
  onSliderChange,
  isAnalyzing,
  t1Date,
  t2Date,
  onClose,
}) => {
  const [activeQuestion, setActiveQuestion] = useState(CDVQA_PRESETS[0]);
  const [showDiffHeatmap, setShowDiffHeatmap] = useState<boolean>(false);
  const [diffHeatmapUrl, setDiffHeatmapUrl] = useState<string | null>(null);
  const [diffHeatmapLoading, setDiffHeatmapLoading] = useState<boolean>(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load the raw radiometric diff heatmap on demand. Honest failure path:
  // if the sector has no distinct T1/T2 rasters or the render fails, the
  // toggle stays off and the UI shows why rather than a fake image.
  useEffect(() => {
    if (!showDiffHeatmap || !selectedPin) return;
    let isMounted = true;
    setDiffHeatmapLoading(true);
    setDiffHeatmapUrl(null);
    fetchSectorDiffHeatmap(selectedPin.id, 1.0).then((blob) => {
      if (!isMounted) return;
      if (blob) {
        setDiffHeatmapUrl(URL.createObjectURL(blob));
      }
      setDiffHeatmapLoading(false);
    }).catch(() => {
      if (!isMounted) return;
      setDiffHeatmapLoading(false);
    });
    return () => {
      isMounted = false;
      if (diffHeatmapUrl) URL.revokeObjectURL(diffHeatmapUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDiffHeatmap, selectedPin?.id]);

  const findings = queryResponse?.findings;
  const telemetry = queryResponse?.telemetry;
  const imageryDistinct = telemetry?.imagery_distinct;
  const imageryOrigin = telemetry?.imagery_origin;
  const areaKm2 = findings?.surfaceAreaModifiedKm2 ?? null;
  const changeClass = findings?.changeClass || (selectedPin?.temporalDelta ? `Sector baseline: ${selectedPin.temporalDelta}` : 'None (Awaiting Inference)');

  return (
    <div
      id="bitemporal-studio-overlay"
      className="absolute top-3 left-3 right-3 sm:right-auto sm:w-[460px] max-h-[calc(100vh-140px)] bg-gradient-to-b from-[#141926]/95 via-[#0D121C]/95 to-[#080B12]/95 backdrop-blur-md border border-[#232F44] rounded-xl shadow-2xl flex flex-col z-20 text-slate-200 select-none overflow-hidden"
    >
      {/* Studio Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-b from-[#1A2334] to-[#101624] border-b border-[#202C40] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Split className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold text-slate-100 tracking-wide">
            BI-TEMPORAL CHANGE STUDIO // CDVQA
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold">
            SIH26167 §4.3
          </span>
          {onClose && (
            <button
              type="button"
              id="close-bitemporal-studio-btn"
              onClick={onClose}
              title="Close Bi-Temporal Studio (Esc)"
              className="p-1 rounded hover:bg-[#1E293C] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3 overflow-y-auto">
        {/* Honest distinctness banner: if T1/T2 rasters are NOT distinct for this
            sector, change detection has no meaningful signal — say so rather
            than letting the curtain look broken. Matches the project's
            anti-fabrication / honest-labeling convention. */}
        {imageryDistinct === false && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 text-[10px] font-mono text-amber-200 flex items-start space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <div className="font-bold text-amber-300 uppercase tracking-wide">
                T1/T2 Imagery Not Distinct
              </div>
              <span>
                This sector's T1 and T2 rasters fall back to the same baseline
                file{imageryOrigin ? ` (${imageryOrigin})` : ''}. Change detection
                will show no meaningful difference — the curtain is comparing
                identical imagery.
              </span>
            </div>
          </div>
        )}
        {imageryDistinct === true && (
          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
            <span>
              Distinct T1/T2 acquisitions confirmed{imageryOrigin ? ` — ${imageryOrigin}` : ''}.
              Both curtain halves render the same location in RGB across two real dates.
            </span>
          </div>
        )}

        {/* Difference Heatmap Toggle (raw magnitude, not polygon outlines) */}
        <div className="p-2.5 rounded-lg bg-[#0D121B] border border-[#1C2638] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center space-x-1">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Raw Delta Heatmap</span>
            </span>
            <button
              type="button"
              onClick={() => setShowDiffHeatmap((v) => !v)}
              title={showDiffHeatmap ? 'Hide diff heatmap' : 'Show raw radiometric delta heatmap'}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                showDiffHeatmap
                  ? 'bg-rose-950/60 text-rose-200 border-rose-500/50'
                  : 'bg-[#0B0F17] text-slate-400 border-[#1C2638] hover:text-slate-200'
              }`}
            >
              {showDiffHeatmap ? (
                <span className="flex items-center space-x-1"><EyeOff className="w-3 h-3" /><span>HIDE</span></span>
              ) : (
                <span className="flex items-center space-x-1"><Eye className="w-3 h-3" /><span>SHOW</span></span>
              )}
            </button>
          </div>
          {showDiffHeatmap && (
            diffHeatmapLoading ? (
              <div className="text-[9px] font-mono text-slate-500 italic">Rendering radiometric delta heatmap…</div>
            ) : diffHeatmapUrl ? (
              <img
                src={diffHeatmapUrl}
                alt="Radiometric delta heatmap (dark blue = unchanged, red = maximum change)"
                className="w-full rounded border border-[#1C2638]"
              />
            ) : (
              <div className="text-[9px] font-mono text-rose-400/80 italic">
                Diff heatmap unavailable for this sector (no distinct T1/T2 rasters).
              </div>
            )
          )}
        </div>
        {/* Epoch Timestamps */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-[#0A0E16] border border-[#1E283C] space-y-0.5">
            <span className="text-[9px] text-amber-400 font-bold uppercase block">T1 Baseline Image</span>
            <span className="text-slate-100 font-bold">{t1Date || selectedPin?.optical_t1_date || '2024-03-27'}</span>
            <span className="text-[9px] text-slate-400 block truncate">Sentinel-2 L2A Pre-Event</span>
          </div>
          <div className="p-2 rounded-lg bg-[#0A0E16] border border-[#1E283C] space-y-0.5">
            <span className="text-[9px] text-blue-400 font-bold uppercase block">T2 Active Target</span>
            <span className="text-slate-100 font-bold">{t2Date || selectedPin?.optical_t2_date || '2024-05-12'}</span>
            <span className="text-[9px] text-slate-400 block truncate">Sentinel-2 + Cartosat-2S</span>
          </div>
        </div>

        {/* Quantitative Differencing Metric Strip */}
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="p-2 rounded bg-[#0D121B] border border-[#1C2638]">
            <span className="text-[9px] text-slate-500 block">MODIFIED AREA</span>
            <span className="text-xs font-bold text-amber-400">
              {areaKm2 != null ? `+${areaKm2} km²` : '--'}
            </span>
          </div>
          <div className="p-2 rounded bg-[#0D121B] border border-[#1C2638]">
            <span className="text-[9px] text-slate-500 block">OTSU THRESH</span>
            <span className="text-xs font-bold text-cyan-400">
              {findings?.otsu_threshold != null ? `${Number(findings.otsu_threshold).toFixed(3)} σB²` : '--'}
            </span>
          </div>
          <div className="p-2 rounded bg-[#0D121B] border border-[#1C2638]">
            <span className="text-[9px] text-slate-500 block">CONFIDENCE</span>
            <span className="text-xs font-bold text-emerald-400">
              {queryResponse?.confidence != null ? `${(queryResponse.confidence * 100).toFixed(1)}%` : '--'}
            </span>
          </div>
        </div>

        {/* Interactive Curtain Position Slider */}
        <div className="p-2.5 rounded-lg bg-[#0D121B] border border-[#1C2638] space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>SPLIT CURTAIN RATIO:</span>
            </span>
            <span className="text-slate-200 font-bold">
              T1: {sliderPercent}% | T2: {100 - sliderPercent}%
            </span>
          </div>
          <input
            type="range"
            min="5"
            max="95"
            value={sliderPercent}
            onChange={(e) => onSliderChange(Number(e.target.value))}
            className="w-full h-1.5 bg-[#141C2B] rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <div className="flex justify-between text-[8px] text-slate-500">
            <span>◄ 100% T1 Pre-Event</span>
            <span>50% Split</span>
            <span>100% T2 Post-Event ►</span>
          </div>
        </div>

        {/* CDVQA Natural Language Query Section */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400 font-semibold uppercase">
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            <span>CDVQA Benchmark Question Answering</span>
          </div>

          <div className="space-y-1">
            {CDVQA_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveQuestion(preset);
                  onExecuteQuery(preset, 'bitemporal');
                }}
                disabled={isAnalyzing}
                className={`w-full text-left p-2 rounded-md border text-[11px] font-mono transition-all flex items-center justify-between group cursor-pointer ${
                  activeQuestion === preset
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 font-semibold'
                    : 'bg-[#0B0F17] hover:bg-[#121824] border-[#1C2638] text-slate-300'
                }`}
              >
                <span className="truncate pr-2">{preset}</span>
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Current Grounded Change Finding */}
        <div className="p-2.5 rounded-lg bg-[#070A10] border border-[#1A2232] space-y-1">
          <div className="text-[9px] font-mono text-slate-400 uppercase">Change Classification & Reasoning</div>
          <p className="text-xs text-slate-200 font-sans leading-relaxed">
            {isAnalyzing ? (
              <span className="text-amber-400 font-mono animate-pulse">Running Otsu Threshold Change Detection...</span>
            ) : queryResponse?.answer ? (
              queryResponse.answer
            ) : (
              <span className="text-slate-400 italic">
                Select a CDVQA preset question above or enter a prompt to run bi-temporal change detection on this sector.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
