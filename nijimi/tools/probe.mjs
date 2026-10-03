import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const W = 1920, H = 1080;
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(pathToFileURL(ROOT + '/index.html').href);
await p.waitForFunction(() => window.__ready);
await p.waitForTimeout(1500);
await p.keyboard.press('r');
await p.waitForTimeout(200);
await p.mouse.click(0.5 * W, 0.5 * H);
for (const ms of [50, 500, 1500]) {
  await p.waitForTimeout(ms);
  const grid = await p.evaluate(() => { let m = 0; for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const v = window.__ink.probe(i / 40, j / 40); if (v && v[0] > m) m = v[0]; } return [m, window.__ink.probe(0.5, 0.5)]; });
  console.log(ms, JSON.stringify(grid));
}
await b.close();
