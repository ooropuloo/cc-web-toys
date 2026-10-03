// quick look: node tools/quick.mjs <out.png> <query> <script-name>
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [OUT, Q = '', MODE = 'clear'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const W = 1920, H = 1080;
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + Q);
await p.waitForFunction(() => window.__ready);
await p.waitForTimeout(2000);
if (MODE === 'clear') {
  await p.keyboard.press('r');
  await p.waitForTimeout(300);
} else if (MODE === 'stroke') {
  await p.keyboard.press('r');
  await p.mouse.move(0.2 * W, 0.6 * H);
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    await p.mouse.move((0.2 + 0.6 * t) * W, (0.6 - 0.18 * Math.sin(t * 6.283)) * H);
    await p.waitForTimeout(16);
  }
  await p.waitForTimeout(1500);
} else if (MODE === 'click') {
  await p.keyboard.press('r');
  await p.mouse.click(0.5 * W, 0.5 * H);
  await p.waitForTimeout(2200);
}
await p.screenshot({ path: OUT });
console.log('fps', await p.evaluate(() => window.__fps), errs.join('\n'));
await b.close();
