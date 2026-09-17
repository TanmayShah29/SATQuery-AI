import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Satellite,
  Layers,
  ChevronRight,
  X,
  Radio,
  Sliders,
  CheckSquare,
  Square,
  ExternalLink,
  ShieldAlert,
  Flame,
  CloudRain,
  Compass,
} from 'lucide-react';
import type { LayerConfig, TacticalGlobePin } from '../types';

interface SituationalFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  layers: LayerConfig[];
  onToggleLayer: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  pins: TacticalGlobePin[];
  selectedPin: TacticalGlobePin | null;
  onSelectPin: (pin: TacticalGlobePin) => void;
  onExecuteQueryForSector?: (pin: TacticalGlobePin) => void;
}

interface TacticalAlertItem {
  id: string;
  pinId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'TACTICAL' | 'ADVISORY';
  region: string;
  sensor: string;
  summary: string;
  timestamp: string;
}

const TACTICAL_ALERTS: TacticalAlertItem[] = [
  {
    id: 'alt-1',
    pinId: 'brahmaputra-flood',
    title: 'Assam Kaziranga Monsoon Inundation',
    severity: 'CRITICAL',
    region: 'Northeast Corridor, Assam',
    sensor: 'Sentinel-1 C-SAR (Cloud Pierced)',
    summary: 'Illustrative scenario: heavy cloud cover over Brahmaputra basin; SAR specular water-boundary isolation is demonstrated on request.',
    timestamp: '12m ago',
  },
  {
    id: 'alt-2',
    pinId: 'joshimath-subsidence',
    title: 'Joshimath Himalayan Land Subsidence',
    severity: 'HIGH',
    region: 'Chamoli, Uttarakhand',
    sensor: 'Cartosat-2S (Optical)',
    summary: 'Illustrative scenario: differential terrain along slope gradient. This system performs radiometric DSP change detection only — no InSAR/DInSAR processing.',
    timestamp: '34m ago',
  },
  {
    id: 'alt-3',
    pinId: 'galwan-sar',
    title: 'Galwan Valley LAC Tactical Infrastructure',
    severity: 'TACTICAL',
    region: 'Ladakh Sector, LAC',
    sensor: 'RISAT-1A (EOS-04) + Sentinel-1',
    summary: 'Illustrative scenario: high-backscatter double-bounce signature analysis for causeway/road reconnaissance (computed live on query).',
    timestamp: '1h 14m ago',
  },
  {
    id: 'alt-4',
    pinId: 'tarapur-npp',
    title: 'Tarapur NPP Thermal Effluent Channel',
    severity: 'ADVISORY',
    region: 'Maharashtra Coastline',
    sensor: 'Landsat-9 TIRS + Sentinel-2',
    summary: 'Illustrative scenario: cooling-water discharge channel monitoring; thermal variance is not currently measured by this system.',
    timestamp: '2h 05m ago',
  },
];

const ORBITAL_PASSES = [
  { sensor: 'Sentinel-2A MSI', band: 'B2-B12 (10m)', passWindow: '14m 20s', mode: 'High Sun (Cloud-Free)', status: 'SIM · APPROACHING' },
  { sensor: 'Sentinel-1 C-SAR', band: 'C-Band 5.405 GHz', passWindow: '42m 10s', mode: 'IW GRD Dual-Pol', status: 'SIM · ACTIVE' },
  { sensor: 'Cartosat-3', band: 'Panchromatic (0.28m)', passWindow: '01h 18m', mode: 'Sub-Meter Tactical', status: 'SIM · SCHEDULED' },
  { sensor: 'RISAT-1A (EOS-04)', band: 'C-Band Circular Pol', passWindow: '02h 45m', mode: 'FRS-1 High-Res', status: 'SIM · STANDBY' },
  { sensor: 'INSAT-3DR (MOSDAC)', band: 'Imager & Sounder', passWindow: 'CONTINUOUS', mode: 'Geostationary 74°E', status: 'SIM · CONTINUOUS' },
];

