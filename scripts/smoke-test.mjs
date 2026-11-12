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
 *   - journal (J) + The Weight of a Swing: level 2, practice post, 4 Twig to Calden, 3 F hits grant Power Strike r1
 *   - skills (K): Enter trains Power Strike rank 2 (scaled cost) after the quest
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
  if (bar0[0] !== null || bar0.length !== 6 || bar0[4] !== 'meadow_dew' || bar0[5] !== 'clear_dew') fail(`hotbar defaults: ${JSON.stringify(bar0)}`);
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


  // ── Journal (J) + The Weight of a Swing (real town path) ──
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await page.waitForTimeout(80);
  await key('j', 350);
  if (!(await visible()).includes('journal')) fail('J did not open the journal');
  let jText = await page.evaluate(() => document.querySelector('#p-journal')?.innerText ?? '');
  if (!/The Weight of a Swing/i.test(jText)) fail(`journal missing Weight quest: ${jText.slice(0, 400)}`);
  await shot('journal');
  await key('Escape');
  if ((await visible()).length) fail(`Esc did not close journal: ${JSON.stringify(await visible())}`);

  await key('`');
  await page.keyboard.type('level 2'); await key('Enter');
  await key('Escape', 150);
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  const q1 = await page.evaluate(() => window.__state.player.questLog?.ql_weight);
  if (!q1 || q1.done || q1.step !== 1) fail(`level 2 did not start Weight: ${JSON.stringify(q1)}`);
  const track = await page.evaluate(() => document.querySelector('#quest-track')?.innerText ?? '');
  if (!/practice post/i.test(track)) fail(`quest tracker missing: ${track}`);
  console.log('journal start ok:', q1, track);

  // Practice post (tile 40), E for step 1
  await page.evaluate(() => { window.__state.scene.player.x = 40 * 32; });
  await page.waitForTimeout(200);
  await key('e', 400);
  const q2 = await page.evaluate(() => window.__state.player.questLog?.ql_weight);
  if (!q2 || q2.step !== 2) fail(`E at the post did not advance Weight: ${JSON.stringify(q2)}`);
  await shot('practice-post');

  // 4 Twig to Calden (tile 21)
  await key('`');
  await page.keyboard.type('item twig 4'); await key('Enter');
  await key('Escape', 150);
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await page.evaluate(() => { window.__state.scene.player.x = 21 * 32; });
  await page.waitForTimeout(200);
  await key('e', 400);
  if (!(await visible()).includes('dialog')) fail('Calden did not open a quest dialog for the Twig turn-in');
  const dlg = await page.evaluate(() => document.querySelector('#p-dialog')?.innerText ?? '');
  if (!/Twig|practice|blow|That will do/i.test(dlg)) fail(`Calden turn-in dialog unexpected: ${dlg.slice(0, 400)}`);
  await shot('calden-quest');
  await key('Enter', 250);
  const q3 = await page.evaluate(() => ({ q: window.__state.player.questLog?.ql_weight, twig: window.__state.player.inventory.twig ?? 0 }));
  if (!q3.q || q3.q.step !== 3) fail(`Twig turn-in did not advance: ${JSON.stringify(q3)}`);
  if (q3.twig !== 0) fail(`Twigs were not consumed: ${JSON.stringify(q3)}`);

  // 3 basic F hits on the post
  await page.evaluate(() => { window.__state.scene.player.x = 40 * 32; });
  await page.waitForTimeout(150);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('f'); await page.waitForTimeout(200); await page.keyboard.up('f');
    await page.waitForTimeout(900);
  }
  const done = await page.evaluate(() => ({
    q: window.__state.player.questLog?.ql_weight,
    rank: window.__state.player.skillRanks.power_strike ?? 0,
    bar: [...window.__state.player.skillBar],
    me: window.__state.player.inventory.monster_essence ?? 0,
  }));
  if (!done.q?.done) fail(`3 F hits did not complete Weight: ${JSON.stringify(done)}`);
  if (done.rank !== 1) fail(`Power Strike was not granted at rank 1: ${JSON.stringify(done)}`);
  if (!done.bar.includes('power_strike')) fail(`Power Strike was not auto-bound: ${JSON.stringify(done)}`);
  if (done.me !== 8) fail(`Weight reward ME x8 missing: ${JSON.stringify(done)}`);
  await shot('quest-complete');
  console.log('weight quest ok:', done);

  // ── Skill training (K): Enter trains Power Strike rank 2, pays the scaled cost ──
  // r2 = round(r1 × 1.6): ME 48, scrolls 8, 32c. Reward left 8 ME, so give 40 more.
  await key('`');
  await page.keyboard.type('item monster_essence 40'); await key('Enter');
  await page.keyboard.type('item training_scroll 8'); await key('Enter');
  await key('Escape');
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await page.waitForTimeout(100);
  await key('k', 350);
  if (!(await visible()).includes('skills')) fail('K did not open the skills window');
  const sk = await page.evaluate(() => document.querySelector('#p-skills .sel')?.dataset.skill);
  if (sk !== 'power_strike') fail(`skills default is ${sk}`);
  const skillText = await page.evaluate(() => document.querySelector('#p-skills')?.innerText ?? '');
  if (/Intentionally modest|Rebalanced down|Available from level 1|Clearly stronger than|Most expensive|opens mid|opens early|opens late|Capstone/i.test(skillText)) fail(`skill UI shows design notes: ${skillText.slice(0, 400)}`);
  if (!/A heavy blow that hits harder/i.test(skillText)) fail(`skill UI missing player desc: ${skillText.slice(0, 400)}`);
  const beforeTrain = await page.evaluate(() => ({ coins: window.__state.player.coins, me: window.__state.player.inventory.monster_essence ?? 0, sc: window.__state.player.inventory.training_scroll ?? 0 }));
  await key('Enter', 400);
  const ranks = await page.evaluate(() => ({ ...window.__state.player.skillRanks, coins: window.__state.player.coins, me: window.__state.player.inventory.monster_essence ?? 0, sc: window.__state.player.inventory.training_scroll ?? 0, bar: [...window.__state.player.skillBar] }));
  if (ranks.power_strike !== 2) fail(`train did not raise Power Strike to r2: ${JSON.stringify(ranks)}`);
  if (ranks.me !== beforeTrain.me - 48 || ranks.sc !== beforeTrain.sc - 8 || ranks.coins !== beforeTrain.coins - 32) {
    fail(`train r2 did not pay scaled cost: ${JSON.stringify({ ranks, beforeTrain })}`);
  }
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

  // ── Dirt Banks: east portal from the pasture, mobs, whoDrops, west portal back ──
  // A pasture fight may have left us dead (input is locked until town respawn).
  if ((await s()).hp <= 0) {
    await page.waitForFunction(() => window.__state.player.area === 'meadow_town' && window.__state.player.hp > 0, null, { timeout: 10000 });
  }
  await key('`');
  await page.keyboard.type('heal'); await key('Enter');
  await page.keyboard.type('god'); await key('Enter');
  await page.keyboard.type('tp sunny_pasture'); await key('Enter');
  await key('Escape', 500);
  await page.waitForFunction(() => window.__state.player.area === 'sunny_pasture' && window.__state.player.hp > 0 && window.__game?.scene.isActive('World'), null, { timeout: 10000 });
  await page.evaluate(() => { window.__state.scene.player.x = 127 * 32; });
  await key('e', 900);
  if ((await s()).area !== 'dirt_banks') fail(`east portal did not reach Dirt Banks: ${JSON.stringify(await s())}`);
  const banksMobs = await page.evaluate(() => {
    const sc = window.__game.scene.getScene('World');
    const alive = sc.monsters.filter((m) => m.alive);
    return { ids: [...new Set(alive.map((m) => m.def.id))].sort(), n: alive.length };
  });
  for (const id of ['burrow_mole', 'earth_sprite', 'ember_beetle']) {
    if (!banksMobs.ids.includes(id)) fail(`Dirt Banks missing ${id}: ${JSON.stringify(banksMobs)}`);
  }
  if (banksMobs.n < 10) fail(`Dirt Banks spawn count low: ${JSON.stringify(banksMobs)}`);
  await shot('dirt-banks');
  // a few swings for a combat screenshot
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene('World');
    const m = sc.monsters.find((x) => x.alive);
    if (m) sc.player.x = m.x - 36;
  });
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('f'); await page.waitForTimeout(400); await page.keyboard.up('f');
    await page.keyboard.press('1');
  }
  await shot('dirt-banks-combat');
  await key('`');
  await page.keyboard.type('whodrops stone club'); await key('Enter', 200);
  await page.keyboard.type('whodrops dry root'); await key('Enter', 200);
  const who2 = await page.evaluate(() => document.querySelector('#console-out')?.innerText ?? '');
  if (!/Burrow Mole/i.test(who2) || !/0\.24%/.test(who2)) fail(`whodrops stone club: ${who2.slice(-500)}`);
  if (!/Dry Root/i.test(who2) || !/32%/.test(who2) || !/Wool Sheep/i.test(who2)) fail(`whodrops dry root: ${who2.slice(-500)}`);
  await key('Escape', 200);
  await page.evaluate(() => { window.__state.scene.player.x = 2 * 32; });
  await key('e', 900);
  if ((await s()).area !== 'sunny_pasture') fail(`west portal did not return to Sunny Pasture: ${JSON.stringify(await s())}`);
  console.log('dirt banks ok:', banksMobs);

  // ── Named foe (Wool-Shoulder) + Root Lash / Dig In learn ──
  // Force the Blood Up kill-step (they may already have walked this path).
  await page.evaluate(() => {
    const p = window.__state.player;
    p.questLog ??= {};
    p.questLog.ql_blood = { step: 3, done: false, killed: false };
    window.__state.save();
  });
  await key('`');
  await page.keyboard.type('tp sunny_pasture'); await key('Enter');
  await key('Escape', 400);
  await page.waitForFunction(() => window.__state.player.area === 'sunny_pasture' && window.__game?.scene.isActive('World'), null, { timeout: 10000 });
  await page.evaluate(() => { window.__state.scene.player.x = 118 * 32; });
  await page.waitForTimeout(500);
  const named = await page.evaluate(() => {
    const sc = window.__game.scene.getScene('World');
    return sc.monsters.filter((m) => m.alive).map((m) => m.def.id);
  });
  if (!named.includes('wool_shoulder')) fail(`Wool-Shoulder did not spawn on kill-step: ${JSON.stringify(named)}`);
  await shot('wool-shoulder');
  console.log('named spawn ok:', named);

  await key('`');
  await page.keyboard.type('level 5'); await key('Enter');
  await page.keyboard.type('heal'); await key('Enter');
  await key('Escape', 150);
  await page.evaluate(() => {
    const p = window.__state.player;
    p.stats.STR = 7;
    p.hp = 200; // will clamp on next command
    window.__game.events.emit('close-all');
  });
  await key('`');
  for (const line of [
    'item dry_root 30', 'item tough_root 2', 'item earth_grit 10',
    'item nature_essence 36', 'copper 50',
  ]) { await page.keyboard.type(line); await key('Enter'); }
  await key('Escape', 150);
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  // Back to town so Calden / K is a fair learn
  await key('`');
  await page.keyboard.type('tp meadow_town'); await key('Enter');
  await key('Escape', 400);
  await page.waitForFunction(() => window.__state.player.area === 'meadow_town', null, { timeout: 8000 });
  await key('k', 350);
  const rootSel = await page.evaluate(() => {
    const t = document.querySelector('#p-skills [data-skill="root_lash"]');
    if (!t) return null;
    t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    return t.dataset.skill;
  });
  if (rootSel !== 'root_lash') fail(`Root Lash not visible at lv5 STR7: ${rootSel}`);
  await key('Enter', 400);
  const nature = await page.evaluate(() => ({
    root: window.__state.player.skillRanks.root_lash ?? 0,
    bar: [...window.__state.player.skillBar],
    text: document.querySelector('#p-skills')?.innerText ?? '',
  }));
  if (nature.root !== 1) fail(`Root Lash did not learn: ${JSON.stringify(nature)}`);
  if (!/Root Lash/i.test(nature.text)) fail('Root Lash preview missing');
  await shot('root-lash');
  await key('Escape');
  console.log('root lash ok:', nature.root);

  // ── Passive tree (T) + Ila 10:1 bench ──
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await key('t', 350);
  if (!(await visible()).includes('passives')) fail('T did not open the passive tree');
  const treeText = await page.evaluate(() => document.querySelector('#p-passives')?.innerText ?? '');
  if (!/Nature Essence/i.test(treeText) || !/Forager/i.test(treeText)) fail(`Nature tree missing nodes: ${treeText.slice(0, 400)}`);
  if (/Item sources|DEPRECATED|gathering slots|To be tuned/i.test(treeText)) fail(`passive UI shows design notes: ${treeText.slice(0, 400)}`);
  await shot('passive-tree');
  await key('Tab', 200);
  const elemText = await page.evaluate(() => document.querySelector('#p-passives')?.innerText ?? '');
  if (!/Elemental Essence/i.test(elemText) || !/Attunement/i.test(elemText)) fail(`Elemental tab missing: ${elemText.slice(0, 400)}`);
  if (/Spirit Essence|Hunter/i.test(elemText) && !/Elemental/.test(elemText)) fail('Spiritual/Luck should be parked');
  await shot('passive-elemental');
  await key('Tab', 150); // back to Nature
  await key('Escape');

  await key('`');
  for (const line of [
    'item pebble 50', 'item bark 40', 'item earth_shard 5',
    'item nature_essence 50', 'copper 30',
  ]) { await page.keyboard.type(line); await key('Enter'); }
  await key('Escape', 150);
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await key('t', 350);
  await key('Enter', 400);
  const upgrading = await page.evaluate(() => window.__state.player.passiveUpgrade);
  if (!upgrading || upgrading.nodeId !== 'nature_prod' || upgrading.targetRank !== 1) fail(`upgrade did not start: ${JSON.stringify(upgrading)}`);
  await shot('passive-upgrade');
  await key('Escape');
  await key('`');
  await page.keyboard.type('passive finish'); await key('Enter');
  await key('Escape', 150);
  const r1 = await page.evaluate(() => ({
    rank: window.__state.player.passiveRanks?.nature_prod ?? 0,
    up: window.__state.player.passiveUpgrade ?? null,
  }));
  if (r1.rank !== 1 || r1.up) fail(`finish did not complete Nature prod r1: ${JSON.stringify(r1)}`);

  // 80 minutes at 1.5/h = exactly 2 Nature Essence
  const neBefore = await page.evaluate(() => window.__state.player.inventory.nature_essence ?? 0);
  await key('`');
  await page.keyboard.type(`passive wait ${80 / 60}`); await key('Enter'); // 80 min at 1.5/h = 2
  await key('Escape', 150);
  const neAfter = await page.evaluate(() => ({
    ne: window.__state.player.inventory.nature_essence ?? 0,
    frac: window.__state.player.passiveFrac?.nature_prod ?? 0,
    report: window.__state.player.passiveReport,
  }));
  const gained = neAfter.ne - neBefore;
  if (gained !== 2) fail(`expected 2 essence in 80min at 1.5/h, got ${gained}: ${JSON.stringify({ neBefore, neAfter })}`);
  await shot('passive-yield');
  console.log('passives ok:', r1, 'gained', gained);

  // Ila 10:1 — Dry Root and Twig
  await page.evaluate(() => { window.__state.scene.player.x = 27 * 32; window.__game.events.emit('close-all'); });
  await page.waitForTimeout(200);
  await key('`');
  await page.keyboard.type('item twig 20'); await key('Enter');
  await page.keyboard.type('item dry_root 10'); await key('Enter');
  await key('Escape', 150);
  await page.evaluate(() => window.__game?.events?.emit('close-all'));
  await key('e', 400);
  if (!(await visible()).includes('exchange')) fail('E at Ila did not open the exchange bench');
  const exText = await page.evaluate(() => document.querySelector('#p-exchange')?.innerText ?? '');
  if (!/Twig/i.test(exText) || !/Dry Root/i.test(exText)) fail(`exchange missing Twig/Dry Root: ${exText.slice(0, 400)}`);
  await shot('ila-exchange');
  // select twig and Enter
  const traded = await page.evaluate(() => {
    const t = document.querySelector('#p-exchange [data-ex="ex_twig"]');
    if (!t) return null;
    t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    return t.dataset.ex;
  });
  if (traded !== 'ex_twig') fail(`could not select Twig recipe: ${traded}`);
  const beforeEx = await page.evaluate(() => ({
    twig: window.__state.player.inventory.twig ?? 0,
    ne: window.__state.player.inventory.nature_essence ?? 0,
  }));
  await key('Enter', 300);
  const afterEx = await page.evaluate(() => ({
    twig: window.__state.player.inventory.twig ?? 0,
    ne: window.__state.player.inventory.nature_essence ?? 0,
  }));
  if (afterEx.twig !== beforeEx.twig - 10 || afterEx.ne !== beforeEx.ne + 1) fail(`10:1 Twig exchange failed: ${JSON.stringify({ afterEx, beforeEx })}`);
  await key('Escape');
  console.log('ila ok:', afterEx);

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
      ranks: { ...p.skillRanks }, flags: { ...p.questFlags }, log: { ...p.questLog },
      passives: { ...p.passiveRanks },
      keys: Object.keys(localStorage).filter((k) => k.startsWith('meadows')),
    };
  });
  let fresh = await freshOf();
  const isFresh = (f) => f.level === 1 && f.coins === 0 && f.xp === 0 && !f.cheated
    && f.area === 'meadow_town' && !Object.keys(f.inv).length && !Object.keys(f.storage).length
    && (f.ranks.power_strike ?? 0) === 0 && !Object.values(f.passives ?? {}).some((n) => n);
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
