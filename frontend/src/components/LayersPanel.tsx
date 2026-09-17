import React from 'react';
import {
  Layers,
  X,
  Eye,
  EyeOff,
  Sliders,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import type { LayerConfig } from '../types';

interface LayersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layers: LayerConfig[];
  onToggleLayer: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onOpacityChange,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="layers-drawer-panel"
      className="absolute top-3 left-3 z-30 w-72 bg-gradient-to-b from-[#141924]/95 via-[#0E121B]/95 to-[#0A0D14]/95 backdrop-blur-md border border-[#222B3D] rounded-xl shadow-2xl flex flex-col text-slate-200 overflow-hidden select-none transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      style={{ maxHeight: 'calc(100% - 24px)' }}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-b from-[#171D2A] to-[#0F131D] border-b border-[#202838] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-300" />
          <span className="text-xs font-semibold text-slate-100 tracking-wide font-mono">
            SENSOR CATALOG // LAYERS
          </span>
        </div>
        <button
          id="close-layers-panel-btn"
          onClick={onClose}
          className="p-1 rounded hover:bg-[#1E2536] text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Layer List */}
      <div className="p-2.5 space-y-2 overflow-y-auto max-h-[calc(80vh-60px)]">
        {layers.map((layer) => {
          return (
            <div
              key={layer.id}
              id={`layer-card-${layer.id}`}
              className={`p-2.5 rounded-lg border transition-all ${
                layer.visible
                  ? 'bg-gradient-to-b from-[#1B2332]/95 to-[#121724]/95 border-[#28344A] shadow-sm'
                  : 'bg-gradient-to-b from-[#121620]/60 to-[#0A0D14]/60 border-[#1B2230] opacity-60'
              }`}
            >
              {/* Top row: Checkbox, Name, Asset Count, Visibility */}
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2">
                  <button
                    onClick={() => onToggleLayer(layer.id)}
                    className="mt-0.5 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {layer.visible ? (
                      <CheckSquare className="w-4 h-4 text-slate-200" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="text-xs font-medium text-slate-100 leading-tight">
                        {layer.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {layer.category}
                    </span>
                  </div>
                </div>

                {layer.assetCount != null && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0A0D14] border border-[#20293A] text-slate-400">
                    {layer.assetCount}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-300 mt-2 leading-snug font-sans pl-6">
                {layer.description}
              </p>

              {/* Band Info / Resolution Badge */}
              {layer.bandInfo && (
                <div className="mt-1.5 pl-6 flex items-center space-x-1 text-[9px] font-mono text-slate-400">
                  <span className="text-slate-500">BAND:</span>
                  <span className="text-slate-300">{layer.bandInfo}</span>
                </div>
              )}

              {/* Opacity Slider (when visible) */}
              {layer.visible && (
                <div className="mt-2.5 pl-6 pt-1.5 border-t border-[#202838] flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <Sliders className="w-3 h-3 text-slate-500" />
                    <span>OPACITY:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={layer.opacity}
                      onChange={(e) => onOpacityChange(layer.id, Number(e.target.value))}
                      className="w-24 h-1 bg-[#0A0D14] rounded-lg appearance-none cursor-pointer accent-slate-400"
                    />
                    <span className="w-7 text-right text-slate-300 font-mono">
                      {layer.opacity}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-[#0A0D14] border-t border-[#202838] text-[10px] text-slate-400 flex items-center space-x-1.5 font-mono">
        <Info className="w-3 h-3 text-slate-500 shrink-0" />
        <span>ESRI Minimal Relief + Sentinel-2 STAC Ingestion Engine</span>
      </div>
    </div>
  );
};
