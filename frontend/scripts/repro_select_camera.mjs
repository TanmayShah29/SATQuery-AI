import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const GALWAN = { lat: 34.7667, lon: 78.25, zoom: 12.5 };
const AHMEDABAD = { lat: 23.02, lon: 72.51 };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on('console', (m) => {
  if (m.text().includes('discarding stale response')) {
    console.log('  [app]', m.text().slice(0, 200));
  }
});

// Landing page must be skipped: goto /tactical directly. A background query for
// the DEFAULT sector (isro-sac) fires on mount — this is the query whose late
// response previously yanked the camera to Ahmedabad.
await page.goto(`${BASE}/tactical`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => {
  const m = window.__MAP__;
  return m && m.getSource && m.getSource('tactical-pins-source');
}, null, { timeout: 20000 });
await page.waitForTimeout(1200);

// Instrument camera commands.
await page.evaluate(() => {
  const m = window.__MAP__;
  window.__cam = { calls: [], traj: [], armed: true };
  ['flyTo', 'jumpTo', 'easeTo'].forEach((name) => {
    const orig = m[name].bind(m);
    m[name] = (opts) => {
      window.__cam.calls.push({ name, at: Math.round(performance.now()), o: { center: opts?.center, zoom: opts?.zoom } });
      return orig(opts);
    };
  });
  const origFit = m.fitBounds.bind(m);
  m.fitBounds = (bb, o) => {
    window.__cam.calls.push({
      name: 'fitBounds',
      at: Math.round(performance.now()),
      o: { bbox: bb && bb[0] && bb[1] ? [bb[0][0], bb[0][1], bb[1][0], bb[1][1]] : undefined, zoom: o?.maxZoom },
    });
    return origFit(bb, o);
  };
  const rec = () => {
    if (!window.__cam.armed) return;
    const c = m.getCenter();
    window.__cam.traj.push({ t: Math.round(performance.now()), lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), z: +m.getZoom().toFixed(3) });
    setTimeout(rec, 250);
  };
  rec();
});

// Deterministic selection: Scope Selector -> Galwan Valley Corridor.
await page.click('#scope-selector-btn');
await page.click('button:has-text("Galwan Valley Corridor")');
console.log('Clicked Galwan Valley Corridor via Scope Selector.');
await page.waitForTimeout(2500);
console.log('URL after select:', page.url());

const camAt = async () =>
  page.evaluate(() => {
    const m = window.__MAP__;
    const c = m.getCenter();
    return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), zoom: +m.getZoom().toFixed(3) };
  });

const snap2s = await camAt();
console.log('CAMERA ~2.5s after select:', JSON.stringify(snap2s));

// Watch for a detour to Ahmedabad until well past the isro-sac background response.
let detoured = null;
const tStart = Date.now();
const tEnd = tStart + 52000;
while (Date.now() < tEnd) {
  const c = await camAt();
  if (Math.abs(c.lat - AHMEDABAD.lat) < 0.2 && Math.abs(c.lng - AHMEDABAD.lon) < 0.2 && !detoured) {
    detoured = { at: (Date.now() - tStart) / 1000, ...c };
  }
  await page.waitForTimeout(500);
}
await page.evaluate(() => { window.__cam.armed = false; });
const camSt = await page.evaluate(() => window.__cam);
const after = await camAt();

console.log('\n=== CAMERA COMMANDS ===');
for (const c of camSt.calls) {
  const rel = ((c.at - (camSt.calls[0]?.at ?? 0)) / 1000).toFixed(2);
  const locus = c.o?.center
    ? `galwan=${Math.hypot(c.o.center[0] - GALWAN.lon, c.o.center[1] - GALWAN.lat) < 0.05}`
    : `bbox=${c.o?.bbox?.map((n) => +n.toFixed(4))}`;
  console.log(`  +${rel}s ${c.name} center=${c.o?.center ? c.o.center.map((n) => +n.toFixed(3)) : ''} zoom=${c.o?.zoom ?? '?'} (${locus})`);
}
const ahmed = camSt.calls.filter((c) => c.o?.bbox && Math.abs(c.o.bbox[0] - 72.4844) < 0.01);
console.log('Ahmedabad-bbox fitBounds count:', ahmed.length);

console.log('\n=== CAMERA TRAJECTORY (500ms, 15 samples) ===');
const step = Math.max(1, Math.floor(camSt.traj.length / 15));
for (let i = 0; i < camSt.traj.length; i += step) {
  const s = camSt.traj[i];
  console.log(`  t=${((s.t - camSt.traj[0].t) / 1000).toFixed(1)}s center=[${s.lng}, ${s.lat}] zoom=${s.z}`);
}

console.log('\nVERDICT:', detoured ? `DETOUR — camera left Galwan to Ahmedabad at +${detoured.at.toFixed(1)}s (${detoured.lat},${detoured.lng}, z${detoured.zoom})` : 'NO DETOUR — camera never left the selected sector');
console.log('FINAL:', JSON.stringify(after));
console.log('URL final:', page.url());
await browser.close();