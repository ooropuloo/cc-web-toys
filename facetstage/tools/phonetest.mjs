// Phone check: 390x844 dpr3 touch, CPU x4 throttle. upload → 自動偵測面 → 套用 → touch-drag a vertex.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const OUT = ROOT + '/shots/r3'; mkdirSync(OUT, { recursive: true });
const IMG = process.argv[2] || ROOT + '/testimg/syn_ceiling.jpg';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const cdp = await ctx.newCDPSession(p);
await p.goto('file:///' + ROOT + '/index.html');
await p.waitForFunction(() => window.__reel2, null, { timeout: 15000 });
await p.tap('#btnSide');                      // open settings (folded on phones)
await p.setInputFiles('#bgFile', IMG);
await p.waitForSelector('#autoBox', { state: 'visible' });
await p.locator('#btnAuto').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${OUT}/phone_1_uploaded.png` });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
// measure the longest frame gap while detecting (UI freeze check)
await p.evaluate(() => { window.__gap = 0; let last = performance.now(); const f = () => { const t = performance.now(); window.__gap = Math.max(window.__gap, t - last); last = t; if (!window.__stopGap) requestAnimationFrame(f); }; requestAnimationFrame(f); });
await p.tap('#btnAuto');
await p.waitForFunction(() => window.__autoLast, null, { timeout: 60000 });
const gap = await p.evaluate(() => { window.__stopGap = true; return Math.round(window.__gap); });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const det = await p.evaluate(() => window.__autoLast);
await p.locator('#btnAutoApply').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${OUT}/phone_2_preview.png` });
await p.tap('#btnAutoApply'); await p.waitForTimeout(150);
let facets = await p.evaluate(() => window.__reel2.facets);
if (facets !== det.count) { await p.tap('#btnAutoApply'); await p.waitForTimeout(150); facets = await p.evaluate(() => window.__reel2.facets); } // two-tap confirm when replacing
const status = await p.locator('#autoStatus').innerText();
await p.tap('#btnSide'); await p.waitForTimeout(300);   // fold settings, stage full screen
// pick a shared vertex and touch-drag it by (+40,+30) stage px
const info = await p.evaluate(() => {
  const S = JSON.parse(localStorage.getItem('reel2.facetstage.v1'));
  const cnt = new Map(); S.facets.forEach(f => f.pts.forEach(q => { const k = q.join(','); cnt.set(k, (cnt.get(k) || 0) + 1); }));
  let best = null, bn = 0; for (const [k, n] of cnt) { const v = k.split(',').map(Number); if (v[0] > 20 && v[1] > 20 && v[0] < S.res[0] - 60 && v[1] < S.res[1] - 60 && n > bn) { bn = n; best = v; } }
  if (!best) { const f0 = S.facets[0].pts; const c = f0.reduce((a, q) => [a[0] + q[0] / f0.length, a[1] + q[1] / f0.length], [0, 0]); best = f0.filter(q => q[0] < S.res[0] - 5 && q[1] < S.res[1] - 5).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]))[0]; bn = cnt.get(best.join(',')); }
  const r = document.getElementById('view').getBoundingClientRect(), dpr = devicePixelRatio;
  const W = r.width * dpr, H = r.height * dpr, s = Math.min(W / S.res[0], H / S.res[1]), ox = (W - S.res[0] * s) / 2, oy = (H - S.res[1] * s) / 2;
  const toCss = (x, y) => [r.left + (ox + x * s) / dpr, r.top + (oy + y * s) / dpr];
  return { v: best, shared: bn, from: toCss(best[0], best[1]), to: toCss(best[0] + (best[0] > S.res[0] / 2 ? -40 : 40), best[1] + (best[1] > S.res[1] / 2 ? -30 : 30)), res: S.res };
});
const tp = (type, xy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: xy ? [{ x: xy[0], y: xy[1] }] : [] });
await tp('touchStart', info.from);
for (let i = 1; i <= 8; i++) await tp('touchMove', [info.from[0] + (info.to[0] - info.from[0]) * i / 8, info.from[1] + (info.to[1] - info.from[1]) * i / 8]);
await tp('touchEnd'); await p.waitForTimeout(400);
const moved = await p.evaluate(([x, y]) => { const S = JSON.parse(localStorage.getItem('reel2.facetstage.v1')); let n = 0, old = 0; S.facets.forEach(f => f.pts.forEach(q => { if (Math.abs(q[0] - x) <= 3 && Math.abs(q[1] - y) <= 3) n++; })); return n; }, [info.v[0] + (info.v[0] > info.res[0] / 2 ? -40 : 40), info.v[1] + (info.v[1] > info.res[1] / 2 ? -30 : 30)]);
await p.screenshot({ path: `${OUT}/phone_3_dragged.png` });
console.log(JSON.stringify({ detected: det.count, msThrottled4x: det.ms, longestFrameGapMs: gap, appliedFacets: facets, status, sharedVertex: info.v, sharedBy: info.shared, movedVerticesAtTarget: moved, build: await p.locator('#build').innerText(), errs }));
await b.close();
