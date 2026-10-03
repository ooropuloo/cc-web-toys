// Headless test for 折面投影台: phase screenshots + interaction checks.
// node tools/shot.mjs <outDir> [view=sim]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');

const OUT = process.argv[2] || ROOT + '/shots/run';
const VIEW = process.argv[3] || 'sim';
mkdirSync(OUT, { recursive: true });
const URL0 = 'file:///' + ROOT + '/index.html';
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });

const beat = 60 / 128;
const phases = [['01_dark', 1], ['02_lines_mid', 7], ['03_lines_end', 13.6], ['04_fill_mid', 19], ['05_fill_end', 25.6], ['06_char', 30.5], ['07_title', 40.3], ['08_title2', 44]];
for (const [name, bt] of phases) {
  await p.goto(`${URL0}?demo&view=${VIEW}&t=${(bt * beat).toFixed(3)}`);
  await p.waitForFunction(() => window.__reel2 && window.__reel2.t >= 0, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  await p.locator('#view').screenshot({ path: `${OUT}/${name}.png` });
}
// interaction: edit mode, add a facet, drag a vertex, play
await p.goto(`${URL0}?demo&view=edit`);
await p.waitForFunction(() => window.__reel2, null, { timeout: 15000 });
await p.waitForTimeout(300);
const before = await p.evaluate(() => window.__reel2.facets);
const box = await p.locator('#view').boundingBox();
const toPage = (x, y) => { const s = Math.min(box.width / 1280, box.height / 720); const ox = (box.width - 1280 * s) / 2, oy = (box.height - 720 * s) / 2; return [box.x + ox + x * s, box.y + oy + y * s]; };
await p.click('#btnAddFacet');
for (const [x, y] of [[100, 500], [300, 480], [250, 680], [100, 500]]) { const [px, py] = toPage(x, y); await p.mouse.click(px, py); await p.waitForTimeout(80); }
const after = await p.evaluate(() => window.__reel2.facets);
// drag shared vertex G (720,260) -> (740,240)
let [gx, gy] = toPage(720, 260); await p.mouse.move(gx, gy); await p.mouse.down();
[gx, gy] = toPage(745, 235); await p.mouse.move(gx, gy, { steps: 5 }); await p.mouse.up();
await p.waitForTimeout(400);
const moved = await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('reel2.facetstage.v1')); let n = 0; S.facets.forEach(f => f.pts.forEach(q => { if (q[0] === 745 && q[1] === 235) n++; })); return n; });
await p.locator('#view').screenshot({ path: `${OUT}/09_edit.png` });
await p.click('#editTabs button[data-e=layer]');
await p.waitForTimeout(300);
await p.locator('#view').screenshot({ path: `${OUT}/10_layer_edit.png` });
await p.click('#btnPlay');
const t1 = await p.evaluate(() => window.__reel2.t);
await p.waitForTimeout(1500);
const t2 = await p.evaluate(() => window.__reel2.t);
await p.screenshot({ path: `${OUT}/11_ui.png` });
const build = await p.locator('#build').innerText();
console.log(JSON.stringify({ facetsBefore: before, facetsAfterAdd: after, sharedVertexMoved: moved, playAdvanced: +(t2 - t1).toFixed(2), build }));
console.log(errors.length ? 'ERRORS\n' + [...new Set(errors)].join('\n') : 'no errors');
await b.close();
