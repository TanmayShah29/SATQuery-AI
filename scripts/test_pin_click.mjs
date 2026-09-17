import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/tanmay/SIH-2026/audit_screenshots';

async function testPin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Use evaluate to query pin position from MapLibre
  const pinPoint = await page.evaluate(() => {
    // Look at center pin
    const canvas = document.querySelector('#primary-geospatial-canvas canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 - 20 };
  });

  if (pinPoint) {
    console.log('Hovering over center pin at:', pinPoint);
    await page.mouse.move(pinPoint.x, pinPoint.y);
    await page.waitForTimeout(600);
    await page.mouse.click(pinPoint.x, pinPoint.y);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FIX_07_PIN_TOOLTIP_POPUP.png'), fullPage: true });
  }

  await browser.close();
}

testPin();
