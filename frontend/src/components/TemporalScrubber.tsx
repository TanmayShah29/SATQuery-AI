import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Satellite,
  Activity,
  Layers,
  Sparkles,
  Columns,
  Eye,
} from 'lucide-react';
import type { TimeRangeOption, SatellitePass } from '../types';
import { fetchSectorTimeline, generateClientTimeline, findNearestPass } from '../utils/timelineConstellation';
import { ProvenanceBadge } from './ui/ProvenanceBadge';

interface TemporalScrubberProps {
  timeRange: TimeRangeOption;
  onChangeTimeRange: (range: TimeRangeOption) => void;
  sliderValue?: number;
  onSliderChange?: (val: number) => void;
  onPlayChange?: (isPlaying: boolean) => void;
  activeEpochLabel?: string;
  isBitemporal?: boolean;
  t1Date?: string;
  t2Date?: string;
  sectorId?: string;
  sectorName?: string;
  onPassChange?: (pass: SatellitePass) => void;
  isCurtainMode?: boolean;
  onToggleCurtainMode?: () => void;
}

export const TemporalScrubber: React.FC<TemporalScrubberProps> = ({
  timeRange,
  onChangeTimeRange,
  sliderValue = 50,
  onSliderChange,
  onPlayChange,
  activeEpochLabel,
  isBitemporal = false,
  t1Date = '2024-04-01',
  t2Date = '2024-05-01',
  sectorId = 'isro-sac',
  sectorName,
  onPassChange,
  isCurtainMode = false,
  onToggleCurtainMode,
}) => {
  const [internalValue, setInternalValue] = useState<number>(sliderValue);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isInteractingSlider, setIsInteractingSlider] = useState<boolean>(false);
  const [passes, setPasses] = useState<SatellitePass[]>(() =>
    generateClientTimeline(sectorId, timeRange, t1Date, t2Date)
  );

  // Sync internal slider value from prop
  useEffect(() => {
    setInternalValue(sliderValue);
  }, [sliderValue]);

  // Load dense constellation passes whenever sector, timeRange, or dates change
  useEffect(() => {
    let active = true;
    fetchSectorTimeline(sectorId, timeRange, t1Date, t2Date).then((fetched) => {
      if (active && fetched && fetched.length > 0) {
        setPasses(fetched);
      }
    });
    return () => {
      active = false;
    };
  }, [sectorId, timeRange, t1Date, t2Date]);

  // Active satellite pass currently targeted by the slider
  const activePass = useMemo(() => {
    return findNearestPass(passes, internalValue);
  }, [passes, internalValue]);

  // Notify parent of active pass changes
  useEffect(() => {
    if (activePass && onPassChange) {
      onPassChange(activePass);
    }
  }, [activePass, onPassChange]);

  // Automated time-scrubber play interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setInternalValue((prev) => {
        const next = prev >= 100 ? 0 : Math.min(100, prev + 1.5);
        setTimeout(() => {
          onSliderChange?.(next);
        }, 0);
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, onSliderChange]);

  const handleTogglePlay = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    onPlayChange?.(nextPlaying);
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setInternalValue(val);
    onSliderChange?.(val);
  };

  const formatShortDate = (isoStr: string, compareDateStr?: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const dComp = compareDateStr ? new Date(compareDateStr) : null;
      const showYear = dComp && !isNaN(dComp.getTime()) && dComp.getFullYear() !== d.getFullYear();
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: showYear ? 'numeric' : undefined,
      }).toUpperCase();
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      id="temporal-scrubber-hud"
      className="w-full bg-sq-bg-0/98 border-t border-sq-border-1 px-3 py-1.5 text-slate-200 select-none shadow-[0_-8px_24px_rgba(0,0,0,0.7)] backdrop-blur-xl shrink-0"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5 text-xs font-mono">
        {/* Row 1: Temporal Range & Sector — always visible ("what am I looking at") */}
        <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-2">
          {/* Left: T1 -> T2 Range & Sector Name */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">
              T1: <span className="text-amber-300 font-bold">{formatShortDate(t1Date, t2Date)}</span>
            </span>
            <span className="text-slate-600">──►</span>
            <span className="text-slate-400">
              T2: <span className="text-cyan-300 font-bold">{formatShortDate(t2Date, t1Date)}</span>
            </span>
            {sectorName && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded bg-sq-bg-1 border border-sq-border-1 text-slate-300 font-sans">
                {sectorName}
              </span>
            )}
          </div>

          {/* Right: Sync status indicator (minimal) */}
          {!activePass && (
            <div className="flex items-center space-x-1 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{activeEpochLabel || 'Synchronizing Constellation...'}</span>
            </div>
          )}
        </div>

        {/* Row 2: Active Pass Metadata — conditional, slides in on interaction */}
        <div className={`overflow-hidden transition-all duration-200 ease-out ${
          activePass && (isInteractingSlider || isPlaying)
            ? 'max-h-8 opacity-100 mt-1'
            : 'max-h-0 opacity-0 mt-0'
        }`}>
          {activePass && (
            <div className="flex items-center space-x-2.5 text-[10px] text-slate-400 border-t border-sq-border-1 pt-1">
              <div className="flex items-center space-x-1">
                <Satellite className="w-3 h-3 text-cyan-400" />
                <span className="text-slate-200 font-bold">{activePass.sensor}</span>
                <span className="text-slate-500">({activePass.resolution})</span>
                {activePass.is_simulated && (
                  <ProvenanceBadge variant="SIMULATED" size="xs" />
                )}
              </div>
              <div className="hidden md:flex items-center space-x-1.5 text-slate-400">
                <span>•</span>
                <span className="text-amber-300 font-semibold">{activePass.formattedDate}</span>
                <span className="text-slate-500">{activePass.formattedTime}</span>
              </div>
              <div className="flex items-center space-x-1 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-300" title={activePass.changeDescription || undefined}>
                <Activity className="w-2.5 h-2.5 text-cyan-400" />
                <span className="font-bold">Δ {activePass.deltaPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Row: Span Selector, Timeline Track with 100s of passes, Play Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          {/* Left: Time Range Presets */}
          <div className="flex items-center space-x-1 shrink-0">
            <div className="flex items-center space-x-1 text-slate-500 text-[10px] mr-1 hidden sm:flex font-semibold tracking-wider">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>SPAN:</span>
            </div>
            {(['24h', '7d', '30d', '1y', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeTimeRange(r)}
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-[#0E131E] text-slate-400 hover:text-slate-200 hover:bg-[#141B2A] border border-[#1A2336]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Center: Constellation Pass Ticks & Slider Track */}
          <div
            className="flex-1 w-full max-w-2xl px-2 flex flex-col items-center"
            onMouseEnter={() => setIsInteractingSlider(true)}
            onMouseLeave={() => setIsInteractingSlider(false)}
            onTouchStart={() => setIsInteractingSlider(true)}
            onTouchEnd={() => setIsInteractingSlider(false)}
          >
            <div className="relative w-full flex items-center py-1.5">
              {/* Background Track */}
              <div className="absolute inset-x-0 h-1 bg-[#121824] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-blue-500"
                  style={{ width: `${internalValue}%` }}
                />
              </div>

              {/* Constellation Pass Pips (Dense timeline showing 10s or 100s of passes) */}
              <div className="absolute inset-x-0 h-1.5 pointer-events-none flex items-center">
                {passes.map((p, idx) => {
                  const passPercent = (idx / Math.max(1, passes.length - 1)) * 100;
                  const isCurrent = activePass?.id === p.id;
                  return (
                    <div
                      key={p.id || idx}
                      style={{ left: `${passPercent}%` }}
                      className={`absolute -translate-x-1/2 w-0.5 rounded-full transition-all ${
                        isCurrent
                          ? 'h-3 bg-cyan-300 shadow-[0_0_6px_#00E5FF] z-20'
                          : p.modality === 'SAR'
                          ? 'h-1.5 bg-amber-400/70'
                          : p.modality === 'NIR'
                          ? 'h-1.5 bg-red-400/60'
                          : 'h-1 bg-slate-600/60'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Range Input */}
              <input
                id="temporal-progress-slider"
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={internalValue}
                onChange={handleRangeChange}
                className="relative w-full h-2 bg-transparent appearance-none cursor-pointer focus:outline-none z-10 
                [&::-webkit-slider-thumb]:appearance-none 
                [&::-webkit-slider-thumb]:w-3 
                [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:bg-cyan-400 
                [&::-webkit-slider-thumb]:border 
                [&::-webkit-slider-thumb]:border-white 
                [&::-webkit-slider-thumb]:rounded-xs 
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_#00E5FF] 
                [&::-webkit-slider-thumb]:cursor-ew-resize
                [&::-moz-range-thumb]:w-3 
                [&::-moz-range-thumb]:h-4 
                [&::-moz-range-thumb]:bg-cyan-400 
                [&::-moz-range-thumb]:border 
                [&::-moz-range-thumb]:border-white 
                [&::-moz-range-thumb]:rounded-xs"
              />
            </div>
          </div>

          {/* Right: Mode Toggle (Timelapse vs Split Curtain) & Playback Button */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Split Curtain Mode Toggle */}
            {onToggleCurtainMode && (
              <button
                type="button"
                onClick={onToggleCurtainMode}
                title={isCurtainMode ? 'Exit Spatial Split Curtain' : 'Toggle Spatial Split Curtain (Compare T1 vs T2)'}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer border ${
                  isCurtainMode
                    ? 'bg-blue-950 border-blue-400 text-blue-200 font-bold shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                    : 'bg-[#101724] hover:bg-[#162032] border-[#1E2A3E] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Columns className="w-3 h-3 text-blue-400" />
                <span className="hidden sm:inline">
                  {isCurtainMode ? 'CURTAIN ACTIVE' : 'SPLIT CURTAIN'}
                </span>
              </button>
            )}

            {/* Timelapse Play / Pause */}
            <button
              type="button"
              onClick={handleTogglePlay}
              title={isPlaying ? 'Pause Constellation Playback' : 'Play Chronological Satellite Timelapse'}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                isPlaying
                  ? 'bg-amber-950/90 border-amber-500/70 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'bg-gradient-to-b from-[#182338] to-[#101726] hover:bg-[#1C283E] border-[#22314A] text-white shadow-xs'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 text-amber-400 animate-pulse" />
              ) : (
                <Play className="w-3 h-3 text-emerald-400" />
              )}
              <span>{isPlaying ? 'PAUSE' : 'PLAY TIMELAPSE'}</span>
            </button>

            {/* Reset to Start or Middle */}
            <button
              type="button"
              onClick={() => {
                setInternalValue(0);
                onSliderChange?.(0);
              }}
              title="Rewind to Earliest Satellite Pass"
              className="p-1 rounded bg-[#0E131E] hover:bg-[#162032] border border-[#1A2336] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
