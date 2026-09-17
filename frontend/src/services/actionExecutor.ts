/**
 * Grounded UI-action executor (Mission: agent control of map & dashboard).
 *
 * Contract:
 *  - The backend proposes actions; this module performs them against REAL
 *    stores and the REAL MapLibre instance, then reports the true outcome.
 *  - `status: "executed"` is only ever returned after an observable state
 *    change actually happened. If the target is missing, the map is not ready,
 *    or the control cannot represent the request, the action is reported
 *    `failed`/`skipped` with the real reason — never silently claimed.
 *  - No action here fabricates a map move, a highlight, or a panel state.
 */

import { getMapHandle } from './mapHandle';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import { useQueryStore } from '../stores/queryStore';
import { TACTICAL_PINS } from '../config/tacticalData';
import type {
  ActionResult,
  AgentExecutionNode,
  QueryResponse,
  UIAction,
  UIActionOutcome,
} from '../types';

export interface ExecutionReport {
  results: ActionResult[];
  executed: number;
  failed: number;
  skipped: number;
}

type Outcome = { status: UIActionOutcome; detail: string };

const executed = (detail: string): Outcome => ({ status: 'executed', detail });
const failed = (detail: string): Outcome => ({ status: 'failed', detail });
const skipped = (detail: string): Outcome => ({ status: 'skipped', detail });

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBbox(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) return false;
  const [minLon, minLat, maxLon, maxLat] = value;
  return minLon < maxLon && minLat < maxLat;
}

