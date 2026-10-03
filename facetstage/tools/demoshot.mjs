import { createRequire } from 'node:module';
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1580, height: 760 } });
await p.goto('file:///' + ROOT + '/index.html?demo&view=sim&t=0.2');
await p.waitForFunction(() => window.__reel2); await p.waitForTimeout(500);
await p.evaluate(() => { document.body.classList.add('side-hidden'); window.dispatchEvent(new Event('resize')); });
await p.waitForTimeout(400);
await p.locator('#view').screenshot({ path: ROOT + '/testimg/demo_sim.png' });
await b.close();
