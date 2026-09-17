import React from 'react';
import {
  Globe,
  Map,
  SlidersHorizontal,
  SplitSquareVertical,
  Compass,
  Layers,
} from 'lucide-react';
import type { ProjectionMode } from '../types';

interface MapHeaderRibbonProps {
  lat: number;
  lng: number;
  zoom: number;
  projection: ProjectionMode;
  onToggleProjection: () => void;
  swipeActive: boolean;
  onToggleSwipe: () => void;
  layersDrawerOpen: boolean;
  onToggleLayersDrawer: () => void;
  activeLayersCount: number;
  targetSectorName?: string;
  targetBadge?: string;
}

export const MapHeaderRibbon: React.FC<MapHeaderRibbonProps> = ({
  lat,
  lng,
  zoom,
  projection,
  onToggleProjection,
  swipeActive,
  onToggleSwipe,
  layersDrawerOpen,
  onToggleLayersDrawer,
  activeLayersCount,
  targetSectorName,
  targetBadge,
}) => {
  const formattedLat = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const formattedLng = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;

  return (
    <div
      id="map-situation-ribbon"
      className="h-8 w-full bg-[#0A0E16] border-b border-[#1A2232] px-3 sm:px-4 flex items-center justify-between z-20 select-none text-xs text-slate-300 shrink-0 font-mono shadow-sm"
    >
      {/* Left: Telemetry Data (Active Sector, Coordinates, Zoom, Projection) */}
      <div className="flex items-center space-x-2 sm:space-x-3 text-[10px] sm:text-[11px] min-w-0 overflow-hidden whitespace-nowrap">
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-slate-100 font-semibold font-mono tracking-tight truncate max-w-[140px] sm:max-w-[180px]">
            {targetSectorName || 'ISRO SAC Ahmedabad'}
          </span>
          {targetBadge && (
            <span className="px-1.5 py-0.2 rounded bg-[#131926] border border-[#202C3F] text-[9px] text-slate-400 font-mono hidden md:inline">
              {targetBadge}
            </span>
          )}
        </div>

        <div className="h-3 w-px bg-[#1A2232] shrink-0" />

        <div className="flex items-center space-x-1 text-slate-400 whitespace-nowrap shrink-0">
          <Compass className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-slate-200 font-mono">{formattedLat}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-mono">{formattedLng}</span>
        </div>

        <div className="h-3 w-px bg-[#1A2232] hidden sm:block shrink-0" />

        <div className="hidden sm:flex items-center space-x-1 text-slate-400 whitespace-nowrap shrink-0">
          <span className="text-slate-500 font-medium whitespace-nowrap">ZOOM:</span>
          <span className="text-slate-200 font-mono whitespace-nowrap">{zoom.toFixed(1)}</span>
        </div>

        <div className="h-3 w-px bg-[#1A2232] hidden md:block shrink-0" />

        <div className="hidden md:flex items-center space-x-1 text-slate-400 whitespace-nowrap shrink-0">
          <span className="text-slate-500 font-medium whitespace-nowrap">PROJECTION:</span>
          <span className="text-slate-300 uppercase whitespace-nowrap font-mono">{projection}</span>
        </div>
      </div>

      {/* Right: Primary Canvas Action Switches */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {/* Layers Drawer Toggle */}
        <button
          id="layers-drawer-toggle"
          onClick={onToggleLayersDrawer}
          className={`flex items-center space-x-1.5 h-6 px-2 rounded text-[10px] font-mono border transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 ${
            layersDrawerOpen
              ? 'bg-[#1E2738] border-slate-500/60 text-white font-semibold shadow-xs'
              : 'bg-[#111622] hover:bg-[#161D2B] border-[#20293C] text-slate-300 hover:text-white'
          }`}
        >
          <Layers className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="hidden sm:inline whitespace-nowrap">LAYERS</span>
          <span className="px-1 py-0.2 bg-[#090C12] border border-[#20293C] rounded text-[9px] font-mono text-slate-300 shrink-0">
            {activeLayersCount}
          </span>
        </button>

        {/* Bi-Temporal Swipe Toggle */}
        <button
          id="swipe-curtain-toggle"
          onClick={onToggleSwipe}
          className={`flex items-center space-x-1.5 h-6 px-2 rounded text-[10px] font-mono border transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
            swipeActive
              ? 'bg-[#2A2216] border-amber-500/50 text-amber-200 font-semibold shadow-xs'
              : 'bg-[#111622] hover:bg-[#161D2B] border-[#20293C] text-slate-300 hover:text-white'
          }`}
        >
          <SplitSquareVertical className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="hidden sm:inline whitespace-nowrap">SWIPE</span>
        </button>

        {/* 2D / 3D Globe Projection Toggle */}
        <button
          id="projection-toggle-btn"
          onClick={onToggleProjection}
          className="flex items-center space-x-1.5 h-6 px-2 rounded text-[10px] font-mono bg-[#111622] hover:bg-[#161D2B] border border-[#20293C] hover:border-slate-500 text-slate-300 hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
        >
          {projection === 'globe' ? (
            <>
              <Globe className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">3D GLOBE</span>
              <span className="sm:hidden whitespace-nowrap">3D</span>
            </>
          ) : (
            <>
              <Map className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">2D MERCATOR</span>
              <span className="sm:hidden whitespace-nowrap">2D</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
