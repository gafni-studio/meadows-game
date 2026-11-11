#!/usr/bin/env node
/**
 * Headless smoke test: serves the production build with `vite preview`, opens it in
 * Chrome via playwright-core, walks into Sunny Pasture, fights, and fails on any
 * console error. Usage: npm run build && npm run smoke
 * Set CHROME_PATH if Chrome/Chromium is not at /usr/bin/google-chrome.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4199;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()); setTimeout(res, 8000); });

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?canvas`);
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  const s = () => page.evaluate(() => { const g = window.__state; return { area: g.player.area, x: Math.round(g.player.x), hp: g.player.hp, xp: g.player.xp, level: g.player.level, coins: g.player.coins, inv: g.player.inventory }; });
  console.log('boot:', await s());

  // Spend points, then walk east to the town gate and enter Sunny Pasture.
  await page.keyboard.press('c');
  for (let i = 0; i < 5; i++) await page.click('button[data-stat="STR"]');
  await page.keyboard.press('Escape');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__state.player.x > 42 * 32 - 20, null, { timeout: 15000 });
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.press('e'); await page.waitForTimeout(800);
  console.log('after gate:', await s());
  if ((await s()).area !== 'sunny_pasture') throw new Error('Did not reach Sunny Pasture');

  // Fight: step toward the nearest living monster, hold F (attack), use Power Strike (1), pick up (E).
  const nearestDir = () => page.evaluate(() => {
    const sc = window.__game.scene.getScene('World');
    const alive = sc.monsters.filter((m) => m.alive);
    if (!alive.length) return 0;
    const m = alive.reduce((a, b) => (Math.abs(a.x - sc.player.x) < Math.abs(b.x - sc.player.x) ? a : b));
    const dx = m.x - sc.player.x;
    return Math.abs(dx) < 40 ? (dx < 0 ? -0.1 : 0.1) : Math.sign(dx);
  });
  for (let i = 0; i < 60; i++) {
    const dir = await nearestDir();
    const key = dir < 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key); await page.waitForTimeout(Math.abs(dir) < 1 ? 30 : 250); await page.keyboard.up(key);
    await page.keyboard.down('f'); await page.waitForTimeout(500); await page.keyboard.up('f');
    await page.keyboard.press('1');
    await page.keyboard.press('e');
  }
  const end = await s();
  console.log('after fighting:', end);
  await page.screenshot({ path: 'smoke-screenshot.png' });
  if (end.xp === 0 && end.level === 1) throw new Error('Gained no XP — combat may be broken');
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('SMOKE OK — no console errors');
