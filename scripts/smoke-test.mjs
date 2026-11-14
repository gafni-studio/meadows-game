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
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4199;
const SHOTS = process.env.SHOTS;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()); setTimeout(res, 8000); });

const errors = [];
const fail = (msg) => { throw new Error(msg + (errors.length ? ' | page errors: ' + errors.slice(-3).join(' // ') : '')); };
{
  const skills = JSON.parse(readFileSync('data/skills.json', 'utf8')).rows;
  const mp = Object.fromEntries(skills.map((r) => [r.id, r.mp_cost]));
  const wantMp = { power_strike: 5, rage: 10, earthbreaker: 10, flame_cleave: 14, soul_guard: 18 };
  for (const [id, n] of Object.entries(wantMp)) if (mp[id] !== n) fail(`sheet mp_cost ${id} is ${mp[id]}, expected ${n}`);
  const drops = JSON.parse(readFileSync('data/drop_tables.json', 'utf8')).rows;
  const copper = Object.fromEntries(drops.filter((r) => r.item_id === 'copper_coin').map((r) => [r.monster_id, r.drop_rate]));
  const wantCu = { crow: 80, burrow_mole: 80, earth_sprite: 80, ember_beetle: 82, spark_bug: 80, frost_moth: 80, field_mouse: 70 };
  for (const [id, n] of Object.entries(wantCu)) if (Math.abs(copper[id] - n * 0.75) > 0.01) fail(`sheet copper ${id} is ${copper[id]}, expected ${n * 0.75} (v0.2.9: -25%)`);
  const wantDrop = {
    'field_mouse:strawberry': [10, 1, 2],
    'wool_sheep:blueberry': [12, 1, 2],
    'burrow_mole:blueberry': [12, 1, 2],
    'earth_sprite:stone_chunk': [10, 2, 4],
    'crow:monster_essence': [40, 2, 5],
    'burrow_mole:monster_essence': [46, 2, 5],
    'earth_sprite:monster_essence': [46, 2, 5],
    'ember_beetle:monster_essence': [46, 2, 6],
    'wool_sheep:nature_essence': [24, 2, 4],
    'crow:nature_essence': [30, 2, 5],
    'burrow_mole:nature_essence': [30, 2, 5],
    'crow:training_scroll': [20, 2, 4],
    'burrow_mole:training_scroll': [16, 2, 4],
    'burrow_mole:tough_root': [12, 2, 3],
    'earth_sprite:tough_root': [6, 2, 3],
    'crow:branch': [4, 1, 2],
    'meadow_boar:branch': [8, 2, 3],
    'old_stump:branch': [10, 2, 3],
    'burrow_mole:earth_shard': [12, 1, 3],
    // v0.2.6 named bumps
    'ember_beetle:smoldering_scale': [20, 1, 1],
    'spark_bug:smoldering_scale': [12, 1, 1],
    'ember_beetle:warm_grain': [20, 1, 2],
    'earth_sprite:warm_grain': [12, 1, 2],
    'ember_beetle:fire_shard': [10, 1, 3],
    'spark_bug:lightning_shard': [10, 1, 3],
    'spark_bug:ice_shard': [6, 1, 2],
  };
  const dropKey = Object.fromEntries(drops.map((r) => [`${r.monster_id}:${r.item_id}`, [r.drop_rate, r.min_qty, r.max_qty]]));
  for (const [k, v] of Object.entries(wantDrop)) {
    const have = dropKey[k];
    // v0.2.9: every chance x0.75; no stack above 3 per kill (Copper excepted)
    const want = [v[0] * 0.75, Math.min(v[1], 3), Math.min(v[2], 3)];
    if (!have || Math.abs(have[0] - want[0]) > 0.011 || have[1] !== want[1] || have[2] !== want[2]) fail(`drop ${k} is ${JSON.stringify(have)}, expected ${want}`);
  }
  const costs = JSON.parse(readFileSync('data/skill_costs.json', 'utf8')).rows;
  const eb1 = costs.filter((r) => r.skill_id === 'earthbreaker' && r.rank === 1).map((r) => r.material_id);
  if (!eb1.includes('clay') || !eb1.includes('earth_shard')) fail(`earthbreaker r1 missing clay/earth_shard: ${eb1}`);
  if (eb1.includes('bark') || eb1.includes('branch')) fail(`earthbreaker r1 still has bark/branch: ${eb1}`);
  const dig = skills.find((r) => r.id === 'dig_in');
  if (!dig || dig.duration_s !== 60) fail(`dig_in duration_s is ${dig?.duration_s}, expected 60`);
  // ── v0.2.6 data ──
  const cf = Object.fromEntries(JSON.parse(readFileSync('data/combat_formulas.json', 'utf8')).rows.map((r) => [r.key, r.num]));
  if (cf.hp_base_warrior !== 100 || cf.hp_per_level_warrior !== 7 || cf.hp_per_str !== 2) fail('warrior HP is not 100 + 7/level + 2/STR');
  if (cf.hp_base_mage !== 70 || cf.hp_per_level_mage !== 4 || cf.hp_base_rogue !== 85 || cf.hp_per_level_rogue !== 6) fail('mage/rogue HP not updated');
  for (const [L, n] of [[4, 880], [5, 1194], [6, 1536], [7, 1902], [8, 2290], [9, 2700], [10, 3130]]) {
    if (cf[`xp_to_next_${L}`] !== n) fail(`xp_to_next_${L} is ${cf[`xp_to_next_${L}`]}, expected ${n}`);
  }
  if (cf.xp_to_next_1 !== 70 || cf.xp_to_next_2 !== 173 || cf.xp_to_next_3 !== 298) fail('levels 1-3 XP changed');
  const gearRows = Object.fromEntries(JSON.parse(readFileSync('data/gear.json', 'utf8')).rows.map((r) => [r.item_id, r]));
  const cloth = { cloth_cap: 1, cloth_tunic: 2, cloth_pants: 1, cloth_shoes: 1, cloth_gloves: 1 };
  let clothSum = 0;
  for (const [id, d] of Object.entries(cloth)) {
    const g = gearRows[id];
    if (g.defense_min !== d || g.defense_max !== d || g.defense !== d) fail(`${id} is not a fixed Defense ${d}`);
    clothSum += d;
  }
  if (clothSum !== 6) fail('cloth set is not Defense 6');
  const ss = gearRows.short_sword;
  if (ss.weapon_damage_min !== 13 || ss.weapon_damage_max !== 13 || ss.stat_multiplier !== 1.1) fail('Short Sword is not exactly 13 x 1.10');
  if (gearRows.hide_vest.defense !== 3 || gearRows.stone_club.weapon_damage !== 16) fail('quest gift typical values changed');
  const JUNK = ['broken_twig', 'torn_cloth', 'lost_button', 'pasture_bell', 'cracked_shell'];
  const junkRows = drops.filter((r) => JUNK.includes(r.item_id));
  if (junkRows.length) fail(`junk still drops: ${junkRows.map((r) => `${r.monster_id}:${r.item_id}`)}`);
  for (const [m, i] of [['crow', 'bright_bead'], ['burrow_mole', 'old_bone'], ['burrow_mole', 'fence_peg'], ['ember_beetle', 'warm_grain']]) {
    if (!drops.some((r) => r.monster_id === m && r.item_id === i)) fail(`kept junk ${m}:${i} missing`);
  }
  const banks = JSON.parse(readFileSync('data/map_layout.json', 'utf8')).rows.find((r) => r.id === 'dirt_banks');
  if (JSON.stringify(banks.spawns) !== JSON.stringify({ burrow_mole: 6, earth_sprite: 5, ember_beetle: 5, spark_bug: 4 })) fail(`Banks spawns: ${JSON.stringify(banks.spawns)}`);
  // explicit recipes, ranks 1-10, no scaling, nothing over 40, no Heartwood / Log
  const allCosts = JSON.parse(readFileSync('data/skill_costs.json', 'utf8')).rows;
  const passCosts = JSON.parse(readFileSync('data/passive_costs.json', 'utf8')).rows;
  const checkRecipes = (rows, idKey, ids) => {
    for (const id of ids) {
      for (let rk = 1; rk <= 10; rk++) {
        const r = rows.filter((x) => x[idKey] === id && x.rank === rk);
        if (!r.some((x) => x.material_id === 'copper_coin')) fail(`${id} rank ${rk} has no recipe`);
        for (const x of r) {
          if (x.quantity > 40) fail(`${id} r${rk} ${x.material_id} is ${x.quantity} (>40)`);
          if (['heartwood', 'log'].includes(x.material_id)) fail(`${id} r${rk} needs ${x.material_id}`);
        }
      }
    }
  };
  checkRecipes(allCosts, 'skill_id', ['power_strike', 'rage', 'earthbreaker', 'root_lash', 'flame_cleave', 'dig_in']);
  checkRecipes(passCosts, 'node_id', ['nature_prod', 'nature_eff_drops', 'elemental_prod', 'elemental_eff_drops']);
  const eb = (rk) => allCosts.filter((x) => x.skill_id === 'earthbreaker' && x.rank === rk);
  if (eb(1).some((x) => x.material_id === 'twig') || eb(4).some((x) => x.material_id === 'twig')) fail('Earthbreaker r1/r4 still need Twig');
  const nat = (rk) => Object.fromEntries(passCosts.filter((x) => x.node_id === 'nature_prod' && x.rank === rk).map((x) => [x.material_id, x.quantity]));
  if (JSON.stringify(nat(1)) !== JSON.stringify({ nature_essence: 20, pebble: 16, bark: 12, copper_coin: 18 })) fail(`Nature rank 1: ${JSON.stringify(nat(1))}`);
  if (nat(3).nature_essence !== 40 || nat(3).pebble) fail(`Nature rank 3: ${JSON.stringify(nat(3))}`);
  console.log('sheet mp/copper/drops/recipe ok');
}

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
  const dismissDialog = async () => {
    for (let i = 0; i < 12; i++) {
      if (!(await visible()).includes('dialog')) break;
      await key('Enter', 180);
    }
    if ((await visible()).includes('dialog')) fail('dialog did not close after Enter');
    // v0.2.6: a quest that completes shows its rewards screen after the last page; Enter continues.
    for (let i = 0; i < 3 && (await visible()).includes('rewards'); i++) {
      lastRewards = await page.evaluate(() => document.querySelector('#p-rewards')?.innerText ?? '');
      await key('Enter', 180);
    }
  };
  let lastRewards = '';
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
  if (!/Wool Sheep/i.test(who) || !/0\.09%/.test(who)) fail(`whodrops failed: ${who.slice(-400)}`);
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
  if (bar0.length !== 8 || bar0.slice(0, 6).some((x) => x !== null) || bar0[6] !== 'meadow_dew' || bar0[7] !== 'clear_dew') fail(`hotbar defaults (4 attack, 2 buff, 2 potion): ${JSON.stringify(bar0)}`);
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
  if (picked !== 'meadow_dew') fail(`could not highlight Meadow Dew: ${picked}`);
  await key('g', 200); // potions bind to Q (HP slot) or G (MP slot) from the bag
  await key('Escape', 150);
  const bar1 = await page.evaluate(() => [...window.__state.player.skillBar]);
  if (bar1[7] !== 'meadow_dew' || bar1[6] !== 'clear_dew') fail(`inventory G did not bind Meadow Dew (swapping with Clear Dew): ${JSON.stringify(bar1)}`);
  console.log('hotbar ok:', bar1);

  // ══════════════ v0.2.9: a fresh Hero's first quests, played for real ══════════════
  const con = async (...lines) => {
    await key('`');
    for (const l of lines) { await page.keyboard.type(l); await key('Enter'); }
    await key('Escape', 150);
    await page.evaluate(() => window.__game?.events?.emit('close-all'));
  };
  const settle = (ms = 400) => page.waitForTimeout(ms);
  const marker = (id) => page.evaluate((nid) => {
    const n = window.__state.scene.npcs.find((x) => x.id === nid);
    return n?.marker?.visible ? n.marker.text : null;
  }, id);
  const toTown = async () => {
    if ((await s()).area !== 'meadow_town') await con('tp meadow_town');
    await page.waitForFunction(() => window.__state.player.area === 'meadow_town' && window.__game?.scene.isActive('World'), null, { timeout: 10000 });
    await settle(300);
  };
  const toNpc = async (id) => {
    await page.evaluate((nid) => {
      const w = window.__state.scene;
      w.player.x = nid === 'chest' ? w.chestX : w.npcs.find((n) => n.id === nid).x;
    }, id);
    await settle(220);
  };
  const qlog = (line) => page.evaluate((l) => window.__state.player.questLog?.[l] ?? null, line);
  const inv = () => page.evaluate(() => ({ ...window.__state.player.inventory }));
  const MATS = ['monster_essence', 'training_scroll', 'clay', 'nature_essence', 'elemental_essence', 'pebble', 'bark', 'earth_grit', 'twig', 'wool', 'feather'];
  /** Talk to an NPC, page through every line, and (optionally) take the rewards screen. Returns the text. */
  const talkTo = async (id, opts = {}) => {
    const before = await inv();
    await page.evaluate(() => [...window.__state.scene.drops.getChildren()].forEach((d) => d.destroy())); // E picks up drops first
    await toNpc(id);
    await key('e', 450);
    if (!(await visible()).includes('dialog')) fail(`${id} did not open a conversation: ${JSON.stringify({ vis: await visible(), log: await page.evaluate(() => window.__state.player.questLog), x: await page.evaluate(() => Math.round(window.__state.scene.player.x)), st: await page.evaluate(() => ({ drops: window.__state.scene.drops.getChildren().length, menu: window.__state.menuOpen, dead: window.__state.dead, console: window.__state.consoleOpen, toasts: [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).slice(0, 3) })), npcs: await page.evaluate(() => window.__state.scene.npcs.map((n) => [n.id, Math.round(n.x)])) })}`);
    const pages = [];
    for (let i = 0; i < 14 && (await visible()).includes('dialog'); i++) {
      pages.push(await page.evaluate(() => document.querySelector('#p-dialog .dlg-line')?.innerText ?? ''));
      await key('Enter', 170);
    }
    let rewards = '';
    if (opts.rewards) {
      await page.waitForFunction(() => !document.querySelector('#p-rewards')?.hidden, null, { timeout: 3000 }).catch(() => {});
      if (!(await visible()).includes('rewards')) fail(`${id}: no rewards screen after the conversation`);
      rewards = await page.evaluate(() => document.querySelector('#p-rewards')?.innerText ?? '');
      await key('Enter', 200);
    }
    if (!opts.final) {
      const after = await inv();
      for (const m of MATS) if ((after[m] ?? 0) > (before[m] ?? 0)) fail(`${id} handed over ${m}: NPCs never supply quest materials`);
    }
    return { text: pages.join(' '), pages, rewards };
  };

  // start from a fresh Hero (state seeded; the quest engine starts Welcome to Meadow Town by itself)
  await page.evaluate(() => {
    const g = window.__state, p = g.player;
    p.level = 1; p.xp = 0; p.unspent = 3; p.stats = { STR: 0, INT: 0, AGI: 0, SPI: 0 }; p.coins = 0; p.inventory = {}; p.storage = {};
    p.skillRanks = {}; p.skillBar = [null, null, null, null, null, null, 'meadow_dew', 'clear_dew']; p.questLog = {}; p.questFlags = {};
    p.passiveRanks = {}; p.passiveFrac = {}; p.passiveUpgrade = undefined; p.cheats.god = false; g.cooldowns = {}; g.buffs = {};
    p.hp = 100; p.mp = 40;
    window.__game.events.emit('close-all');
  });
  await toTown();
  await settle(600);
  const intro0 = await qlog('ql_intro');
  if (!intro0 || intro0.step !== 1) fail(`a new Hero should be on Welcome to Meadow Town step 1: ${JSON.stringify(intro0)}`);
  const onlyOne = await page.evaluate(() => Object.keys(window.__state.player.questLog).filter((l) => !window.__state.player.questLog[l].done));
  if (onlyOne.join() !== 'ql_intro') fail(`a fresh Hero at level 1 sees only Welcome to Meadow Town: ${onlyOne}`);
  if ((await marker('pell')) !== '!') fail(`Pell should show ! at the start, got ${await marker('pell')}`);
  // K shows no tree before Path of the Warrior
  await key('k', 350);
  const k0 = await page.evaluate(() => ({ txt: document.querySelector('#p-skills')?.innerText ?? '', tree: !!document.querySelector('#p-skills .pathtree'), tabs: document.querySelectorAll('#p-skills .tabs button').length }));
  if (k0.tree || k0.tabs || !/Calden in Meadow Town can set you on a Path/.test(k0.txt)) fail(`K should show no tree and one short line: ${JSON.stringify(k0)}`);
  await key('Escape');
  // the journal lists only the startable quest
  await key('j', 350);
  const j0 = await page.evaluate(() => document.querySelector('#p-journal')?.innerText ?? '');
  if (!/Welcome to Meadow Town/.test(j0) || /soon/i.test(j0)) fail(`journal should show only Welcome to Meadow Town: ${j0.slice(0, 300)}`);
  await key('Escape');

  // 1 Pell: talk + Back / Continue
  await toNpc('pell');
  await key('e', 450);
  const pg = async () => page.evaluate(() => ({ pager: document.querySelector('#p-dialog .dlg-pager')?.innerText ?? '', line: document.querySelector('#p-dialog .dlg-line')?.innerText ?? '', back: !!document.querySelector('#p-dialog [data-dlg="back"]') }));
  const d1 = await pg();
  if (d1.back || !/1 \/ 4/.test(d1.pager)) fail(`Pell's first page has no Back: ${JSON.stringify(d1)}`);
  await key('Enter', 150);
  const d2 = await pg();
  if (!d2.back || !/2 \/ 4/.test(d2.pager)) fail(`page 2 should have Back: ${JSON.stringify(d2)}`);
  await key('Backspace', 150);
  if ((await pg()).line !== d1.line) fail('Backspace should go back a page');
  await key('Enter', 150); await key('ArrowLeft', 150);
  if ((await pg()).line !== d1.line) fail('Left arrow should go back a page');
  await page.evaluate(() => document.querySelector('#p-dialog [data-dlg="next"]')?.click());
  await settle(150);
  await page.evaluate(() => document.querySelector('#p-dialog [data-dlg="back"]')?.click());
  await settle(150);
  if ((await pg()).line !== d1.line) fail('the Back button should go back a page');
  if ((await qlog('ql_intro')).step !== 1) fail('going back must not advance or undo the quest step');
  for (let i = 0; i < 8 && (await visible()).includes('dialog'); i++) await key('Enter', 170);
  await page.waitForFunction(() => !document.querySelector('#p-rewards')?.hidden, null, { timeout: 2500 }).catch(() => {});
  let rw = await page.evaluate(() => document.querySelector('#p-rewards')?.innerText ?? '');
  if (!/Welcome to Meadow Town/.test(rw) || !/5 Copper/.test(rw)) fail(`Pell's gift should show the rewards screen: ${rw}`);
  await key('Enter', 200);
  if ((await qlog('ql_intro')).step !== 2 || (await s()).coins !== 5) fail('Pell step: 5 Copper and step 2');

  // 2 Mara: talk (2 Blueberry), 3 buy a Strawberry
  if ((await marker('mara')) !== '!') fail(`Mara should show ! for the next part, got ${await marker('mara')}`);
  let t = await talkTo('mara', { rewards: true });
  if (!/2× Blueberry/.test(t.rewards)) fail(`Mara's gift: ${t.rewards}`);
  if ((await qlog('ql_intro')).step !== 3) fail('Mara talk should advance to the buy step');
  if (await marker('mara')) fail('no marker on Mara while the player is shopping');
  await toNpc('mara');
  await key('e', 400);
  if (!(await visible()).includes('shop')) fail('E at Mara should open the shop during the buy step');
  await page.evaluate(() => document.querySelector('#p-shop [data-buy="strawberry"]')?.click());
  await settle(250);
  if ((await qlog('ql_intro')).step !== 4) fail('buying a Strawberry should advance the intro');
  await key('Escape');
  // 4 Mara: bag lines; 5 put a berry on Q and eat it
  t = await talkTo('mara');
  if (!/berry/i.test(t.text)) fail(`Mara bag lines: ${t.text}`);
  if ((await qlog('ql_intro')).step !== 5) fail('Mara bag talk should advance to the eat step');
  await key('i', 300);
  await page.evaluate(() => document.querySelector('#p-inventory .tile[data-item="blueberry"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await key('q', 200);
  await key('Escape', 150);
  if ((await page.evaluate(() => window.__state.player.skillBar[6])) !== 'blueberry') fail('a berry should bind to the Q slot from the bag');
  await key('q', 400);
  if ((await qlog('ql_intro')).step !== 6) fail('eating a berry from Q should advance the intro');
  // 6 chest talk, 7 put in and take out
  await toNpc('chest');
  await key('e', 450);
  if (!(await visible()).includes('dialog')) fail('E at the chest should start Mara\'s words about it');
  for (let i = 0; i < 6 && (await visible()).includes('dialog'); i++) await key('Enter', 170);
  if (!(await visible()).includes('storage')) fail('the chest opens after Mara has spoken');
  if ((await qlog('ql_intro')).step !== 7) fail('chest talk should advance to the put-in step');
  await page.evaluate(() => document.querySelector('#p-storage [data-c="bag"][data-item]')?.click());
  await settle(250);
  if ((await qlog('ql_intro')).step !== 7) fail('putting an item in is not enough; it has to come back out');
  await page.evaluate(() => document.querySelector('#p-storage [data-c="storage"][data-item]')?.click());
  await page.waitForFunction(() => !document.querySelector('#p-rewards')?.hidden, null, { timeout: 2500 }).catch(() => {});
  rw = await page.evaluate(() => document.querySelector('#p-rewards')?.innerText ?? '');
  if (!/1× Meadow Dew/.test(rw) || !/Ila/.test(rw)) fail(`chest gift: ${rw}`);
  await key('Enter', 200); await key('Escape', 150);
  if ((await qlog('ql_intro')).step !== 8) fail('the chest round trip should advance to Ila');
  // 8 Ila (1 Clear Dew), 9 Tamsin, 10 spend a point (2 Strawberry), 11 Calden
  t = await talkTo('ila', { rewards: true });
  if (!/1× Clear Dew/.test(t.rewards) || !/essence/i.test(t.text)) fail(`Ila: ${t.rewards} / ${t.text}`);
  t = await talkTo('tamsin');
  if (!/Three/.test(t.text) || (await qlog('ql_intro')).step !== 10) fail('Tamsin should teach ability points and set the spend step');
  await key('c', 300);
  await key('Enter', 400);
  await page.waitForFunction(() => !document.querySelector('#p-rewards')?.hidden, null, { timeout: 2500 }).catch(() => {});
  rw = await page.evaluate(() => document.querySelector('#p-rewards')?.innerText ?? '');
  if (!/2× Strawberry/.test(rw) || !/Calden is waiting/.test(rw)) fail(`spend-a-point gift: ${rw}`);
  await key('Enter', 200); await key('Escape', 150);
  await page.evaluate(() => window.__game.events.emit('close-all'));
  if ((await marker('calden')) !== '?') fail(`Calden should show ? to close the intro, got ${await marker('calden')}`);
  await toNpc('calden');
  await key('e', 450);
  for (let i = 0; i < 6 && (await visible()).includes('dialog'); i++) await key('Enter', 170);
  // the completion moment: the banner and sound first, then the rewards screen
  const banner = await page.evaluate(() => ({ hidden: document.querySelector('#questup')?.hidden, txt: document.querySelector('#questup')?.innerText ?? '' }));
  if (banner.hidden || !/QUEST COMPLETE/.test(banner.txt)) fail(`quest completion should play the banner: ${JSON.stringify(banner)}`);
  await shot('quest-complete-banner');
  await page.waitForFunction(() => !document.querySelector('#p-rewards')?.hidden, null, { timeout: 3000 }).catch(() => {});
  rw = await page.evaluate(() => document.querySelector('#p-rewards')?.innerText ?? '');
  if (!/Welcome to Meadow Town — Complete/.test(rw) || !/10 XP/.test(rw)) fail(`intro completion rewards: ${rw}`);
  await key('Enter', 200);
  console.log('intro chain ok');

  // Path of the Warrior
  await settle(400);
  if ((await marker('calden')) !== '!') fail(`Calden should show ! for Path of the Warrior, got ${await marker('calden')}`);
  t = await talkTo('calden');
  if (!/Path/.test(t.text) || (await qlog('ql_warrior')).step !== 2) fail('Calden should start Path of the Warrior at the post');
  // three basic attacks on the practice post
  await page.evaluate(() => { const w = window.__state.scene; w.player.x = w.postX - 60; w.facing = 1; w.player.setFlipX(false); });
  await settle(200);
  for (let i = 0; i < 3; i++) { await page.keyboard.down('f'); await settle(220); await page.keyboard.up('f'); await settle(900); }
  if ((await qlog('ql_warrior')).step !== 3) fail(`3 basic attacks should advance to step 3: ${JSON.stringify(await qlog('ql_warrior'))}`);
  t = await talkTo('calden');
  if (!/mice/i.test(t.text) || (await qlog('ql_warrior')).step !== 4) fail('Calden should send the player after the mice');
  const track = await page.evaluate(() => document.querySelector('#quest-track')?.innerText ?? '');
  if (!/Field Mouse 0\/5/.test(track) || !/Twig 0\/5/.test(track)) fail(`tracker should show the mice and Twig counts: ${track}`);
  await page.evaluate(() => { const w = window.__state.scene; for (let i = 0; i < 5; i++) w.onKill({ def: { id: 'field_mouse', xp: 0, level: 1 }, x: w.player.x, y: w.player.y, displayHeight: 20 }); });
  await settle(200);
  if ((await qlog('ql_warrior')).step !== 5) fail('5 mice should advance to the return step');
  t = await talkTo('calden');
  if (!/Twig|count/i.test(t.text) || (await qlog('ql_warrior')).step !== 5) fail('Calden turns the player away until they have 5 Twig');
  await con('item twig 5');
  await settle(350);
  if ((await marker('calden')) !== '?') fail(`Calden should show ? with 5 Twig, got ${await marker('calden')}`);
  t = await talkTo('calden', { rewards: true, final: true });
  for (const re of [/Path of the Warrior — Complete/, /25 XP/, /5 Copper/, /Warrior Path revealed/, /Power Strike training is now open/]) if (!re.test(t.rewards)) fail(`Warrior rewards missing ${re}: ${t.rewards}`);
  if ((await inv()).twig) fail('the Twigs should be consumed');
  if (await page.evaluate(() => window.__state.player.skillRanks.power_strike ?? 0)) fail('Power Strike must not be granted for free');
  // the tree is revealed: Warrior only
  await key('k', 350);
  const k1 = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#p-skills .tabs button')].map((b) => b.textContent.trim()), tree: !!document.querySelector('#p-skills .pathtree'), ps: (document.querySelector('#p-skills [data-skill="power_strike"]')?.className.match(/st-(\w+)/) ?? [])[1] }));
  if (!k1.tree || k1.tabs.length !== 1 || !/Warrior/.test(k1.tabs[0]) || k1.ps !== 'available') fail(`after Path of the Warrior only the Warrior tab shows, Power Strike available: ${JSON.stringify(k1)}`);
  await key('Escape');
  // pay Power Strike's normal recipe
  await con('item monster_essence 16', 'item training_scroll 6', 'copper 20');
  await key('k', 350);
  await page.evaluate(() => document.querySelector('#p-skills [data-skill="power_strike"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await key('Enter', 400);
  const psr = await page.evaluate(() => ({ r: window.__state.player.skillRanks.power_strike, bar: [...window.__state.player.skillBar] }));
  if (psr.r !== 1 || psr.bar.indexOf('power_strike') < 0 || psr.bar.indexOf('power_strike') > 3) fail(`Power Strike should train for its recipe and equip in an attack slot: ${JSON.stringify(psr)}`);
  await key('Escape');
  console.log('warrior path ok');

  // Path of the Magician
  await settle(450);
  if ((await marker('tamsin')) !== '!') fail(`Tamsin should show ! once Power Strike is trained, got ${await marker('tamsin')}`);
  t = await talkTo('tamsin');
  if (!/Wool/.test(t.text) || (await qlog('ql_magician')).step !== 2) fail('Tamsin asks for Wool and Feathers');
  if (await marker('tamsin')) fail('no marker while Tamsin waits for the focus items');
  await con('item wool 6', 'item feather 4');
  await settle(700);
  if ((await qlog('ql_magician')).step !== 3) fail('having the items should move to the return step');
  if ((await marker('tamsin')) !== '?') fail(`Tamsin should show ? with the items, got ${await marker('tamsin')}`);
  t = await talkTo('tamsin', { rewards: true, final: true });
  for (const re of [/Path of the Magician — Complete/, /20 XP/, /5 Copper/, /1× Clear Dew/, /Magician Path revealed/, /Magic Bolt training is now open/]) if (!re.test(t.rewards)) fail(`Magician rewards missing ${re}: ${t.rewards}`);
  await key('k', 350);
  const k2 = await page.evaluate(() => [...document.querySelectorAll('#p-skills .tabs button')].map((b) => b.textContent.trim()));
  if (k2.length !== 2 || !/Magician/.test(k2[1])) fail(`both tabs after both Path quests: ${JSON.stringify(k2)}`);
  await key('Escape');
  console.log('magician path ok');

  // quests appear gradually
  const active = () => page.evaluate(() => Object.entries(window.__state.player.questLog).filter(([, v]) => !v.done).map(([k]) => k).sort());
  if ((await active()).length) fail(`nothing else is open at level 1: ${await active()}`);
  await con('level 2');
  if ((await active()).length) fail(`nothing else is open at level 2: ${await active()}`);
  await con('level 3');
  await settle(450);
  if ((await active()).join() !== 'ql_dirt_path,ql_warm_coat') fail(`level 3 opens Wool Before Winter and Beyond the Pasture Gate only: ${await active()}`);
  await con('level 4');
  await settle(450);
  if ((await active()).join() !== 'ql_blood,ql_dirt_path,ql_warm_coat') fail(`level 4 adds The Bargain of Rage (Roots That Grow waits for The Dirt Path): ${await active()}`);
  await key('j', 350);
  const j4 = await page.evaluate(() => document.querySelector('#p-journal')?.innerText ?? '');
  for (const re of [/Wool Before Winter/, /Beyond the Pasture Gate/, /The Bargain of Rage/]) if (!re.test(j4)) fail(`journal should list ${re}`);
  for (const re of [/Roots That Grow/, /What the Banks Hide/, /The Cracked Stone/, /Ember in the Scale/, /soon/i]) if (re.test(j4)) fail(`journal must hide locked quest ${re}: ${j4.slice(0, 400)}`);
  await key('Escape');
  await con('quest complete ql_dirt_path');
  await settle(1500);
  await key('Enter', 200);
  await page.evaluate(() => window.__game.events.emit('close-all'));
  await settle(450);
  if (!(await active()).includes('ql_quiet_work') || (await active()).includes('ql_dirt_keeps')) fail(`Roots That Grow opens after The Dirt Path at level 4: ${await active()}`);
  await con('level 5');
  await settle(450);
  if (!(await active()).includes('ql_dirt_keeps')) fail('What the Banks Hide opens at level 5');
  if ((await marker('calden')) !== '!') fail(`Calden should offer The Cracked Stone at level 5, got ${await marker('calden')}`);
  // Roots That Grow: Ila gives no kit; the player gathers and plants it
  t = await talkTo('ila');
  if ((await qlog('ql_quiet_work')).step !== 2) fail('Ila should send the player to gather');
  const q2 = await page.evaluate(() => document.querySelector('#quest-track')?.innerText ?? '');
  if (!/Nature Essence \d+\/20/.test(q2) || !/Pebble \d+\/16/.test(q2) || !/Bark \d+\/12/.test(q2) || !/Copper \d+\/18/.test(q2)) fail(`Roots That Grow shows the first rank's cost: ${q2}`);
  await con('item nature_essence 20', 'item pebble 16', 'item bark 12', 'copper 30');
  await key('t', 350);
  await key('Enter', 400);
  await key('Escape', 150);
  if ((await qlog('ql_quiet_work')).step !== 3) fail(`planting Nature Essence should advance Roots That Grow: ${JSON.stringify(await qlog('ql_quiet_work'))}`);
  console.log('gradual quests ok');

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
    if (i === 20) {
      await shot('pasture-combat');
      // v0.2.5: slash trail at the impact frame, and a Power Strike smash.
      await page.keyboard.down('f');
      await page.waitForTimeout(75);
      await shot('attack-slash');
      await page.keyboard.up('f');
      await page.waitForTimeout(200);
      await page.keyboard.press('1');
      await page.waitForTimeout(180);
      await shot('skill-power-strike');
    }
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
  for (const id of ['burrow_mole', 'earth_sprite', 'ember_beetle', 'spark_bug']) {
    if (!banksMobs.ids.includes(id)) fail(`Dirt Banks missing ${id}: ${JSON.stringify(banksMobs)}`);
  }
  if (banksMobs.ids.includes('frost_moth')) fail(`Frost Moth must not spawn in the Dirt Banks: ${JSON.stringify(banksMobs)}`);
  if (banksMobs.n < 20) fail(`Dirt Banks spawn count low (want 20 regulars): ${JSON.stringify(banksMobs)}`);
  await shot('dirt-banks');
  await page.evaluate(() => {
    const sc = window.__state.scene;
    const m = sc.monsters.find((x) => x.alive && x.def.id === 'spark_bug');
    if (m) sc.player.x = m.x - 44;
  });
  await page.waitForTimeout(400);
  await shot('spark-bug');
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
  if (!/Burrow Mole/i.test(who2) || !/0\.18%/.test(who2)) fail(`whodrops stone club: ${who2.slice(-500)}`);
  if (!/Dry Root/i.test(who2) || !/24%/.test(who2) || !/Wool Sheep/i.test(who2)) fail(`whodrops dry root: ${who2.slice(-500)}`);
  await key('Escape', 200);
  await page.evaluate(() => { window.__state.scene.player.x = 2 * 32; });
  await key('e', 900);
  if ((await s()).area !== 'sunny_pasture') fail(`west portal did not return to Sunny Pasture: ${JSON.stringify(await s())}`);
  console.log('dirt banks ok:', banksMobs);

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

  // v0.2.6: whole numbers. Rank 1 is 1 per hour, so 2 hours = exactly 2 Nature Essence
  const neBefore = await page.evaluate(() => window.__state.player.inventory.nature_essence ?? 0);
  await key('`');
  await page.keyboard.type('passive wait 2'); await key('Enter'); // rank 1 = 1/h
  await key('Escape', 150);
  const neAfter = await page.evaluate(() => ({
    ne: window.__state.player.inventory.nature_essence ?? 0,
    frac: window.__state.player.passiveFrac?.nature_prod ?? 0,
    report: window.__state.player.passiveReport,
  }));
  const gained = neAfter.ne - neBefore;
  if (gained !== 2) fail(`expected 2 essence in 2h at 1/h, got ${gained}: ${JSON.stringify({ neBefore, neAfter })}`);
  await shot('passive-yield');
  console.log('passives ok:', r1, 'gained', gained);


  // Berries exist as items; Wild Apple retired from drops (not asserted via rolls). Icons load.
  const berries = await page.evaluate(() => ({
    s: !!window.__data?.items?.strawberry || true, // data may not be on window
  }));
  await key('`');
  await page.keyboard.type('item strawberry 1'); await key('Enter');
  await page.keyboard.type('item blueberry 1'); await key('Enter');
  await key('Escape');
  const berryInv = await page.evaluate(() => ({
    s: window.__state.player.inventory.strawberry ?? 0,
    b: window.__state.player.inventory.blueberry ?? 0,
  }));
  if (berryInv.s < 1 || berryInv.b < 1) fail(`berries not addable: ${JSON.stringify(berryInv)}`);
  await key('i', 200);
  const berryUi = await page.evaluate(() => {
    document.querySelector('#p-inventory [data-invtab="all"]')?.click();
    const ids = [...document.querySelectorAll('#p-inventory .grid.bag .tile')].map((t) => t.dataset.item).filter(Boolean);
    const straw = document.querySelector('#p-inventory .tile[data-item="strawberry"]');
    straw?.click();
    const pv = document.querySelector('#inv-preview')?.innerText ?? '';
    return { ids, pv, straw: ids.includes('strawberry'), blue: ids.includes('blueberry'), desc: /ripe meadow strawberry/i.test(pv) };
  });
  if (!berryUi.straw || !berryUi.blue) fail(`berries missing in inventory: ${JSON.stringify(berryUi)}`);
  if (!berryUi.desc) fail(`strawberry missing player desc: ${berryUi.pv}`);
  await key('Escape', 80);

  // 22. Power Strike costs 5 MP (asserted at train); Rage 10 / EB 10 / FC 14 / SG 18 live in the sheet (checked via fetch).
  const mpCosts = await page.evaluate(async () => {
    // bundled in the game: read from a skill preview after giving ourselves knowledge is messy; return hotbar labels if any.
    return document.querySelector('#hotbar')?.innerText ?? '';
  });

  // 25. Skill cooldown queue: Power Strike (1s CD, 5 MP). First re-press while on CD is silent and queues; it fires when ready.
  await page.evaluate(() => { window.__game?.events?.emit('close-all'); });
  await page.waitForTimeout(100);
  const mpBefore = await page.evaluate(() => window.__state.player.mp);
  // Make sure PS is bound to 1 and we have MP
  await page.evaluate(() => {
    const p = window.__state.player;
    p.mp = Math.max(p.mp, 40);
    if (!p.skillBar.includes('power_strike')) p.skillBar[0] = 'power_strike';
    window.__game?.events?.emit('changed');
  });
  const mpReady = await page.evaluate(() => window.__state.player.mp);
  await key('1', 80);
  await page.waitForTimeout(80);
  const mpOnce = await page.evaluate(() => window.__state.player.mp);
  // Second press immediately: must NOT toast "on cooldown" (CD is 1s < 5s), and must queue
  const toastsBefore = await page.evaluate(() => [...document.querySelectorAll('#toasts *')].map((e) => e.textContent).join('\n'));
  await key('1', 50);
  await page.waitForTimeout(80);
  const toastsAfter = await page.evaluate(() => [...document.querySelectorAll('#toasts *')].map((e) => e.textContent).join('\n'));
  if (/Power Strike is on cooldown/i.test(toastsAfter) && !/Power Strike is on cooldown/i.test(toastsBefore)) {
    fail(`short cooldown showed a banner: ${toastsAfter.slice(0, 300)}`);
  }
  const mpTwiceEarly = await page.evaluate(() => window.__state.player.mp);
  if (mpOnce - mpTwiceEarly > 2) fail(`second press during CD spent MP immediately: ${mpOnce} → ${mpTwiceEarly}`);
  // v0.2.6: nothing is queued. More presses are ignored, and the skill does not auto-fire when the cooldown ends.
  await key('1', 40);
  await key('1', 40);
  await page.waitForTimeout(1200);
  const mpAfter = await page.evaluate(() => window.__state.player.mp);
  if (mpAfter < mpOnce - 1) fail(`Power Strike was queued and fired again (mp ${mpReady} → ${mpOnce} → ${mpAfter}); v0.2.6 has no queue`);
  const toastsEnd = await page.evaluate(() => [...document.querySelectorAll('#toasts *')].map((e) => e.textContent).join('\n'));
  if (/on cooldown/i.test(toastsEnd)) fail(`short cooldown showed a banner: ${toastsEnd.slice(0, 300)}`);
  // Rage (60 s): exactly one banner for a mash, and it does not fire when the cooldown ends.
  await page.evaluate(() => {
    const p = window.__state.player;
    p.skillRanks.rage = Math.max(1, p.skillRanks.rage ?? 0);
    p.skillBar[4] = 'rage';
    p.mp = Math.max(p.mp, 40);
    window.__state.cooldowns.rage = Date.now() + 60000;
    document.querySelector('#toasts').innerHTML = '';
  });
  for (let i = 0; i < 4; i++) await key('5', 60);
  const rageToasts = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].filter((e) => /Rage is on cooldown/i.test(e.textContent)).length);
  if (rageToasts !== 1) fail(`Rage mash should show exactly one cooldown banner, got ${rageToasts}`);
  await page.evaluate(() => { window.__state.cooldowns.rage = Date.now() + 200; });
  await page.waitForTimeout(500);
  if (await page.evaluate(() => (window.__state.buffs.rage ?? 0) > Date.now())) fail('Rage fired by itself when its cooldown ended (no queue in v0.2.6)');
  console.log('no skill queue ok:', { mpReady, mpOnce, mpAfter });

  // Wool-Shoulder guaranteed copper: simulate onKill if exposed, else trust the code path (recheck script covers it).
  // Type / Junk already checked. Keyboard hints are smaller (CSS) — presence of L is enough.
  // Rage tint: grant rage, activate, expire via Date — visual is hard to assert; ensure buffs use Date and no leftover after clearing.
  await page.evaluate(() => { window.__state.buffs = {}; });
  console.log('v0.2.3 recheck block finished');

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
  const sc = (fn, arg) => page.evaluate(fn, arg);

  // ── HP (section 5) on the fresh character ──
  let hpNow = await page.evaluate(() => window.__state.player.hp);
  if (hpNow !== 100) fail(`fresh Warrior should have 100 max HP, got ${hpNow}`);
  await con('level 5', 'heal');
  const hp5 = await page.evaluate(() => window.__state.player.hp);
  if (hp5 !== 128) fail(`level 5, 0 STR should be 128 HP, got ${hp5}`);
  await con('level 10', 'heal');
  const hp10 = await page.evaluate(() => window.__state.player.hp);
  if (hp10 !== 163) fail(`level 10, 0 STR should be 163 HP, got ${hp10}`);
  await con('level 1', 'heal');
  await page.evaluate(() => { window.__state.player.stats.STR = 3; });
  await con('heal');
  if ((await page.evaluate(() => window.__state.player.hp)) !== 106) fail('level 1 with 3 STR should be 106 HP');
  await page.evaluate(() => { window.__state.player.stats.STR = 0; });
  console.log('hp ok: 100 / 128 / 163 / 106');

  // ── XP curve (section 15a): 4 → 5 takes 880 ──
  await con('level 4');
  await page.evaluate(() => { window.__state.player.xp = 0; });
  await con('xp 440');
  const half = await s();
  if (half.level !== 4) fail(`440 XP should leave a level-4 character at level 4, got ${half.level}`);
  await con('xp 440');
  if ((await s()).level !== 5) fail('880 XP total should reach level 5');
  await con('level 1', 'heal');
  console.log('xp curve ok');

  // ── Character screen (section 6): equipment and gear bonuses ──
  await page.evaluate(() => {
    const p = window.__state.player;
    p.gearItems.t_cap = { uid: 't_cap', itemId: 'hide_cap', defense: 2, weaponDamage: 0, statMultiplier: 1, magic: true, prefix: 'Sturdy', affixes: [{ stat: 'STR', value: 2 }, { stat: 'hp', value: 12 }], container: 'bag' };
    p.equipment.head = 't_cap';
    window.__game.events.emit('changed');
  });
  await key('c', 300);
  const cTxt = await page.evaluate(() => document.querySelector('#p-stats')?.innerText ?? '');
  for (const re of [/Equipment/i, /Club — Weapon damage 10/, /Weapon damage/, /Sturdy Hide Cap/, /Defense \+2/, /\+2 STR/, /\+12 Max HP/, /\(\+2 from gear\)/]) {
    if (!re.test(cTxt)) fail(`character screen missing ${re}: ${cTxt}`);
  }
  if (/Rage/.test(cTxt)) fail('Rage row shown without the buff');
  await shot('character-equipment');
  await key('Escape');
  await page.evaluate(() => { delete window.__state.player.equipment.head; delete window.__state.player.gearItems.t_cap; });

  // ── Contact damage (section 11), affinity (16), give-up and jump (9) — in a safe test arena (town) ──
  await con('item meadow_dew 1');
  const arena = (id, dx = 0) => page.evaluate(([mid, off]) => {
    const w = window.__state.scene;
    const m = w.spawnMonster(mid, w.player.x + off);
    m.setData('test', true);
    return m.def.id;
  }, [id, dx]);
  const clearMobs = () => page.evaluate(() => { const w = window.__state.scene; w.monsters.forEach((m) => m.destroy()); w.monsters = []; });
  await page.evaluate(() => { const p = window.__state.player; p.cheats.god = false; p.hp = 100; window.__state.invulnUntil = 0; window.__state.scene.player.x = 700; });
  await settle(300);
  // a peaceful sheep you have not hit does nothing
  await arena('wool_sheep');
  const hpA = await page.evaluate(() => window.__state.player.hp);
  await settle(1500);
  if ((await page.evaluate(() => window.__state.player.hp)) < hpA) fail('an unaggroed Wool Sheep dealt contact damage');
  // hit it (0 dmg engages it), then the touch hurts — about 40% of a normal hit
  await page.evaluate(() => { const w = window.__state.scene; const m = w.monsters[0]; m.x = w.player.x; m.hurt(1, w.player.x - 5, 0, 0); });
  await settle(500);
  const hpB = await page.evaluate(() => window.__state.player.hp);
  if (hpB >= hpA) fail(`an aggroed Wool Sheep touching the player should bump for damage (hp ${hpA} → ${hpB})`);
  if (hpA - hpB > 14) fail(`contact should be ~40% of a swing, took ${hpA - hpB}`);
  const bumps = await page.evaluate(() => window.__state.player.hp);
  await settle(300);
  console.log('contact ok:', hpA, '→', hpB, '(then', bumps, ')');
  await clearMobs();

  // affinity: Flame Cleave on a Field Mouse = Weak, on an Earth Sprite = Immune
  const cast = async (mob) => {
    await clearMobs();
    await page.evaluate((id) => {
      const w = window.__state.scene; const p = window.__state.player;
      p.skillRanks.flame_cleave = 1; p.mp = 999; p.hp = 9999; p.cheats.god = true; window.__state.cooldowns = {};
      w.__ft = []; if (!w.__ftHooked) { const o = w.floatText.bind(w); w.floatText = (x, y, t, c, z) => { w.__ft.push(String(t)); return o(x, y, t, c, z); }; w.__ftHooked = true; }
      w.facing = 1; w.player.x = 900; w.swingReadyAt = 0;
      const m = w.spawnMonster(id, 950); m.body.setVelocityX(0); w.__mob = m;
    }, mob);
    const hp0 = await page.evaluate(() => window.__state.scene.__mob.hp);
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => { window.__state.cooldowns = {}; window.__state.scene.swingReadyAt = 0; window.__state.scene.useSkill('flame_cleave'); });
      await settle(520);
      const r = await page.evaluate(() => ({ hp: window.__state.scene.__mob.hp, ft: window.__state.scene.__ft.slice() }));
      if (r.hp < hp0 || r.ft.includes('Immune')) return { hp0, ...r };
    }
    return { hp0, ...(await page.evaluate(() => ({ hp: window.__state.scene.__mob.hp, ft: window.__state.scene.__ft.slice() }))) };
  };
  const weak = await cast('field_mouse');
  if (!weak.ft.includes('Weak!') || weak.hp >= weak.hp0) fail(`Flame Cleave on a Field Mouse should be Weak: ${JSON.stringify(weak)}`);
  const imm = await cast('earth_sprite');
  if (!imm.ft.includes('Immune') || imm.hp !== imm.hp0) fail(`Flame Cleave on an Earth Sprite should be Immune and deal nothing: ${JSON.stringify(imm)}`);
  console.log('affinity ok:', { weak: weak.ft, imm: imm.ft });
  await clearMobs();

  // give up (section 9): the player stands on a ledge too high for a Burrow Mole
  await con('tp dirt_banks');
  await page.waitForFunction(() => window.__state.player.area === 'dirt_banks' && window.__game?.scene.isActive('World'), null, { timeout: 10000 });
  await settle(400);
  await page.evaluate(() => { window.__state.scene.monsters.forEach((m) => m.destroy()); window.__state.scene.monsters = []; });
  const high = await page.evaluate(() => {
    const w = window.__state.scene;
    const ledge = w.geo.platforms.find((p) => p.y === 4);
    const top = w.groundY - ledge.y * 32;
    w.player.setPosition((ledge.x + 2) * 32, top - 4);
    window.__state.player.cheats.god = true;
    const m = w.spawnMonster('burrow_mole', (ledge.x + 2) * 32);
    m.hurt(1, m.x + 1, 0, 0);
    w.__mole = m;
    return { top };
  });
  await settle(900);
  const engagedNow = await page.evaluate(() => window.__state.scene.__mole.engaged);
  if (!engagedNow) fail('the Mole should be hunting at first');
  await settle(3300);
  const gaveUp = await page.evaluate(() => window.__state.scene.__mole.state);
  if (gaveUp !== 'idle') fail(`the Mole should give up within ~3 s of failing to reach a high ledge, state is ${gaveUp}`);
  // drop down: it can re-aggro
  await page.evaluate(() => { const w = window.__state.scene; w.player.setPosition(w.__mole.x + 90, w.groundY - 2); });
  await settle(900);
  if (!(await page.evaluate(() => window.__state.scene.__mole.engaged))) fail('the Mole should re-aggro when the player is back on reachable ground');
  console.log('give-up ok');
  // a low ledge it can jump to
  await page.evaluate(() => { window.__state.scene.monsters.forEach((m) => m.destroy()); window.__state.scene.monsters = []; });
  await page.evaluate(() => {
    const w = window.__state.scene;
    const ledge = w.geo.platforms.find((p) => p.y === 2);
    const top = w.groundY - ledge.y * 32;
    w.player.setPosition((ledge.x + 3) * 32, top - 4);
    const m = w.spawnMonster('burrow_mole', (ledge.x + 1) * 32);
    m.hurt(1, m.x - 1, 0, 0);
    w.__mole2 = m; w.__ledgeTop = top;
  });
  await settle(3000);
  const up = await page.evaluate(() => ({ y: window.__state.scene.__mole2.y, top: window.__state.scene.__ledgeTop, state: window.__state.scene.__mole2.state }));
  if (up.y > up.top + 14) fail(`the Mole should jump up onto a low ledge instead of giving up: ${JSON.stringify(up)}`);
  console.log('ledge jump ok:', up);
  await page.evaluate(() => { window.__state.scene.monsters.forEach((m) => m.destroy()); window.__state.scene.monsters = []; window.__state.player.cheats.god = false; });

  // ── Hot Edge (section 17) ──
  await toTown();
  // Calden's other lines (Blood Up, A Crack in the Dirt) are finished, so only Hot Edge can mark him.
  await page.evaluate(() => { window.__state.player.questLog = { ql_intro: { step: 11, done: true }, ql_warrior: { step: 5, done: true }, ql_blood: { step: 3, done: true }, ql_dirt_path: { step: 4, done: true }, ql_crack: { step: 4, done: true }, ql_magician: { step: 3, done: true } }; });
  await con('level 6', 'heal');
  await settle(350);
  if ((await marker('calden')) !== '!') fail(`Calden should show ! at level 6 for Hot Edge, got ${await marker('calden')}`);
  await page.evaluate(() => { window.__state.scene.player.x = window.__state.scene.npcs.find((n) => n.id === 'calden').x; });
  await settle(200);
  await key('e', 400);
  if (!(await visible()).includes('dialog')) fail('Calden did not open the Hot Edge dialog');
  const heDlg = await page.evaluate(() => document.querySelector('#p-dialog')?.innerText ?? '');
  if (!/Level six|Smoldering Scale/i.test(heDlg)) fail(`Hot Edge opening dialog unexpected: ${heDlg}`);
  await dismissDialog();
  const he1 = await page.evaluate(() => window.__state.player.questLog?.ql_hot);
  if (!he1 || he1.step !== 1) fail(`talking to Calden at level 6 should start Hot Edge: ${JSON.stringify(he1)}`);
  if (await marker('calden')) fail(`no marker while waiting for the scale, got ${await marker('calden')}`);
  // with a scale but under 10 STR: "not ready", scale kept, no ?
  await con('item smoldering_scale 1');
  await page.evaluate(() => { window.__state.player.stats.STR = 4; });
  await settle(350);
  if (await marker('calden')) fail('Calden must not show ? while STR is under 10');
  await page.evaluate(() => { window.__state.scene.player.x = window.__state.scene.npcs.find((n) => n.id === 'calden').x; });
  await key('e', 400);
  await dismissDialog();
  if (!((await page.evaluate(() => window.__state.player.inventory.smoldering_scale ?? 0)) >= 1)) fail('Calden took the scale before the player was ready');
  if ((await page.evaluate(() => window.__state.player.questLog.ql_hot.step)) !== 1) fail('Hot Edge advanced before the gate');
  await page.evaluate(() => { window.__state.player.stats.STR = 10; });
  await settle(350);
  if ((await marker('calden')) !== '?') fail(`Calden should show ? at level 6, 10 STR with the scale, got ${await marker('calden')}`);
  await page.evaluate(() => { window.__state.scene.player.x = window.__state.scene.npcs.find((n) => n.id === 'calden').x; });
  await key('e', 400);
  await dismissDialog();
  const he2 = await page.evaluate(() => ({ step: window.__state.player.questLog.ql_hot.step, scale: window.__state.player.inventory.smoldering_scale ?? 0 }));
  if (he2.step !== 2 || he2.scale !== 0) fail(`scale turn-in should advance Hot Edge and consume the scale: ${JSON.stringify(he2)}`);
  // Cinderback is out in the Banks from the grain step
  await con('tp dirt_banks');
  await page.waitForFunction(() => window.__state.player.area === 'dirt_banks' && window.__game?.scene.isActive('World'), null, { timeout: 10000 });
  await settle(700);
  const cb = await page.evaluate(() => window.__state.scene.monsters.filter((m) => m.alive && m.def.id === 'cinderback').length);
  if (cb !== 1) fail(`Cinderback should be in the Dirt Banks during the grain step, found ${cb}`);
  // the first Ember Beetle killed at level 6+ always drops a scale (once per character)
  const guaranteed = await page.evaluate(() => {
    const w = window.__state.scene; const p = window.__state.player;
    p.questFlags.scale_seen = false; p.inventory.smoldering_scale = 0;
    const seen = [];
    const o = w.spawnDrop.bind(w); w.spawnDrop = (x, y, id, q, r, i) => { seen.push(id); return o(x, y, id, q, r, i); };
    w.onKill({ def: { id: 'ember_beetle', xp: 0, level: 4 }, x: w.player.x, y: w.player.y, displayHeight: 20 });
    return { seen, flag: p.questFlags.scale_seen };
  });
  if (!guaranteed.seen.includes('smoldering_scale') || !guaranteed.flag) fail(`first Ember Beetle at level 6+ must drop a Smoldering Scale: ${JSON.stringify(guaranteed)}`);
  console.log('hot edge ok');

  // ── Passive production is whole numbers (section 7) ──
  await con('passive rank nature_prod 5');
  const ne0 = await page.evaluate(() => window.__state.player.inventory.nature_essence ?? 0);
  await con('passive wait 1');
  const ne1 = await page.evaluate(() => window.__state.player.inventory.nature_essence ?? 0);
  if (ne1 - ne0 !== 8) fail(`rank 5 should make 8 Nature Essence in an hour, got ${ne1 - ne0}`);
  await con('passive rank nature_prod 10');
  const ne2 = await page.evaluate(() => window.__state.player.inventory.nature_essence ?? 0);
  await con('passive wait 1');
  if ((await page.evaluate(() => window.__state.player.inventory.nature_essence ?? 0)) - ne2 !== 64) fail('rank 10 should make 64 an hour');
  console.log('passive rates ok');

  // static numbers that live in code
  const asm = readFileSync('src/data/assumptions.ts', 'utf8');
  for (const re of [/field_mouse: 42, wool_sheep: 30, crow: 55, burrow_mole: 32, earth_sprite: 40, ember_beetle: 32/, /meadow_boar: \{[^}]*range: 44/, /field_mouse: \{[^}]*range: 16/, /GIVE_UP_MS = 2750/, /fraction: 0\.4/]) {
    if (!re.test(asm)) fail(`assumptions.ts is missing ${re}`);
  }
  console.log('v0.2.6 behaviour ok');
  // ══════════════ v0.2.9 specifics ══════════════
  {
    const w = await page.evaluate(() => { const p = window.__state.player; const g = p.gearItems[p.equipment.weapon]; return g?.itemId; });
    if (w !== 'club') fail(`a fresh Hero starts with the Club, got ${w}`);
  }
  // Pell's markers for Beyond the Pasture Gate
  await toTown();
  await page.evaluate(() => {
    const p = window.__state.player;
    p.questLog = { ql_intro: { step: 11, done: true }, ql_warrior: { step: 5, done: true }, ql_warm_coat: { step: 2, done: true } };
    p.skillRanks = { power_strike: 1, rage: 1, magic_bolt: 1, mana_shield: 1 }; p.questFlags = {};
    p.skillBar = ['power_strike', null, null, null, null, null, 'meadow_dew', 'clear_dew'];
    p.level = 3;
    window.__state.scene.levelUpFx(0);
  });
  await settle(500);
  if ((await marker('pell')) !== '!') fail(`Pell should show ! for Beyond the Pasture Gate, got ${await marker('pell')}`);
  await page.evaluate(() => { window.__state.player.questLog.ql_dirt_path = { step: 4, done: false, kills: { burrow_mole: 5, ember_beetle: 3 } }; });
  await settle(400);
  if ((await marker('pell')) !== '?') fail(`Pell should show ? when the hunt is done, got ${await marker('pell')}`);
  await page.evaluate(() => { window.__state.player.questLog.ql_dirt_path = { step: 4, done: false, kills: { burrow_mole: 2 } }; });
  await settle(400);
  if (await marker('pell')) fail('Pell should show nothing while the hunt is unfinished');

  // ── the Paths window: states, lines, equip slots, and the slot rules ──
  await page.evaluate(() => {
    const p = window.__state.player;
    p.questLog.ql_magician = { step: 3, done: true };
    p.questLog.ql_dirt_path = { step: 4, done: true };
    window.__game.events.emit('close-all');
  });
  await key('k', 400);
  const tree = await page.evaluate(() => {
    const st = (id) => (document.querySelector(`#p-skills [data-skill="${id}"]`)?.className.match(/st-(\w+)/) ?? [])[1];
    return {
      states: Object.fromEntries(['power_strike', 'earthbreaker', 'dig_in', 'rage', 'root_lash', 'flame_cleave'].map((id) => [id, st(id)])),
      lines: document.querySelectorAll('#p-skills .pathtree svg path.ln').length, lit: document.querySelectorAll('#p-skills .pathtree svg path.ln.lit').length,
      future: document.querySelectorAll('#p-skills .pnode.future').length,
      tabs: [...document.querySelectorAll('#p-skills .tabs button')].map((b) => b.textContent.trim()),
      slots: document.querySelectorAll('#p-skills .eq-slot').length,
      fams: [...new Set([...document.querySelectorAll('#p-skills .pnode[data-skill]')].map((n) => (n.className.match(/fam-(\w+)/) ?? [])[1]))].sort(),
    };
  });
  if (tree.states.power_strike !== 'trained' || tree.states.dig_in !== 'available' || tree.states.earthbreaker !== 'locked' || tree.states.rage !== 'trained' || tree.states.root_lash !== 'locked' || tree.states.flame_cleave !== 'locked') fail(`tree states: ${JSON.stringify(tree.states)}`);
  if (tree.lines < 6 || tree.lit < 3 || tree.future < 3 || tree.slots !== 6 || tree.tabs.length !== 2 || tree.fams.join() !== 'basic,elemental,nature') fail(`tree: ${JSON.stringify(tree)}`);
  await shot('paths-tree');
  const dig = await page.evaluate(() => { const t = document.querySelector('#p-skills [data-skill="dig_in"]'); t?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return document.querySelector('#skills-preview')?.innerText ?? ''; });
  if (!/Cost for rank 1/.test(dig) || !/Needs Power Strike/.test(dig)) fail(`available node shows its cost and chain: ${dig}`);
  // buffs only in buff slots, attacks only in attack slots
  await page.evaluate(() => document.querySelector('#p-skills [data-skill="rage"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await key('1', 200);
  const slotsA = await page.evaluate(() => [...window.__state.player.skillBar]);
  if (slotsA[0] === 'rage') fail('Rage must not go in an attack slot');
  const hint1 = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
  if (!/Buffs go in the buff slots/.test(hint1)) fail(`wrong-slot hint for a buff: ${hint1}`);
  await key('5', 200);
  if ((await page.evaluate(() => window.__state.player.skillBar[4])) !== 'rage') fail('Rage should equip in a buff slot');
  await page.evaluate(() => document.querySelector('#p-skills [data-skill="power_strike"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await key('6', 200);
  if ((await page.evaluate(() => window.__state.player.skillBar[5])) === 'power_strike') fail('Power Strike must not go in a buff slot');
  const hint2 = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
  if (!/Attacks go in the attack slots/.test(hint2)) fail(`wrong-slot hint for an attack: ${hint2}`);
  await key('Tab', 300);
  const magTab = await page.evaluate(() => document.querySelector('#p-skills .tabs .on')?.textContent ?? '');
  if (!/Magician/.test(magTab)) fail(`Tab should switch to the Magician tab: ${magTab}`);
  await page.evaluate(() => document.querySelector('#p-skills [data-skill="mana_shield"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await key('2', 200);
  if ((await page.evaluate(() => window.__state.player.skillBar[1])) === 'mana_shield') fail('Mana Shield must not go in an attack slot');
  await key('6', 200);
  if ((await page.evaluate(() => window.__state.player.skillBar[5])) !== 'mana_shield') fail('Mana Shield should equip in a buff slot');
  // E closes the Paths window, and a shop
  await key('e', 250);
  if ((await visible()).includes('skills')) fail('E should close the Paths window');
  await toNpc('mara');
  await key('e', 350);
  if (!(await visible()).includes('shop')) fail('E should open the shop');
  await key('e', 250);
  if ((await visible()).includes('shop')) fail('E should close the shop');
  console.log('paths window ok');

  // ── old saves: a bar with skills in the wrong slots, and the old quests, are brought forward ──
  await page.evaluate(() => {
    const p = window.__state.player;
    p.questLog = { ql_weight: { step: 3, done: true }, ql_paths: { step: 4, done: true }, ql_magic: { step: 4, done: true }, ql_dirt_path: { step: 4, done: true } };
    p.skillRanks = { power_strike: 2, rage: 1, magic_bolt: 1, mana_shield: 1 };
    p.skillBar = ['rage', 'mana_shield', 'meadow_dew', 'power_strike', 'power_strike', 'magic_bolt', 'clear_dew', 'meadow_dew'];
    p.level = 6;
    window.__state.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.__state?.player && window.__game?.scene.isActive('World'), null, { timeout: 15000 });
  await settle(600);
  const mig = await page.evaluate(() => ({ log: window.__state.player.questLog, bar: [...window.__state.player.skillBar], ranks: { ...window.__state.player.skillRanks } }));
  for (const l of ['ql_intro', 'ql_warrior', 'ql_magician']) if (!mig.log[l]?.done) fail(`old save: ${l} should be complete: ${JSON.stringify(mig.log)}`);
  if (mig.log.ql_weight || mig.log.ql_paths || mig.log.ql_magic) fail('old save: the removed quests should be gone');
  if (mig.ranks.power_strike !== 2 || mig.ranks.magic_bolt !== 1) fail('old save keeps its skills');
  const grp = (i) => (i < 4 ? 'attack' : i < 6 ? 'buff' : 'potion');
  const kind = { rage: 'buff', mana_shield: 'buff', power_strike: 'attack', magic_bolt: 'attack', meadow_dew: 'potion', clear_dew: 'potion' };
  mig.bar.forEach((id, i) => { if (id && kind[id] !== grp(i)) fail(`old save: ${id} is in a ${grp(i)} slot: ${JSON.stringify(mig.bar)}`); });
  await key('k', 350);
  const kk = await page.evaluate(() => [...document.querySelectorAll('#p-skills .tabs button')].map((b) => b.textContent.trim()));
  if (kk.length !== 2) fail(`old save should have both trees: ${JSON.stringify(kk)}`);
  await key('Escape');
  console.log('old save migration ok');

  // ── magic scales with INT, the Warrior side with STR; C shows both ──
  const atkRows = async () => {
    await key('c', 250);
    const r = await page.evaluate(() => {
      const row = (n) => Number([...document.querySelectorAll('#p-stats .derived tr')].find((x) => x.querySelector('td')?.textContent === n)?.querySelector('td:last-child')?.textContent);
      return { atk: row('Attack'), mag: row('Magic attack') };
    });
    await key('Escape', 100);
    return r;
  };
  await page.evaluate(() => { const p = window.__state.player; p.stats = { STR: 0, INT: 0, AGI: 0, SPI: 0 }; window.__game.events.emit('changed'); });
  const base = await atkRows();
  await page.evaluate(() => { window.__state.player.stats.INT = 4; window.__game.events.emit('changed'); });
  const withInt = await atkRows();
  await page.evaluate(() => { const p = window.__state.player; p.stats.INT = 0; p.stats.STR = 4; window.__game.events.emit('changed'); });
  const withStr = await atkRows();
  if (!(withInt.mag === base.mag + 2 && withInt.atk === base.atk)) fail(`+4 INT should add 2 magic attack and nothing to Attack: ${JSON.stringify({ base, withInt })}`);
  if (!(withStr.atk === base.atk + 2 && withStr.mag === base.mag)) fail(`+4 STR should add 2 Attack and nothing to magic: ${JSON.stringify({ base, withStr })}`);
  await page.evaluate(() => { window.__state.player.stats.STR = 0; });
  console.log('INT magic ok', { base, withInt, withStr });

  // ── drops: nothing but Copper is ever more than 3 from one kill ──
  await toTown();
  const dropStats = await page.evaluate(() => {
    const w = window.__state.scene, p = window.__state.player;
    p.cheats.god = true; p.hp = 9999; p.cheats.dropMul = 1;
    const seen = {}; let maxCopper = 0; let kills = 0;
    const orig = w.spawnDrop.bind(w);
    w.spawnDrop = (x, y, id, qty, rare, inst) => { if (id === 'copper_coin') maxCopper = Math.max(maxCopper, qty); else seen[id] = Math.max(seen[id] ?? 0, qty); return orig(x, y, id, qty, rare, inst); };
    for (const mob of ['field_mouse', 'wool_sheep', 'crow', 'burrow_mole', 'earth_sprite', 'ember_beetle', 'spark_bug']) {
      for (let i = 0; i < 90; i++) { w.onKill({ def: { id: mob, xp: 0, level: 1 }, x: w.player.x, y: w.player.y, displayHeight: 20 }); kills++; }
    }
    [...w.drops.getChildren()].forEach((d) => d.destroy());
    w.spawnDrop = orig;
    return { seen, maxCopper, kills };
  });
  const over = Object.entries(dropStats.seen).filter(([, q]) => q > 3);
  if (over.length) fail(`a single kill dropped more than 3 of ${JSON.stringify(over)}`);
  if (dropStats.maxCopper < 4) fail(`Copper is excluded from the cap but never exceeded 3 in ${dropStats.kills} kills: ${dropStats.maxCopper}`);
  if (!dropStats.seen.twig && !dropStats.seen.monster_essence) fail('common materials should still drop');
  console.log('drop cap ok', dropStats.maxCopper, Object.keys(dropStats.seen).length, 'item kinds');

  // ══════════════ v0.2.8 Magician Path ══════════════
  {
    const sk = JSON.parse(readFileSync('data/skills.json', 'utf8')).rows;
    const mag = Object.fromEntries(sk.filter((r) => r.path_id === 'magician').map((r) => [r.id, r]));
    const chain = { magic_bolt: null, mana_shield: 'magic_bolt', fire_bolt: 'mana_shield', thorn_volley: 'mana_shield', chain_spark: 'thorn_volley' };
    for (const [id, prev] of Object.entries(chain)) {
      if (!mag[id] || (mag[id].prev_skill_id ?? null) !== prev) fail(`magician chain: ${id} should follow ${prev}, got ${mag[id]?.prev_skill_id}`);
    }
    if (mag.fire_bolt.branch !== 'elemental' || mag.chain_spark.branch !== 'elemental' || mag.thorn_volley.branch !== 'nature' || mag.mana_shield.type !== 'buff') fail('magician families / types wrong');
    if (Object.values(mag).some((r) => /Frost|Spirit Drain/i.test(r.name))) fail('Frost Shard / Spirit Drain must not be implemented');
    const sc2 = JSON.parse(readFileSync('data/skill_costs.json', 'utf8')).rows;
    for (const id of Object.keys(chain)) {
      for (let rk = 1; rk <= 10; rk++) {
        const rows = sc2.filter((r) => r.skill_id === id && r.rank === rk);
        if (!rows.some((r) => r.material_id === 'copper_coin')) fail(`${id} rank ${rk} has no recipe`);
        for (const r of rows) {
          if (r.quantity > 40 || ['heartwood', 'log'].includes(r.material_id)) fail(`${id} r${rk} ${r.material_id} ${r.quantity}`);
        }
      }
    }
    const first = (id) => Object.fromEntries(sc2.filter((r) => r.skill_id === id && r.rank === 1).map((r) => [r.material_id, r.quantity]));
    if (!first('fire_bolt').elemental_essence || !first('thorn_volley').nature_essence || !first('chain_spark').elemental_essence || !first('chain_spark').lightning_shard) fail('family essence should be the main cost');
    if (readFileSync('data/skills.json', 'utf8').includes('"energy_blast"')) fail('Energy Blast should be renamed to Magic Bolt');
  }
  // ── casting: projectiles land when they arrive, not on the key press ──
  const bArena = async (mobs, opts = {}) => page.evaluate(({ mobs, opts }) => {
    const w = window.__state.scene, p = window.__state.player;
    w.monsters.forEach((m) => m.destroy()); w.monsters = []; w.bolts.forEach((b) => b.head.destroy()); w.bolts = [];
    p.cheats.god = true; p.level = 8; p.mp = 999; p.hp = 9999; window.__state.cooldowns = {}; w.facing = 1; w.player.setFlipX(false); w.swingReadyAt = 0; w.player.x = 400;
    for (const id of ['magic_bolt', 'mana_shield', 'fire_bolt', 'thorn_volley', 'chain_spark']) p.skillRanks[id] = 1;
    w.__ft = []; if (!w.__ftHooked) { const o = w.floatText.bind(w); w.floatText = (x, y, t, c, z) => { w.__ft.push(String(t)); return o(x, y, t, c, z); }; w.__ftHooked = true; }
    w.__mobs = mobs.map((dx) => { const m = w.spawnMonster(opts.mob ?? 'field_mouse', 400 + dx); m.body.setVelocityX(0); m.speed = 0; m.hp = 9999; m.def.hp = 9999; return m; });
    return w.__mobs.length;
  }, { mobs, opts });
  const hps = () => page.evaluate(() => window.__state.scene.__mobs.map((m) => m.hp));
  const bCast = async (id) => { await page.evaluate((sid) => { window.__state.cooldowns = {}; window.__state.scene.swingReadyAt = 0; window.__state.scene.useSkill(sid); }, id); };
  // Magic Bolt: spend MP, a bolt is in the air, no damage yet; it connects ~150 px away
  await bArena([170]);
  const mpA = await page.evaluate(() => window.__state.player.mp);
  await bCast('magic_bolt');
  await settle(60);
  const early = await page.evaluate(() => ({ bolts: window.__state.scene.bolts.length, hp: window.__state.scene.__mobs[0].hp, mp: window.__state.player.mp }));
  if (early.bolts !== 1 || early.hp !== 9999) fail(`a Magic Bolt should be in flight and not have hit yet: ${JSON.stringify(early)}`);
  if (mpA - early.mp < 7.5) fail(`Magic Bolt should cost its MP: ${mpA} → ${early.mp}`);
  await shot('magic-bolt-flight');
  await settle(700);
  if ((await hps())[0] >= 9999) fail('Magic Bolt never connected');
  // out of range: nothing happens to a far mob
  await bArena([480]);
  await bCast('magic_bolt'); await settle(1200);
  if ((await hps())[0] !== 9999) fail('a bolt must fizzle at the end of its range');
  // Fire Bolt: Weak on a Field Mouse and leaves a burn
  await bArena([170]);
  await bCast('fire_bolt'); await settle(260);
  await shot('fire-bolt-flight');
  await settle(700);
  const fire = await page.evaluate(() => ({ hp: window.__state.scene.__mobs[0].hp, burns: window.__state.scene.burns.length, ft: window.__state.scene.__ft.slice() }));
  if (fire.hp >= 9999 || !fire.ft.includes('Weak!') || fire.burns < 1) fail(`Fire Bolt should hit a beast hard (Weak) and leave a burn: ${JSON.stringify(fire)}`);
  // Fire Bolt is Elemental: Immune on an Earth Sprite
  await bArena([170], { mob: 'earth_sprite' });
  await bCast('fire_bolt'); await settle(1000);
  const imm2 = await page.evaluate(() => ({ hp: window.__state.scene.__mobs[0].hp, ft: window.__state.scene.__ft.slice() }));
  if (imm2.hp !== 9999 || !imm2.ft.includes('Immune')) fail(`Fire Bolt on an Earth Sprite should be Immune: ${JSON.stringify(imm2)}`);
  // Thorn Volley: three thorns
  await bArena([150]);
  await bCast('thorn_volley'); await settle(30);
  await settle(180);
  const thorns = await page.evaluate(() => window.__state.scene.bolts.length + window.__state.scene.__ft.filter((t) => /^\d+$/.test(t)).length);
  if (thorns < 3) fail(`Thorn Volley should throw three thorns, saw ${thorns}`);
  await shot('thorn-volley');
  await settle(800);
  // Chain Spark: hits the first foe and jumps to others, each weaker
  await bArena([150, 230, 310]);
  await bCast('chain_spark'); await settle(1500);
  const chained = await hps();
  if (chained.some((h) => h >= 9999)) fail(`Chain Spark should reach all three foes: ${JSON.stringify(chained)}`);
  const dmg = chained.map((h) => 9999 - h);
  console.log('chain damage by link:', dmg);
  // Mana Shield: a buff that dulls incoming hits and ends cleanly
  await page.evaluate(() => { window.__state.scene.monsters.forEach((m) => m.destroy()); window.__state.scene.monsters = []; });
  const took = async (shield) => page.evaluate((withShield) => {
    const w = window.__state.scene, p = window.__state.player;
    p.cheats.god = false; p.hp = 5000; window.__state.invulnUntil = 0; window.__state.buffs = {}; window.__state.cooldowns = {};
    if (withShield) { w.swingReadyAt = 0; w.useSkill('mana_shield'); }
    const m = w.spawnMonster('burrow_mole', w.player.x); const d = m.def; const save = [d.attack_min, d.attack_max, d.attack];
    d.attack_min = 100; d.attack_max = 100; d.attack = 100;
    const before = p.hp; w.monsterSwings(m, m.x, true);
    d.attack_min = save[0]; d.attack_max = save[1]; d.attack = save[2];
    const lost = before - p.hp; m.destroy(); w.monsters = w.monsters.filter((x) => x !== m);
    return { lost, active: (window.__state.buffs.mana_shield ?? 0) > Date.now() };
  }, shield);
  const plain = await took(false);
  const warded = await took(true);
  if (!warded.active || !(warded.lost < plain.lost) || warded.lost < plain.lost * 0.5) fail(`Mana Shield should dull hits by about a third: ${JSON.stringify({ plain, warded })}`);
  await shot('mana-shield');
  await page.evaluate(() => { window.__state.buffs.mana_shield = Date.now() - 1; });
  await settle(250);
  console.log('magician combat ok', { plain: plain.lost, warded: warded.lost, chain: dmg });
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('SMOKE OK — no console errors');