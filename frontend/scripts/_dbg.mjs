import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const vite = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
vite.stdout.on('data', (d) => (log += d));
vite.stderr.on('data', (d) => (log += d));

const wait = async (url) => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

let browser;
try {
  console.log('server up:', await wait('http://localhost:3000'));
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('PAGE ERR:', String(e).slice(0, 300)));
  const res = await page.goto('http://localhost:3000/tactical', { waitUntil: 'domcontentloaded' });
  console.log('status:', res && res.status());
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => ({
    path: location.pathname,
    title: document.title,
    rootChildren: document.getElementById('root')?.children.length ?? -1,
    headerHud: !!document.getElementById('header-hud'),
    bodyLen: document.body.innerText.length,
    bodyStart: document.body.innerText.slice(0, 400),
    ids: Array.from(document.querySelectorAll('[id]')).map((e) => e.id).slice(0, 40),
  }));
  console.log(JSON.stringify(info, null, 2));
} catch (e) {
  console.log('ERR', e);
} finally {
  if (browser) await browser.close();
  vite.kill('SIGTERM');
}
