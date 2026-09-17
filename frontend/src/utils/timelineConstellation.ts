import type { SatellitePass, TimeRangeOption } from '../types';

const SENSORS_POOL = [
  { sensor: 'Sentinel-2A MSI', modality: 'RGB' as const, gsd: '10m', orbit: 'Desc. Track 042', hasCloud: true },
  { sensor: 'Sentinel-1 C-SAR', modality: 'SAR' as const, gsd: '10m', orbit: 'Asc. Pass 118', hasCloud: false },
  { sensor: 'Sentinel-2B MSI (CIR)', modality: 'NIR' as const, gsd: '10m', orbit: 'Desc. Track 085', hasCloud: true },
  { sensor: 'Cartosat-2S', modality: 'RGB' as const, gsd: '0.65m', orbit: 'Sun-Sync Orbit 97.4°', hasCloud: true },
  { sensor: 'RISAT-1A (EOS-04)', modality: 'SAR' as const, gsd: '3m', orbit: 'Dawn-Dusk C-Band', hasCloud: false },
  { sensor: 'Landsat-9 TIRS-2', modality: 'NIR' as const, gsd: '15m', orbit: 'WRS-2 Path 148', hasCloud: true },
  { sensor: 'Cartosat-3 High-Res', modality: 'RGB' as const, gsd: '0.28m', orbit: 'Tactical Revisit Orbit', hasCloud: true },
];

const SECTOR_CHANGE_DESCRIPTIONS: Record<string, string[]> = {
  'brahmaputra-flood': [
    'River channels within nominal dry-season banks; baseline Otsu σ° < -16dB',
    'Pre-monsoon catchment rainfall; tributary water rise +0.6m',
    'Sandbar inundation initiated; low marsh perimeter submersions',
    'Main braided channel swell; eastern embankment stress observed',
    'Flood surge expanding into riparian agricultural paddies (+22% delta)',
    'Widespread inundation; connecting rural causeways submerged',
    'Peak monsoon inundation; Otsu water mask at maximum extent (+88% delta)',
  ],
  'galwan-sar': [
    'Natural alpine gorge baseline; riverbed unobstructed',
    'Preliminary earthwork spotted near tributary confluence',
    'Bulldozer wheel tracks and grading on steep scree embankment',
    'Reinforced gravel roadway constructed along gorge floor',
    'Prefabricated bunker foundation posts anchored in bedrock',
    'Defensive perimeter wall and helipad clearing complete (T2 Delta)',
  ],
  'pokhran-range': [
    'Nominal arid desert surface baseline',
    'Security perimeter patrol tracks established',
    'Heavy drilling rig deployed to central test shaft coordinate',
    'Circular excavation collar borehole completed (45m diameter)',
    'Radial spoil mounds deposited around shaft collar',
    'Subterranean sensor array telemetry stations fully installed (T2)',
  ],
  'sdsc-sriharikota': [
    'Launch complex in nominal standby configuration',
    'Vehicle Assembly Building (VAB) rollout track inspected',
    'Solid rocket booster segments staged in integration bay',
    'Core cryogenic stage mated to launcher assembly',
    'Umbilical tower cryogenic fuel lines pressurized',
    'Mobile launch pedestal rolled out to SLP pad center (T2 Delta)',
  ],
  'isro-sac': [
    'Baseline ISRO SAC campus footprint',
    'Earth excavated for cleanroom foundation',
    'Poured concrete foundation for optical payload test bay',
    'Structural steel framing erected for cleanroom wing',
    'Rooftop satellite transceiver dome assembled',
    'New Advanced Sensor Integration Cleanroom operational (T2 Delta)',
  ],
};

/**
 * Instant deterministic client-side satellite pass generator.
 * Yields authentic constellation densities:
 * 24h: 8 passes | 7d: 20 passes | 30d: 42 passes | 1y: 110 passes | all: 160 passes.
 * ALL PASSES ARE SIMULATED by construction — not live STAC acquisitions.
 */
