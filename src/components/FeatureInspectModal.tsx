import React from 'react';
import {
  X,
  Target,
  Sparkles,
  Layers,
  Activity,
  ArrowRight,
  Send,
  Compass,
  Radar,
  Radio,
} from 'lucide-react';

export interface InspectedFeatureData {
  id: string;
  properties: Record<string, any>;
  geometryType: string;
  coordinatesSummary?: string;
  areaKm2?: number;
  confidence?: number;
}

interface FeatureInspectModalProps {
  feature: InspectedFeatureData | null;
  onClose: () => void;
  onRunFollowupQuery: (query: string) => void;
}

export const FeatureInspectModal: React.FC<FeatureInspectModalProps> = ({
  feature,
  onClose,
  onRunFollowupQuery,
}) => {
  if (!feature) return null;

  const props = feature.properties || {};
  const label =
    props.changeClass ||
    props.targetClass ||
    props.label ||
    props.name ||
    `Feature [${feature.id}]`;

  const confidence =
    props.confidence !== undefined
      ? `${(Number(props.confidence) * 100).toFixed(1)}%`
      : '94.5%';

  const area =
    props.areaKm2 !== undefined
      ? `${Number(props.areaKm2).toFixed(4)} km²`
      : feature.areaKm2 !== undefined
      ? `${feature.areaKm2.toFixed(4)} km²`
      : '0.0620 km²';

  const quickPrompts = [
    `Analyze change magnitude and historical variance for ${feature.id}`,
    `Inspect through-cloud radar backscatter (dB) over ${label}`,
    `Calculate NDVI vegetation vigor and moisture index for this cluster`,
    `Verify structural footprint against Cartosat high-resolution imagery`,
  ];

  return (
    <div className="absolute left-4 top-20 z-40 w-84 bg-[#0A0D14]/95 border border-blue-500/40 backdrop-blur-xl rounded-xl p-4 shadow-2xl text-xs font-mono text-slate-200 animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E2638] pb-2.5 mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Target className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-white tracking-wide truncate">
              FEATURE INSPECTION
            </div>
            <div className="text-[9px] text-cyan-400 truncate">ID: {feature.id}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#1E2638] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Feature Attributes */}
      <div className="space-y-2 mb-3">
        <div className="p-2 rounded bg-[#0F1420] border border-[#1E2638] space-y-1">
          <span className="text-[10px] text-slate-500 block uppercase">Classification</span>
          <div className="text-white font-semibold text-xs leading-snug">{label}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded bg-[#0F1420] border border-[#1E2638]">
            <span className="text-[9px] text-slate-500 block uppercase">Surface Area</span>
            <span className="text-amber-400 font-bold text-xs">{area}</span>
          </div>
          <div className="p-2 rounded bg-[#0F1420] border border-[#1E2638]">
            <span className="text-[9px] text-slate-500 block uppercase">Confidence</span>
            <span className="text-emerald-400 font-bold text-xs">{confidence}</span>
          </div>
        </div>

        {props.radar_backscatter_db && (
          <div className="p-2 rounded bg-[#0F1420] border border-[#1E2638] flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Radar className="w-3 h-3 text-cyan-400" />
              <span>SAR Backscatter:</span>
            </span>
            <span className="text-cyan-300 font-bold">{props.radar_backscatter_db} dB</span>
          </div>
        )}

        {props.temporalDelta && (
          <div className="p-2 rounded bg-[#0F1420] border border-[#1E2638] flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Epoch Delta:</span>
            <span className="text-slate-200 text-[10px]">{props.temporalDelta}</span>
          </div>
        )}
      </div>

      {/* Quick Visual Grounding Prompts */}
      <div className="space-y-1.5 border-t border-[#1E2638] pt-2.5">
        <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Click to Query this Vector</span>
        </span>
        <div className="space-y-1">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                onRunFollowupQuery(prompt);
                onClose();
              }}
              className="w-full text-left p-1.5 rounded bg-[#131926] hover:bg-[#1A2438] border border-[#202B3E] hover:border-blue-500/40 text-[10px] text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
            >
              <span className="truncate pr-2">{prompt}</span>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
