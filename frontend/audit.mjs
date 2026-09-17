/**
 * SatQuery AI // Full UI/UX Audit Script
 * Uses installed Playwright Chromium to audit http://localhost:5173/
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CHROME_EXEC = '/Users/tanmay/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SCREENSHOT_DIR = '/Users/tanmay/SIH-2026/frontend/audit_screenshots';
const BASE_URL = 'http://localhost:5173';

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const defects = [];
let stepCount = 0;

async function ss(page, name, note = '') {
  stepCount++;
  const filename = join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`📸 ${name}.png ${note ? '→ ' + note : ''}`);
  } catch(e) {
    console.log(`⚠️  Screenshot failed: ${name} — ${e.message}`);
  }
  return filename;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function defect(id, severity, component, trigger, description, screenshot) {
  defects.push({ id, severity, component, trigger, description, screenshot });
  console.log(`🚨 [${severity}] DEF-${id}: ${description}`);
}

(async () => {
  console.log('\n=== SATQUERY AI // MASTER VISUAL AUDIT ===\n');

  const browser = await chromium.launch({
    executablePath: CHROME_EXEC,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  try {
    // PHASE 1: INITIAL LOAD & TOP HUD
    console.log('\n--- PHASE 1: INITIAL LOAD & TOP HUD ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(4000);
    await ss(page, 'STEP_001_INITIAL_LOAD', 'Full app initial render');

    const mapCanvas = await page.$('.maplibregl-canvas');
    if (!mapCanvas) {
      defect('001', 'P1', 'MapCanvas', 'Initial Load', 'MapLibre canvas not found — WebGL may have failed', 'STEP_001_INITIAL_LOAD');
    } else {
      console.log('✅ MapLibre canvas found');
    }

    const promptBar = await page.$('#query-prompt-bar-container');
    const rightPanel = await page.$('#right-operational-deck');
    if (!promptBar) defect('002', 'P2', 'QueryPromptBar', 'Initial Load', 'Prompt bar not found on initial load', 'STEP_001_INITIAL_LOAD');
    if (!rightPanel) defect('003', 'P2', 'RightOperationalPanel', 'Initial Load', 'Right panel not found on initial load', 'STEP_001_INITIAL_LOAD');

    // Model Chip
    const modelChip = await page.$('button:has-text("RemoteCLIP")');
    if (modelChip) {
      await modelChip.click(); await wait(600);
      await ss(page, 'STEP_002_MODEL_CHIP_MODAL', 'Model chip clicked');
      await page.keyboard.press('Escape'); await wait(400);
      await ss(page, 'STEP_003_MODAL_CLOSED', 'Modal closed');
    } else {
      defect('004', 'P3', 'HeaderHUD', 'Model Chip', 'RemoteCLIP chip not visible at 1440px width', 'STEP_001_INITIAL_LOAD');
      await ss(page, 'STEP_002_MODEL_CHIP_MODAL', 'Model chip not found');
      await ss(page, 'STEP_003_MODAL_CLOSED', 'N/A');
    }

    // Navigation Pills
    const navItems = [
      { label: 'Dashboard', step: 'STEP_004' },
      { label: 'Bi-Temporal', step: 'STEP_005' },
      { label: 'Radar SAR', step: 'STEP_006' },
      { label: 'Grounding', step: 'STEP_007' },
      { label: 'Benchmarks', step: 'STEP_008' },
      { label: 'Data', step: 'STEP_009' },
      { label: 'Audit DAG', step: 'STEP_010' },
    ];

    for (const nav of navItems) {
      console.log(`Clicking nav: ${nav.label}...`);
      const pill = await page.$(`button:has-text("${nav.label}")`);
      if (pill) {
        await pill.click(); await wait(800);
        const url = page.url();
        await ss(page, `${nav.step}_NAV_${nav.label.replace(/\s+/g,'').toUpperCase()}`, `URL: ${url}`);
      } else {
        defect('005', 'P1', 'HeaderHUD', `Nav ${nav.label}`, `"${nav.label}" pill not found in DOM`, nav.step);
      }
    }

    // Back to Dashboard
    const dash = await page.$('button:has-text("Dashboard")');
    if (dash) { await dash.click(); await wait(700); }

    // Feed Drawer
    console.log('Testing Feed Drawer...');
    const feedBtn = await page.$('button:has-text("Feed")');
    if (feedBtn) {
      await feedBtn.click(); await wait(700);
      await ss(page, 'STEP_011_FEED_DRAWER_OPEN', 'Feed drawer opened');

      const feedDrawer = await page.$('#situational-feed-drawer');
      if (feedDrawer) {
        const box = await feedDrawer.boundingBox();
        console.log(`Feed drawer: x=${box.x.toFixed(0)} y=${box.y.toFixed(0)} w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`);
        if (box.width > 420) defect('006', 'P1', 'SituationalFeedDrawer', 'Open', `Drawer too wide (${box.width.toFixed(0)}px) — may occlude map center`, 'STEP_011_FEED_DRAWER_OPEN');
      } else {
        defect('007', 'P1', 'SituationalFeedDrawer', 'Open', '#situational-feed-drawer not found in DOM', 'STEP_011_FEED_DRAWER_OPEN');
      }

      const alertsTab = await page.$('button:has-text("ALERTS")');
      if (alertsTab) { await alertsTab.click(); await wait(400); await ss(page, 'STEP_012_FEED_ALERTS_TAB', 'Alerts tab'); }

      const passesTab = await page.$('button:has-text("PASSES")');
      if (passesTab) { await passesTab.click(); await wait(400); await ss(page, 'STEP_013_FEED_PASSES_TAB', 'Passes tab'); }

      const layersTab = await page.$('button:has-text("LAYERS")');
      if (layersTab) { await layersTab.click(); await wait(400); await ss(page, 'STEP_014_FEED_LAYERS_TAB', 'Layers tab'); }

      // Back to alerts
      if (alertsTab) { await alertsTab.click(); await wait(400); }

      if (feedDrawer) {
        await feedDrawer.evaluate(el => { el.scrollTop += 200; }); await wait(300);
        await ss(page, 'STEP_015_FEED_SCROLL', 'Feed scrolled');
      }

      // Fly to — alert cards are clickable divs
      const alertCard = await page.$('#situational-feed-drawer .cursor-pointer');
      if (alertCard) {
        await alertCard.click(); await wait(700);
        await ss(page, 'STEP_016_FEED_FLYTO', 'Alert card clicked (fly-to)');
      } else {
        defect('008', 'P3', 'SituationalFeedDrawer', 'Fly To', 'No .cursor-pointer alert card found for fly-to', 'STEP_015_FEED_SCROLL');
        await ss(page, 'STEP_016_FEED_FLYTO', 'Alert fly-to not triggered');
      }

      // Close
      const xBtn = await page.$('#situational-feed-drawer button:first-child, #situational-feed-drawer button[title]');
      const allBtns = await page.$$('#situational-feed-drawer button');
      if (allBtns.length > 0) {
        await allBtns[0].click(); await wait(400);
        await ss(page, 'STEP_017_FEED_CLOSED', 'Feed drawer closed');
      }
    } else {
      defect('009', 'P2', 'HeaderHUD', 'Feed Toggle', 'Feed button not found in header', 'STEP_001_INITIAL_LOAD');
      await ss(page, 'STEP_011_FEED_DRAWER_OPEN', 'Feed not opened');
    }

    // PHASE 2: CANVAS TOOL DOCK & MAP CONTROLS
    console.log('\n--- PHASE 2: CANVAS TOOL DOCK & MAP CONTROLS ---');

    // Try opening layers panel via any button with "Layers" text or title
    const layerBtn = await page.$('button[title*="Layer"], button[title*="layer"]');
    if (layerBtn) {
      await layerBtn.click(); await wait(600);
      await ss(page, 'STEP_018_LAYERS_PANEL_OPEN', 'Layers panel opened');

      const layersPanel = await page.$('#layers-drawer-panel');
      if (layersPanel) {
        const firstToggle = await layersPanel.$('button');
        if (firstToggle) {
          await firstToggle.click(); await wait(400);
          await ss(page, 'STEP_019_LAYER_TOGGLE_OFF', 'Layer toggled off');
          await firstToggle.click(); await wait(300);
        }
        const opacitySlider = await layersPanel.$('input[type="range"]');
        if (opacitySlider) {
          const cls = await opacitySlider.getAttribute('class') || '';
          if (!cls.includes('appearance-none')) {
            defect('010', 'P2', 'LayersPanel', 'Opacity Slider', 'Layer opacity slider lacks appearance-none — may show default OS slider thumb', 'STEP_018_LAYERS_PANEL_OPEN');
          }
          await opacitySlider.evaluate(el => { el.value = '0'; el.dispatchEvent(new Event('input', {bubbles:true})); });
          await wait(400);
          await ss(page, 'STEP_020_LAYER_OPACITY_0', 'Layer opacity at 0%');
          await opacitySlider.evaluate(el => { el.value = '80'; el.dispatchEvent(new Event('input', {bubbles:true})); });
          await wait(300);
        }
        const closePanelBtn = await page.$('#close-layers-panel-btn');
        if (closePanelBtn) {
          await closePanelBtn.click(); await wait(400);
          await ss(page, 'STEP_021_LAYERS_CLOSED', 'Layers panel closed');
        }
      }
    } else {
      defect('011', 'P2', 'LayersPanel', 'Layers toggle', 'Layers toggle button not found by title', 'STEP_001_INITIAL_LOAD');
      await ss(page, 'STEP_018_LAYERS_PANEL_OPEN', 'Layers panel not opened');
      await ss(page, 'STEP_019_LAYER_TOGGLE_OFF', 'N/A');
      await ss(page, 'STEP_020_LAYER_OPACITY_0', 'N/A');
      await ss(page, 'STEP_021_LAYERS_CLOSED', 'N/A');
    }

    // Zoom controls
    const plusBtn = await page.$('button[title*="Zoom in"], button[title*="zoom in"], button[title*="Zoom In"]');
    if (plusBtn) {
      for (let i = 0; i < 3; i++) { await plusBtn.click(); await wait(400); }
      await ss(page, 'STEP_022_ZOOM_IN', 'Zoomed in 3x');
      const minusBtn = await page.$('button[title*="Zoom out"], button[title*="zoom out"], button[title*="Zoom Out"]');
      if (minusBtn) {
        for (let i = 0; i < 3; i++) { await minusBtn.click(); await wait(400); }
        await ss(page, 'STEP_023_ZOOM_OUT', 'Zoomed out 3x');
      }
    } else {
      defect('012', 'P3', 'MapCanvas', 'Zoom Controls', 'Zoom in/out buttons not found by title — may lack title attributes', 'STEP_022_ZOOM_IN');
      await ss(page, 'STEP_022_ZOOM_IN', 'Zoom buttons not found');
      await ss(page, 'STEP_023_ZOOM_OUT', 'N/A');
    }

    // Swipe
    const swipeBtn = await page.$('button[title*="wipe"], button[title*="Swipe"], button[title*="curtain"]');
    if (swipeBtn) {
      await swipeBtn.click(); await wait(700);
      await ss(page, 'STEP_024_SWIPE_CURTAIN', 'Swipe curtain toggled');
    } else {
      await ss(page, 'STEP_024_SWIPE_CURTAIN', 'Swipe button not found');
    }

    // Projection
    const projBtn = await page.$('button[title*="Globe"], button[title*="globe"], button[title*="Mercator"], button[title*="3D"]');
    if (projBtn) {
      await projBtn.click(); await wait(700);
      await ss(page, 'STEP_025_PROJECTION_TOGGLE', 'Projection toggled');
    } else {
      await ss(page, 'STEP_025_PROJECTION_TOGGLE', 'Projection toggle not found');
    }

    // Basemap
    const basemapBtn = await page.$('#basemap-toggle-btn');
    if (basemapBtn) {
      await basemapBtn.click(); await wait(700);
      await ss(page, 'STEP_026_BASEMAP_TOGGLE', 'Basemap switched to Satellite');
      await basemapBtn.click(); await wait(500);
    } else {
      defect('013', 'P2', 'HeaderHUD', 'Basemap Toggle', '#basemap-toggle-btn not found', 'STEP_026_BASEMAP_TOGGLE');
      await ss(page, 'STEP_026_BASEMAP_TOGGLE', 'Basemap toggle not found');
    }

    // Map pin clicks
    const mapContainer = await page.$('.maplibregl-canvas-container');
    if (mapContainer) {
      const mapBox = await mapContainer.boundingBox();
      if (mapBox) {
        await page.mouse.click(mapBox.x + mapBox.width * 0.4, mapBox.y + mapBox.height * 0.5);
        await wait(800);
        await ss(page, 'STEP_027_MAP_PIN_CLICK_1', 'Map click at center-left');
        await page.mouse.click(mapBox.x + mapBox.width * 0.6, mapBox.y + mapBox.height * 0.4);
        await wait(800);
        await ss(page, 'STEP_028_MAP_PIN_CLICK_2', 'Map click at center-right');
      }
    }

    // PHASE 3: TEMPORAL SCRUBBER
    console.log('\n--- PHASE 3: TEMPORAL SCRUBBER ---');
    const scrubber = await page.$('#temporal-scrubber-hud');
    if (scrubber) {
      await ss(page, 'STEP_029_SCRUBBER_BASELINE', 'Temporal scrubber baseline');

      const rangeInput = await page.$('#temporal-scrubber-hud input[type="range"]');
      if (rangeInput) {
        const cls = await rangeInput.getAttribute('class') || '';
        console.log('Scrubber slider classes:', cls.slice(0, 120) + '...');
        if (cls.includes('[&::-webkit-slider-thumb]')) {
          console.log('✅ Custom slider thumb styling applied via Tailwind JIT');
        } else {
          defect('014', 'P2', 'TemporalScrubber', 'Slider Thumb', 'Temporal scrubber slider may not have custom thumb styling applied', 'STEP_029_SCRUBBER_BASELINE');
        }
      }

      for (const [range, step] of [['24h','STEP_030'],['7d','STEP_031'],['30d','STEP_032'],['1y','STEP_033'],['all','STEP_034']]) {
        const btn = await scrubber.$(`button:has-text("${range}")`);
        if (btn) { await btn.click(); await wait(400); await ss(page, `${step}_RANGE_${range.toUpperCase()}`, `Range: ${range}`); }
      }

      if (rangeInput) {
        await rangeInput.evaluate(el => { el.value = '0'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        await wait(400);
        await ss(page, 'STEP_035_SLIDER_0', 'Slider at 0%');

        await rangeInput.evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        await wait(400);
        await ss(page, 'STEP_036_SLIDER_50', 'Slider at 50%');

        await rangeInput.evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        await wait(400);
        await ss(page, 'STEP_037_SLIDER_100', 'Slider at 100%');

        await rangeInput.evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        await wait(300);
      }

      const milestones = await scrubber.$$('button[title]');
      console.log(`Found ${milestones.length} milestone buttons`);
      if (milestones.length >= 1) { await milestones[0].click(); await wait(400); await ss(page, 'STEP_038_MILESTONE_T0', 'T0 milestone'); }
      if (milestones.length >= 4) { await milestones[3].click(); await wait(400); await ss(page, 'STEP_039_MILESTONE_T2', 'T2 milestone'); }

      const sweepBtn = await scrubber.$('button:has-text("SWEEP")');
      if (sweepBtn) {
        await sweepBtn.click(); await wait(1500);
        await ss(page, 'STEP_040_SWEEP_PLAYING', 'Sweep playing');
        const pauseBtn = await scrubber.$('button:has-text("PAUSE")');
        if (pauseBtn) { await pauseBtn.click(); await wait(400); await ss(page, 'STEP_041_SWEEP_PAUSED', 'Sweep paused'); }
        else { await sweepBtn.click(); await wait(400); await ss(page, 'STEP_041_SWEEP_PAUSED', 'Sweep stopped'); }
      } else {
        defect('015', 'P2', 'TemporalScrubber', 'Sweep Playback', 'SWEEP button not found', 'STEP_040_SWEEP_PLAYING');
        await ss(page, 'STEP_040_SWEEP_PLAYING', 'N/A'); await ss(page, 'STEP_041_SWEEP_PAUSED', 'N/A');
      }

      const resetBtn = await scrubber.$('button[title*="Reset"]');
      if (resetBtn) { await resetBtn.click(); await wait(400); await ss(page, 'STEP_042_SCRUBBER_RESET', 'Scrubber reset to 50%'); }
      else { defect('016', 'P3', 'TemporalScrubber', 'Reset Button', 'Reset button (title*=Reset) not found', 'STEP_042_SCRUBBER_RESET'); await ss(page, 'STEP_042_SCRUBBER_RESET', 'N/A'); }
    } else {
      defect('017', 'P0', 'TemporalScrubber', 'Inspect', '#temporal-scrubber-hud not found in DOM', 'STEP_029_SCRUBBER_BASELINE');
    }

    // PHASE 4: QUERY PROMPT BAR
    console.log('\n--- PHASE 4: QUERY PROMPT BAR ---');
    const promptBarEl = await page.$('#query-prompt-bar-container');
    if (promptBarEl) {
      await ss(page, 'STEP_043_PROMPT_BAR', 'Prompt bar baseline');

      const promptBox = await promptBarEl.boundingBox();
      const scrubberEl2 = await page.$('#temporal-scrubber-hud');
      const scrubberBox = scrubberEl2 ? await scrubberEl2.boundingBox() : null;
      if (promptBox && scrubberBox) {
        const promptBottom = promptBox.y + promptBox.height;
        const scrubberTop = scrubberBox.y;
        console.log(`Prompt bar bottom: ${promptBottom.toFixed(0)}px, Scrubber top: ${scrubberTop.toFixed(0)}px`);
        if (promptBottom > scrubberTop + 10) {
          defect('018', 'P1', 'QueryPromptBar', 'Layout', `Prompt bar bottom (${promptBottom.toFixed(0)}px) overlaps scrubber top (${scrubberTop.toFixed(0)}px)`, 'STEP_043_PROMPT_BAR');
        } else {
          console.log('✅ Prompt bar clears scrubber — no overlap');
        }
      }

      // Cycle modality badge
      const modalityBtn = await page.$('#query-prompt-bar-container button[title*="switch"]');
      if (modalityBtn) {
        await modalityBtn.click(); await wait(400);
        await ss(page, 'STEP_044_MODALITY_CYCLED_1', 'Modality cycled once');
        await modalityBtn.click(); await wait(400);
        await ss(page, 'STEP_045_MODALITY_CYCLED_2', 'Modality cycled twice');
      }

      // Benchmark toggle
      const benchToggle = await page.$('#toggle-benchmark-suggestions-btn');
      if (benchToggle) {
        await benchToggle.click(); await wait(400);
        await ss(page, 'STEP_046_BENCHMARK_CHIPS_OPEN', 'Benchmark chips open');
        const firstChip = await page.$('[id^="benchmark-chip-"]');
        if (firstChip) { await firstChip.click(); await wait(600); await ss(page, 'STEP_047_BENCHMARK_SELECTED', 'Benchmark chip selected'); }
      } else {
        defect('019', 'P2', 'QueryPromptBar', 'Benchmark Toggle', '#toggle-benchmark-suggestions-btn not found', 'STEP_046_BENCHMARK_CHIPS_OPEN');
        await ss(page, 'STEP_046_BENCHMARK_CHIPS_OPEN', 'N/A'); await ss(page, 'STEP_047_BENCHMARK_SELECTED', 'N/A');
      }

      // Submit query
      const queryInput = await page.$('#satquery-prompt-input');
      if (queryInput) {
        await queryInput.click();
        await page.keyboard.type('Detect flood extent using SAR cloud piercing over Brahmaputra');
        await wait(300);
        await ss(page, 'STEP_048_QUERY_TYPED', 'Query typed');

        const submitBtn = await page.$('#satquery-submit-btn');
        if (submitBtn) {
          await submitBtn.click(); await wait(1500);
          await ss(page, 'STEP_049_QUERY_PROCESSING', 'Query processing');
          await wait(5000);
          await ss(page, 'STEP_050_QUERY_RESPONSE', 'Query response');

          // Check map center occlusion
          const canvasEl = await page.$('.maplibregl-canvas');
          const promptBox2 = await promptBarEl.boundingBox();
          if (canvasEl && promptBox2) {
            const canvasBox = await canvasEl.boundingBox();
            const cx = canvasBox.x + canvasBox.width / 2;
            const cy = canvasBox.y + canvasBox.height / 2;
            const covers = promptBox2.x < cx && promptBox2.x + promptBox2.width > cx && promptBox2.y < cy && promptBox2.y + promptBox2.height > cy;
            if (covers) {
              defect('020', 'P1', 'QueryPromptBar', 'Post-Query', 'Prompt bar/response card covers map center after query', 'STEP_050_QUERY_RESPONSE');
            } else {
              console.log('✅ Map center visible after query — PASS');
            }
          }
        }
      }

      // Minimize
      const minBtn = await page.$('#minimize-prompt-bar-btn');
      if (minBtn) {
        await minBtn.click(); await wait(400);
        await ss(page, 'STEP_051_PROMPT_MINIMIZED', 'Prompt bar minimized');
        const restoreEl = await page.$('#query-prompt-bar-minimized');
        if (restoreEl) {
          await restoreEl.click(); await wait(400);
          await ss(page, 'STEP_052_PROMPT_RESTORED', 'Prompt bar restored');
        } else {
          defect('021', 'P2', 'QueryPromptBar', 'Minimize', '#query-prompt-bar-minimized not found after minimize', 'STEP_051_PROMPT_MINIMIZED');
          await ss(page, 'STEP_052_PROMPT_RESTORED', 'N/A');
        }
      }
    } else {
      defect('022', 'P1', 'QueryPromptBar', 'Initial Render', 'Prompt bar not found on desktop viewport (1440px)', 'STEP_043_PROMPT_BAR');
    }

    // PHASE 5: RIGHT OPERATIONAL PANEL
    console.log('\n--- PHASE 5: RIGHT OPERATIONAL PANEL ---');
    const rightPanelEl = await page.$('#right-operational-deck');
    if (rightPanelEl) {
      await ss(page, 'STEP_053_RIGHT_PANEL_FULL', 'Right panel full view');

      const evidenceTab = await rightPanelEl.$('button:has-text("EVIDENCE")');
      if (evidenceTab) {
        await evidenceTab.click(); await wait(400);
        await ss(page, 'STEP_054_EVIDENCE_TAB', 'Evidence tab active');

        const panelBody = await page.$('#right-operational-deck .overflow-y-auto');
        if (panelBody) {
          await panelBody.evaluate(el => { el.scrollTop += 200; }); await wait(300);
          await ss(page, 'STEP_055_EVIDENCE_SCROLL', 'Evidence tab scrolled');
        }

        const exportGeoBtn = await page.$('button:has-text("EXPORT EPSG")');
        if (exportGeoBtn) { await exportGeoBtn.click(); await wait(400); await ss(page, 'STEP_056_GEOJSON_EXPORT', 'GeoJSON export'); }
        else { defect('023', 'P2', 'RightPanel', 'Export GeoJSON', 'Export GeoJSON button not found', 'STEP_055_EVIDENCE_SCROLL'); }
      }

      const dagTab = await rightPanelEl.$('button:has-text("AGENT DAG")');
      if (dagTab) {
        await dagTab.click(); await wait(500);
        await ss(page, 'STEP_057_DAG_TAB', 'Agent DAG tab');
        const exportDagBtn = await page.$('button:has-text("EXPORT AUDITABLE")');
        if (exportDagBtn) { await exportDagBtn.click(); await wait(400); await ss(page, 'STEP_058_DAG_EXPORT', 'DAG export triggered'); }
      }

      const sensorsTab = await rightPanelEl.$('button:has-text("SENSORS")');
      if (sensorsTab) {
        await sensorsTab.click(); await wait(500);
        await ss(page, 'STEP_059_SENSORS_TAB', 'Sensors tab');
        const nirBtn = await rightPanelEl.$('button:has-text("NIR")');
        if (nirBtn) { await nirBtn.click(); await wait(400); await ss(page, 'STEP_060_BAND_NIR', 'NIR band'); }
        const sarBtn = await rightPanelEl.$('button:has-text("SAR")');
        if (sarBtn) { await sarBtn.click(); await wait(400); await ss(page, 'STEP_061_BAND_SAR', 'SAR band'); }
      }

      const minimizePanelBtn = await page.$('#minimize-operational-deck-btn');
      if (minimizePanelBtn) {
        await minimizePanelBtn.click(); await wait(500);
        await ss(page, 'STEP_062_PANEL_MINIMIZED', 'Right panel minimized');
        const vlmTab = await page.$('#open-operational-deck-btn');
        if (vlmTab) {
          await vlmTab.click(); await wait(400);
          await ss(page, 'STEP_063_PANEL_RESTORED', 'Panel restored via VLM ORCHESTRATOR');
        } else {
          defect('024', 'P2', 'RightPanel', 'Panel Minimize', 'VLM ORCHESTRATOR restore button not found after minimize', 'STEP_062_PANEL_MINIMIZED');
          await ss(page, 'STEP_063_PANEL_RESTORED', 'N/A');
        }
      }
    } else {
      defect('025', 'P1', 'RightPanel', 'Initial Render', 'Right operational deck not found', 'STEP_053_RIGHT_PANEL_FULL');
    }

    // PHASE 6: SPECIALIZED STUDIOS
    console.log('\n--- PHASE 6: SPECIALIZED STUDIOS ---');

    // Bi-Temporal
    const biTempBtn = await page.$('button:has-text("Bi-Temporal")');
    if (biTempBtn) {
      await biTempBtn.click(); await wait(800);
      await ss(page, 'STEP_064_BITEMPORAL_STUDIO', 'Bi-Temporal studio');
      const overlay = await page.$('#bitemporal-studio-overlay');
      if (overlay) {
        const overlayBox = await overlay.boundingBox();
        console.log(`Bitemporal overlay: w=${overlayBox.width.toFixed(0)}px`);
        const slider = await overlay.$('input[type="range"]');
        if (slider) {
          await slider.evaluate(el => { el.value = '20'; el.dispatchEvent(new Event('input', {bubbles:true})); }); await wait(400);
          await ss(page, 'STEP_065_CURTAIN_20', 'Curtain at 20%');
          await slider.evaluate(el => { el.value = '80'; el.dispatchEvent(new Event('input', {bubbles:true})); }); await wait(400);
          await ss(page, 'STEP_066_CURTAIN_80', 'Curtain at 80%');
          await slider.evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        }
        const presetBtns = await overlay.$$('button');
        if (presetBtns.length > 0) { await presetBtns[0].click(); await wait(500); await ss(page, 'STEP_067_CDVQA_PRESET', 'CDVQA preset clicked'); }
      } else {
        defect('026', 'P1', 'BitemporalStudio', 'Open', '#bitemporal-studio-overlay not found', 'STEP_064_BITEMPORAL_STUDIO');
      }
    }

    // Radar SAR
    const radarBtn = await page.$('button:has-text("Radar SAR")');
    if (radarBtn) {
      await radarBtn.click(); await wait(800);
      await ss(page, 'STEP_068_RADAR_SAR_STUDIO', 'Radar SAR studio');
      const overlay = await page.$('#crossmodal-studio-overlay');
      if (overlay) {
        const slider = await overlay.$('input[type="range"]');
        if (slider) {
          await slider.evaluate(el => { el.value = '60'; el.dispatchEvent(new Event('input', {bubbles:true})); }); await wait(400);
          await ss(page, 'STEP_068B_CLOUD_PIERCE', 'Cloud pierce slider adjusted');
        }
      } else {
        defect('027', 'P2', 'CrossmodalStudio', 'Open', '#crossmodal-studio-overlay not found', 'STEP_068_RADAR_SAR_STUDIO');
      }
    }

    // Grounding
    const groundBtn = await page.$('button:has-text("Grounding")');
    if (groundBtn) {
      await groundBtn.click(); await wait(800);
      await ss(page, 'STEP_069_GROUNDING_STUDIO', 'Grounding studio');
      const overlay = await page.$('#grounding-studio-overlay');
      if (overlay) {
        const customInput = await overlay.$('input[type="text"]');
        if (customInput) { await customInput.click(); await page.keyboard.type('radar hard targets'); await wait(300); }
        const sliders = await overlay.$$('input[type="range"]');
        if (sliders.length >= 2) {
          await sliders[1].evaluate(el => { el.value = '65'; el.dispatchEvent(new Event('input', {bubbles:true})); }); await wait(400);
        }
        await ss(page, 'STEP_069B_GROUNDING_IOU', 'Grounding IoU slider');
      } else {
        defect('028', 'P2', 'GroundingStudio', 'Open', '#grounding-studio-overlay not found', 'STEP_069_GROUNDING_STUDIO');
      }
    }

    // Benchmarks
    const benchBtn = await page.$('button:has-text("Benchmarks")');
    if (benchBtn) { await benchBtn.click(); await wait(800); await ss(page, 'STEP_070_BENCHMARK_STUDIO', 'Benchmarks studio'); }

    // Ingestion
    const dataBtn = await page.$('button:has-text("Data")');
    if (dataBtn) { await dataBtn.click(); await wait(800); await ss(page, 'STEP_071_INGESTION_STUDIO', 'Ingestion studio'); }

    // Audit DAG
    const auditBtn = await page.$('button:has-text("Audit DAG")');
    if (auditBtn) {
      await auditBtn.click(); await wait(800);
      await ss(page, 'STEP_072_AUDIT_STUDIO', 'Audit DAG studio');
      const auditOverlay = await page.$('#audit-studio-overlay');
      if (auditOverlay) {
        const airgapped = await auditOverlay.$('text="AIR-GAPPED LOCAL"');
        const online = await auditOverlay.$('text="ONLINE"');
        if (airgapped && online) {
          defect('029', 'P1', 'AuditStudio', 'Contradictory Labels', '"AIR-GAPPED LOCAL" badge alongside "ONLINE" STAC indicator creates contradictory messaging', 'STEP_072_AUDIT_STUDIO');
        }
        await ss(page, 'STEP_072B_AUDIT_HASH', 'Audit hash ledger');
      }
    }

    // Final
    const finalDash = await page.$('button:has-text("Dashboard")');
    if (finalDash) { await finalDash.click(); await wait(700); }
    await ss(page, 'STEP_073_FINAL_DASHBOARD', 'Final state — Dashboard');

    // === PRINT REPORT ===
    console.log('\n\n╔════════════════════════════════════════════╗');
    console.log('║   SATQUERY AI // MASTER AUDIT REPORT       ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log(`📸 Total Screenshots: ${stepCount}`);
    console.log(`🚨 Total Defects:     ${defects.length}\n`);

    const p0 = defects.filter(d => d.severity === 'P0');
    const p1 = defects.filter(d => d.severity === 'P1');
    const p2 = defects.filter(d => d.severity === 'P2');
    const p3 = defects.filter(d => d.severity === 'P3');
    console.log(`  P0 Critical: ${p0.length}`);
    console.log(`  P1 Major:    ${p1.length}`);
    console.log(`  P2 Moderate: ${p2.length}`);
    console.log(`  P3 Minor:    ${p3.length}`);

    console.log('\n--- DEFECT LOG ---');
    defects.forEach((d, i) => {
      console.log(`\n[DEF-${d.id}] ${d.severity} | ${d.component}`);
      console.log(`  Trigger:     ${d.trigger}`);
      console.log(`  Description: ${d.description}`);
      console.log(`  Screenshot:  ${d.screenshot}`);
    });
    console.log(`\n✅ Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (err) {
    console.error('\n❌ Audit script crashed:', err.message);
    await ss(page, 'STEP_ERROR', `Error: ${err.message}`).catch(() => {});
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed. Audit complete.');
  }
})();
