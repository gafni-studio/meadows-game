#!/usr/bin/env node
/**
 * Visual check of an attack or skill: casts it next to a Field Mouse in the pasture and saves ONE contact
 * sheet (frames over time, left to right) — open it with any image viewer (or Claude's Read tool).
 *
 *   npm run build && npm run shots -- slash            (basic attack)
 *   npm run shots -- power_strike fire_bolt chain_spark  (several; any skill id, or "slash")
 *   OUT=dir  where sheets go (default: shots/)          MS=40,90,140,…  frame times in ms
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const names = process.argv.slice(2);
if (!names.length) { console.error('Usage: npm run shots -- slash power_strike fire_bolt …'); process.exit(1); }
const OUT = process.env.OUT ?? 'shots';
mkdirSync(OUT, { recursive: true });
const TIMES = (process.env.MS ?? '40,90,140,190,260,340').split(',').map(Number);
const CHROME = process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const PORT = 4211;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()); setTimeout(r, 8000); });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${PORT}/?canvas`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'));
  await page.evaluate(() => window.__state.scene.travel('sunny_pasture', 20 * 32));
  await page.waitForFunction(() => window.__state.player.area === 'sunny_pasture' && window.__game?.scene.isActive('World'));
  await page.waitForTimeout(500);
  for (const name of names) {
    // a fresh target, a ready Hero, the skill learned
    await page.evaluate((id) => {
      const w = window.__state.scene, p = window.__state.player;
      w.monsters.forEach((m) => m.destroy()); w.monsters = []; (w.bolts ?? []).forEach((b) => b.head.destroy()); w.bolts = [];
      p.cheats.god = true; p.level = 8; p.mp = 999; if (id !== 'slash') p.skillRanks[id] = 3;
      window.__state.cooldowns = {}; window.__state.buffs = {}; w.facing = 1; w.player.setFlipX(false); w.swingReadyAt = 0;
      w.player.x = 20 * 32; w.player.body.setVelocityX(0);
      const m = w.spawnMonster('field_mouse', 20 * 32 + 90); m.body.setVelocityX(0); m.speed = 0; m.hp = 99999; m.def.hp = 99999;
    }, name);
    await page.waitForTimeout(200);
    const t0 = Date.now();
    await page.evaluate((id) => { const w = window.__state.scene; if (id === 'slash') w.trySwing(1, 0, 'basic'); else w.useSkill(id); }, name);
    const frames = [];
    for (const t of TIMES) {
      const wait = t - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      frames.push((await page.screenshot({ clip: { x: 540, y: 460, width: 400, height: 190 } })).toString('base64'));
    }
    // compose the sheet in the browser (no image libraries needed)
    const png = await page.evaluate(async ({ frames, times }) => {
      const imgs = await Promise.all(frames.map((b) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${b}`; })));
      const cols = 3, w = imgs[0].width, h = imgs[0].height, c = document.createElement('canvas');
      c.width = w * cols; c.height = h * Math.ceil(imgs.length / cols);
      const g = c.getContext('2d');
      imgs.forEach((im, i) => {
        const x = (i % cols) * w, y = Math.floor(i / cols) * h;
        g.drawImage(im, x, y); g.fillStyle = '#000a'; g.fillRect(x, y, 64, 18); g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(`${times[i]} ms`, x + 4, y + 13);
      });
      return c.toDataURL('image/png').split(',')[1];
    }, { frames, times: TIMES });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(png, 'base64'));
    console.log(`${OUT}/${name}.png`);
  }
} finally { await browser.close(); server.kill(); }
