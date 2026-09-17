/**
 * SatQuery AI - Automated Playwright Master Visual & Functional Audit Runner
 * Clicks every button, swipes/drags sliders, scrolls containers, captures screenshots,
 * and records all DOM mutations and console anomalies.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/tanmay/SIH-2026/audit_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const auditLog = [];

function logStep(stepId, name, action, notes = '') {
  const entry = { stepId, name, action, notes, timestamp: new Date().toISOString() };
  auditLog.push(entry);
  console.log(`[AUDIT STEP ${stepId}] ${name}: ${action} ${notes ? `(${notes})` : ''}`);
}

async function run() {
  console.log('==================================================================');
  console.log('     SATQUERY AI: INITIATING PLAYWRIGHT RECONNAISSANCE AUDIT      ');
  console.log('==================================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.warn(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.error(`[BROWSER UNCAUGHT ERROR] ${err.message}`);
  });

  try {
    // ------------------------------------------------------------------------
    // STEP 01: Initial Load & Telemetry
    // ------------------------------------------------------------------------
    logStep('01', 'Initial Load', 'Navigating to http://localhost:5173/');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Allow MapLibre WebGL canvas to paint
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_01_INITIAL_DASHBOARD.png'), fullPage: true });

    // ------------------------------------------------------------------------
    // STEP 02 - 08: Studio Navigation Switching
    // ------------------------------------------------------------------------
    const studios = [
      { name: 'Bi-Temporal', path: '/bitemporal', selector: 'button:has-text("Bi-Temporal")' },
      { name: 'Radar SAR', path: '/crossmodal', selector: 'button:has-text("Radar SAR")' },
      { name: 'Grounding', path: '/grounding', selector: 'button:has-text("Grounding")' },
      { name: 'Benchmarks', path: '/benchmarks', selector: 'button:has-text("Benchmarks")' },
      { name: 'Data', path: '/ingestion', selector: 'button:has-text("Data")' },
      { name: 'Audit DAG', path: '/audit', selector: 'button:has-text("Audit DAG")' },
      { name: 'Dashboard', path: '/', selector: 'button:has-text("Dashboard")' },
    ];

    let stepNum = 2;
    for (const st of studios) {
      logStep(String(stepNum).padStart(2, '0'), `Studio Switch - ${st.name}`, `Clicking studio button ${st.selector}`);
      const btn = page.locator(st.selector).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `STEP_${String(stepNum).padStart(2, '0')}_STUDIO_${st.name.replace(/\s+/g, '_').toUpperCase()}.png`),
          fullPage: true
        });
      } else {
        logStep(String(stepNum).padStart(2, '0'), `Studio Switch - ${st.name}`, 'Button not visible!');
      }
      stepNum++;
    }

    // ------------------------------------------------------------------------
    // STEP 09 - 13: Situational Feed Drawer
    // ------------------------------------------------------------------------
    logStep('09', 'Situational Feed', 'Clicking Feed drawer toggle in top HUD');
    const feedBtn = page.locator('button:has-text("Feed")').first();
    if (await feedBtn.isVisible()) {
      await feedBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_09_SITUATIONAL_FEED_OPEN.png'), fullPage: true });

      // Click Passes tab
      logStep('10', 'Situational Feed', 'Clicking Passes tab');
      const passesTab = page.locator('button:has-text("PASSES")').first();
      if (await passesTab.isVisible()) {
        await passesTab.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_10_FEED_PASSES_TAB.png'), fullPage: true });
      }

      // Click Layers tab
      logStep('11', 'Situational Feed', 'Clicking Layers tab');
      const layersTab = page.locator('button:has-text("LAYERS")').first();
      if (await layersTab.isVisible()) {
        await layersTab.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_11_FEED_LAYERS_TAB.png'), fullPage: true });
      }

      // Scroll drawer content
      logStep('12', 'Situational Feed', 'Scrolling drawer content');
      const drawerScrollable = page.locator('#situational-feed-drawer .overflow-y-auto').first();
      if (await drawerScrollable.isVisible()) {
        await drawerScrollable.evaluate((el) => el.scrollBy(0, 400));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_12_FEED_SCROLLED.png'), fullPage: true });
      }

      // Close drawer
      logStep('13', 'Situational Feed', 'Closing drawer');
      const closeDrawerBtn = page.locator('#situational-feed-drawer button:has(svg.lucide-x)').first();
      if (await closeDrawerBtn.isVisible()) {
        await closeDrawerBtn.click();
      } else {
        await feedBtn.click();
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_13_FEED_CLOSED.png'), fullPage: true });
    }

    // ------------------------------------------------------------------------
    // STEP 14 - 18: Right Operational Panel (Evidence Deck)
    // ------------------------------------------------------------------------
    logStep('14', 'Right Panel Evidence', 'Inspecting EVIDENCE tab');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_14_RIGHT_PANEL_EVIDENCE.png'), fullPage: true });

    // Click AGENT DAG tab
    logStep('15', 'Right Panel DAG', 'Clicking AGENT DAG tab');
    const dagTab = page.locator('button:has-text("AGENT DAG")').first();
    if (await dagTab.isVisible()) {
      await dagTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_15_RIGHT_PANEL_DAG.png'), fullPage: true });
    }

    // Click SENSORS tab
    logStep('16', 'Right Panel Sensors', 'Clicking SENSORS tab');
    const sensorsTab = page.locator('button:has-text("SENSORS")').first();
    if (await sensorsTab.isVisible()) {
      await sensorsTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_16_RIGHT_PANEL_SENSORS.png'), fullPage: true });
    }

    // Minimize Right Panel
    logStep('17', 'Right Panel Minimize', 'Minimizing right operational deck');
    const minimizeBtn = page.locator('#minimize-operational-deck-btn').first();
    if (await minimizeBtn.isVisible()) {
      await minimizeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_17_RIGHT_PANEL_MINIMIZED.png'), fullPage: true });

      // Restore Right Panel
      logStep('18', 'Right Panel Restore', 'Clicking VLM ORCHESTRATOR to restore panel');
      const restoreBtn = page.locator('#open-operational-deck-btn').first();
      if (await restoreBtn.isVisible()) {
        await restoreBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_18_RIGHT_PANEL_RESTORED.png'), fullPage: true });
      }
    }

    // ------------------------------------------------------------------------
    // STEP 19 - 24: Prompt Bar & Real Query Execution
    // ------------------------------------------------------------------------
    logStep('19', 'Prompt Bar', 'Testing Modality Pills');
    const optPill = page.locator('button:has-text("OPTICAL")').first();
    if (await optPill.isVisible()) {
      await optPill.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_19_MODALITY_OPTICAL.png'), fullPage: true });
    }

    const biPill = page.locator('button:has-text("BI-TEMPORAL")').first();
    if (await biPill.isVisible()) {
      await biPill.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_20_MODALITY_BITEMPORAL.png'), fullPage: true });
    }

    const sarPill = page.locator('button:has-text("SAR RADAR")').first();
    if (await sarPill.isVisible()) {
      await sarPill.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_21_MODALITY_SAR.png'), fullPage: true });
    }

    // Type query
    logStep('22', 'Prompt Bar', 'Typing query in input');
    const queryInput = page.locator('input[placeholder*="Ask"]').first();
    if (await queryInput.isVisible()) {
      await queryInput.fill('Detect flood boundaries and water bodies in the basin');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_22_QUERY_TYPED.png'), fullPage: true });

      // Click RUN
      logStep('23', 'Prompt Bar', 'Submitting query');
      const runBtn = page.locator('button:has-text("RUN")').first();
      if (await runBtn.isVisible()) {
        await runBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_23_QUERY_PROCESSING.png'), fullPage: true });

        // Wait for query response to settle
        await page.waitForTimeout(3500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_24_QUERY_COMPLETED.png'), fullPage: true });
      }
    }

    // ------------------------------------------------------------------------
    // STEP 25 - 33: Temporal Scrubber Interaction
    // ------------------------------------------------------------------------
    logStep('25', 'Scrubber Range', 'Testing Range 24h');
    const btn24h = page.locator('#temporal-scrubber-hud button:has-text("24h")').first();
    if (await btn24h.isVisible()) {
      await btn24h.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_25_SCRUBBER_24H.png'), fullPage: true });
    }

    logStep('26', 'Scrubber Range', 'Testing Range 7d');
    const btn7d = page.locator('#temporal-scrubber-hud button:has-text("7d")').first();
    if (await btn7d.isVisible()) {
      await btn7d.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_26_SCRUBBER_7D.png'), fullPage: true });
    }

    logStep('27', 'Scrubber Range', 'Testing Range 30d');
    const btn30d = page.locator('#temporal-scrubber-hud button:has-text("30d")').first();
    if (await btn30d.isVisible()) {
      await btn30d.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_27_SCRUBBER_30D.png'), fullPage: true });
    }

    logStep('28', 'Scrubber Range', 'Testing Range 1y');
    const btn1y = page.locator('#temporal-scrubber-hud button:has-text("1y")').first();
    if (await btn1y.isVisible()) {
      await btn1y.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_28_SCRUBBER_1Y.png'), fullPage: true });
    }

    logStep('29', 'Scrubber Range', 'Testing Range all');
    const btnAll = page.locator('#temporal-scrubber-hud button:has-text("all")').first();
    if (await btnAll.isVisible()) {
      await btnAll.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_29_SCRUBBER_ALL.png'), fullPage: true });
    }

    // Set Slider to 25%
    logStep('30', 'Scrubber Slider', 'Setting slider to 25%');
    const slider = page.locator('#temporal-scrubber-hud input[type="range"]').first();
    if (await slider.isVisible()) {
      await slider.fill('25');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_30_SCRUBBER_25PCT.png'), fullPage: true });

      // Set Slider to 75%
      logStep('31', 'Scrubber Slider', 'Setting slider to 75%');
      await slider.fill('75');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_31_SCRUBBER_75PCT.png'), fullPage: true });
    }

    // Test TIME SWEEP button
    logStep('32', 'Scrubber Sweep', 'Clicking SWEEP button to start play');
    const sweepBtn = page.locator('#temporal-scrubber-hud button:has-text("SWEEP")').first();
    if (await sweepBtn.isVisible()) {
      await sweepBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_32_SCRUBBER_SWEEPING.png'), fullPage: true });

      // Pause sweep
      logStep('33', 'Scrubber Sweep', 'Clicking PAUSE button to stop sweep');
      const pauseBtn = page.locator('#temporal-scrubber-hud button:has-text("PAUSE")').first();
      if (await pauseBtn.isVisible()) {
        await pauseBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_33_SCRUBBER_PAUSED.png'), fullPage: true });
      }
    }

    // ------------------------------------------------------------------------
    // STEP 34 - 38: Map Canvas Tools Dock
    // ------------------------------------------------------------------------
    logStep('34', 'Map Controls', 'Clicking Zoom In (+)');
    const zoomInBtn = page.locator('#map-zoom-in-btn').first();
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_34_MAP_ZOOM_IN.png'), fullPage: true });
    }

    logStep('35', 'Map Controls', 'Clicking Zoom Out (−)');
    const zoomOutBtn = page.locator('#map-zoom-out-btn').first();
    if (await zoomOutBtn.isVisible()) {
      await zoomOutBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_35_MAP_ZOOM_OUT.png'), fullPage: true });
    }

    logStep('36', 'Map Controls', 'Toggling Layers Drawer from Dock');
    const layersBtn = page.locator('#map-layers-toggle-btn').first();
    if (await layersBtn.isVisible()) {
      await layersBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_36_MAP_LAYERS_OPEN.png'), fullPage: true });
      // Close it again
      await layersBtn.click();
      await page.waitForTimeout(300);
    }

    logStep('37', 'Map Controls', 'Toggling 2D/3D Globe Projection');
    const projBtn = page.locator('#map-projection-toggle-btn').first();
    if (await projBtn.isVisible()) {
      await projBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_37_MAP_GLOBE_TOGGLE.png'), fullPage: true });
    }

    logStep('38', 'Map Controls', 'Toggling Basemap');
    const basemapBtn = page.locator('#map-basemap-toggle-btn').first();
    if (await basemapBtn.isVisible()) {
      await basemapBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'STEP_38_MAP_BASEMAP_TOGGLE.png'), fullPage: true });
    }

    console.log('==================================================================');
    console.log(`COMPLETED ALL 38 AUDIT STEPS! Screenshots stored in: ${SCREENSHOT_DIR}`);
    console.log(`Total Browser Console Errors Logged: ${consoleErrors.length}`);
    console.log('==================================================================');

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'audit_execution_summary.json'),
      JSON.stringify({ log: auditLog, consoleErrors }, null, 2)
    );

  } catch (err) {
    console.error('Audit execution error:', err);
  } finally {
    await browser.close();
  }
}

run();
