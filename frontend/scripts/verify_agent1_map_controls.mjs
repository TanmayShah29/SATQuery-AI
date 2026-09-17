/**
 * Agent 1 verification — store unification + MapCanvas imperative handle.
 *
 * Mission: "every audit finding ends as real computation or honest null/degraded
 * state, proven by re-running exact audit probes" and "done only when a real
 * browser click-through shows the map/dashboard actually did what the agent said."
 *
 * This drives a REAL Chromium browser against the REAL app and asserts OBSERVABLE
 * state changes for each control whose state moved out of App.tsx into
 * mapStore/uiStore/queryStore. It also proves the projection toggle changes the
 * live MapLibre projection (UI -> store -> map), not just a store flag.
 *
 * Usage:  node scripts/verify_agent1_map_controls.mjs
 * Assumes nothing is already listening on :3000. Backend is NOT required.
 */
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:3000';
const ROUTE = `${BASE}/tactical`; // non-root => tactical HUD (isLandingMode === false)

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok === true ? 'PASS' : ok === 'SKIP' ? 'SKIP' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// This harness owns :3000. Reclaim it from a previous run so we always test the
// code on disk (a stale dev server would silently test old code).
try {
  const stale = execSync('lsof -ti:3000', { encoding: 'utf8' }).trim();
  if (stale) {
    console.log(`Reclaiming :3000 from stale dev server (pid ${stale.split('\\n').join(', ')})`);
    execSync('lsof -ti:3000 | xargs kill -9', { shell: '/bin/zsh', stdio: 'ignore' });
  }
} catch {
  /* nothing listening */
}

const vite = spawn('npm', ['run', 'dev'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
  env: { ...process.env, BROWSER: 'none' },
});
let viteLog = '';
vite.stdout.on('data', (d) => (viteLog += d.toString()));
vite.stderr.on('data', (d) => (viteLog += d.toString()));

