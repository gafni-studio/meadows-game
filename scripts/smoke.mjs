#!/usr/bin/env node
/**
 * Boot smoke (~20 s): the built game starts, every window opens and closes, an NPC talks,
 * the Hero walks into the pasture and fights — with no console errors. That is all it checks:
 * logic lives in the fast tests (`npm test`), feel is for playtesting.
 *
 * Usage: npm run build && npm run smoke     (CHROME_PATH overrides the browser; SHOTS=dir saves screenshots)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4199;
const SHOTS = process.env.SHOTS;
const CHROME = process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()); setTimeout(res, 8000); });

const errors = [];
const t0 = Date.now();
const step = (msg) => console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${msg}`);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const fail = (msg) => { throw new Error(msg); };
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const visible = () => page.evaluate(() => [...document.querySelectorAll('.panel')].filter((p) => !p.hidden).map((p) => p.id.replace('p-', '')));
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };

  await page.goto(`http://localhost:${PORT}/?canvas`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  await page.waitForTimeout(700);
  step(`boot (v${await page.evaluate(() => window.__version)})`);
  await shot('boot');

  for (const [k, panel] of [['i', 'inventory'], ['c', 'stats'], ['k', 'skills'], ['j', 'journal'], ['t', 'passives']]) {
    await key(k, 250);
    if (!(await visible()).includes(panel)) fail(`${k.toUpperCase()} did not open ${panel}`);
    await key('Escape');
    if ((await visible()).length) fail(`Esc did not close ${panel}`);
  }
  step('windows I C K J T open and close');

  // Pell starts Welcome to Meadow Town: talk, page through, take the gift screen
  await page.evaluate(() => { const w = window.__state.scene; w.player.x = w.npcs.find((n) => n.id === 'pell').x; });
  await page.waitForTimeout(250);
  await key('e', 400);
  if (!(await visible()).includes('dialog')) fail('E at Pell did not open a conversation');
  await shot('dialog');
  for (let i = 0; i < 8 && (await visible()).includes('dialog'); i++) await key('Enter', 160);
  await page.waitForFunction(() => !document.querySelector('#p-rewards')?.hidden, null, { timeout: 3000 }).catch(() => fail('no rewards screen after Pell'));
  await shot('rewards');
  await key('Enter', 200);
  if ((await page.evaluate(() => window.__state.player.questLog.ql_intro?.step)) !== 2) fail('Pell did not advance the intro');
  step('NPC conversation and rewards screen');

  // into the pasture and fight with F
  await page.evaluate(() => { window.__state.scene.travel('sunny_pasture', 20 * 32); });
  await page.waitForFunction(() => window.__state.player.area === 'sunny_pasture' && window.__game?.scene.isActive('World'), null, { timeout: 10000 });
  await page.waitForTimeout(400);
  const xp0 = await page.evaluate(() => window.__state.player.xp);
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => {
      const w = window.__state.scene;
      const m = w.monsters.filter((x) => x.alive).sort((a, b) => Math.abs(a.x - w.player.x) - Math.abs(b.x - w.player.x))[0];
      if (m) { w.player.x = m.x - 50; w.facing = 1; w.player.setFlipX(false); }
      window.__state.player.hp = 100;
    });
    await page.keyboard.down('f'); await page.waitForTimeout(250); await page.keyboard.up('f');
    if ((await page.evaluate(() => window.__state.player.xp)) > xp0) break;
  }
  if ((await page.evaluate(() => window.__state.player.xp)) <= xp0) fail('no XP after fighting in the pasture');
  await shot('combat');
  step('pasture combat');
  ok = true;
} catch (e) {
  console.error(`SMOKE FAILED: ${e.message}`);
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
if (!ok) process.exit(1);
console.log(`SMOKE OK in ${((Date.now() - t0) / 1000).toFixed(1)}s — no console errors`);
