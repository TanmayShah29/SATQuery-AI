import React, { useState } from 'react';
import {
  Crosshair,
  Sliders,
  Search,
  CheckCircle,
  FileCode,
  Download,
  Layers,
  ChevronRight,
  ExternalLink,
  Target,
  Terminal,
  Send,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { QueryResponse, TacticalGlobePin } from '../types';

interface GroundingStudioProps {
  queryResponse: QueryResponse | null;
  selectedPin: TacticalGlobePin | null;
  onExecuteQuery: (query: string, modality?: 'single_image') => void;
  isAnalyzing: boolean;
  confidenceThreshold?: number;
  onConfidenceChange?: (val: number) => void;
  iouThreshold?: number;
  onIouChange?: (val: number) => void;
  onClose?: () => void;
}

const GROUNDING_PRESETS = [
  'Highlight the water body referred to in the query.',
  'Describe the land-cover and major objects visible in this image.',
  'Segment all commercial infrastructure footprints and roads.',
  'Detect aircraft, runways, and taxiways across this sector.',
];

export const GroundingStudio: React.FC<GroundingStudioProps> = ({
  queryResponse,
  selectedPin,
  onExecuteQuery,
  isAnalyzing,
  confidenceThreshold: propConf,
  onConfidenceChange,
  iouThreshold: propIou,
  onIouChange,
  onClose,
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [localConf, setLocalConf] = useState<number>(75);
  const [localIou, setLocalIou] = useState<number>(50);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const confThresh = propConf != null ? Math.round(propConf * 100) : localConf;
  const iouThresh = propIou != null ? Math.round(propIou * 100) : localIou;

  const handleConfChange = (val: number) => {
    setLocalConf(val);
    if (onConfidenceChange) onConfidenceChange(val / 100);
  };

  const handleIouChange = (val: number) => {
    setLocalIou(val);
    if (onIouChange) onIouChange(val / 100);
  };

  const allFeatures = queryResponse?.geojson?.features || [];
  // HONESTY: a feature with no confidence score from the backend is not silently
  // assumed to pass the threshold (previously defaulted to 90%) — it's excluded
  // so the filtered list reflects only real, scored model output.
  const features = allFeatures.filter((feat: any) => {
    const conf = feat.properties?.confidence != null ? feat.properties.confidence * 100 : null;
    return conf != null && conf >= confThresh;
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    onExecuteQuery(customPrompt, 'single_image');
  };

  const handleExportGeoJSON = () => {
    if (!queryResponse?.geojson) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(queryResponse.geojson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${selectedPin?.id || 'grounded'}_features.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      id="grounding-studio-overlay"
      className="absolute top-3 left-3 right-3 sm:right-auto sm:w-[460px] max-h-[calc(100vh-140px)] bg-gradient-to-b from-[#141926]/95 via-[#0D121C]/95 to-[#080B12]/95 backdrop-blur-md border border-[#232F44] rounded-xl shadow-2xl flex flex-col z-20 text-slate-200 select-none overflow-hidden"
    >
      {/* Studio Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-b from-[#1A2334] to-[#101624] border-b border-[#202C40] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-slate-100 tracking-wide">
            VISUAL GROUNDING // VRSBENCH SANDBOX
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold">
            SIH26167 §4.2
          </span>
          {onClose && (
            <button
              type="button"
              id="close-grounding-studio-btn"
              onClick={onClose}
              title="Close Visual Grounding Studio (Esc)"
              className="p-1 rounded hover:bg-[#1E293C] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3 overflow-y-auto">
        {/* Custom Grounding Query Input */}
        <form onSubmit={handleCustomSubmit} className="space-y-1.5 font-mono text-xs">
          <label className="text-[10px] text-slate-400 uppercase block font-semibold">
            Text-Guided Region Grounding Prompt:
          </label>
          <div className="flex items-center space-x-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder='e.g. "Highlight the primary runway and taxiway"'
                className="w-full pl-8 pr-3 py-1.5 bg-[#090D15] border border-[#1E283C] focus:border-emerald-500 rounded-md text-slate-100 placeholder-slate-500 text-xs focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing || !customPrompt.trim()}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
            >
              {isAnalyzing ? '...' : 'SEGMENT'}
            </button>
          </div>
        </form>

        {/* Confidence & IoU Filter Sliders */}
        <div className="p-2.5 rounded-lg bg-[#0D121B] border border-[#1C2638] space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">CONFIDENCE THRESHOLD:</span>
            <span className="text-emerald-400 font-bold">{confThresh}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            value={confThresh}
            onChange={(e) => handleConfChange(Number(e.target.value))}
            className="w-full h-1.5 bg-[#141C2B] rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          <div className="flex items-center justify-between text-[10px] pt-1">
            <span className="text-slate-400">IoU OVERLAP FILTER:</span>
            <span className="text-cyan-400 font-bold">{iouThresh}%</span>
          </div>
          <input
            type="range"
            min="20"
            max="80"
            value={iouThresh}
            onChange={(e) => handleIouChange(Number(e.target.value))}
            className="w-full h-1.5 bg-[#141C2B] rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Representative Presets */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
            VRSBench Representative Queries
          </span>
          {GROUNDING_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => onExecuteQuery(preset, 'single_image')}
              disabled={isAnalyzing}
              className="w-full text-left p-1.5 rounded bg-[#0A0E17] hover:bg-[#121824] border border-[#1C2638] text-[10px] font-mono text-slate-300 hover:text-white transition-colors flex items-center justify-between group cursor-pointer"
            >
              <span className="truncate pr-2">{preset}</span>
              <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0" />
            </button>
          ))}
        </div>

        {/* Detected Features Table */}
        <div className="p-2.5 rounded-lg bg-[#070A10] border border-[#1A2232] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 font-bold uppercase">Grounded Polygons Detected</span>
            <span className="text-emerald-400 font-bold">{features.length} Features</span>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {features.map((feat: any, idx: number) => (
              <div
                key={feat.id || idx}
                className="p-1.5 rounded bg-[#0D121B] border border-[#1E283C] text-[10px] font-mono flex items-center justify-between"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: feat.properties?.fillColor || '#10B981' }}
                  />
                  <span className="text-slate-200 truncate font-semibold">
                    {feat.properties?.change_type || feat.properties?.feature_type || `Feature #${idx + 1}`}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-slate-400">
                    {feat.properties?.confidence != null ? `${(feat.properties.confidence * 100).toFixed(0)}%` : 'N/A'}
                  </span>
                  {feat.properties?.area_km2 && (
                    <span className="text-slate-300 font-bold">{feat.properties.area_km2} km²</span>
                  )}
                </div>
              </div>
            ))}
            {features.length === 0 && (
              <div className="text-[10px] font-mono text-slate-500 italic py-2 text-center">
                No active grounding polygons in current viewport.
              </div>
            )}
          </div>

          <button
            onClick={handleExportGeoJSON}
            disabled={features.length === 0}
            className="w-full py-1.5 px-2 bg-[#131C2C] hover:bg-[#1C273D] border border-[#23334E] text-slate-200 hover:text-white rounded text-[10px] font-mono font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span>DOWNLOAD EPSG:4326 GEOJSON VECTORS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