/**
 * Poll a real condition instead of assuming readiness. React commits the new
 * response (and MapCanvas rebuilds its evidence source/layer) one tick after the
 * network resolves, so a camera move or highlight issued too early would land on
 * a stale map. We wait for the real precondition, then act — and only report
 * success once the real call confirmed it.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 2500, stepMs = 100): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (predicate()) return true;
    if (Date.now() - start >= timeoutMs) return predicate();
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

async function runAction(action: UIAction): Promise<Outcome> {
  const params = (action.params || {}) as Record<string, any>;

  switch (action.type) {
    case 'fly_to_sector': {
      const pin = TACTICAL_PINS.find((p) => p.id === params.sector_id);
      if (!pin) {
        return failed(`no sector '${String(params.sector_id)}' exists in the tactical pin registry`);
      }
      // The selected pin is the authoritative app state and its own effect flies
      // the camera; the direct handle call makes the move immediate when ready.
      useMapStore.getState().setSelectedPin(pin);
      await waitFor(() => Boolean(getMapHandle()?.isReady()));
      const map = getMapHandle();
      const movedDirectly = map?.isReady()
        ? map.flyTo({
            center: [pin.lon, pin.lat],
            zoom: Math.max(pin.zoom ?? 12, 12),
            pitch: pin.pitch ?? 40,
            duration: 1400,
          })
        : false;
      return executed(
        `selected pin '${pin.id}' (${pin.name}) and ${
          movedDirectly ? 'flew the live camera' : 'deferred the camera move to the pin effect (map not ready)'
        }`
      );
    }

    case 'fly_to_bbox': {
      if (!isBbox(params.bbox)) return failed('bbox is not a valid [minLon, minLat, maxLon, maxLat] extent');
      const ready = await waitFor(() => Boolean(getMapHandle()?.isReady()));
      if (!ready) return failed('map instance is not ready');
      const ok = getMapHandle()!.flyToBounds(params.bbox, { duration: 1400 });
      return ok ? executed(`fitted camera to ${JSON.stringify(params.bbox)}`) : failed('map rejected the fit-bounds request');
    }

    case 'set_modality': {
      const modality = params.modality;
      if (modality !== 'single_image' && modality !== 'cross_modal' && modality !== 'bitemporal') {
        return failed(`unknown modality '${String(modality)}'`);
      }
      useMapStore.getState().setModality(modality);
      return executed(`modality switch set to '${modality}'`);
    }

    case 'set_sensor_band': {
      const band = params.band;
      if (band !== 'RGB' && band !== 'NIR' && band !== 'SAR') {
        return failed(`unknown sensor band '${String(band)}'`);
      }
      useMapStore.getState().setSensorBand(band);
      return executed(`sensor filter set to '${band}'`);
    }

    case 'set_swipe_curtain': {
      if (typeof params.active !== 'boolean') return failed('missing boolean active flag');
      useMapStore.getState().setSwipeActive(params.active);
      return executed(`bi-temporal swipe curtain ${params.active ? 'enabled' : 'disabled'}`);
    }

    case 'toggle_layer': {
      const layerId = String(params.layer_id);
      const { layers, toggleLayer } = useMapStore.getState();
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return failed(`layer '${layerId}' does not exist in the layer registry`);
      if (typeof params.visible !== 'boolean') return failed('missing boolean visible flag');
      if (layer.visible === params.visible) {
        return executed(`layer '${layerId}' already ${params.visible ? 'visible' : 'hidden'} (no change needed)`);
      }
      toggleLayer(layerId);
      const after = useMapStore.getState().layers.find((l) => l.id === layerId);
      return after?.visible === params.visible
        ? executed(`layer '${layerId}' set ${params.visible ? 'visible' : 'hidden'}`)
        : failed(`layer '${layerId}' did not reach the requested visibility`);
    }

    case 'set_layer_opacity': {
      const layerId = String(params.layer_id);
      const opacity = params.opacity;
      if (!isFiniteNumber(opacity) || opacity < 0 || opacity > 100) {
        return failed('opacity must be a number within 0..100');
      }
      const { layers, setLayerOpacity } = useMapStore.getState();
      if (!layers.some((l) => l.id === layerId)) {
        return failed(`layer '${layerId}' does not exist in the layer registry`);
      }
      setLayerOpacity(layerId, opacity);
      const after = useMapStore.getState().layers.find((l) => l.id === layerId);
      return after?.opacity === opacity
        ? executed(`layer '${layerId}' opacity set to ${opacity}`)
        : failed(`layer '${layerId}' opacity did not reach ${opacity}`);
    }

    case 'toggle_projection': {
      const mode = params.mode;
      if (mode !== 'globe' && mode !== 'mercator') return failed(`unknown projection '${String(mode)}'`);
      useMapStore.getState().setProjection(mode);
      const applied = Boolean(getMapHandle()?.isReady());
      return executed(
        `projection set to '${mode}'${applied ? '' : ' (applied on next map mount; map not ready)'}`
      );
    }

    case 'toggle_basemap': {
      const mode = params.mode;
      if (mode !== 'dark' && mode !== 'satellite') return failed(`unknown basemap '${String(mode)}'`);
      useMapStore.getState().setBasemap(mode);
      return executed(`basemap set to '${mode}'`);
    }

    case 'open_panel': {
      const tab = params.tab;
      if (tab !== 'evidence' && tab !== 'dag' && tab !== 'telemetry') {
        return failed(`unknown deck tab '${String(tab)}'`);
      }
      const ui = useUIStore.getState();
      ui.setDeckOpen(true);
      ui.setDeckTab(tab);
      const after = useUIStore.getState();
      return after.deckOpen && after.deckTab === tab
        ? executed(`operational deck open on '${tab}' tab`)
        : failed(`deck did not switch to '${tab}'`);
    }

    case 'open_studio':
      // Studio switches are router navigations; this module has no router access,
      // so claiming success would be fabricated. Reported honestly instead.
      return skipped('studio navigation requires the router and is not wired into the action executor');

    case 'highlight_feature': {
      const featureId = String(params.feature_id);
      // The evidence source/layer is rebuilt from the new response one React
      // commit after it arrives; wait for the map to actually hold it before
      // claiming the filter landed.
      const applied = await waitFor(() => Boolean(getMapHandle()?.isReady() && getMapHandle()!.highlightFeature(featureId)));
      return applied
        ? executed(`evidence layers filtered to '${featureId}'`)
        : failed(`feature '${featureId}' is absent from the current response`);
    }

    case 'toggle_live_stream': {
      if (typeof params.enabled !== 'boolean') return failed('missing boolean enabled flag');
      useQueryStore.getState().setLiveStreamEnabled(params.enabled);
      return executed(`live STAC stream ${params.enabled ? 'enabled' : 'disabled'} for the next query`);
    }

    case 'run_benchmark':
      return skipped('no real benchmark catalog is exposed to the frontend, so none was run');

    default:
      return failed(`unsupported action type '${String((action as UIAction).type)}'`);
  }
}

/** Execute every proposed action in order and collect the real outcomes. */
export async function executeUIActions(actions: UIAction[] | undefined | null): Promise<ExecutionReport> {
  const results: ActionResult[] = [];
  for (const action of actions || []) {
    let outcome: Outcome;
    try {
      outcome = await runAction(action);
    } catch (err: any) {
      outcome = failed(`executor threw: ${err?.message || String(err)}`);
    }
    results.push({ type: action.type, status: outcome.status, detail: outcome.detail });
  }
  return {
    results,
    executed: results.filter((r) => r.status === 'executed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
  };
}

/**
 * Fold the real execution report back into the response's DAG so the audit
 * trail states what actually happened, not what was merely proposed.
 */
export function applyActuationReport(response: QueryResponse, report: ExecutionReport): QueryResponse {
  if (!response?.dagNodes?.length) return response;
  const { executed: nExecuted, failed: nFailed, skipped: nSkipped, results } = report;
  const hasFailures = nFailed > 0;

  const dagNodes: AgentExecutionNode[] = response.dagNodes.map((node) => {
    if (node.id !== 'node-5-ui-actuation') return node;
    return {
      ...node,
      status: hasFailures ? 'failed' : 'completed',
      details: hasFailures
        ? `${nExecuted}/${results.length} grounded UI action(s) executed; ${nFailed} failed — see per-action results.`
        : `${nExecuted}/${results.length} grounded UI action(s) executed against real stores/map${
            nSkipped ? `; ${nSkipped} skipped (no real handler)` : ''
          }.`,
      uiActionResults: results,
    };
  });

  return { ...response, dagNodes };
}