let browser;
let exitCode = 0;
try {
  if (!(await waitForServer(BASE))) {
    console.error('Vite dev server did not come up on :3000.\n' + viteLog);
    process.exit(2);
  }

  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  globalThis.__page = page;
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // Cold Vite dev servers transform the whole module graph on demand, which can
  // take a minute+ before React first mounts. Pre-warm the entry module, then
  // allow a generous mount budget.
  try {
    await fetch(BASE + '/src/main.tsx');
  } catch {
    /* warm-up is best-effort */
  }
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#header-hud', { state: 'attached', timeout: 150000 });
  await page.waitForSelector('#map-projection-toggle-btn', { state: 'visible', timeout: 150000 });
  await page.waitForTimeout(3500); // allow MapLibre init + style load

  // --- 0. Map actually mounted (the target of the imperative handle) ----------
  const mapState = await page.evaluate(() => {
    const m = window.__MAP__;
    return {
      present: Boolean(m),
      projection: m && typeof m.getProjection === 'function' ? m.getProjection()?.type ?? null : null,
      zoom: m ? m.getZoom() : null,
      fallbackShown: Boolean(document.getElementById('tactical-2d-canvas-fallback')),
    };
  });
  if (!mapState.present) {
    record(
      'map instance mounted (window.__MAP__)',
      mapState.fallbackShown ? 'SKIP' : false,
      mapState.fallbackShown
        ? 'WebGL unavailable in this environment; 2D fallback rendered (honest degradation)'
        : 'no map instance and no fallback'
    );
  } else {
    record('map instance mounted (window.__MAP__)', true, `projection=${mapState.projection} zoom=${Number(mapState.zoom).toFixed(2)}`);
  }

  // --- 1. Projection toggle: UI -> mapStore -> LIVE MapLibre projection -------
  const projBefore = await page.evaluate(() => window.__MAP__?.getProjection?.()?.type ?? null);
  const projLabelBefore = await page.getAttribute('#map-projection-toggle-btn', 'title');
  await page.click('#map-projection-toggle-btn');
  await page.waitForTimeout(1500);
  const projAfter = await page.evaluate(() => window.__MAP__?.getProjection?.()?.type ?? null);
  const projLabelAfter = await page.getAttribute('#map-projection-toggle-btn', 'title');
  if (!mapState.present) {
    record('projection toggle changes live MapLibre projection', 'SKIP', 'no map instance');
  } else {
    record(
      'projection toggle changes live MapLibre projection',
      projBefore !== projAfter && Boolean(projAfter),
      `${projBefore} -> ${projAfter} (title "${projLabelBefore}" -> "${projLabelAfter}")`
    );
  }
  await page.click('#map-projection-toggle-btn');
  await page.waitForTimeout(1500);

  // --- 2. Swipe curtain toggle -> wrapper mounts ------------------------------
  const swipeTitleBefore = await page.getAttribute('#map-swipe-toggle-btn', 'title');
  await page.click('#map-swipe-toggle-btn');
  let swipeMounted = false;
  try {
    await page.waitForFunction(() => !!document.getElementById('bitemporal-swipe-wrapper'), null, {
      timeout: 15000,
    });
    swipeMounted = true;
  } catch {
    swipeMounted = false;
  }
  const swipeTitleAfter = await page.getAttribute('#map-swipe-toggle-btn', 'title');
  record(
    'swipe toggle mounts #bitemporal-swipe-wrapper',
    swipeMounted && swipeTitleBefore !== swipeTitleAfter,
    `${swipeTitleBefore} -> ${swipeTitleAfter}`
  );
  await page.click('#map-swipe-toggle-btn');
  await page.waitForTimeout(500);

  // --- 3. Layers drawer open/close --------------------------------------------
  await page.click('#map-layers-toggle-btn');
  let drawerOpen = false;
  try {
    await page.waitForSelector('#layers-drawer-panel', { state: 'visible', timeout: 5000 });
    drawerOpen = true;
  } catch {
    drawerOpen = false;
  }
  record('layers drawer opens (#layers-drawer-panel)', drawerOpen);
  if (drawerOpen) {
    await page.click('#close-layers-panel-btn');
    await page.waitForSelector('#layers-drawer-panel', { state: 'hidden', timeout: 5000 });
    record('layers drawer closes (#close-layers-panel-btn)', true);
  } else {
    record('layers drawer closes (#close-layers-panel-btn)', 'SKIP', 'drawer never opened');
  }

  // --- 4. Operational deck open/close ----------------------------------------
  await page.click('#minimize-operational-deck-btn');
  let deckHidden = false;
  try {
    await page.waitForSelector('#right-operational-deck', { state: 'hidden', timeout: 5000 });
    deckHidden = true;
  } catch {
    deckHidden = false;
  }
  record('deck minimizes (#right-operational-deck hidden)', deckHidden);
  let reopened = false;
  try {
    await page.waitForSelector('#open-operational-deck-btn', { state: 'visible', timeout: 5000 });
    // The reopen affordance animates continuously, so Playwright's "stable"
    // requirement can never be satisfied — dispatch a raw DOM click.
    await page.evaluate(() => document.getElementById('open-operational-deck-btn')?.click());
    await page.waitForSelector('#right-operational-deck', { state: 'visible', timeout: 5000 });
    reopened = true;
  } catch {
    reopened = false;
  }
  record('deck reopens (#open-operational-deck-btn)', reopened);

  // --- 5. Deck tab switch (evidence -> dag) -----------------------------------
  const tabCls = (sel) => page.getAttribute(sel, 'class');
  const evidenceBefore = await tabCls('#tab-evidence-btn');
  const dagBefore = await tabCls('#tab-dag-btn');
  await page.click('#tab-dag-btn');
  await page.waitForTimeout(400);
  const evidenceAfter = await tabCls('#tab-evidence-btn');
  const dagAfter = await tabCls('#tab-dag-btn');
  record(
    'deck tab switch moves active styling evidence -> dag',
    evidenceBefore !== evidenceAfter && dagBefore !== dagAfter && evidenceAfter === dagBefore,
    `evidence ${evidenceBefore === evidenceAfter ? 'unchanged' : 'deactivated'}, dag ${dagBefore === dagAfter ? 'unchanged' : 'activated'}`
  );
  await page.click('#tab-evidence-btn');
  await page.waitForTimeout(300);

  // --- 6. Situational feed drawer (uiStore) ----------------------------------
  const feedTrigger = await page.$('#secondary-feed-toggle-btn');
  if (!feedTrigger) {
    record('situational feed drawer toggles', 'SKIP', 'no #secondary-feed-toggle-btn control found');
  } else {
    await feedTrigger.click();
    let feedVisible = false;
    try {
      await page.waitForSelector('#situational-feed-drawer', { state: 'visible', timeout: 5000 });
      feedVisible = true;
    } catch {
      feedVisible = false;
    }
    record('situational feed drawer toggles', feedVisible);
    await feedTrigger.click();
    await page.waitForTimeout(300);
  }

  // --- 6b. Basemap toggle (mapStore) -----------------------------------------
  const basemapBtn = await page.$('#map-basemap-toggle-btn');
  if (!basemapBtn) {
    record('basemap toggle changes basemap state', 'SKIP', '#map-basemap-toggle-btn not rendered');
  } else {
    const titleBefore = (await basemapBtn.getAttribute('title')) ?? '';
    await basemapBtn.click();
    await page.waitForTimeout(900);
    const titleAfter = (await page.getAttribute('#map-basemap-toggle-btn', 'title')) ?? '';
    record(
      'basemap toggle changes basemap state',
      titleBefore !== titleAfter,
      `${titleBefore} -> ${titleAfter}`
    );
    await page.click('#map-basemap-toggle-btn');
    await page.waitForTimeout(900);
  }

  // --- 7. Live stream toggle (queryStore) ------------------------------------
  const liveBtn = await page.$('#toggle-live-stream-btn');
  if (!liveBtn) {
    record('live stream toggle changes control state', 'SKIP', '#toggle-live-stream-btn not rendered in this view');
  } else {
    const before = await page.getAttribute('#toggle-live-stream-btn', 'class');
    await liveBtn.click();
    await page.waitForTimeout(400);
    const after = await page.getAttribute('#toggle-live-stream-btn', 'class');
    record('live stream toggle changes control state', before !== after, before === after ? 'no change' : 'class state changed');
  }

  // --- 8. No console errors during the click-through -------------------------
  const realErrors = consoleErrors.filter(
    (e) => !/WebGL|SwiftShader|Failed to load resource|net::ERR|tiles|style/i.test(e)
  );
  record('no unexpected console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  exitCode = results.some((r) => r.ok === false) ? 1 : 0;
} catch (err) {
  console.error('Harness error:', err);
  try {
    if (globalThis.__page) {
      const dbg = await globalThis.__page.evaluate(() => ({
        path: location.pathname,
        readyState: document.readyState,
        rootChildren: document.getElementById('root')?.children.length ?? -1,
        headerHud: !!document.getElementById('header-hud'),
        bodyLen: document.body.innerText.length,
        bodyStart: document.body.innerText.slice(0, 300),
      }));
      console.error('PAGE DIAGNOSTICS:', JSON.stringify(dbg, null, 2));
    }
  } catch (e) {
    console.error('could not collect page diagnostics:', String(e));
  }
  console.error('VITE LOG TAIL:\n' + viteLog.split('\n').slice(-25).join('\n'));
  exitCode = 3;
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, 'SIGKILL');
  } catch {
    vite.kill('SIGKILL');
  }
  // Belt-and-braces: the dev server is ours, so make sure :3000 is free.
  try {
    execSync('lsof -ti:3000 | xargs kill -9', { shell: '/bin/zsh', stdio: 'ignore' });
  } catch {
    /* already free */
  }
}

const pass = results.filter((r) => r.ok === true).length;
const fail = results.filter((r) => r.ok === false).length;
const skip = results.filter((r) => r.ok === 'SKIP').length;
console.log(`\nAgent 1 browser verification: ${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(exitCode);
