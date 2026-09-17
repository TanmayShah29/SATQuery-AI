import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import fs from 'fs';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const screenshotsDir = 'audit_screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Initial State Screenshot
  await page.screenshot({ path: `${screenshotsDir}/VERIFY_01_INITIAL_DASHBOARD.png` });
  console.log('Saved VERIFY_01_INITIAL_DASHBOARD.png');

  // 2. Test Sensor Switcher on Map: Click NIR
  console.log('2. Testing NIR Sensor Switch...');
  const nirBtn = page.locator('#sensor-band-btn-nir');
  await nirBtn.waitFor({ state: 'visible' });
  await nirBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${screenshotsDir}/VERIFY_02_MAP_NIR_ACTIVE.png` });
  console.log('Saved VERIFY_02_MAP_NIR_ACTIVE.png');

  // 3. Test Sensor Switcher on Map: Click SAR
  console.log('3. Testing SAR Sensor Switch...');
  const sarBtn = page.locator('#sensor-band-btn-sar');
  await sarBtn.waitFor({ state: 'visible' });
  await sarBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${screenshotsDir}/VERIFY_03_MAP_SAR_ACTIVE.png` });
  console.log('Saved VERIFY_03_MAP_SAR_ACTIVE.png');

  // 4. Open SENSORS tab in Right Panel
  console.log('4. Testing SENSORS tab in Right Operational Panel...');
  const sensorsTabBtn = page.locator('button:has-text("SENSORS")').first();
  await sensorsTabBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${screenshotsDir}/VERIFY_04_RIGHT_PANEL_SENSORS_TAB.png` });
  console.log('Saved VERIFY_04_RIGHT_PANEL_SENSORS_TAB.png');

  // 5. Test 1Y Timeline Range (100+ passes)
  console.log('5. Testing 1Y Timeline Span...');
  const oneYearBtn = page.locator('#temporal-scrubber-hud button:has-text("1y")');
  await oneYearBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${screenshotsDir}/VERIFY_05_TIMELINE_1Y_100_PASSES.png` });
  console.log('Saved VERIFY_05_TIMELINE_1Y_100_PASSES.png');

  // 6. Test Play Timelapse
  console.log('6. Testing PLAY TIMELAPSE playback...');
  const playBtn = page.locator('#temporal-scrubber-hud button:has-text("PLAY TIMELAPSE")');
  await playBtn.click();
  await page.waitForTimeout(2500); // let it play through multiple passes
  await page.screenshot({ path: `${screenshotsDir}/VERIFY_06_TIMELAPSE_PLAYING_ACTIVE_PASSES.png` });
  console.log('Saved VERIFY_06_TIMELAPSE_PLAYING_ACTIVE_PASSES.png');

  // Pause
  const pauseBtn = page.locator('#temporal-scrubber-hud button:has-text("PAUSE")');
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
  }

  // 7. Test Dedicated Split Curtain Mode
  console.log('7. Testing Dedicated Split Curtain Mode...');
  const curtainBtn = page.locator('#temporal-scrubber-hud button:has-text("SPLIT CURTAIN")');
  if (await curtainBtn.isVisible()) {
    await curtainBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${screenshotsDir}/VERIFY_07_SPLIT_CURTAIN_MODE.png` });
    console.log('Saved VERIFY_07_SPLIT_CURTAIN_MODE.png');
  }

  await browser.close();
  console.log('Verification script completed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