export function generateClientTimeline(
  sectorId: string = 'isro-sac',
  timeRange: TimeRangeOption = '30d',
  t1DateStr: string = '2024-04-01',
  t2DateStr: string = '2024-05-01'
): SatellitePass[] {
  let targetCount = 42;
  if (timeRange === '24h') targetCount = 8;
  else if (timeRange === '7d') targetCount = 20;
  else if (timeRange === '30d') targetCount = 42;
  else if (timeRange === '1y') targetCount = 110;
  else if (timeRange === 'all') targetCount = 160;

  const t1 = new Date(t1DateStr).getTime() || new Date('2024-04-01').getTime();
  const t2 = new Date(t2DateStr).getTime() || new Date('2024-05-01').getTime();
  const totalMs = Math.max(1000, t2 - t1);

  const changes = SECTOR_CHANGE_DESCRIPTIONS[sectorId] || [
    'Baseline surface conditions recorded',
    'Initial ground disturbance anomaly identified',
    'Linear infrastructure development detected',
    'Structural material staging on site',
    'Expanded footprint with high-confidence VLM grounding',
    'Contemporary target configuration confirmed (T2 Delta)',
  ];

  let seed = 0;
  for (let i = 0; i < sectorId.length; i++) {
    seed = (seed * 31 + sectorId.charCodeAt(i)) % 100000;
  }

  const passes: SatellitePass[] = [];
  for (let i = 0; i < targetCount; i++) {
    const fraction = i / Math.max(1, targetCount - 1);
    const jitterMs = (((seed * (i + 1) * 37) % 14400) - 7200) * 1000;
    const currentMs = Math.max(t1, Math.min(t2, t1 + fraction * totalMs + jitterMs));
    const dt = new Date(currentMs);

    const sMeta = SENSORS_POOL[(i + seed) % SENSORS_POOL.length];
    const cloud = !sMeta.hasCloud ? 0 : Math.round(((seed + i * 17) % 150) / 10);

    const cIdx = Math.min(changes.length - 1, Math.floor(fraction * changes.length));
    const desc = changes[cIdx];

    const passId = `${sMeta.sensor.slice(0, 3).toUpperCase()}_${dt.toISOString().slice(0, 10).replace(/-/g, '')}_${String(i).padStart(3, '0')}`;

    passes.push({
      id: passId,
      datetime: dt.toISOString(),
      formattedDate: dt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).toUpperCase(),
      formattedTime: `${dt.toISOString().slice(11, 19)} UTC`,
      sensor: sMeta.sensor,
      modality: sMeta.modality,
      cloudCover: cloud,
      deltaPercent: Math.round(fraction * 1000) / 10,
      changeDescription: desc,
      orbit: sMeta.orbit,
      resolution: sMeta.gsd,
      is_simulated: true,
      acquisition_type: 'Simulated Constellation Orbital Schedule',
    });
  }

  passes.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  return passes;
}

/**
 * Fetches the authentic multi-mission constellation timeline from backend,
 * with instantaneous client fallback.
 */
export async function fetchSectorTimeline(
  sectorId: string = 'isro-sac',
  timeRange: TimeRangeOption = '30d',
  t1DateStr: string = '2024-04-01',
  t2DateStr: string = '2024-05-01'
): Promise<SatellitePass[]> {
  try {
    const resp = await fetch(
      `http://localhost:8080/api/samples/sector-timeline/${encodeURIComponent(sectorId)}?time_range=${timeRange}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.passes) && data.passes.length > 0) {
        return data.passes;
      }
    }
  } catch (err) {
    // Graceful fallback
  }

  return generateClientTimeline(sectorId, timeRange, t1DateStr, t2DateStr);
}

/**
 * Finds the satellite pass closest to a given slider percentage (0 to 100).
 */
export function findNearestPass(passes: SatellitePass[], percent: number): SatellitePass | null {
  if (!passes.length) return null;
  const clamped = Math.max(0, Math.min(100, percent));
  const idx = Math.round((clamped / 100) * (passes.length - 1));
  return passes[Math.max(0, Math.min(passes.length - 1, idx))];
}
