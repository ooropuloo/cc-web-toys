// fps per forced tier under continuous interaction, plus a transparent-mode screenshot
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const URL = pathToFileURL(ROOT + '/index.html').href;
const W = 1920, H = 1080;
for (const q of ['ultra', 'high', 'medium', 'low', 'min', 'auto']) {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto(URL + '?debug' + (q === 'auto' ? '' : '&q=' + q));
  await p.waitForFunction(() => window.__ready);
  const samples = [];
  for (let s = 0; s < 7; s++) {
    for (let i = 0; i < 60; i++) { const a = (s * 60 + i) / 30; await p.mouse.move((0.5 + 0.3 * Math.cos(a)) * W, (0.5 + 0.3 * Math.sin(a * 1.3)) * H); await p.waitForTimeout(16); }
    samples.push(await p.evaluate(() => window.__fps));
  }
  const dbg = await p.evaluate(() => document.getElementById('debug').textContent.split('\n').slice(0, 4).join(' | '));
  const ms = await p.evaluate(() => [window.__ink.bench(60), window.__ink.bench(60)]);
  console.log(q.padEnd(7), 'gpu ms/frame', ms.join('/'), 'fps samples', samples.join(','), '::', dbg);
  await p.close();
}
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(URL + '?transparent=1&palette=fire');
await p.waitForFunction(() => window.__ready);
await p.evaluate(() => { document.body.style.background = 'repeating-linear-gradient(45deg,#334 0 40px,#556 40px 80px)'; window.__ink.burst(4); });
await p.waitForTimeout(2000);
await p.screenshot({ path: ROOT + '/shots/transparent_over_checker.png' });
await b.close();
