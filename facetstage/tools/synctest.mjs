import { createRequire } from 'node:module';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const errs = [];
const main = await ctx.newPage(); main.on('pageerror', e => errs.push(e.message));
await main.goto('file:///' + ROOT + '/index.html?demo');
const out = await ctx.newPage(); out.on('pageerror', e => errs.push(e.message));
await out.goto('file:///' + ROOT + '/index.html?demo#out');
await out.waitForTimeout(800);
await main.click('#btnPlay');
await main.waitForTimeout(3000);
const tm = await main.evaluate(() => window.__reel2.t), to = await out.evaluate(() => window.__reel2.t);
const hidden = await out.evaluate(() => getComputedStyle(document.getElementById('side')).display);
await out.screenshot({ path: ROOT + '/shots/r5/12_out_window.png' });
console.log(JSON.stringify({ mainT: tm.toFixed(2), outT: to.toFixed(2), sidebarInOut: hidden, errs }));
await b.close();
