import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/tanmay/SIH-2026/audit_screenshots';

async function testIssues() {
  console.log('=== STARTING REPRODUCTION & VERIFICATION SUITE ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.warn(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    // 1. Initial Load
    console.log('[1] Loading Dashboard...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 2. Open Sectors dropdown in Top HUD
    console.log('[2] Opening Sectors dropdown in Top HUD...');
    const sectorsBtn = page.locator('#scope-selector-btn').first();
    await sectorsBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_01_SECTORS_DROPDOWN_CLEAN.png'), fullPage: true });

    // Close dropdown by clicking header
    await page.locator('#header-hud').click({ position: { x: 50, y: 20 } });
    await page.waitForTimeout(400);

    // 3. Test Time Range switching (7d -> 30d -> 24h -> 1y -> all)
    console.log('[3] Testing Time Range switching...');
    
    // Switch to 30d
    await page.locator('#temporal-scrubber-hud button:has-text("30d")').first().click();
    await page.waitForTimeout(400);
    const dateText30d = await page.locator('#temporal-scrubber-hud').innerText();
    console.log('30d Scrubber Text contains:', dateText30d.includes('01 APR') ? '01 APR (PASSED)' : dateText30d);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_02_TIME_RANGE_30D.png'), fullPage: true });

    // Switch to 24h
    await page.locator('#temporal-scrubber-hud button:has-text("24h")').first().click();
    await page.waitForTimeout(400);
    const dateText24h = await page.locator('#temporal-scrubber-hud').innerText();
    console.log('24h Scrubber Text contains:', dateText24h.includes('30 APR') ? '30 APR (PASSED)' : dateText24h);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_03_TIME_RANGE_24H.png'), fullPage: true });

    // Switch to 1y
    await page.locator('#temporal-scrubber-hud button:has-text("1y")').first().click();
    await page.waitForTimeout(400);
    const dateText1y = await page.locator('#temporal-scrubber-hud').innerText();
    console.log('1y Scrubber Text contains:', dateText1y.includes('2023') ? '2023 (PASSED)' : dateText1y);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_04_TIME_RANGE_1Y.png'), fullPage: true });

    // Switch back to 7d
    await page.locator('#temporal-scrubber-hud button:has-text("7d")').first().click();
    await page.waitForTimeout(400);

    // 4. Test SWEEP button: should trigger bi-temporal split curtain and glide across satellite footage
    console.log('[4] Testing SWEEP button on satellite footage...');
    const sweepBtn = page.locator('#temporal-scrubber-hud button:has-text("SWEEP")').first();
    await sweepBtn.click();
    // Allow sweep to animate for 2.5 seconds
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_05_SWEEP_ACTIVE_SATELLITE_GLIDE.png'), fullPage: true });

    // Pause sweep
    const pauseBtn = page.locator('#temporal-scrubber-hud button:has-text("PAUSE")').first();
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      await page.waitForTimeout(300);
    }

    // 5. Test Sector Pin click bubble: click on the center pin to verify popup bubble is not cut off
    console.log('[5] Clicking map to trigger sector bubble...');
    // Click near center canvas where pin is located
    await page.mouse.click(800, 500);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_06_SECTOR_BUBBLE_CLAMPED.png'), fullPage: true });

    console.log('=== REPRODUCTION & VERIFICATION SUITE FINISHED ===');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

testIssues();
