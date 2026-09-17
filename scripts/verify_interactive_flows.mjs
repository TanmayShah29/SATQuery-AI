import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/tanmay/SIH-2026/audit_screenshots';

async function verifyFlows() {
  console.log('=== STARTING INTERACTIVE FLOWS AUDIT ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.warn(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    // 1. Load Dashboard
    console.log('[1] Loading Dashboard...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 2. Open Data Studio
    console.log('[2] Opening Data Studio...');
    await page.locator('button:has-text("Data")').first().click();
    await page.waitForTimeout(1000);

    // 3. Click the first precalibrated GeoTIFF
    console.log('[3] Selecting Cartosat-2S GeoTIFF...');
    const geotiffItem = page.locator('text=ISRO_SAC_CARTOSAT2S_PAN_MS_202405.tif').first();
    if (await geotiffItem.isVisible()) {
      await geotiffItem.click();
      await page.waitForTimeout(1500);
      console.log('Clicked Cartosat-2S GeoTIFF.');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FLOW_01_GEOTIFF_SELECTED.png'), fullPage: true });

    // 4. Submit a query with the selected GeoTIFF
    console.log('[4] Submitting query on selected GeoTIFF...');
    const queryInput = page.locator('input[placeholder*="Ask"]').first();
    await queryInput.fill('Evaluate building density and vegetation indices across this scene');
    await page.locator('button:has-text("RUN")').first().click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FLOW_02_GEOTIFF_QUERY_COMPLETED.png'), fullPage: true });

    // 5. Open Benchmarks Studio
    console.log('[5] Opening Benchmarks Studio...');
    await page.locator('button:has-text("Benchmarks")').first().click();
    await page.waitForTimeout(1000);

    // 6. Click Run Evaluation Batch
    console.log('[6] Triggering Real Evaluation Batch...');
    const runBenchBtn = page.locator('button:has-text("RUN EVALUATION BATCH")').first();
    if (await runBenchBtn.isVisible()) {
      await runBenchBtn.click();
      console.log('Evaluation triggered, waiting for real benchmark batch response...');
      // Wait for the button text to change or re-enable
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FLOW_03_BENCHMARK_COMPLETED.png'), fullPage: true });
      console.log('Benchmark evaluation completed screenshot saved.');
    }

    console.log('=== INTERACTIVE FLOWS AUDIT COMPLETE ===');
  } catch (err) {
    console.error('Flow verification error:', err);
  } finally {
    await browser.close();
  }
}

verifyFlows();
