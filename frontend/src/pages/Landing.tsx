import React, { useState } from 'react';
import {
  Radar,
  Split,
  Network,
  ArrowRight,
  Shield,
  Satellite,
  Activity,
  Cpu,
  Layers,
  Sparkles,
  Database,
  CheckCircle2,
  ChevronRight,
  Eye,
  Crosshair,
  BarChart3,
  Globe,
  Waves,
  Mountain,
  Building2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { TACTICAL_PINS } from '../config/tacticalData';

interface LandingProps {
  onLaunch: (targetPinId?: string) => void;
  isLaunching?: boolean;
}

export default function Landing({ onLaunch, isLaunching = false }: LandingProps) {
  const [activeModalTab, setActiveModalTab] = useState<'optical' | 'sar' | 'fusion'>('fusion');
  const [activeCaseStudy, setActiveCaseStudy] = useState<'joshimath' | 'brahmaputra' | 'siachen'>('brahmaputra');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative min-h-screen w-full bg-transparent text-slate-100 font-sans select-auto transition-opacity duration-500 ${isLaunching ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Background Subtle Tactical Grid */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.02] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[size:48px_48px] z-0" />

      {/* 1. TOP STICKY HUD NAVIGATION */}
      <header className="sticky top-0 z-40 h-16 w-full bg-[#080A0F]/90 backdrop-blur-md border-b border-[#1B2232] px-4 sm:px-8 flex items-center justify-between">
        {/* Brand mark & Identity */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg sq-brand-gradient shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <circle cx="12" cy="12" r="3.4" fill="white" />
              <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
              <path d="M2.5 12A9.5 9.5 0 0 1 12 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 font-mono leading-none">
              <span className="text-white font-bold text-sm tracking-tight">SatQuery</span>
              <span className="font-bold text-sm text-cyan-400">AI</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 text-xs font-semibold">Divya-Drishti</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5 hidden sm:block">
              ISRO SAC &middot; Smart India Hackathon 2026 &middot; PS 26167
            </div>
          </div>
        </div>

        {/* Section Anchor Links (Desktop) */}
        <nav className="hidden xl:flex items-center space-x-6 text-xs font-mono text-slate-400">
          <button onClick={() => scrollToSection('sensors')} className="hover:text-cyan-300 transition-colors cursor-pointer">
            Sensors &amp; SAR
          </button>
          <button onClick={() => scrollToSection('bitemporal')} className="hover:text-cyan-300 transition-colors cursor-pointer">
            Bi-Temporal Delta
          </button>
          <button onClick={() => scrollToSection('dag')} className="hover:text-cyan-300 transition-colors cursor-pointer">
            Agent DAG
          </button>
          <button onClick={() => scrollToSection('benchmarks')} className="hover:text-cyan-300 transition-colors cursor-pointer">
            Benchmarks
          </button>
          <button onClick={() => scrollToSection('sih2026')} className="hover:text-cyan-300 transition-colors cursor-pointer">
            PS 26167 Specs
          </button>
        </nav>

        {/* Action button & Telemetry */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0F1420] border border-[#1E283D] text-[10px] font-mono text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-semibold">MULTI-ORBITER STAC QUERY</span>
          </div>

          <button
            id="header-launch-console-btn"
            onClick={() => onLaunch()}
            disabled={isLaunching}
            className="group flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-950/40 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span>{isLaunching ? 'Entering Console…' : 'Launch Tactical Console'}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative z-10 min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-8 flex flex-col lg:flex-row items-center justify-between py-12 lg:py-0">
        {/* Left Column: Vision & Identity */}
        <div className="w-full lg:w-[48%] xl:w-[45%] flex flex-col justify-center space-y-6 pt-4 lg:pt-0 relative z-20">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#121926] border border-[#232F46] text-[11px] font-mono text-cyan-300 w-fit">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>ISRO SAC // SIH 2026 // PROBLEM STATEMENT 26167</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.06]">
              SatQuery <span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-xl sm:text-2xl font-bold font-mono text-slate-300 tracking-tight">
              Divya-Drishti: Multi-Modal Earth Observation Intelligence
            </p>
          </div>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
            Direct natural-language grounding across Optical, C-band SAR, and multi-temporal satellite rasters.
            Built for sub-meter surface change detection, monsoon cloud penetration, and verifiable ReAct geospatial reasoning.
          </p>

          {/* Tactical Sensor Constellation Strip */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 max-w-lg">
            <div className="p-2.5 rounded-lg bg-[#0E131E] border border-[#1C2538]">
              <div className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-slate-200">
                <Satellite className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sentinel-2A MSI</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">10m Optical RGB/NIR &middot; 5d Revisit</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E131E] border border-[#1C2538]">
              <div className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-slate-200">
                <Radar className="w-3.5 h-3.5 text-amber-400" />
                <span>Sentinel-1 C-SAR</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">20m Radar &middot; Cloud-Piercing VV/VH</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E131E] border border-[#1C2538]">
              <div className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-slate-200">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cartosat-3</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">0.28m Panchromatic Tactical</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E131E] border border-[#1C2538]">
              <div className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-slate-200">
                <Waves className="w-3.5 h-3.5 text-indigo-400" />
                <span>RISAT-1A / EOS-04</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">C-band MRS &middot; SAR Amplitude Baseline (no InSAR in this build)</div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="hero-launch-console-btn"
              onClick={() => onLaunch()}
              disabled={isLaunching}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold text-sm tracking-wide transition-all shadow-xl shadow-cyan-900/30 active:scale-95 cursor-pointer"
            >
              <Radar className="w-4 h-4 animate-pulse" />
              <span>LAUNCH TACTICAL CONSOLE</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => scrollToSection('sensors')}
              className="px-5 py-3 rounded-lg border border-[#232F46] hover:border-[#354563] text-slate-300 hover:text-white font-mono text-xs font-semibold transition-colors cursor-pointer"
            >
              Explore Architecture ↓
            </button>
          </div>

          {/* Quick Target Sector Gateway */}
          <div className="pt-2 flex flex-col space-y-2">
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold">DIRECT SECTOR LAUNCH:</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500 text-[10px]">Click any tactical AOI to glide straight into analysis</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TACTICAL_PINS.slice(0, 4).map((pin) => (
                <button
                  key={pin.id}
                  onClick={() => onLaunch(pin.id)}
                  disabled={isLaunching}
                  className="px-3 py-1.5 rounded-lg bg-[#0E1420] hover:bg-[#182338] border border-[#1F2C42] hover:border-cyan-500/60 text-slate-300 hover:text-cyan-200 transition-all font-mono text-xs flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pin.pinColor }} />
                  <span className="font-semibold">{pin.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Readiness & Sensor Orbit Telemetry Strip */}
          <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 border-t border-[#161D2B]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">ISRO SAC Compliant &middot; Local Neural Execution &amp; Edge Ingest</span>
            </div>
            <span className="text-slate-700 hidden sm:inline">&bull;</span>
            <div className="text-slate-400">
              Orbit: <span className="text-cyan-400 font-semibold">SSO 786km</span> &middot; Fast Revisit
            </div>
            <span className="text-slate-700 hidden sm:inline">&bull;</span>
            <div className="text-slate-400">
              AOI: <span className="text-slate-300">India Continental (78.96&deg;E, 20.59&deg;N)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Clean Dedicated Globe Stage */}
        <div className="w-full lg:w-[50%] xl:w-[53%] flex flex-col items-center justify-center relative min-h-[520px] lg:min-h-[680px] pointer-events-none mt-8 lg:mt-0" />
      </section>

      {/* 3. SECTION 1: MULTI-MODAL SENSOR CONSTELLATION (SAR + OPTICAL FUSION) */}
      <section id="sensors" className="relative z-20 py-20 border-t border-[#161C2A] bg-[#080A0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest font-semibold mb-2">
              Cross-Modal Remote Sensing Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Why Optical Satellite Imagery Fails When You Need It Most.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
              Monsoon cloud blankets in Assam, Himalayan snowfall in Siachen, and night operations render conventional
              optical satellites (Sentinel-2, Landsat) 100% blind. SatQuery AI pairs optical with Synthetic Aperture Radar (SAR)
              to pierce weather and synthesize coherent ground evidence.
            </p>
          </div>

          {/* Interactive Modality Showcase Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Optical Card */}
            <div className={`p-6 rounded-xl border transition-all ${activeModalTab === 'optical' ? 'bg-[#0E1524] border-cyan-500/50 shadow-lg shadow-cyan-950/20' : 'bg-[#0A0E17] border-[#1A2336]'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-bold">
                  <Eye className="w-4 h-4" />
                  <span>OPTICAL (SENTINEL-2 MSI)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 border border-blue-500/30 text-blue-300">
                  10m GSD
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mb-4">
                RGB visual spectrum (B04, B03, B02) + Near-Infrared (B08). Ideal for vegetation health and urban visual confirmation, but stopped cold by cloud cover, atmospheric haze, and darkness.
              </p>
              <div className="pt-3 border-t border-[#1C263B] text-[11px] font-mono text-slate-400 space-y-1">
                <div><span className="text-slate-500">Wavelength:</span> 440nm – 2200nm</div>
                <div><span className="text-slate-500">Limitation:</span> Blinded by &gt;40% cloud cover</div>
              </div>
            </div>

            {/* SAR Radar Card */}
            <div className={`p-6 rounded-xl border transition-all ${activeModalTab === 'sar' ? 'bg-[#0E1524] border-amber-500/50 shadow-lg shadow-amber-950/20' : 'bg-[#0A0E17] border-[#1A2336]'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold">
                  <Radar className="w-4 h-4" />
                  <span>C-BAND SAR (SENTINEL-1)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 border border-amber-500/30 text-amber-300">
                  20m GSD
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mb-4">
                Active microwave radar at 5.405 GHz. Images through cloud, heavy monsoon rain, and smoke (cloud-independent, not cloud-penetrating). Measures surface roughness via dual-polarization (VV/VH) backscatter.
              </p>
              <div className="pt-3 border-t border-[#1C263B] text-[11px] font-mono text-slate-400 space-y-1">
                <div><span className="text-slate-500">Wavelength:</span> 5.54 cm (C-band)</div>
                <div><span className="text-slate-500">Capability:</span> 24/7 all-weather day &amp; night</div>
              </div>
            </div>

            {/* Cross-Modal Fusion Card */}
            <div className={`p-6 rounded-xl border transition-all ${activeModalTab === 'fusion' ? 'bg-[#0E1524] border-emerald-500/50 shadow-lg shadow-emerald-950/20' : 'bg-[#0A0E17] border-[#1A2336]'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold">
                  <Layers className="w-4 h-4" />
                  <span>CROSS-MODAL FUSION</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                  SUB-PIXEL CO-REG
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mb-4">
                SatQuery AI co-registers SAR dielectric backscatter onto optical baselines, producing fused pseudo-color imagery where water surfaces, flooded runways, and metal structures glow distinctly.
              </p>
              <div className="pt-3 border-t border-[#1C263B] text-[11px] font-mono text-slate-400 space-y-1">
                <div><span className="text-slate-500">Target Sectors:</span> Brahmaputra, Siachen, Galwan</div>
                <div><span className="text-slate-500">Model:</span> RemoteCLIP-ViT Alignment</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. SECTION 2: BI-TEMPORAL QUANTITATIVE DELTA ENGINE */}
      <section id="bitemporal" className="relative z-20 py-20 border-t border-[#161C2A] bg-[#080A0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-amber-400 font-mono text-xs uppercase tracking-widest font-semibold mb-2">
                Pixel-Level Change Differencing
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                From Archival Baseline (T₁) to Contemporary Revisit (T₂).
              </h2>
              <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
                Detecting changes requires comparing historical satellite acquisitions against the latest orbital pass.
                SatQuery AI executes calibrated radiometric differencing across multi-mission archives, computing exact surface area deltas in square kilometers.
              </p>

              <div className="space-y-4 mt-8">
                <div className="flex items-start space-x-3 p-3 rounded-lg bg-[#0E131E] border border-[#1C2538]">
                  <div className="w-6 h-6 rounded bg-blue-950 border border-blue-500/30 text-blue-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    Δ1
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-200">NDVI / NDWI Spectral Differencing</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Automated extraction of water boundaries during flood events and vegetation clearing.</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg bg-[#0E131E] border border-[#1C2538]">
                  <div className="w-6 h-6 rounded bg-amber-950 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    Δ2
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-200">Multi-temporal SAR Change Detection</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Bi-temporal SAR differencing to identify surface changes. Note: InSAR phase coherence is not implemented in this build.</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg bg-[#0E131E] border border-[#1C2538]">
                  <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    Δ3
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-200">Quantified Polygon GeoJSON Generation</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Direct export of GeoJSON bounding geometries compatible with GIS workstations and command centers.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Case Study Deep-Dive Card */}
            <div className="p-6 rounded-2xl bg-[#0B0F17] border border-[#1F293D] shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#1A2336]">
                <div className="text-xs font-mono text-slate-300 font-bold flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>TACTICAL SECTOR CASE STUDIES (DEMO SCENARIOS)</span>
                </div>
                <div className="flex space-x-1">
                  {(['brahmaputra', 'joshimath', 'siachen'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setActiveCaseStudy(key)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${activeCaseStudy === key ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 text-[9px] font-mono text-slate-500 italic">
                Illustrative pre-configured offline demo scenarios — figures below are scripted for the internal-round walkthrough, not claims of a validated evaluation run.
              </div>

              {activeCaseStudy === 'brahmaputra' && (
                <div className="py-6 space-y-4">
                  <div className="text-base font-bold text-white">Brahmaputra Basin Monsoon Inundation (Assam) — Demo Scenario</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Heavy monsoon rainfall caused riverbanks to breach near Kaziranga. Optical imagery was blocked by storm clouds; Sentinel-1 C-SAR bi-temporal differencing is used to walk through how flood inundation would be revealed and quantified in this scripted scenario.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#1E273A]">
                      <div className="text-[10px] font-mono text-slate-400">DEMO SURFACE WATER DELTA</div>
                      <div className="text-lg font-mono font-black text-cyan-400 mt-1">+142.6 km²</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#1E273A]">
                      <div className="text-[10px] font-mono text-slate-400">SCENARIO CONFIDENCE</div>
                      <div className="text-lg font-mono font-black text-emerald-400 mt-1">94.2%</div>
                    </div>
                  </div>
                </div>
              )}

              {activeCaseStudy === 'joshimath' && (
                <div className="py-6 space-y-4">
                  <div className="text-base font-bold text-white">Joshimath Urban Subsidence (Uttarakhand) — Demo Scenario</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A scripted walkthrough of how differential SAR interferometry (DInSAR) over a multi-month window could quantify ground displacement across Ward 5 and Sunil area. DInSAR phase-coherence processing is not implemented in this build — the figures below illustrate the target output format only.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#1E273A]">
                      <div className="text-[10px] font-mono text-slate-400">ILLUSTRATIVE DISPLACEMENT</div>
                      <div className="text-lg font-mono font-black text-rose-400 mt-1">-14.2 cm</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#1E273A]">
                      <div className="text-[10px] font-mono text-slate-400">TARGET CADENCE</div>
                      <div className="text-lg font-mono font-black text-amber-400 mt-1">12-Day Revisit</div>
                    </div>
                  </div>
                </div>
              )}

              {activeCaseStudy === 'siachen' && (
                <div className="py-6 space-y-4">
                  <div className="text-base font-bold text-white">Siachen Glacier Snout Retreat (Ladakh) — Demo Scenario</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A scripted walkthrough of cryospheric glacial monitoring using Cartosat-3 0.28m PAN imagery fused with Sentinel-2 VNIR bands to illustrate moraine velocity, crevasse expansion, and snout terminus retreat tracking over a multi-year baseline.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#1E273A]">
                      <div className="text-[10px] font-mono text-slate-400">ILLUSTRATIVE RETREAT DELTA</div>
                      <div className="text-lg font-mono font-black text-indigo-400 mt-1">-88.4 m/yr</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#1E273A]">
                      <div className="text-[10px] font-mono text-slate-400">RESOLVED GSD</div>
                      <div className="text-lg font-mono font-black text-teal-400 mt-1">0.28m PAN</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => onLaunch()}
                className="w-full py-2.5 rounded-lg bg-[#151D2C] hover:bg-[#1E283D] border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <span>OPEN IN TACTICAL CONSOLE</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION 3: EXPLAINABLE AGENT DAG & ZERO-SHOT GROUNDING */}
      <section id="dag" className="relative z-20 py-20 border-t border-[#161C2A] bg-[#080A0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-emerald-400 font-mono text-xs uppercase tracking-widest font-semibold mb-2">
              Explainable ReAct Execution Pipeline
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Eliminating Black-Box Hallucinations in Satellite Defense.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
              Standard commercial LLMs fabricate coordinates, invent bounding boxes, and lack physical remote-sensing calibration.
              SatQuery AI executes a transparent 5-stage Directed Acyclic Graph (DAG) where every inference step is logged, timed, and inspectable.
            </p>
          </div>

          {/* 5-Step Pipeline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1B2436] relative">
              <span className="text-[10px] font-mono text-cyan-400 font-bold">01 // QUERY PARSER</span>
              <div className="text-sm font-bold text-white mt-1">Intent Resolution</div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Extracts location entities, time windows (24h to 1y), and required sensors (SAR vs Optical).
              </p>
              <div className="mt-4 pt-2 border-t border-[#182030] text-[9px] font-mono text-slate-500">Live per-query latency shown in the Audit tab</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1B2436] relative">
              <span className="text-[10px] font-mono text-blue-400 font-bold">02 // GEO LOCATOR</span>
              <div className="text-sm font-bold text-white mt-1">EPSG:4326 BBox</div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Projects target to exact coordinates, defining [minX, minY, maxX, maxY] bounding frames.
              </p>
              <div className="mt-4 pt-2 border-t border-[#182030] text-[9px] font-mono text-slate-500">CRS: EPSG:4326 (WGS84)</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1B2436] relative">
              <span className="text-[10px] font-mono text-amber-400 font-bold">03 // STAC STREAM</span>
              <div className="text-sm font-bold text-white mt-1">Raster Ingestion</div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Retrieves calibrated Sentinel-1/2 rasters and local GeoTIFF bands via GDAL/Rasterio pipeline.
              </p>
              <div className="mt-4 pt-2 border-t border-[#182030] text-[9px] font-mono text-slate-500">Band: RGB + SAR VV/VH</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1B2436] relative">
              <span className="text-[10px] font-mono text-emerald-400 font-bold">04 // REMOTE-CLIP</span>
              <div className="text-sm font-bold text-white mt-1">Zero-Shot Grounding</div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Vision-language transformer aligns query embedding against spatial raster tokens, scoring confidence.
              </p>
              <div className="mt-4 pt-2 border-t border-[#182030] text-[9px] font-mono text-slate-500">IoU threshold: adjustable in Grounding Studio</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1B2436] relative">
              <span className="text-[10px] font-mono text-teal-400 font-bold">05 // SYNTHESIS</span>
              <div className="text-sm font-bold text-white mt-1">Evidence Export</div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Outputs vector GeoJSON polygons, area modified in km², and verifiable tactical briefing report.
              </p>
              <div className="mt-4 pt-2 border-t border-[#182030] text-[9px] font-mono text-slate-500">Format: GeoJSON / EPSG:4326</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION 4: TARGET EVALUATION BENCHMARKS */}
      <section id="benchmarks" className="relative z-20 py-20 border-t border-[#161C2A] bg-[#080A0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest font-semibold mb-2">
              Target Evaluation Benchmarks
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built Against the Standard Remote Sensing Benchmarks.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
              SatQuery AI is designed and structured around the datasets SIH26167 prescribes for training and evaluation —
              BigEarthNet.txt, VRSBench, RSVQA, and CDVQA. The cards below describe what each benchmark tests, not a
              scored result: run the Benchmark Studio in the console for live, query-by-query evaluation against your
              current backend, rather than a pre-computed leaderboard number.
            </p>
          </div>

          {/* Standard Remote Sensing Benchmark Cards — describe the task, not an unverified score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* BigEarthNet.txt */}
            <div className="rounded-xl border border-[#1C2538] bg-[#0B0F19] p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Multi-Modal Adaptation</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300">590K Pairs</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">BigEarthNet.txt</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  Co-registered Sentinel-1 SAR &amp; Sentinel-2 MSI patches with text captions — the PS-prescribed dataset
                  for remote-sensing domain adaptation of the image–text alignment backbone.
                </p>
                <div className="p-3 rounded-lg bg-[#070A10] border border-[#151D2C] mb-4 text-[11px] font-mono text-slate-400 leading-relaxed">
                  Role in SatQuery AI: primary fine-tuning corpus for aligning natural language with optical + SAR
                  spectral signatures. Scores are reported live in the Benchmark Studio once evaluation is run, not
                  claimed here.
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-[#141B2A]">
                <span>arXiv:2603.29630</span>
                <span className="text-slate-400 font-medium">Training &amp; adaptation set</span>
              </div>
            </div>

            {/* VRSBench */}
            <div className="rounded-xl border border-[#1C2538] bg-[#0B0F19] p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Vision-Language VQA</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/50 text-indigo-300">29.6K Images</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">VRSBench</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  High-resolution satellite imagery benchmark for visual question answering, natural-language grounding,
                  and scene captioning — used to evaluate the single-image baseline requirement.
                </p>
                <div className="p-3 rounded-lg bg-[#070A10] border border-[#151D2C] mb-4 text-[11px] font-mono text-slate-400 leading-relaxed">
                  Role in SatQuery AI: evaluates single-image VQA and text-guided region grounding. Open the Benchmark
                  Studio to run a live query against this dataset's question format and see the actual model answer.
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-[#141B2A]">
                <span>VRSBench (open dataset)</span>
                <span className="text-slate-400 font-medium">Single-image baseline</span>
              </div>
            </div>

            {/* CDVQA / LEVIR-CD */}
            <div className="rounded-xl border border-[#1C2538] bg-[#0B0F19] p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Bi-Temporal Change</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300">Bi-temporal pairs</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">CDVQA / LEVIR-CD</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  Temporal change question-answering and building change-detection pairs — used to evaluate the
                  mandatory multi-image change analysis requirement.
                </p>
                <div className="p-3 rounded-lg bg-[#070A10] border border-[#151D2C] mb-4 text-[11px] font-mono text-slate-400 leading-relaxed">
                  Role in SatQuery AI: evaluates change description / change-VQA from a t1/t2 image pair. As with the
                  other benchmarks, results are shown live per-run in the console, not pre-scored here.
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-[#141B2A]">
                <span>CDVQA / LEVIR-CD (open datasets)</span>
                <span className="text-slate-400 font-medium">Bi-temporal change</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION 5: SIH 2026 PROBLEM STATEMENT 26167 SPECIFICATIONS */}
      <section id="sih2026" className="relative z-10 py-20 border-t border-[#161C2A] bg-[#0A0D14]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-teal-400 font-mono text-xs uppercase tracking-widest font-semibold mb-2">
                Problem Statement Compliance
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Designed for ISRO Space Applications Centre (SAC).
              </h2>
              <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
                Problem Statement PS 26167 mandates a conversational vision-language interface capable of querying
                unstructured satellite imagery, ingesting calibrated GeoTIFF rasters, and extracting verified intelligence without cloud reliance.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1E2638]">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-xs font-bold text-white">Full GeoTIFF Ingestion</div>
                  <div className="text-[11px] text-slate-400 mt-1">Reads CRS (EPSG:4326/3857), GSD metadata, and multi-spectral band rasters.</div>
                </div>

                <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1E2638]">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-xs font-bold text-white">Natural Language NLP</div>
                  <div className="text-[11px] text-slate-400 mt-1">Zero-shot geospatial grounding driven by natural English tactical queries.</div>
                </div>

                <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1E2638]">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-xs font-bold text-white">Local Edge Deployment</div>
                  <div className="text-[11px] text-slate-400 mt-1">Self-contained local backend with on-device neural reasoning and hybrid STAC ingest.</div>
                </div>

                <div className="p-4 rounded-xl bg-[#0C111A] border border-[#1E2638]">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-xs font-bold text-white">Multi-Temporal Scrubber</div>
                  <div className="text-[11px] text-slate-400 mt-1">Interactive timeline scrubber with automated sweep curtain and orbital pass tracking.</div>
                </div>
              </div>
            </div>

            {/* Architectural Stack Card */}
            <div className="p-6 rounded-2xl bg-[#0B0F17] border border-[#1F293D] shadow-2xl">
              <div className="text-xs font-mono text-cyan-300 font-bold mb-4 pb-2 border-b border-[#1A2336] flex items-center justify-between">
                <span>SYSTEM ARCHITECTURE &amp; STACK</span>
                <span className="text-[10px] text-slate-500">STANDALONE PRODUCTION</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-2.5 rounded bg-[#101622] border border-[#1C2538]">
                  <span className="text-slate-400">Frontend Presentation:</span>
                  <span className="text-white font-bold">React 19 + MapLibre GL v6 + Tailwind v4</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-[#101622] border border-[#1C2538]">
                  <span className="text-slate-400">Geospatial Projection:</span>
                  <span className="text-cyan-300 font-bold">3D Globe &amp; 2D Mercator (EPSG:4326)</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-[#101622] border border-[#1C2538]">
                  <span className="text-slate-400">Inference Engine:</span>
                  <span className="text-emerald-400 font-bold">FastAPI + PyTorch MPS / ONNX Runtime</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-[#101622] border border-[#1C2538]">
                  <span className="text-slate-400">Vision-Language Model:</span>
                  <span className="text-amber-300 font-bold">RemoteCLIP-ViT-B/32 (Zero-Shot)</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-[#101622] border border-[#1C2538]">
                  <span className="text-slate-400">Raster Tile Providers:</span>
                  <span className="text-slate-200 font-bold">Esri World Imagery + Sentinel Hub</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#1C263B]">
                <button
                  onClick={() => onLaunch()}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-cyan-950/30"
                >
                  <Radar className="w-4 h-4" />
                  <span>START TACTICAL ANALYSIS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. MISSION COMMAND FOOTER */}
      <footer className="relative z-10 py-12 border-t border-[#161C2A] bg-[#06080D] text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <span>SatQuery AI // Divya-Drishti</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Smart India Hackathon 2026 &middot; Ministry of Space / ISRO SAC &middot; Problem Statement 26167
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              Developed by Team Divya Drishti &middot; All satellite imagery and telemetry calibrated for research and demonstration.
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => onLaunch()}
              className="px-4 py-2 rounded-lg bg-[#141C2B] hover:bg-[#1E2A40] border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Launch Console ➔
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
