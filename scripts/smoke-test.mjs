#!/usr/bin/env node
/**
 * Headless smoke test: serves the production build with `vite preview`, opens it in
 * Chrome via playwright-core and checks, by keyboard only:
 *   - boot + canvas, no console errors
 *   - test console (`): copper / item / xp commands, save marked cheated
 *   - Mara's shop: arrows + Enter buys, Tab switches to Sell, Esc closes
 *   - inventory (I): Enter uses a potion; M + arrows + Enter moves a stack; X drops (confirm) and E picks up;
 *     gameplay keys ignored while open
 *   - storage chest: E opens, Enter stores a stack, it persists across a reload
 *   - skills (K): Enter trains Power Strike rank 1 and pays Monster Essence + Training Scrolls + coins
 *   - stats (C): Enter spends a point; Esc menu opens/closes
 *   - walks into Sunny Pasture and fights with F / Power Strike (1)
 *   - console `reset` and Esc → New game → Enter/Y both land on a fresh character
 * Usage: npm run build && npm run smoke   (CHROME_PATH overrides /usr/bin/google-chrome)
 * SHOTS=dir also saves screenshots there.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4199;
const SHOTS = process.env.SHOTS;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()); setTimeout(res, 8000); });

const errors = [];
const fail = (msg) => { throw new Error(msg); };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?canvas`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  const s = () => page.evaluate(() => { const g = window.__state; return { area: g.player.area, x: Math.round(g.player.x), hp: Math.round(g.player.hp), xp: g.player.xp, level: g.player.level, coins: g.player.coins, inv: { ...g.player.inventory }, cheated: g.player.cheated, unspent: g.player.unspent, menu: g.menuOpen }; });
  const visible = () => page.evaluate(() => [...document.querySelectorAll('.panel')].filter((p) => !p.hidden).map((p) => p.id.replace('p-', '')));
  const key = async (k, wait = 120) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  console.log('boot:', await s());

  // ── Test console ──
  await key('`');
  await page.keyboard.type('copper 100'); await key('Enter');
  await page.keyboard.type('item meadow_dew 2'); await key('Enter');
  await page.keyboard.type('xp 10'); await key('Enter');
  const c = await s();
  if (c.coins !== 100 || c.inv.meadow_dew !== 2 || c.xp !== 10 || !c.cheated) fail(`console commands failed: ${JSON.stringify(c)}`);
  await key('Escape');
  if (await page.evaluate(() => !document.querySelector('#console').hidden)) fail('console did not close on Esc');
  console.log('console ok:', c);

  // ── Shop by keyboard ──
  await page.evaluate(() => { window.__state.scene.player.x = 10 * 32; });
  await page.waitForTimeout(150);
  await key('e', 250);
  if (!(await visible()).includes('shop')) fail('shop did not open with E');
  await key('Enter'); // first tile = Meadow Dew 15c
  let after = await s();
  if (after.coins !== 85 || after.inv.meadow_dew !== 3) fail(`buy by Enter failed: ${JSON.stringify(after)}`);
  await key('ArrowRight'); await key('ArrowRight');
  const sel = await page.evaluate(() => document.querySelector('#p-shop .sel')?.dataset.key);
  if (sel !== 'buy:spring_draught') fail(`arrow nav went to ${sel}`);
  await shot('town-shop');
  await key('Tab');
  if (!(await page.evaluate(() => document.querySelector('#p-shop .tabs .on')?.dataset.tab === 'sell'))) fail('Tab did not switch to Sell');
  await key('Escape');
  if ((await visible()).length) fail('Esc did not close the shop');
  console.log('shop ok:', after.coins, after.inv);

  // ── Inventory: gameplay keys ignored while open, Enter uses ──
  await key('i');
  const x0 = (await s()).x;
  await page.keyboard.down('f'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('f');
  await page.keyboard.press('Space');
  if (Math.abs((await s()).x - x0) > 2) fail('player moved while inventory was open');
  await page.evaluate(() => { window.__state.player.hp = 50; });
  await key('Escape'); await key('i'); // reopening starts on the first bag item
  const sel2 = await page.evaluate(() => document.querySelector('#p-inventory .sel')?.dataset.key);
  if (sel2 !== 'inv:meadow_dew') fail(`inventory selection is ${sel2}`);
  await key('Enter', 600);
  after = await s();
  if (after.inv.meadow_dew !== 2 || after.hp < 85) fail(`inventory Enter did not use ${sel2}: ${JSON.stringify(after)}`);
  // move by keyboard: M picks up, → moves, Enter places
  await key('m'); await key('ArrowRight'); await key('Enter');
  const slots = await page.evaluate(() => window.__state.player.bagSlots.slice(0, 3));
  if (slots[1] !== 'meadow_dew' || slots[0]) fail(`keyboard move failed: ${JSON.stringify(slots)}`);
  // drop on the ground: X → confirm (stack of 2) → "Drop 1"
  await key('ArrowRight'); await key('ArrowLeft'); // reselect the moved stack
  await key('x');
  if (!(await visible()).includes('drop')) fail('drop confirm did not open');
  await key('Enter', 400);
  if ((await s()).inv.meadow_dew !== 1) fail('drop 1 failed');
  await shot('inventory');
  await key('Escape');
  await page.waitForTimeout(500);
  // Do not step away: Mara is next to the player and E would talk to her if the drop is out of range.
  await shot('loot-on-ground');
  await key('e', 320);
  await shot('pickup-fly');
  await page.waitForTimeout(800);
  if ((await s()).inv.meadow_dew !== 2) fail(`pickup of dropped item failed: ${JSON.stringify(await s())}`);
  console.log('inventory ok (use, move, drop, pick up)');

  // ── Storage chest: E opens, Enter stores the stack, persists across reload ──
  await page.evaluate(() => { window.__state.scene.player.x = 15 * 32; });
  await page.waitForTimeout(150);
  await key('e', 250);
  if (!(await visible()).includes('storage')) fail('storage did not open with E');
  await key('Enter', 200);
  const st = await page.evaluate(() => ({ ...window.__state.player.storage }));
  if (st.meadow_dew !== 2) fail(`store failed: ${JSON.stringify(st)}`);
  await shot('storage-chest');
  await key('Escape');
  await page.evaluate(() => window.__state.save());
  await page.reload();
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  if ((await page.evaluate(() => window.__state.player.storage.meadow_dew)) !== 2) fail('storage did not persist');
  console.log('storage ok');

  // ── whodrops + gear instance (does not stack) ──
  await key('`');
  await page.keyboard.type('whodrops hide vest'); await key('Enter', 200);
  const who = await page.evaluate(() => document.querySelector('#console-out')?.innerText ?? '');
  if (!/Wool Sheep/i.test(who) || !/0\.12%/.test(who)) fail(`whodrops failed: ${who.slice(-400)}`);
  await page.keyboard.type('item hide_vest'); await key('Enter');
  await page.keyboard.type('item hide_vest magic'); await key('Enter');
  await key('Escape');
  const gear = await page.evaluate(() => Object.values(window.__state.player.gearItems).map((g) => ({ id: g.itemId, def: g.defense, magic: g.magic, prefix: g.prefix, container: g.container })));
  const hides = gear.filter((g) => g.id === 'hide_vest');
  if (hides.length !== 2) fail(`expected 2 hide vest instances, got ${JSON.stringify(gear)}`);
  if (!hides.some((g) => g.magic && g.prefix) || hides.some((g) => g.def < 2 || g.def > 5)) fail(`gear rolls/magic wrong: ${JSON.stringify(hides)}`);
  if ((await page.evaluate(() => window.__state.player.inventory.hide_vest))) fail('gear should not stack in inventory counts');
  await key('i', 250);
  await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#p-inventory .tile[data-uid]')];
    const magic = tiles.find((t) => t.classList.contains('magic')) || tiles[0];
    if (magic) magic.click();
  });
  await page.waitForTimeout(150);
  await shot('inventory-gear');
  await key('Escape');
  console.log('gear/whodrops ok:', hides);
  // hotbar: defaults on a fresh-enough bar; give a dew (chest may already hold the shop stack) and bind it to 3
  const bar0 = await page.evaluate(() => [...window.__state.player.skillBar]);
  if (bar0[0] !== 'power_strike' || bar0.length !== 6 || !bar0.includes('meadow_dew') || bar0[5] !== 'clear_dew') fail(`hotbar defaults: ${JSON.stringify(bar0)}`);
  await key('`');
  await page.keyboard.type('item meadow_dew 1'); await key('Enter');
  await key('Escape');
  await key('i', 250);
  const picked = await page.evaluate(() => {
    const t = document.querySelector('#p-inventory .tile[data-item="meadow_dew"]');
    if (!t) return null;
    t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    return t.dataset.item;
  });
  if (picked !== 'meadow_dew') fail(`could not highlight Meadow Dew (click would drink it): ${picked}`);
  await key('3', 200);
  await key('Escape', 150);
  const bar1 = await page.evaluate(() => [...window.__state.player.skillBar]);
  if (bar1[2] !== 'meadow_dew') fail(`inventory 3 did not bind Meadow Dew: ${JSON.stringify(bar1)}`);
  console.log('hotbar ok:', bar1);


  // ── Skill training (K / Calden): Enter trains Power Strike rank 1, pays the sheet cost ──
  await key('`');
  await page.keyboard.type('item monster_essence 30'); await key('Enter');
  await page.keyboard.type('item training_scroll 5'); await key('Enter');
  await key('Escape');
  // Close leftover panels without a second Esc (that would open the pause menu).
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await page.waitForTimeout(100);
  await key('k', 350);
  if (!(await visible()).includes('skills')) fail('K did not open the skills window');
  const sk = await page.evaluate(() => document.querySelector('#p-skills .sel')?.dataset.skill);
  if (sk !== 'power_strike') fail(`skills default is ${sk}`);
  const skillText = await page.evaluate(() => document.querySelector('#p-skills')?.innerText ?? '');
  if (/Intentionally modest|Rebalanced down|Available from level 1|Clearly stronger than|Most expensive|opens mid|opens early|opens late|Capstone/i.test(skillText)) fail(`skill UI shows design notes: ${skillText.slice(0, 400)}`);
  if (!/A heavy blow that hits harder/i.test(skillText)) fail(`skill UI missing player desc: ${skillText.slice(0, 400)}`);
  const coinsBefore = (await s()).coins;
  await key('Enter', 400);
  const ranks = await page.evaluate(() => ({ ...window.__state.player.skillRanks, coins: window.__state.player.coins, me: window.__state.player.inventory.monster_essence ?? 0, sc: window.__state.player.inventory.training_scroll ?? 0, bar: [...window.__state.player.skillBar] }));
  if (ranks.power_strike !== 1) fail(`train did not raise Power Strike: ${JSON.stringify(ranks)}`);
  if (ranks.me !== 0 || ranks.sc !== 0 || ranks.coins !== coinsBefore - 20) fail(`train did not pay the cost: ${JSON.stringify(ranks)} coinsBefore=${coinsBefore}`);
  await shot('skills-train');
  await key('Escape');
  if ((await visible()).length) fail(`Esc did not close skills: ${JSON.stringify(await visible())}`);
  console.log('skills ok:', ranks);


  // ── Stats + Esc menu ──
  const pts = (await s()).unspent;
  await key('c'); await key('Enter');
  if ((await s()).unspent !== pts - 1) fail('stats Enter did not spend a point');
  await key('Escape'); await key('Escape');
  if (!(await visible()).includes('pause')) fail('Esc did not open the menu');
  await key('Enter');
  if ((await visible()).length) fail('Enter on Resume did not close the menu');
  console.log('stats/menu ok');

  // ── Walk east into Sunny Pasture and fight ──
  await page.evaluate(() => { window.__state.scene.player.x = 41 * 32; });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__state.player.x > 42 * 32 - 20, null, { timeout: 15000 });
  await page.keyboard.up('ArrowRight');
  await key('e', 800);
  if ((await s()).area !== 'sunny_pasture') fail('Did not reach Sunny Pasture');
  const nearestDir = () => page.evaluate(() => {
    const sc = window.__game.scene.getScene('World');
    const alive = sc.monsters.filter((m) => m.alive);
    if (!alive.length) return 0;
    const m = alive.reduce((a, b) => (Math.abs(a.x - sc.player.x) < Math.abs(b.x - sc.player.x) ? a : b));
    const dx = m.x - sc.player.x;
    return Math.abs(dx) < 50 ? (dx < 0 ? -0.1 : 0.1) : Math.sign(dx);
  });
  const xpBefore = (await s()).xp + (await s()).level * 1000;
  for (let i = 0; i < 50; i++) {
    const dir = await nearestDir();
    const k = dir < 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k); await page.waitForTimeout(Math.abs(dir) < 1 ? 30 : 250); await page.keyboard.up(k);
    await page.keyboard.down('f'); await page.waitForTimeout(500); await page.keyboard.up('f');
    await page.keyboard.press('1');
    await page.keyboard.press('e');
    if (i === 20) await shot('pasture-combat');
  }
  const end = await s();
  console.log('after fighting:', end);
  if (end.xp + end.level * 1000 <= xpBefore) fail('Gained no XP — combat may be broken');
  await page.screenshot({ path: 'smoke-screenshot.png' });

  // ── Reset must wipe everything and not let beforeunload rewrite the old save ──
  const dirty = await s();
  if (dirty.coins === 0 && dirty.xp === 0 && !dirty.cheated) fail(`pre-reset state is already fresh: ${JSON.stringify(dirty)}`);
  await key('`');
  await page.keyboard.type('reset');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }),
    key('Enter'),
  ]);
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const freshOf = async () => page.evaluate(() => {
    const p = window.__state.player;
    return {
      area: p.area, level: p.level, xp: p.xp, coins: p.coins, cheated: p.cheated,
      unspent: p.unspent, inv: { ...p.inventory }, storage: { ...p.storage },
      ranks: { ...p.skillRanks }, flags: { ...p.questFlags },
      keys: Object.keys(localStorage).filter((k) => k.startsWith('meadows')),
    };
  });
  let fresh = await freshOf();
  const isFresh = (f) => f.level === 1 && f.coins === 0 && f.xp === 0 && !f.cheated
    && f.area === 'meadow_town' && !Object.keys(f.inv).length && !Object.keys(f.storage).length
    && (f.ranks.power_strike ?? 0) === 0;
  if (!isFresh(fresh)) fail(`console reset did not start fresh: ${JSON.stringify(fresh)}`);
  console.log('console reset ok:', fresh);

  // Menu: dirty the save, Esc → New game → Enter (or Y) confirms
  await page.evaluate(() => {
    const p = window.__state.player;
    p.coins = 77; p.xp = 15; p.cheated = true;
    p.inventory.meadow_dew = 3; p.storage.meadow_dew = 2;
    window.__state.save();
  });
  await key('Escape', 200);
  if (!(await visible()).includes('pause')) fail('Esc did not open the menu for reset');
  await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 250);
  if (!(await visible()).includes('confirm')) fail('New game did not ask to confirm');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }),
    key('y'),
  ]);
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  await page.waitForTimeout(400);
  fresh = await freshOf();
  if (!isFresh(fresh)) fail(`menu reset (Y) did not start fresh: ${JSON.stringify(fresh)}`);
  console.log('menu reset ok:', fresh);
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('SMOKE OK — no console errors');
