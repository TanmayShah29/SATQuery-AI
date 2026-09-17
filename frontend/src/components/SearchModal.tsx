import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Layers,
  CloudRain,
  Building2,
  Ship,
  CornerDownLeft,
  Sparkles,
  Loader2,
  Compass,
} from 'lucide-react';
import { RECOMMENDED_PRESETS, TACTICAL_PINS } from '../config/tacticalData';
import type { TacticalGlobePin } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteQuery: (query: string, sectorPin?: TacticalGlobePin) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onExecuteQuery,
}) => {
  const [queryText, setQueryText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQueryText('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Global shortcut listeners (Cmd+K / Ctrl+K and Esc)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Handled by parent or toggles here
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunPreset = (preset: typeof RECOMMENDED_PRESETS[0]) => {
    const pin = TACTICAL_PINS.find((p) => p.id === preset.sectorId) || TACTICAL_PINS[0];
    setQueryText(preset.query);
    setIsProcessing(true);
    setTimeout(() => {
      onExecuteQuery(preset.query, pin);
      setIsProcessing(false);
      onClose();
    }, 300);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    // Find best matching pin by query text
    const textLower = queryText.toLowerCase();
    const matchedPin =
      TACTICAL_PINS.find(
        (p) =>
          p.name.toLowerCase().includes(textLower) ||
          p.description.toLowerCase().includes(textLower) ||
          p.category.toLowerCase().includes(textLower)
      ) || TACTICAL_PINS[0];

    setIsProcessing(true);
    setTimeout(() => {
      onExecuteQuery(queryText, matchedPin);
      setIsProcessing(false);
      onClose();
    }, 350);
  };

  // Filtered matching pins for quick select
  const filteredPins = queryText.trim()
    ? TACTICAL_PINS.filter(
        (pin) =>
          pin.name.toLowerCase().includes(queryText.toLowerCase()) ||
          pin.badge.toLowerCase().includes(queryText.toLowerCase()) ||
          pin.description.toLowerCase().includes(queryText.toLowerCase())
      ).slice(0, 3)
    : [];

  return (
    <div
      id="search-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        id="search-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-gradient-to-b from-[#151A26] to-[#0D1018] border border-[#232B3E] rounded-xl shadow-[0_24px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden flex flex-col text-slate-200"
      >
        {/* Search Header Input */}
        <form onSubmit={handleFormSubmit} className="relative flex items-center px-4 py-3.5 border-b border-[#202838] bg-gradient-to-b from-[#182030] to-[#111622]">
          <Search className="w-5 h-5 text-slate-300 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            id="spotlight-input-field"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search sector, coordinate, or ask remote sensing question (e.g. detect structural change)..."
            className="w-full bg-transparent border-none px-3 text-sm text-slate-100 placeholder-slate-500 font-sans focus-visible:outline-none"
          />

          {isProcessing ? (
            <Loader2 className="w-4 h-4 text-slate-300 animate-spin shrink-0" />
          ) : queryText ? (
            <button
              type="button"
              onClick={() => setQueryText('')}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-500 border border-[#222B3B] bg-[#0E121B] px-1.5 py-0.5 rounded">
              <span>ESC TO EXIT</span>
            </div>
          )}
        </form>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Matched Sector Pins if query is active */}
          {filteredPins.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Matching Sectors
              </div>
              <div className="space-y-1">
                {filteredPins.map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() => {
                      onExecuteQuery(pin.recommendedQuery, pin);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-gradient-to-b from-[#1A2230] to-[#121722] hover:from-[#222C3F] hover:to-[#171E2C] border border-[#263246] hover:border-slate-400 transition-colors duration-150 text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Compass className="w-4 h-4 text-slate-300" />
                      <div>
                        <div className="text-xs font-medium text-slate-200 group-hover:text-white">
                          {pin.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {pin.country} • {pin.lat.toFixed(3)}°, {pin.lon.toFixed(3)}°
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 px-2 py-0.5 rounded bg-[#0E121B] border border-[#242D3D]">
                      SELECT SECTOR
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Sensing Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Recommended Sensing Presets</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                RemoteCLIP + MobileSAM Ingestion
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {RECOMMENDED_PRESETS.map((preset) => {
                const getIcon = () => {
                  switch (preset.icon) {
                    case 'Layers':
                      return <Layers className="w-4 h-4 text-slate-400" />;
                    case 'CloudRain':
                      return <CloudRain className="w-4 h-4 text-slate-400" />;
                    case 'Building2':
                      return <Building2 className="w-4 h-4 text-slate-400" />;
                    case 'Ship':
                      return <Ship className="w-4 h-4 text-slate-400" />;
                    default:
                      return <Sparkles className="w-4 h-4 text-slate-400" />;
                  }
                };

                return (
                  <button
                    key={preset.id}
                    id={`preset-card-${preset.id}`}
                    onClick={() => handleRunPreset(preset)}
                    className="p-3 rounded-lg bg-gradient-to-b from-[#181F2C] to-[#111620] hover:from-[#20293C] hover:to-[#161D2B] border border-[#252F42] hover:border-slate-400 text-left transition-colors duration-150 group flex flex-col justify-between shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0A0D14] border border-[#222B3C] text-slate-300">
                          {preset.tag}
                        </span>
                        {getIcon()}
                      </div>
                      <p className="text-xs text-slate-200 group-hover:text-white leading-snug font-medium">
                        "{preset.query}"
                      </p>
                    </div>

                    <div className="mt-2.5 pt-1.5 border-t border-[#1F2736] flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Click to run query & fly</span>
                      <CornerDownLeft className="w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 bg-gradient-to-b from-[#111622] to-[#0C0F16] border-t border-[#202838] flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1 py-0.2 bg-[#171E2C] border border-[#252E40] rounded text-[9px] text-slate-300">
                ↵ ENTER
              </kbd>
              <span>to execute</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1 py-0.2 bg-[#171E2C] border border-[#252E40] rounded text-[9px] text-slate-300">
                ESC
              </kbd>
              <span>to dismiss</span>
            </span>
          </div>
          <span className="text-slate-400 text-[10px]">
            ESA / ISRO / NASA STAC Catalog Online
          </span>
        </div>
      </div>
    </div>
  );
};
