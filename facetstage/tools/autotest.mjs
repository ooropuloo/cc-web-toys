// 自動偵測面 headless test. node tools/autotest.mjs <outDir> [details=5] [images...]
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const OUT = process.argv[2] || ROOT + '/shots/r3';
const DETAILS = (process.argv[3] || '5').split(',').map(Number);
const DIR = ROOT + '/testimg';
let imgs = process.argv.slice(4);
if (!imgs.length) imgs = readdirSync(DIR).filter(f => /\.(jpg|png)$/.test(f));
mkdirSync(OUT, { recursive: true });
let gt = {}; try { gt = JSON.parse(readFileSync(DIR + '/gt.json', 'utf8')); } catch (e) {}
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
for (const f of imgs) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html?demo');
  await p.waitForFunction(() => window.__reel2, null, { timeout: 15000 });
  await p.setInputFiles('#bgFile', `${DIR}/${f}`);
  await p.waitForSelector('#autoBox', { state: 'visible', timeout: 10000 });
  for (const d of DETAILS) {
    await p.evaluate(d => { document.getElementById('autoDetail').value = d; window.__autoLast = null; }, d);
    await p.click('#btnAuto');
    await p.waitForFunction(() => window.__autoLast, null, { timeout: 30000 });
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => window.__autoLast);
    const base = f.replace(/\.\w+$/, '');
    await p.locator('#view').screenshot({ path: `${OUT}/auto_${base}_d${d}.png` });
    rows.push({ img: base, detail: d, count: r.count, gt: gt[base] ?? '-', ms: r.ms, sp: r.superpixels, regions: r.regions, noise: r.noise, T: r.T, size: `${r.w}x${r.h}`, errs: errs.length });
  }
  await ctx.close();
}
console.table(rows);
await b.close();
