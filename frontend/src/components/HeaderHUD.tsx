import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  Radio,
  Search,
  Map as MapIcon,
  ChevronDown,
  Layers,
  Crosshair,
  Satellite,
  ShieldAlert,
  FileCode2,
  BookOpen,
  Split,
  Eye,
  Radar,
  Sparkles,
  Cpu,
  Target,
  Award,
  Database,
  Network,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import type { CategoryType, BasemapMode, SectorTarget, ModalityMode, AIStatusResponse, StudioRoute } from '../types';
import { SECTOR_TARGETS } from '../config/tacticalData';
import { StatusBadge } from './ui/StatusBadge';
import { ProvenanceBadge } from './ui/ProvenanceBadge';

interface HeaderHUDProps {
  selectedCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
  onJumpToSector: (sector: SectorTarget) => void;
  basemap: BasemapMode;
  onToggleBasemap: () => void;
  onOpenSearch: () => void;
  activeModality: ModalityMode;
  onChangeModality: (mode: ModalityMode) => void;
  onOpenGeoTIFFModal: () => void;
  onOpenBenchmarkModal: () => void;
  onOpenModelStatusModal?: () => void;
  isBackendHealthy?: boolean;
  aiStatus?: AIStatusResponse | null;
  currentStudio?: StudioRoute;
  onNavigateStudio?: (studio: StudioRoute) => void;
  onToggleSituationalFeed?: () => void;
  situationalFeedOpen?: boolean;
  onNavigateHome?: () => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  selectedCategory,
  onSelectCategory,
  onJumpToSector,
  basemap,
  onToggleBasemap,
  onOpenSearch,
  activeModality,
  onChangeModality,
  onOpenGeoTIFFModal,
  onOpenBenchmarkModal,
  onOpenModelStatusModal,
  isBackendHealthy = true,
  aiStatus,
  currentStudio = 'dashboard',
  onNavigateStudio,
  onToggleSituationalFeed,
  situationalFeedOpen = false,
  onNavigateHome,
}) => {
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const [mobileModalityMenuOpen, setMobileModalityMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalityRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTargetDropdownOpen(false);
      }
      if (modalityRef.current && !modalityRef.current.contains(event.target as Node)) {
        setMobileModalityMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group targets
  const groupedTargets = SECTOR_TARGETS.reduce<Record<string, SectorTarget[]>>((acc, target) => {
    if (!acc[target.group]) acc[target.group] = [];
    acc[target.group].push(target);
    return acc;
  }, {});

  // HONESTY: this badge used to hardcode "RemoteCLIP-ViT (Local MPS)" regardless of what
  // the backend actually reported. It now mirrors the real /api/settings/ai-status value
  // (the same field the Audit tab reads), so this button can never claim a model is
  // active when it isn't.
  const activeModelLabel = aiStatus?.active_model || (isBackendHealthy ? 'Checking model status…' : 'Model Unavailable (Backend Offline)');

  return (
    <header
      id="header-hud"
      className="h-14 w-full bg-sq-bg-1 border-b border-sq-border-1 px-3 sm:px-4 flex items-center justify-between z-40 select-none text-xs text-slate-200 shrink-0 shadow-sm"
    >
      {/* Brand & Live Status */}
      <div className="flex items-center space-x-3 shrink-0">
        <button
          onClick={onNavigateHome}
          title="Return to SatQuery Overview"
          className="flex items-center space-x-3 text-left hover:opacity-90 transition-opacity cursor-pointer group"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg sq-brand-gradient shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            {/* Brand mark: stylised orbital sweep over a ground-truth aperture */}
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none">
              <circle cx="12" cy="12" r="3.4" fill="white" />
              <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
              <path d="M2.5 12A9.5 9.5 0 0 1 12 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-sq-bg-1 animate-pulse" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center space-x-1.5 font-mono leading-none">
              <span className="text-white font-bold text-xs tracking-tight">SatQuery</span>
              <span className="font-bold text-xs tracking-wider" style={{ color: 'var(--sq-brand-400)' }}>AI</span>
              <span className="text-slate-600 text-xs hidden sm:inline">·</span>
              <span className="hidden sm:inline text-slate-500 text-[10px] font-normal tracking-tight">Divya Drishti</span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-sq-bg-2 border border-sq-border-2 rounded ml-0.5">
                ISRO SAC · SIH26167
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Center: Desktop Studio Switcher Segmented Control */}
      <div
        id="studio-switcher-group"
        className="hidden xl:flex items-center bg-[#111622] p-1 rounded-lg border border-[#1E273A] space-x-0.5 shrink-0"
      >
        <button
          onClick={() => onNavigateStudio?.('dashboard')}
          title="Mission Control: Global Situational Awareness"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'dashboard'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Globe className="w-3 h-3 text-cyan-400" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigateStudio?.('bitemporal')}
          title="Bi-Temporal Change Studio (SIH26167 §4.3)"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'bitemporal'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Split className="w-3 h-3 text-amber-400" />
          <span>Bi-Temporal</span>
        </button>

        <button
          onClick={() => onNavigateStudio?.('crossmodal')}
          title="Optical-SAR Cloud-Piercing Radar Studio (SIH26167 §4.4)"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'crossmodal'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Radar className="w-3 h-3 text-cyan-400" />
          <span>Radar SAR</span>
        </button>

        <button
          onClick={() => onNavigateStudio?.('grounding')}
          title="Visual Grounding & VQA Sandbox (SIH26167 §4.2)"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'grounding'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Target className="w-3 h-3 text-emerald-400" />
          <span>Grounding</span>
        </button>

        <button
          onClick={() => onNavigateStudio?.('benchmarks')}
          title="ISRO SIH26167 Benchmark Verification Harness (§8)"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'benchmarks'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Award className="w-3 h-3 text-amber-400" />
          <span>Benchmarks</span>
        </button>

        <button
          onClick={() => onNavigateStudio?.('ingestion')}
          title="GeoTIFF / STAC / MOSDAC Data Workbench (§3 & §7)"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'ingestion'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Database className="w-3 h-3 text-blue-400" />
          <span>Data</span>
        </button>

        <button
          onClick={() => onNavigateStudio?.('audit')}
          title="Auditable Agent Execution Traces & Model Registry (§6)"
          className={`h-7 px-2.5 rounded-md text-[10px] font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
            currentStudio === 'audit'
              ? 'bg-[#1E2738] text-white font-bold shadow-xs border border-slate-500/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151B27]/70 border border-transparent'
          }`}
        >
          <Network className="w-3 h-3 text-purple-400" />
          <span>Audit DAG</span>
        </button>
      </div>

      {/* Right Controls: Mobile Modality, Scope Dropdown, Spotlight Search */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        {/* Mobile/Compact Modality Selector Button */}
        <div className="lg:hidden relative shrink-0" ref={modalityRef}>
          <button
            id="mobile-modality-btn"
            onClick={() => setMobileModalityMenuOpen(!mobileModalityMenuOpen)}
            className="h-8 flex items-center space-x-1.5 px-2.5 bg-sq-bg-2 hover:bg-sq-bg-3 border border-sq-border-2 hover:border-slate-500 rounded-md text-[10px] font-mono text-slate-200 shadow-sm transition-colors whitespace-nowrap"
          >
            {activeModality === 'single_image' && <Eye className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            {activeModality === 'cross_modal' && <Radar className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            {activeModality === 'bitemporal' && <Split className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            <span className="font-semibold">
              {activeModality === 'single_image' ? 'Single' : activeModality === 'cross_modal' ? 'Cross' : 'Bi-Temp'}
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-slate-400 shrink-0 ml-0.5" />
          </button>
          {mobileModalityMenuOpen && (
            <div className="absolute right-0 sm:left-0 mt-1.5 w-56 max-w-[calc(100vw-24px)] bg-sq-bg-1 border border-sq-border-2 rounded-lg shadow-2xl p-1 z-50 text-[11px] font-mono">
              <div className="px-2 py-1 text-[9px] text-slate-400 uppercase font-semibold border-b border-sq-border-1 mb-1">
                Select Pipeline Modality
              </div>
              <button
                onClick={() => {
                  onChangeModality('single_image');
                  setMobileModalityMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md flex items-center space-x-2 transition-colors ${
                  activeModality === 'single_image'
                    ? 'bg-sq-border-1 text-white font-semibold'
                    : 'text-slate-300 hover:bg-sq-bg-2'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Single Image VQA</span>
              </button>
              <button
                onClick={() => {
                  onChangeModality('cross_modal');
                  setMobileModalityMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md flex items-center space-x-2 transition-colors ${
                  activeModality === 'cross_modal'
                    ? 'bg-sq-border-1 text-white font-semibold'
                    : 'text-slate-300 hover:bg-sq-bg-2'
                }`}
              >
                <Radar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Cross-Modal (OPT+SAR)</span>
              </button>
              <button
                onClick={() => {
                  onChangeModality('bitemporal');
                  setMobileModalityMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md flex items-center space-x-2 transition-colors ${
                  activeModality === 'bitemporal'
                    ? 'bg-sq-border-1 text-white font-semibold'
                    : 'text-slate-300 hover:bg-sq-bg-2'
                }`}
              >
                <Split className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Bi-Temporal (T1 vs T2)</span>
              </button>
            </div>
          )}
        </div>

        {/* Tactical Scope Quick Jump Dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            id="scope-selector-btn"
            onClick={() => setTargetDropdownOpen(!targetDropdownOpen)}
            title="Select Priority Target Sector"
            className="h-8 flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 bg-sq-bg-2 hover:bg-sq-bg-3 border border-sq-border-2 hover:border-slate-500 rounded-md text-slate-200 hover:text-white transition-colors duration-150 font-mono text-[10px] shadow-sm whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            <Crosshair className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="hidden sm:inline">Sectors</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {targetDropdownOpen && (
            <div
              id="scope-dropdown-menu"
              className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-20px)] bg-sq-bg-1 border border-sq-border-2 rounded-lg shadow-2xl z-50 p-1.5 max-h-96 overflow-y-auto"
            >
              <div className="text-[10px] font-mono text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-sq-border-1 mb-1 font-semibold">
                ISRO Priority Target Sectors
              </div>
{Object.entries(groupedTargets).map(([groupName, targets]) => (
                  <div key={groupName} className="mb-2">
                    <div className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 tracking-wide">
                      {groupName}
                    </div>
                    <div className="space-y-0.5">
                      {targets.map((tgt) => (
                        <button
                          key={tgt.id}
                          onClick={() => {
                            onJumpToSector(tgt);
                            setTargetDropdownOpen(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-sq-bg-3 flex items-center justify-between group transition-colors"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-slate-200 group-hover:text-white">
                              {tgt.name}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {tgt.region}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sq-bg-0 border border-sq-border-1 text-slate-400 group-hover:border-slate-500 group-hover:text-slate-200">
                              {tgt.badge}
                            </span>
                            {tgt.is_real_image && (
                              <ProvenanceBadge variant="VERIFIED" size="xs" />
                            )}
                            {tgt.is_simulated && !tgt.is_real_image && (
                              <ProvenanceBadge variant="SIMULATED" size="xs" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Spotlight Search Modal Trigger */}
        <button
          id="spotlight-search-btn"
          onClick={onOpenSearch}
          title="Open Query Search (⌘K)"
          className="h-8 flex items-center space-x-1.5 sm:space-x-2 px-2.5 bg-[#1C3252] hover:bg-[#233F68] border border-blue-400/40 hover:border-blue-400/70 text-blue-100 rounded-md transition-colors duration-150 font-mono text-[10px] shadow-sm whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline font-semibold">Query</span>
          <kbd className="hidden sm:inline-block px-1 py-0.2 bg-[#0E1B2E] border border-blue-400/30 rounded text-[9px] text-slate-300">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
};