export const SituationalFeedDrawer: React.FC<SituationalFeedDrawerProps> = ({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onOpacityChange,
  pins,
  selectedPin,
  onSelectPin,
  onExecuteQueryForSector,
}) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'passes' | 'layers'>('alerts');

  if (!isOpen) return null;

  return (
    <aside
      id="situational-feed-drawer"
      className="absolute top-3 left-3 z-30 w-80 max-w-[calc(100vw-24px)] bg-gradient-to-b from-[#131926]/95 via-[#0D121C]/95 to-[#080B12]/95 backdrop-blur-md border border-[#222E44] rounded-xl shadow-2xl flex flex-col text-slate-200 overflow-hidden select-none transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      style={{ maxHeight: 'calc(100% - 24px)' }}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-b from-[#172030] to-[#0F1420] border-b border-[#1F2B3E] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-100 font-mono tracking-wider">
            SITUATIONAL FEED // GEOINT
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[#1E2738] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1C2538] bg-[#0A0E17] text-[10px] font-mono shrink-0">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'alerts'
              ? 'border-cyan-400 text-cyan-200 bg-[#141C2B] font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>SCENARIOS (4)</span>
        </button>
        <button
          onClick={() => setActiveTab('passes')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'passes'
              ? 'border-cyan-400 text-cyan-200 bg-[#141C2B] font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Satellite className="w-3 h-3 text-emerald-400" />
          <span>PASS SCHEDULE</span>
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 flex items-center justify-center space-x-1 ${
            activeTab === 'layers'
              ? 'border-cyan-400 text-cyan-200 bg-[#141C2B] font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3 h-3 text-slate-300" />
          <span>LAYERS</span>
        </button>
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-2 overflow-y-auto max-h-[calc(80vh-90px)]">
        {/* TAB 1: ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-2">
            <div className="p-2 rounded bg-[#0A0E17] border border-[#1C2538] text-[10px] font-mono text-slate-400">
              Curated scenario presets for tactical evaluation (ISRO SAC §4) — static demo content, not live measurements.
            </div>
            {TACTICAL_ALERTS.map((alert) => {
              const targetPin = pins.find((p) => p.id === alert.pinId);
              return (
                <div
                  key={alert.id}
                  onClick={() => {
                    if (targetPin) {
                      onSelectPin(targetPin);
                      onExecuteQueryForSector?.(targetPin);
                    }
                  }}
                  className="p-2.5 rounded-lg border border-[#1E293C] hover:border-cyan-500/60 bg-gradient-to-b from-[#131926]/90 to-[#0C101A]/90 hover:from-[#182132] transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-[#1A2333]">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-950/80 text-red-300 border-red-500/40'
                          : alert.severity === 'HIGH'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                          : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">{alert.timestamp}</span>
                  </div>

                  <div className="mt-1.5 font-sans text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    {alert.title}
                  </div>

                  <p className="mt-1 text-[11px] text-slate-300 font-sans leading-snug">
                    {alert.summary}
                  </p>

                  <div className="mt-2 pt-1.5 border-t border-[#1A2333] flex items-center justify-between text-[9px] font-mono text-slate-400">
                    <span>SENSOR: {alert.sensor}</span>
                    <span className="text-cyan-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                      FLY TO AOI <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: ORBITAL PASSES */}
        {activeTab === 'passes' && (
          <div className="space-y-2">
            <div className="p-2 rounded bg-[#0A0E17] border border-[#1C2538] text-[10px] font-mono text-slate-400">
              Simulated orbital pass schedule (ISRO SAC §3 standard ephemeris).
            </div>

            {ORBITAL_PASSES.map((pass, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-[#1E293C] bg-[#0E131E] space-y-1 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-100 font-bold">{pass.sensor}</span>
                  <span
                    className="text-[9px] px-1.5 py-0.2 rounded border font-bold bg-blue-950 text-blue-300 border-blue-500/40"
                  >
                    {pass.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Band: <span className="text-slate-300">{pass.band}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-[#1C2538]">
                  <span>NEXT OVERPASS:</span>
                  <span className="text-cyan-300 font-bold">{pass.passWindow}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: LAYERS */}
        {activeTab === 'layers' && (
          <div className="space-y-2">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  layer.visible
                    ? 'bg-[#151D2C] border-[#24334C]'
                    : 'bg-[#0B0F17] border-[#182130] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <button
                      onClick={() => onToggleLayer(layer.id)}
                      className="mt-0.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {layer.visible ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: layer.color }}
                        />
                        <span className="text-xs font-semibold text-slate-100 leading-tight">
                          {layer.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {layer.category}
                      </span>
                    </div>
                  </div>
                  {layer.assetCount != null && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0A0D14] text-slate-400 border border-[#1E273A]">
                      {layer.assetCount}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-300 mt-1.5 leading-snug pl-6">
                  {layer.description}
                </p>

                {layer.visible && (
                  <div className="mt-2 pl-6 pt-1.5 border-t border-[#1C2538] flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <div className="flex items-center space-x-1">
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
                        className="w-20 h-1 bg-[#0A0D14] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <span className="w-7 text-right text-slate-300 font-mono">
                        {layer.opacity}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
