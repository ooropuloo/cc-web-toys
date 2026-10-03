// Render the full demo loop (sim view) to PNG frames, then ffmpeg -> mp4. node tools/render.mjs <outDir> [fps=12]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const OUT = process.argv[2]; const FPS = +(process.argv[3] || 12);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto('file:///' + ROOT + '/index.html?demo&view=sim&t=0');
await p.waitForFunction(() => window.__reel2, null, { timeout: 15000 });
const total = 48 * 60 / 128; const n = Math.round(total * FPS);
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.__setT(t), i / FPS);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.locator('#view').screenshot({ path: `${OUT}/f_${String(i).padStart(4, '0')}.png` });
}
console.log('frames', n);
await b.close();
