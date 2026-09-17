import React from 'react';
import {
  Square,
  Sparkles,
  Trash2,
  X,
  Crosshair,
  Compass,
  ArrowRight,
  Maximize,
  HelpCircle,
} from 'lucide-react';

interface AoiDrawToolProps {
  isDrawingActive: boolean;
  onToggleDrawing: () => void;
  drawnAoi: [number, number, number, number] | null;
  onClearAoi: () => void;
  onQueryAoi: (bbox: [number, number, number, number]) => void;
}

export const AoiDrawTool: React.FC<AoiDrawToolProps> = ({
  isDrawingActive,
  onToggleDrawing,
  drawnAoi,
  onClearAoi,
  onQueryAoi,
}) => {
  if (!isDrawingActive && !drawnAoi) return null;

  let areaKm2 = 0;
  if (drawnAoi) {
    const [minLon, minLat, maxLon, maxLat] = drawnAoi;
    const latDist = Math.abs(maxLat - minLat) * 111.32;
    const avgLat = (minLat + maxLat) / 2;
    const lonDist = Math.abs(maxLon - minLon) * (111.32 * Math.cos((avgLat * Math.PI) / 180));
    areaKm2 = Number((latDist * lonDist).toFixed(4));
  }

  const hectares = (areaKm2 * 100).toFixed(1);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-11 z-30 flex items-center space-x-2 bg-[#0A0D14]/95 border border-amber-500/40 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-2xl font-mono text-xs text-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center space-x-2 border-r border-[#1E2638] pr-3">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
          {drawnAoi ? 'Custom AOI Defined' : 'AOI Draw Mode Active'}
        </div>
      </div>

      {drawnAoi ? (
        <div className="flex items-center space-x-3 text-[11px]">
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] mr-1">EXTENT:</span>
            <span className="text-cyan-300 font-semibold">
              [{drawnAoi[0].toFixed(3)}, {drawnAoi[1].toFixed(3)} to {drawnAoi[2].toFixed(3)}, {drawnAoi[3].toFixed(3)}]
            </span>
          </div>

          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] mr-1">AREA:</span>
            <span className="text-amber-400 font-semibold">{areaKm2} km²</span>
            <span className="text-slate-500 text-[9px] ml-1">({hectares} ha)</span>
          </div>

          <button
            onClick={() => onQueryAoi(drawnAoi)}
            className="h-6 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Query This AOI</span>
          </button>

          <button
            onClick={onClearAoi}
            title="Clear Drawn AOI"
            className="h-6 px-2 rounded bg-[#161D2B] hover:bg-[#202A3E] border border-[#26334A] text-slate-400 hover:text-slate-200 text-[10px] flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-[11px] text-slate-300">
          <Crosshair className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Click and drag on the map to bound an Area of Interest</span>
        </div>
      )}

      <button
        onClick={onToggleDrawing}
        title="Exit AOI Drawing Mode"
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1E2638] transition-colors cursor-pointer ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
