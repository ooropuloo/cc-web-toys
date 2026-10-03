// Headless GPU Chrome: drive real pointer strokes / clicks / Space on each palette and screenshot the evolution.
// node tools/shoot.mjs [outDir=shots] [query=?debug]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'shots');
const EXTRA = process.argv[3] || '';
mkdirSync(OUT, { recursive: true });
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function open(viewport, query, opts = {}) {
  const ctx = await b.newContext({ viewport, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  await p.goto(URL + query);
  await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  return { ctx, p };
}
const fps = (p) => p.evaluate(() => [window.__fps, window.__tier, document.getElementById('debug').textContent]);

// curvy stroke with page.mouse (real pointer events)
async function stroke(p, W, H, cx, cy, r, turns = 1.2, steps = 70, phase = 0) {
  await p.mouse.move(cx * W + r * W, cy * H);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = phase + t * turns * 6.283;
    const rr = r * (1 - 0.55 * t);
    await p.mouse.move((cx + Math.cos(a) * rr) * W, (cy + Math.sin(a) * rr * 1.25) * H);
    await p.waitForTimeout(16);
  }
}

const W = 1920, H = 1080;
const { ctx, p } = await open({ width: W, height: H }, '?debug' + EXTRA);
await p.waitForTimeout(2500);
let n = 0;
const shot = async (name) => { await p.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}_${name}.png` }); };
await shot('intro');
for (const pal of ['jade', 'fire', 'indigo', 'sakura', 'gold']) {
  await p.evaluate((x) => { window.__ink.clear(); window.__ink.setPalette(x); }, pal);
  await stroke(p, W, H, 0.32, 0.5, 0.16, 1.4, 80, 0);
  await stroke(p, W, H, 0.66, 0.45, 0.14, -1.1, 70, 2);
  await p.mouse.click(0.5 * W, 0.62 * H);
  await p.waitForTimeout(400);
  await p.mouse.click(0.78 * W, 0.3 * H);
  await p.waitForTimeout(1600);
  await shot(pal + '_2s');
  if (pal === 'jade' || pal === 'fire') {
    await p.keyboard.press('Space');
    await p.waitForTimeout(2600);
    await shot(pal + '_space');
  }
  console.log(pal, JSON.stringify((await fps(p)).slice(0, 2)));
}
console.log('debug:\n' + (await fps(p))[2]);
// idle long enough for attract mode
await p.evaluate(() => { window.__ink.clear(); window.__ink.setPalette('jade'); });
await p.mouse.move(5, 5);
await p.waitForTimeout(13000);
await shot('attract');
console.log('attract fps', JSON.stringify((await fps(p)).slice(0, 2)));
await ctx.close();

// phone with multi-touch via CDP
const ph = await open({ width: 390, height: 844 }, '?debug&palette=sakura' + EXTRA, { deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ph.p.waitForTimeout(1500);
const cdp = await ph.ctx.newCDPSession(ph.p);
const tp = (pts) => pts.map(([x, y], id) => ({ x, y, id }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[120, 300], [270, 560]]) });
for (let i = 0; i < 40; i++) {
  const a = i / 40 * 6.283;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[195 + Math.cos(a) * 90, 330 + Math.sin(a) * 120], [195 + Math.cos(-a) * 100, 560 + Math.sin(-a) * 90]]) });
  await ph.p.waitForTimeout(16);
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await ph.p.waitForTimeout(1800);
await ph.p.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}_phone_touch.png` });
await ph.p.waitForTimeout(3000);
console.log('phone', JSON.stringify((await fps(ph.p)).slice(0, 2)));
await ph.ctx.close();
console.log(errors.length ? 'ERRORS\n' + [...new Set(errors)].join('\n') : 'no errors');
await b.close();
