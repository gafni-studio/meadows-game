import { DB, quest, xpToNext, shopPrice, vendorBuyPrice, consumableEffect, buffNumbers } from '../data/db';
import { ASSUME } from '../data/assumptions';
import { Game } from '../systems/GameState';
import { clearSave } from '../systems/Save';
import * as P from '../systems/Player';
import { HP_POTIONS, MP_POTIONS } from '../scenes/WorldScene';

/**
 * DOM overlay UI: HUD bars, hotbar, toasts, and windows (inventory, stats, shop,
 * NPC dialog, pause). DOM keeps text crisp and makes the windows easy to restyle.
 */
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
type Panel = 'inventory' | 'stats' | 'shop' | 'dialog' | 'pause';

const TYPE_ORDER = ['consumable', 'gear', 'currency', 'material', 'misc'];

export class Hud {
  private open = new Set<Panel>();
  private areaName = '';

  constructor() {
    $('#ui').innerHTML = `
      <div id="hud">
        <div class="row"><b id="lvl"></b> <span id="area"></span></div>
        <div class="bar hp"><i></i><span></span></div>
        <div class="bar mp"><i></i><span></span></div>
        <div class="bar xp"><i></i><span></span></div>
        <div id="coins"></div>
        <div id="buffs"></div>
      </div>
      <div id="hotbar"></div>
      <div id="toasts"></div>
      <div id="help">F attack (hold) · 1 Power Strike · 2 Rage · 5 HP · 6/G MP · E pick up/talk · I inventory · C stats · Esc menu</div>
      <div id="dead" hidden>Defeated…</div>
      <div class="panel" id="p-inventory" hidden></div>
      <div class="panel" id="p-stats" hidden></div>
      <div class="panel" id="p-shop" hidden></div>
      <div class="panel" id="p-dialog" hidden></div>
      <div class="panel" id="p-pause" hidden></div>`;

    Game.events.on('changed', () => this.renderPanels());
    Game.events.on('toast', (m: string, k: string) => this.toast(m, k));
    Game.events.on('area', (n: string) => {
      this.areaName = n;
      this.open.delete('shop');
      this.open.delete('dialog');
      this.renderPanels();
      this.toast(`Entered ${n}`, 'info');
    });
    Game.events.on('toggle', (p: Panel) => this.toggle(p));
    Game.events.on('escape', () => (this.open.size ? this.closeAll() : this.toggle('pause')));
    Game.events.on('close-all', () => this.closeAll());
    Game.events.on('dead', (d: boolean) => ($('#dead').hidden = !d));
    Game.events.on('npc', (id: string, role: string, name: string) => this.npc(id, role, name));
    document.addEventListener('click', (e) => this.onClick(e));
    const tick = () => { this.renderHud(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ─── HUD ───
  private renderHud() {
    const p = Game.player;
    if (!p) return;
    const set = (sel: string, cur: number, max: number, label: string) => {
      const el = $(sel);
      (el.firstElementChild as HTMLElement).style.width = `${Math.max(0, Math.min(1, cur / max)) * 100}%`;
      (el.lastElementChild as HTMLElement).textContent = label;
    };
    const mh = P.maxHp(p), mm = P.maxMp(p), nx = xpToNext(p.level);
    set('#hud .hp', p.hp, mh, `HP ${Math.ceil(Math.max(0, p.hp))} / ${mh}`);
    set('#hud .mp', p.mp, mm, `MP ${Math.floor(p.mp)} / ${mm}`);
    set('#hud .xp', p.xp, nx, `XP ${p.xp} / ${nx} (${((p.xp / nx) * 100).toFixed(1)}%)`);
    $('#lvl').textContent = `Lv ${p.level} Warrior${p.unspent ? ` (+${p.unspent} pts)` : ''}`;
    $('#area').textContent = this.areaName;
    $('#coins').textContent = `● ${p.coins} Copper`;

    const now = Game.now;
    const buffs: string[] = [];
    for (const [id, until] of Object.entries(Game.buffs)) {
      if (until > now) buffs.push(`${DB.skills[id]?.name ?? DB.items[id]?.name ?? id} ${Math.ceil((until - now) / 1000)}s`);
    }
    $('#buffs').textContent = buffs.join(' · ');

    const cd = (id: string) => Math.max(0, (Game.cooldowns[id] ?? 0) - now);
    const slot = (key: string, label: string, sub: string, cdMs: number, total: number) =>
      `<div class="slot"><kbd>${key}</kbd><div>${label}</div><small>${sub}</small>${cdMs > 0 ? `<em style="height:${(cdMs / total) * 100}%"></em>` : ''}</div>`;
    const ps = DB.skills.power_strike, rg = DB.skills.rage;
    const firstOwned = (ids: string[]) => ids.find((i) => (p.inventory[i] ?? 0) > 0);
    const hpPot = firstOwned(HP_POTIONS), mpPot = firstOwned(MP_POTIONS);
    const html =
      slot('F', 'Attack', '100%', 0, 1) +
      slot('1', ps.name, `${Math.round((ps.damage_multiplier ?? 1) * 100)}% · ${ps.mp_cost} MP`, cd('power_strike'), ASSUME.cooldownMs.power_strike) +
      slot('2', rg.name, `${rg.mp_cost} MP`, cd('rage'), ASSUME.cooldownMs.rage) +
      slot('3', '—', '', 0, 1) + slot('4', '—', '', 0, 1) +
      slot('5', hpPot ? DB.items[hpPot].name : 'HP', hpPot ? `x${p.inventory[hpPot]}` : 'none', 0, 1) +
      slot('6', mpPot ? DB.items[mpPot].name : 'MP', mpPot ? `x${p.inventory[mpPot]}` : 'none', 0, 1);
    const hb = $('#hotbar');
    if (hb.dataset.last !== html) { hb.innerHTML = html; hb.dataset.last = html; }
  }

  private toast(msg: string, kind: string) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').prepend(el);
    setTimeout(() => el.classList.add('fade'), 3500);
    setTimeout(() => el.remove(), 4200);
    const all = $('#toasts').children;
    while (all.length > 7) all[all.length - 1].remove();
  }

  // ─── Panels ───
  private toggle(p: Panel) {
    if (this.open.has(p)) this.close(p);
    else { this.open.add(p); this.renderPanels(); }
  }
  private close(p: Panel) { this.open.delete(p); this.renderPanels(); }
  private closeAll() { this.open.clear(); this.renderPanels(); }

  private npc(id: string, role: string, name: string) {
    if (role === 'shop') { this.open.add('shop'); this.open.add('inventory'); this.renderPanels(); return; }
    const lines: Record<string, string> = {
      pell: "Welcome to Meadow Town! Head east through the gate into Sunny Pasture. Mice and sheep won't bother you unless you hit them — but watch the crows further east. Press E to pick up what they drop, and sell junk to Mara.",
      calden: 'Skill training opens soon (v0.2). Bring Monster Essence and Training Scrolls — hold on to them!',
      ila: 'The 10-for-1 essence exchange opens soon (v0.2). Keep your Twigs, Bark and Wool.',
    };
    let extra = '';
    const q = id === 'pell' ? quest('sq_welcome') : null;
    if (q && !Game.player.questFlags[q.id]) {
      // v0.1 stub of the starter chain: talking to Pell grants "A First Step" once.
      Game.player.questFlags[q.id] = true;
      const lv = P.gainXp(Game.player, q.reward_xp ?? 0);
      Game.player.coins += q.reward_coins ?? 0;
      q.items.forEach((it) => P.addItem(Game.player, it.id, it.qty));
      const got = [`${q.reward_xp} XP`, `${q.reward_coins} Copper`, ...q.items.map((it) => `${it.qty}× ${DB.items[it.id].name}`)].join(', ');
      extra = `<p class="quest">Quest complete: <b>${esc(q.name)}</b> — ${esc(got)}</p>`;
      this.toast(`Quest: ${q.name} — ${got}`, lv ? 'level' : 'rare');
      Game.save();
    }
    this.dialogText = `<h3>${esc(name)}</h3><p>${esc(lines[id] ?? '...')}</p>${extra}`;
    this.open.add('dialog');
    this.renderPanels();
  }
  private dialogText = '';

  private renderPanels() {
    const p = Game.player;
    if (!p) return;
    for (const name of ['inventory', 'stats', 'shop', 'dialog', 'pause'] as Panel[]) $(`#p-${name}`).hidden = !this.open.has(name);
    document.body.classList.toggle('panel-open', this.open.size > 0);
    if (this.open.has('inventory')) this.renderInventory();
    if (this.open.has('stats')) this.renderStats();
    if (this.open.has('shop')) this.renderShop();
    if (this.open.has('dialog')) $('#p-dialog').innerHTML = `${this.dialogText}<button data-close="dialog">OK</button>`;
    if (this.open.has('pause')) {
      const saved = p.savedAt ? new Date(p.savedAt).toLocaleTimeString() : 'never';
      $('#p-pause').innerHTML = `<h3>Menu</h3><p>Last saved: ${saved}</p>
        <button data-act="save">Save now</button> <button data-act="reset">New game (erase save)</button> <button data-close="pause">Resume</button>`;
    }
  }

  private renderInventory() {
    const p = Game.player;
    const shopping = this.open.has('shop');
    const ids = Object.keys(p.inventory).sort((a, b) => {
      const ta = TYPE_ORDER.indexOf(DB.items[a].item_type), tb = TYPE_ORDER.indexOf(DB.items[b].item_type);
      return ta - tb || DB.items[a].name.localeCompare(DB.items[b].name);
    });
    const rows = ids.map((id) => {
      const it = DB.items[id];
      const qty = p.inventory[id];
      const acts: string[] = [];
      const eff = consumableEffect(id);
      if (it.item_type === 'consumable' && (eff.hp || eff.mp || eff.buff)) acts.push(`<button data-use="${id}">Use</button>`);
      if (it.item_type === 'gear' && DB.gear[id]) {
        const chk = P.canEquip(p, id);
        acts.push(chk.ok ? `<button data-equip="${id}">Equip</button>` : `<small class="warn">${esc(chk.reason ?? '')}</small>`);
      }
      if (shopping) {
        const price = vendorBuyPrice(id);
        acts.push(price !== null ? `<button data-sell="${id}">Sell ${price}c</button>` : '<small>not bought</small>');
      }
      return `<tr title="${esc(it.description)}"><td class="t-${it.item_type}">${esc(it.name)}</td><td>x${qty}</td><td>${acts.join(' ')}</td></tr>`;
    });
    const eq = P.EQUIP_SLOTS.map((s) => {
      const id = p.equipment[s];
      return `<tr><td>${s}</td><td>${id ? esc(DB.items[id].name) : '<small>—</small>'}</td><td>${id ? `<button data-unequip="${s}">Remove</button>` : ''}</td></tr>`;
    }).join('');
    $('#p-inventory').innerHTML = `<h3>Inventory <small>(I)</small><button class="x" data-close="inventory">×</button></h3>
      <div class="coins">● ${p.coins} Copper Coin</div>
      <table>${rows.join('') || '<tr><td><small>Empty. Defeat monsters and press E to pick up drops.</small></td></tr>'}</table>
      <h4>Equipped</h4><table>${eq}</table>`;
  }

  private renderStats() {
    const p = Game.player;
    const desc: Record<string, string> = { STR: '+2 attack (×weapon), +4 max HP', INT: '+5 max MP', AGI: '+0.4% crit, faster attacks', SPI: '+0.15 MP/s regen' };
    const rows = P.STATS.map((s) => `<tr><td><b>${s}</b></td><td>${p.stats[s]}</td><td><button data-stat="${s}" ${p.unspent ? '' : 'disabled'}>+</button></td><td><small>${desc[s]}</small></td></tr>`).join('');
    const rage = buffNumbers('rage');
    $('#p-stats').innerHTML = `<h3>Character <small>(C)</small><button class="x" data-close="stats">×</button></h3>
      <p>Level ${p.level} Warrior · Points to spend: <b>${p.unspent}</b></p>
      <table>${rows}</table>
      <table class="derived">
        <tr><td>Attack</td><td>${P.attack(p)}</td></tr><tr><td>Defense</td><td>${P.defense(p)}</td></tr>
        <tr><td>Max HP / MP</td><td>${P.maxHp(p)} / ${P.maxMp(p)}</td></tr>
        <tr><td>MP regen</td><td>${P.mpRegenPerSec(p).toFixed(2)}/s</td></tr>
        <tr><td>Crit chance</td><td>${P.critChance(p).toFixed(1)}%</td></tr>
        <tr><td>Attack interval</td><td>${(P.attackIntervalMs(p) / 1000).toFixed(2)}s</td></tr>
        <tr><td>Rage</td><td>+${rage.dealtPct}% dealt / +${rage.takenPct}% taken</td></tr>
      </table>`;
  }

  private renderShop() {
    const p = Game.player;
    const rows = DB.shop.filter((s) => s.role === 'sell' && DB.items[s.item_id]).map((s) => {
      const it = DB.items[s.item_id];
      const price = shopPrice(s.item_id)!;
      return `<tr title="${esc(it.description)}"><td class="t-${it.item_type}">${esc(it.name)}</td><td>${price}c</td><td><small>${esc(s.notes ?? '')}</small></td>
        <td><button data-buy="${s.item_id}" ${p.coins >= price ? '' : 'disabled'}>Buy</button></td></tr>`;
    }).join('');
    $('#p-shop').innerHTML = `<h3>Mara's Shop<button class="x" data-close="shop">×</button></h3>
      <div class="coins">● ${p.coins} Copper Coin</div><table>${rows}</table>
      <p><small>Sell from your inventory (right). Mara buys junk at full price, consumables and gear at half. She doesn't buy materials or essences.</small></p>`;
  }

  private onClick(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const p = Game.player;
    const d = t.dataset;
    if (d.close) this.close(d.close as Panel);
    else if (d.stat) { P.spendPoint(p, d.stat as P.Stat); Game.save(); }
    else if (d.use) Game.events.emit('use-item', d.use);
    else if (d.equip) { const err = P.equip(p, d.equip); if (err) this.toast(err, 'warn'); }
    else if (d.unequip) P.unequip(p, d.unequip as P.EquipSlot);
    else if (d.buy) {
      const price = shopPrice(d.buy);
      if (price !== null && p.coins >= price) { p.coins -= price; P.addItem(p, d.buy, 1); this.toast(`Bought ${DB.items[d.buy].name}`, 'loot'); Game.save(); }
    } else if (d.sell) {
      const price = vendorBuyPrice(d.sell);
      if (price !== null && P.removeItem(p, d.sell)) { p.coins += price; this.toast(`Sold ${DB.items[d.sell].name} for ${price}c`, 'loot'); Game.save(); }
    } else if (d.act === 'save') { Game.save(); this.toast('Saved', 'info'); }
    else if (d.act === 'reset') {
      if (confirm('Erase your save and start a new character?')) { clearSave(); location.reload(); }
    }
    Game.changed();
    t.blur(); // keep keyboard focus on the game
  }
}
