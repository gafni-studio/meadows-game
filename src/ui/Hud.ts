import { DB, f, quest, xpToNext, shopPrice, vendorBuyPrice, consumableEffect } from '../data/db';
import { ASSUME } from '../data/assumptions';
import { DEV_CONSOLE } from '../config';
import { Game } from '../systems/GameState';
import { clearSave } from '../systems/Save';
import { runCommand } from '../systems/Cheats';
import * as P from '../systems/Player';
import { HP_POTIONS, MP_POTIONS } from '../scenes/WorldScene';
import { iconUrl, skillIconUrl } from '../art/sprites';
import { displayName, formatAffix, instanceQuality, rangeOf, isGear } from '../systems/Gear';
import * as Sk from '../systems/Skills';
import { playSfx } from '../systems/Sfx';

/**
 * DOM overlay UI: HUD, hotbar, toasts, windows and the test console.
 *
 * Keyboard model (mouse optional):
 *   any window open → gameplay keys are ignored (Game.menuOpen)
 *   ← ↑ ↓ →  move the highlighted selection (spatial: works for grids, lists, tabs, buttons)
 *   Enter    activate the selection (OK / buy / sell / use / equip / +1 stat)
 *   Tab      switch Buy/Sell tab in the shop
 *   Esc      close the top window (or open the menu when none is open)
 *   I / C / K  toggle inventory / character / skills,  `  toggle the console
 *   M        (bag / storage) pick up the selected stack → arrows → Enter to place (swap), Esc cancels
 *   X / Del  (bag) drop the selected stack on the ground (asks first for stacks and valuables)
 * Mouse: drag tiles between slots / bag ↔ storage; drag out of the window to drop on the ground.
 * Every [data-nav] element is selectable; activation simply clicks it, so mouse and
 * keyboard share one code path.
 */
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
type Panel = 'inventory' | 'stats' | 'shop' | 'storage' | 'skills' | 'dialog' | 'pause' | 'confirm' | 'drop';
const PANELS: Panel[] = ['inventory', 'stats', 'shop', 'storage', 'skills', 'dialog', 'pause', 'confirm', 'drop'];
const TYPE_ORDER = ['consumable', 'gear', 'currency', 'material', 'misc'];
const TYPE_LABEL: Record<string, string> = { consumable: 'Consumable', gear: 'Gear', currency: 'Currency', material: 'Material', misc: 'Sellable junk' };

export class Hud {
  private stack: Panel[] = [];
  private sel: Partial<Record<Panel, string>> = {}; // selected data-key per panel
  private shopTab: 'buy' | 'sell' = 'buy';
  private areaName = '';
  private dialogHtml = '';
  private consoleHistory: string[] = [];
  private historyIdx = -1;
  /** Stack picked up for moving (keyboard M or mouse drag). */
  private held: { c: P.Container; idx: number } | null = null;
  private dropItem: string | null = null;
  private dropUid: string | null = null;

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
      <div id="levelup" hidden></div>
      <div id="help">F attack (hold) · 1 Power Strike · 2 Rage · 5 HP · 6/G MP · E pick up/talk · I inventory · C stats · K skills · Esc menu${DEV_CONSOLE ? ' · ` console' : ''}</div>
      <div id="dead" hidden>Defeated…</div>
      ${PANELS.map((p) => `<div class="panel" id="p-${p}" hidden></div>`).join('')}
      <div id="console" hidden><div id="console-out"></div><input id="console-in" autocomplete="off" spellcheck="false" placeholder="type help, Enter to run, Esc to close" /></div>`;

    Game.events.on('changed', () => this.renderPanels());
    Game.events.on('toast', (m: string, k: string, icon?: string) => this.toast(m, k, icon));
    Game.events.on('levelup', (lvl: number, pts: number) => this.levelBanner(lvl, pts));
    Game.events.on('chest', () => { this.held = null; this.open('storage'); });
    Game.events.on('area', (n: string) => {
      this.areaName = n;
      this.stack = this.stack.filter((p) => p !== 'shop' && p !== 'dialog' && p !== 'storage');
      this.renderPanels();
      this.toast(`Entered ${n}`, 'info');
    });
    Game.events.on('close-all', () => { this.stack = []; this.renderPanels(); });
    Game.events.on('dead', (d: boolean) => ($('#dead').hidden = !d));
    Game.events.on('npc', (id: string, role: string, name: string) => this.npc(id, role, name));
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('mouseover', (e) => {
      const el = (e.target as HTMLElement).closest('[data-nav]') as HTMLElement | null;
      const panel = el?.closest('.panel')?.id.replace('p-', '') as Panel | undefined;
      if (el && panel && this.sel[panel] !== el.dataset.key) { this.sel[panel] = el.dataset.key; this.applySelection(panel); }
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.setupDrag();
    this.setupConsole();
    const tick = () => { this.renderHud(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ───────────────────────── keyboard ─────────────────────────
  private onKey(e: KeyboardEvent) {
    if (e.key === '`' || e.code === 'Backquote') {
      if (DEV_CONSOLE) { e.preventDefault(); this.toggleConsole(); }
      return;
    }
    if (Game.consoleOpen) {
      // the console input handles its own keys; this only runs if it lost focus (e.g. a click on the game)
      if (e.key === 'Escape') { e.preventDefault(); this.toggleConsole(false); }
      else $<HTMLInputElement>('#console-in').focus();
      return;
    }
    const k = e.key;
    const top = this.stack[this.stack.length - 1];
    if (k === 'Escape') {
      e.preventDefault();
      if (this.held) { this.held = null; this.renderPanels(); return; }
      if (top) this.close(top); else this.open('pause');
      return;
    }
    if ((top === 'inventory' || top === 'storage') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const cur = this.selectedEl(top);
      if (k === 'm' || k === 'M') {
        e.preventDefault();
        if (this.held) this.placeHeld(cur);
        else if (cur?.dataset.item && cur.dataset.idx) { this.held = { c: cur.dataset.c as P.Container, idx: Number(cur.dataset.idx) }; this.renderPanels(); }
        return;
      }
      if (k === 'Enter' && this.held) { e.preventDefault(); this.placeHeld(cur); return; }
      if ((k === 'x' || k === 'X' || k === 'Delete') && top === 'inventory' && cur?.dataset.item && cur.dataset.c === 'bag') { e.preventDefault(); this.requestDrop(cur.dataset.item, cur.dataset.uid); return; }
      if (k === '1' && top === 'storage' && cur?.dataset.item && cur.dataset.idx) { e.preventDefault(); this.transfer(cur, 1); return; }
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      if (k === 'i' || k === 'I') { this.toggle('inventory'); return; }
      if (k === 'c' || k === 'C') { this.toggle('stats'); return; }
      if (k === 'k' || k === 'K') { this.toggle('skills'); return; }
    }
    if (!top) return;
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[k]) { e.preventDefault(); this.move(top, dirs[k]); return; }
    if (top === 'skills' && ['1', '2', '3', '4'].includes(k)) {
      e.preventDefault();
      const cur = this.selectedEl('skills');
      if (cur?.dataset.skill && Sk.known(Game.player, cur.dataset.skill)) {
        Sk.assignBar(Game.player, Number(k) - 1, cur.dataset.skill);
        Game.save(); Game.changed();
      }
      return;
    }
    if (k === 'Enter') { e.preventDefault(); this.selectedEl(top)?.click(); return; }
    if (k === 'Tab' && top === 'shop') { e.preventDefault(); this.shopTab = this.shopTab === 'buy' ? 'sell' : 'buy'; this.sel.shop = undefined; this.renderPanels(); }
  }

  private navEls(panel: Panel): HTMLElement[] {
    return [...$(`#p-${panel}`).querySelectorAll<HTMLElement>('[data-nav]')];
  }
  private selectedEl(panel: Panel): HTMLElement | null {
    const els = this.navEls(panel);
    // Default to the first tile (not the tab row) so Enter acts on an item right away.
    return els.find((el) => el.dataset.key === this.sel[panel]) ?? els.find((el) => el.classList.contains('tile') && !!el.dataset.item && el.dataset.mode !== 'equipped') ?? els.find((el) => el.classList.contains('tile') && el.dataset.mode !== 'equipped') ?? els.find((el) => el.classList.contains('tile')) ?? els[0] ?? null;
  }

  /** Spatial navigation: nearest element in the arrow's direction; wraps in DOM order for ←/→. */
  private move(panel: Panel, [dx, dy]: [number, number]) {
    const els = this.navEls(panel);
    const cur = this.selectedEl(panel);
    if (!cur || !els.length) return;
    const c = cur.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of els) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const primary = dx ? (ex - cx) * dx : (ey - cy) * dy;
      const cross = dx ? Math.abs(ey - cy) : Math.abs(ex - cx);
      if (primary <= 4) continue;
      if (dx && cross > Math.max(c.height, r.height) * 0.6) continue; // same row for ←/→
      const score = primary + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best && dx) best = els[(els.indexOf(cur) + dx + els.length) % els.length]; // wrap to next/prev row
    if (best) { this.sel[panel] = best.dataset.key; this.applySelection(panel); }
  }

  private applySelection(panel: Panel) {
    const els = this.navEls(panel);
    const cur = this.selectedEl(panel);
    for (const el of els) {
      el.classList.toggle('sel', el === cur);
      el.classList.toggle('held', !!this.held && el.dataset.c === this.held.c && Number(el.dataset.idx) === this.held.idx && !!el.dataset.item);
    }
    cur?.scrollIntoView({ block: 'nearest' });
    if (panel === 'shop' && cur?.dataset.tab && cur.dataset.tab !== this.shopTab) {
      this.shopTab = cur.dataset.tab as 'buy' | 'sell'; // ←/→ on the tab row switches tabs
      this.renderPanels();
      return;
    }
    if (cur && (panel === 'shop' || panel === 'inventory' || panel === 'storage' || panel === 'skills')) this.renderPreview(panel, cur);
  }

  // ───────────────────────── HUD ─────────────────────────
  private renderHud() {
    const p = Game.player;
    if (!p) return;
    const set = (sel: string, cur: number, max: number, label: string) => {
      const el = $(sel);
      (el.firstElementChild as HTMLElement).style.width = `${Math.max(0, Math.min(1, cur / max)) * 100}%`;
      (el.lastElementChild as HTMLElement).textContent = label;
    };
    const mh = P.maxHp(p), mm = P.maxMp(p), nx = xpToNext(p.level);
    set('#hud .hp', p.hp, mh, `HP ${Math.ceil(Math.max(0, p.hp))} / ${mh}${Game.regenActive ? '  ✚ regen' : ''}`);
    $('#hud .hp').classList.toggle('regen', Game.regenActive);
    set('#hud .mp', p.mp, mm, `MP ${Math.floor(p.mp)} / ${mm}`);
    set('#hud .xp', p.xp, nx, `XP ${p.xp} / ${nx} (${((p.xp / nx) * 100).toFixed(1)}%)`);
    $('#lvl').textContent = `Lv ${p.level} Warrior${p.unspent ? ` (+${p.unspent} pts)` : ''}${p.cheated ? ' ⚑' : ''}`;
    $('#lvl').title = p.cheated ? 'Test console used on this save' : '';
    $('#area').textContent = this.areaName;
    $('#coins').innerHTML = `<img src="${iconUrl('copper_coin')}"> ${p.coins} Copper${p.cheats.god ? ' · <b>GOD</b>' : ''}`;

    const now = Game.now;
    const buffs: string[] = [];
    for (const [id, until] of Object.entries(Game.buffs)) {
      if (until > now) buffs.push(`${DB.skills[id]?.name ?? DB.items[id]?.name ?? id} ${Math.ceil((until - now) / 1000)}s`);
    }
    $('#buffs').textContent = buffs.join(' · ');

    const cd = (id: string) => Math.max(0, (Game.cooldowns[id] ?? 0) - now);
    const slot = (key: string, label: string, sub: string, cdMs: number, total: number, icon = '') =>
      `<div class="slot"><kbd>${key}</kbd>${icon ? `<img src="${icon}">` : ''}<div>${label}</div><small>${sub}</small>${cdMs > 0 ? `<em style="height:${(cdMs / total) * 100}%"></em>` : ''}</div>`;
    const firstOwned = (ids: string[]) => ids.find((i) => (p.inventory[i] ?? 0) > 0);
    const hpPot = firstOwned(HP_POTIONS), mpPot = firstOwned(MP_POTIONS);
    const bar = Sk.barOf(p);
    const skillSlot = (key: string, i: number) => {
      const id = bar[i];
      const sk = id ? DB.skills[id] : null;
      if (!sk || !id) return slot(key, '—', 'empty', 0, 1);
      const r = Sk.rankOf(p, id);
      const sub = sk.damage_multiplier ? `${Math.round(Sk.damageMul(id, r) * 100)}% · ${sk.mp_cost} MP` : `${sk.mp_cost} MP · r${r}`;
      return slot(key, `${sk.name}${r ? ` r${r}` : ''}`, sub, cd(id), Sk.cooldownOf(id), skillIconUrl(id));
    };
    const html =
      slot('F', 'Attack', 'hold', 0, 1) +
      skillSlot('1', 0) + skillSlot('2', 1) + skillSlot('3', 2) + skillSlot('4', 3) +
      slot('5', hpPot ? DB.items[hpPot].name : 'HP', hpPot ? `x${p.inventory[hpPot]}` : 'none', 0, 1, hpPot ? iconUrl(hpPot) : '') +
      slot('6', mpPot ? DB.items[mpPot].name : 'MP', mpPot ? `x${p.inventory[mpPot]}` : 'none', 0, 1, mpPot ? iconUrl(mpPot) : '');
    const hb = $('#hotbar');
    if (hb.dataset.last !== html) { hb.innerHTML = html; hb.dataset.last = html; }
  }

  private toast(msg: string, kind: string, icon?: string) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon && iconUrl(icon) ? `<img src="${iconUrl(icon)}" alt="">` : `<i class="dot"></i>`}<span>${esc(msg)}</span>`;
    $('#toasts').prepend(el);
    setTimeout(() => el.classList.add('fade'), 3200);
    setTimeout(() => el.remove(), 3900);
    const all = $('#toasts').children;
    while (all.length > 6) all[all.length - 1].remove();
  }

  /** Centered, non-blocking level-up announcement (CSS burst + glow). */
  private levelBanner(level: number, pts: number) {
    const el = $('#levelup');
    el.innerHTML = `<div class="burst"></div><div class="lv-title">LEVEL UP!</div><div class="lv-sub">Level ${level} · +${pts} ability points <kbd>C</kbd></div>`;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
    clearTimeout((this as unknown as { lvT?: number }).lvT);
    (this as unknown as { lvT?: number }).lvT = window.setTimeout(() => { el.hidden = true; el.classList.remove('show'); }, 2600);
  }

  // ───────────────────────── bag / storage moves ─────────────────────────
  private placeHeld(target: HTMLElement | null) {
    const h = this.held;
    this.held = null;
    if (h && target?.dataset.idx !== undefined && target.dataset.c) {
      P.moveSlot(Game.player, h.c, h.idx, target.dataset.c as P.Container, Number(target.dataset.idx));
      Game.save();
      const panel = this.stack[this.stack.length - 1];
      if (panel) this.keepSel(panel, target.dataset.c as P.Container, Number(target.dataset.idx));
    }
    Game.changed();
  }

  /** Storage window: move a stack (or `qty`) to the other side. */
  private transfer(el: HTMLElement, qty?: number) {
    const from = el.dataset.c as P.Container;
    const to: P.Container = from === 'bag' ? 'storage' : 'bag';
    if (!P.moveSlot(Game.player, from, Number(el.dataset.idx), to, -1, qty)) { this.toast(`${to === 'bag' ? 'Bag' : 'Storage'} is full`, 'warn'); return; }
    Game.save();
    this.keepSel('storage', from, Number(el.dataset.idx));
    Game.changed();
  }

  /** Keep the highlight on the same slot after its contents changed. */
  private keepSel(panel: Panel, c: P.Container, idx: number) {
    const id = P.layout(Game.player, c)[idx];
    this.sel[panel] = id ? `${c === 'bag' ? 'inv' : 'st'}:${id}` : `${c}-slot:${idx}`;
  }

  private isValuable(id: string) {
    const it = DB.items[id];
    return it.item_type === 'gear' || it.item_type === 'currency' || (it.sell_price ?? 0) >= 20;
  }

  /** Drop to the ground; confirm first for stacks, valuables, and every gear instance. */
  private requestDrop(id: string, uid?: string) {
    if (!Game.scene || Game.dead) return;
    if (uid && Game.player.gearItems[uid]) {
      this.dropItem = id; this.dropUid = uid; this.sel.drop = 'dropall'; this.open('drop'); return;
    }
    const n = Game.player.inventory[id] ?? 0;
    if (n <= 0) return;
    this.dropUid = null;
    if (n > 1 || this.isValuable(id)) { this.dropItem = id; this.sel.drop = n > 1 ? 'drop1' : 'dropall'; this.open('drop'); return; }
    this.doDrop(id, 1);
  }
  private doDrop(id: string, qty: number, uid?: string | null) {
    const g = uid ? Game.player.gearItems[uid] : undefined;
    const label = g ? displayName(g) : `${DB.items[id].name} ×${qty}`;
    if (Game.scene?.dropFromBag(id, qty, uid ?? undefined)) this.toast(`Dropped ${label}`, 'info', id);
  }

  private setupDrag() {
    document.addEventListener('dragstart', (e) => {
      const t = (e.target as HTMLElement).closest('.tile') as HTMLElement | null;
      if (!t?.dataset.item || t.dataset.idx === undefined) { e.preventDefault(); return; }
      this.held = { c: t.dataset.c as P.Container, idx: Number(t.dataset.idx) };
      e.dataTransfer?.setData('text/plain', t.dataset.item);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      t.classList.add('held');
    });
    document.addEventListener('dragover', (e) => { if (this.held) e.preventDefault(); });
    document.addEventListener('drop', (e) => {
      if (!this.held) return;
      e.preventDefault();
      const t = (e.target as HTMLElement).closest('.tile') as HTMLElement | null;
      const inPanel = (e.target as HTMLElement).closest('.panel');
      if (t?.dataset.idx !== undefined && t.dataset.c) this.placeHeld(t);
      else if (!inPanel && this.held.c === 'bag') {
        const ref = Game.player.bagSlots[this.held.idx];
        this.held = null;
        if (ref) {
          const g = Game.player.gearItems[ref];
          this.requestDrop(g ? g.itemId : ref, g?.uid);
        }
        this.renderPanels();
      } else { this.held = null; this.renderPanels(); }
    });
    document.addEventListener('dragend', () => { if (this.held) { this.held = null; this.renderPanels(); } });
  }

  // ───────────────────────── windows ─────────────────────────
  private open(p: Panel) {
    if (!this.stack.includes(p) && (p === 'inventory' || p === 'storage' || p === 'shop')) this.sel[p] = undefined; // reopen at the first item
    this.stack = this.stack.filter((x) => x !== p);
    this.stack.push(p);
    this.renderPanels();
  }
  private close(p: Panel) { this.stack = this.stack.filter((x) => x !== p); this.renderPanels(); }
  private toggle(p: Panel) { if (this.stack.includes(p)) this.close(p); else this.open(p); }

  private npc(id: string, role: string, name: string) {
    if (role === 'shop') { this.shopTab = 'buy'; this.open('shop'); return; }
    if (role === 'trainer') { this.open('skills'); return; }
    const lines: Record<string, string> = {
      pell: "Welcome to Meadow Town! Head east through the gate into Sunny Pasture. Mice and sheep won't bother you unless you hit them — but watch the crows further east. Press E to pick up what they drop, and sell junk to Mara. Calden trains skills — bring Monster Essence and Training Scrolls.",
      calden: 'Bring Monster Essence and Training Scrolls to rank your basic skills, and category essence plus materials for Nature, Elemental and Spiritual skills.',
      ila: 'The 10-for-1 essence exchange opens later in v0.2. Keep your Twigs, Bark and Wool.',
    };
    let extra = '';
    const q = id === 'pell' ? quest('sq_welcome') : null;
    if (q && !Game.player.questFlags[q.id]) {
      // v0.1 stub of the starter chain: talking to Pell grants "A First Step" once.
      Game.player.questFlags[q.id] = true;
      const lv = P.gainXp(Game.player, q.reward_xp ?? 0);
      if (lv) Game.scene?.levelUpFx(lv);
      Game.player.coins += q.reward_coins ?? 0;
      q.items.forEach((it) => P.addItem(Game.player, it.id, it.qty));
      const got = [`${q.reward_xp} XP`, `${q.reward_coins} Copper`, ...q.items.map((it) => `${it.qty}× ${DB.items[it.id].name}`)].join(', ');
      extra = `<p class="quest">Quest complete: <b>${esc(q.name)}</b> — ${esc(got)}</p>`;
      this.toast(`Quest: ${q.name} — ${got}`, 'rare');
      Game.save();
    }
    this.dialogHtml = `<h3>${esc(name)}</h3><p>${esc(lines[id] ?? '...')}</p>${extra}`;
    this.sel.dialog = undefined;
    this.open('dialog');
  }

  private renderPanels() {
    const p = Game.player;
    if (!p) return;
    Game.menuOpen = this.stack.length > 0;
    Game.storageOpen = this.stack.includes('storage');
    const top = this.stack[this.stack.length - 1];
    for (const name of PANELS) {
      const el = $(`#p-${name}`);
      el.hidden = !this.stack.includes(name);
      el.classList.toggle('top', name === top);
    }
    if (this.stack.includes('inventory')) this.renderInventory();
    if (this.stack.includes('stats')) this.renderStats();
    if (this.stack.includes('shop')) this.renderShop();
    if (this.stack.includes('skills')) this.renderSkills();
    if (this.stack.includes('storage')) this.renderStorage();
    if (this.stack.includes('drop') && this.dropItem) {
      const id = this.dropItem;
      const piece = this.dropUid ? p.gearItems[this.dropUid] : undefined;
      const n = piece ? 1 : (p.inventory[id] ?? 0);
      if (n <= 0) this.stack = this.stack.filter((x) => x !== 'drop');
      else {
        const name = piece ? displayName(piece) : DB.items[id].name;
        $('#p-drop').innerHTML = `<h3>Drop ${esc(name)}?</h3><p>${piece ? 'This unique piece keeps its rolled stats on the ground.' : `You have ${n}.`} It lands in front of you and disappears after ${Math.round(ASSUME.dropLifetimeMs / 60000)} min if nobody picks it up.</p>
        <div class="btns">${!piece && n > 1 ? '<button data-nav data-key="drop1" data-act="drop1">Drop 1</button>' : ''}<button data-nav data-key="dropall" data-act="dropall" class="danger">Drop ${!piece && n > 1 ? `all ×${n}` : ''}</button><button data-nav data-key="no" data-close="drop">Cancel</button></div>${hint('←→ select · Enter choose · Esc cancel')}`;
      }
    }
    if (this.stack.includes('dialog')) $('#p-dialog').innerHTML = `${this.dialogHtml}<div class="btns"><button data-nav data-key="ok" data-close="dialog">OK</button></div>${hint('Enter OK · Esc close')}`;
    if (this.stack.includes('pause')) {
      const saved = p.savedAt ? new Date(p.savedAt).toLocaleTimeString() : 'never';
      $('#p-pause').innerHTML = `<h3>Menu</h3><p>Last saved: ${saved}${p.cheated ? ' · <span class="warn">test console used</span>' : ''}</p>
        <div class="btns col"><button data-nav data-key="resume" data-close="pause">Resume</button>
        <button data-nav data-key="save" data-act="save">Save now</button>
        <button data-nav data-key="reset" data-act="reset">New game (erase save)</button></div>${hint('↑↓ select · Enter choose · Esc close')}`;
    }
    if (this.stack.includes('confirm')) {
      $('#p-confirm').innerHTML = `<h3>Erase save?</h3><p>This deletes your character and starts over.</p>
        <div class="btns"><button data-nav data-key="no" data-close="confirm">Cancel</button><button data-nav data-key="yes" data-act="erase" class="danger">Erase save</button></div>${hint('←→ select · Enter choose · Esc cancel')}`;
    }
    for (const name of this.stack) this.applySelection(name);
  }

  private tile(key: string, itemId: string | null, mode: string, qty: string, price: string, dim = false, extraAttr = '', inst?: import('../systems/Gear').GearInstance | null) {
    const it = itemId ? DB.items[itemId] : null;
    const q = inst ? instanceQuality(inst) : '';
    const magic = inst?.magic ? ' magic' : '';
    return `<button class="tile${dim ? ' dim' : ''}${magic}${q ? ` q-${q}` : ''} t-${it?.item_type ?? 'empty'}" data-nav data-key="${key}" data-item="${itemId ?? ''}" data-mode="${mode}" ${extraAttr}>
      ${it ? `<img src="${iconUrl(itemId!)}" alt="">` : '<span class="empty"></span>'}
      ${inst?.magic ? '<span class="spark">✦</span>' : ''}
      ${qty ? `<span class="qty">${qty}</span>` : ''}<span class="price">${price}</span></button>`;
  }

  private renderShop() {
    const p = Game.player;
    let tiles = '';
    if (this.shopTab === 'buy') {
      for (const s of DB.shop.filter((s) => s.role === 'sell' && DB.items[s.item_id])) {
        const price = shopPrice(s.item_id)!;
        tiles += this.tile(`buy:${s.item_id}`, s.item_id, 'buy', '', `${price}c`, p.coins < price, `data-buy="${s.item_id}"`);
      }
    } else {
      for (const id of this.sortedInv()) {
        const price = vendorBuyPrice(id);
        tiles += this.tile(`sell:${id}`, id, 'sell', `${p.inventory[id]}`, price !== null ? `${price}c` : '—', price === null, price !== null ? `data-sell="${id}"` : '');
      }
      for (const g of Object.values(p.gearItems).filter((g) => g.container === 'bag' && !Object.values(p.equipment).includes(g.uid))) {
        const price = vendorBuyPrice(g.itemId);
        tiles += this.tile(`sell:${g.uid}`, g.itemId, 'sell', g.magic ? '✦' : '', price !== null ? `${price}c` : '—', price === null, price !== null ? `data-sell="${g.itemId}" data-uid="${g.uid}"` : `data-uid="${g.uid}"`, g);
      }
      if (!tiles) tiles = '<p class="muted">Nothing to sell yet.</p>';
    }
    $('#p-shop').innerHTML = `<div class="frame-title">Mara's Shop<button class="x" data-close="shop">×</button></div>
      <div class="tabs"><button data-nav data-key="tab:buy" data-tab="buy" class="${this.shopTab === 'buy' ? 'on' : ''}">Buy</button><button data-nav data-key="tab:sell" data-tab="sell" class="${this.shopTab === 'sell' ? 'on' : ''}">Sell</button>
      <span class="coins"><img src="${iconUrl('copper_coin')}"> ${p.coins}</span></div>
      <div class="split"><div class="grid">${tiles}</div><div class="preview" id="shop-preview"></div></div>
      ${hint(`←↑↓→ select · Enter ${this.shopTab === 'buy' ? 'buy' : 'sell'} · Tab Buy/Sell · Esc close`)}`;
  }

  private sortedInv(): string[] {
    const inv = Game.player.inventory;
    return Object.keys(inv).filter((id) => DB.items[id]).sort((a, b) => {
      const ta = TYPE_ORDER.indexOf(DB.items[a].item_type), tb = TYPE_ORDER.indexOf(DB.items[b].item_type);
      return ta - tb || DB.items[a].name.localeCompare(DB.items[b].name);
    });
  }

  private renderInventory() {
    const p = Game.player;
    const eq = P.EQUIP_SLOTS.map((s) => {
      const piece = P.inst(p, p.equipment[s]);
      const id = piece?.itemId ?? null;
      return this.tile(`eq:${s}`, id, 'equipped', '', s, false, `data-slot="${s}"${piece ? ` data-uid="${piece.uid}" data-unequip="${s}"` : ''}`, piece);
    }).join('');
    const items = this.slotTiles('bag', (id, uid) => {
      if (uid) return `data-equip="${uid}" data-uid="${uid}"`;
      const it = DB.items[id];
      const eff = consumableEffect(id);
      const usable = it.item_type === 'consumable' && (eff.hp || eff.mp || eff.buff);
      return usable ? `data-use="${id}"` : '';
    }, 'inv');
    $('#p-inventory').innerHTML = `<div class="frame-title">Inventory <small>(I)</small><button class="x" data-close="inventory">×</button></div>
      <div class="tabs"><span class="label">Equipped</span><span class="coins"><img src="${iconUrl('copper_coin')}"> ${p.coins}</span></div>
      <div class="grid eq">${eq}</div>
      <div class="split"><div class="grid bag">${items}</div><div class="preview" id="inv-preview"></div></div>
      ${hint(this.held ? 'Moving: ←↑↓→ pick a slot · Enter / M place · Esc cancel' : '←↑↓→ select · Enter use / equip / remove · M move · X drop · drag with the mouse · Esc close')}`;
  }

  /** Tiles for every slot of a container (filled stacks + empty slots, all selectable and draggable). */
  private slotTiles(c: P.Container, attrFor: (id: string, uid?: string) => string, mode: string): string {
    const p = Game.player;
    const cnt = c === 'bag' ? p.inventory : p.storage;
    const prefix = c === 'bag' ? 'inv' : 'st';
    return P.layout(p, c).map((ref, i) => {
      const base = `data-c="${c}" data-idx="${i}"`;
      if (!ref) return this.tile(`${c}-slot:${i}`, null, mode, '', '', false, base);
      const piece = p.gearItems[ref];
      if (piece) {
        return this.tile(`${prefix}:${ref}`, piece.itemId, mode, piece.magic ? '✦' : '', '', false,
          `${base} data-uid="${piece.uid}" draggable="true" ${attrFor(piece.itemId, piece.uid)}`, piece);
      }
      return this.tile(`${prefix}:${ref}`, ref, mode, `${cnt[ref]}`, '', false, `${base} draggable="true" ${attrFor(ref)}`);
    }).join('');
  }

  private renderStorage() {
    const store = this.slotTiles('storage', () => 'data-xfer="1"', 'storage');
    const bag = this.slotTiles('bag', () => 'data-xfer="1"', 'bagstore');
    $('#p-storage').innerHTML = `<div class="frame-title">Storage chest<button class="x" data-close="storage">×</button></div>
      <div class="two"><div><div class="label">Chest</div><div class="grid st">${store}</div></div>
      <div><div class="label">Bag</div><div class="grid st">${bag}</div></div>
      <div class="preview" id="storage-preview"></div></div>
      ${hint(this.held ? 'Moving: ←↑↓→ pick a slot · Enter / M place · Esc cancel' : '←↑↓→ select · Enter move stack across · 1 move one · M move to a slot · drag with the mouse · Esc close')}`;
  }

  private renderSkills() {
    const p = Game.player;
    const BRANCH: Record<string, string> = { basic: 'Basic', nature: 'Nature', elemental: 'Elemental', spiritual: 'Spiritual' };
    const tiles = Sk.skillsFor(p.classId).filter((sk) => Sk.canSee(p, sk)).map((sk) => {
      const r = Sk.rankOf(p, sk.id);
      const un = Sk.unlockStatus(p, sk);
      const costs = r < (sk.max_rank ?? 10) ? Sk.nextCost(sk.id, r + 1) : [];
      const afford = costs.length > 0 && Sk.canAfford(p, costs);
      const maxed = r >= (sk.max_rank ?? 10);
      const dim = !un.ok || (!afford && !maxed);
      const known = Sk.known(p, sk.id);
      const qty = known ? `r${r}` : (un.ok ? 'learn' : '—');
      const attr = `data-skill="${sk.id}" data-mode="${known ? 'skill' : 'locked'}"${!maxed && un.ok ? ` data-train="${sk.id}"` : ''}`;
      return `<button class="tile${dim ? ' dim' : ''} t-skill t-${sk.branch}" data-nav data-key="sk:${sk.id}" ${attr}>
        <img src="${skillIconUrl(sk.id)}" alt="">
        <span class="qty">${qty}</span><span class="price">${BRANCH[sk.branch] ?? sk.branch}</span></button>`;
    }).join('');
    const bound = Sk.barOf(p).map((id, i) => `<span class="barbind"><kbd>${i + 1}</kbd>${id ? `<img src="${skillIconUrl(id)}"> ${esc(DB.skills[id].name)}` : '<i>empty</i>'}</span>`).join('');
    $('#p-skills').innerHTML = `<div class="frame-title">Skill training <small>(K)</small><button class="x" data-close="skills">×</button></div>
      <p class="muted">Train at Calden, or open this window with K. Essence is the main gate; rares are only needed at ranks 5 and 10. Press 1–4 to bind the selected skill.</p>
      <div class="barbinds">${bound}</div>
      <div class="split"><div class="grid sk">${tiles}</div><div class="preview" id="skills-preview"></div></div>
      ${hint('←↑↓→ select · Enter train / learn · 1-4 bind · Esc close')}`;
  }

    /** Item preview for the hovered/selected tile. */
  private renderPreview(panel: Panel, el: HTMLElement) {
    const box = $(`#${panel === 'inventory' ? 'inv' : panel}-preview`);
    if (!box) return;
    if (panel === 'skills') { this.renderSkillPreview(box, el); return; }
    const id = el.dataset.item;
    if (!id) {
      box.innerHTML = el.dataset.slot ? `<div class="pv-name">${esc(el.dataset.slot)} slot</div><p class="muted">Empty. Equip gear from your bag.</p>`
        : el.dataset.idx !== undefined ? `<p class="muted">Empty slot${this.held ? ' — Enter to place here' : ''}.</p>` : '<p class="muted">Select an item.</p>';
      return;
    }
    const p = Game.player;
    const it = DB.items[id];
    const eff = consumableEffect(id);
    const g = DB.gear[id];
    const piece = el.dataset.uid ? P.inst(p, el.dataset.uid) : undefined;
    const lines: string[] = [];
    if (eff.hp) lines.push(`+${eff.hp} HP`);
    if (eff.mp) lines.push(`+${eff.mp} MP`);
    if (eff.buff) lines.push(`+${eff.buff.speedPct}% move & attack speed, ${eff.buff.durationS}s`);
    if (g) {
      const wr = rangeOf(g, 'weapon'), dr = rangeOf(g, 'defense');
      if (wr.max > 0) {
        const rolled = piece ? piece.weaponDamage : g.weapon_damage;
        const q = piece ? instanceQuality(piece) : 'avg';
        lines.push(`Weapon damage <span class="q-${q}">${rolled}</span> <span class="range">(${wr.min}–${wr.max})</span> ×${piece?.statMultiplier ?? g.stat_multiplier}`);
      }
      if (dr.max > 0 || g.defense) {
        const rolled = piece ? piece.defense : g.defense;
        const q = piece ? instanceQuality(piece) : 'avg';
        lines.push(`Defense <span class="q-${q}">+${rolled}</span> <span class="range">(${dr.min}–${dr.max})</span>`);
      }
      if (piece?.magic) lines.push(`<span class="magic-tag">Magic · ${esc(piece.prefix ?? '')}</span>${piece.affixes.map((a) => `<br>${esc(formatAffix(a))}`).join('')}`);
      lines.push(`Slot: ${g.slot}${g.class_id !== 'any' ? ` · ${g.class_id}` : ''}`);
      if (g.required_stat && g.required_value > 0) lines.push(`Requires ${g.required_value} ${g.required_stat === 'any' ? 'total points' : g.required_stat}`);
      const chk = P.canEquip(p, id);
      if (!chk.ok && el.dataset.mode !== 'equipped') lines.push(`<span class="warn">${esc(chk.reason ?? '')}</span>`);
    }
    const buy = shopPrice(id);
    const sell = vendorBuyPrice(id);
    const action: Record<string, string> = {
      buy: buy !== null ? (p.coins >= buy ? 'Enter: buy 1' : '<span class="warn">Not enough copper</span>') : '',
      sell: sell !== null ? 'Enter: sell 1' : '<span class="warn">Mara does not buy this</span>',
      inv: el.dataset.use ? 'Enter: use' : el.dataset.equip ? 'Enter: equip' : '',
      equipped: 'Enter: remove',
      storage: 'Enter: take the stack · 1: take one',
      bagstore: 'Enter: store the stack · 1: store one',
    };
    if (el.dataset.mode === 'inv') action.inv = [action.inv, 'M: move', 'X: drop'].filter(Boolean).join(' · ');
    const name = piece ? displayName(piece) : it.name;
    const ownedGear = isGear(id) ? P.gearCount(p, id) : 0;
    const worn = piece && Object.values(p.equipment).includes(piece.uid);
    box.innerHTML = `<div class="pv-head"><img src="${iconUrl(id)}"><div><div class="pv-name${piece?.magic ? ' magic' : ''}${piece ? ` q-${instanceQuality(piece)}` : ''}">${esc(name)}</div><div class="pv-type t-${it.item_type}">${TYPE_LABEL[it.item_type] ?? it.item_type}${piece ? ` · ${instanceQuality(piece)} roll` : ''}</div></div></div>
      <p>${esc(it.description)}</p>
      ${lines.length ? `<div class="pv-eff">${lines.join('<br>')}</div>` : ''}
      <table class="pv-stats">
        ${buy !== null ? `<tr><td>Shop price</td><td>${buy}c</td></tr>` : ''}
        <tr><td>Sells for</td><td>${sell !== null ? `${sell}c` : '—'}</td></tr>
        <tr><td>Owned</td><td>${isGear(id) ? `${ownedGear} piece${ownedGear === 1 ? '' : 's'}${worn ? ' (this one equipped)' : ''}` : `${p.inventory[id] ?? 0}${p.storage[id] ? ` · ${p.storage[id]} in storage` : ''}`}</td></tr>
      </table>
      <div class="pv-act">${action[el.dataset.mode ?? ''] ?? ''}</div>`;
  }

  private renderSkillPreview(box: HTMLElement, el: HTMLElement) {
    const id = el.dataset.skill;
    if (!id || !DB.skills[id]) { box.innerHTML = '<p class="muted">Select a skill.</p>'; return; }
    const p = Game.player;
    const sk = DB.skills[id];
    const r = Sk.rankOf(p, id);
    const known = Sk.known(p, id);
    const un = Sk.unlockStatus(p, sk);
    const max = sk.max_rank ?? 10;
    const costs = r < max ? Sk.nextCost(id, r + 1) : [];
    const costRows = costs.map((c) => {
      const have = c.itemId === 'copper_coin' ? p.coins : (p.inventory[c.itemId] ?? 0);
      const name = c.itemId === 'copper_coin' ? 'Copper' : (DB.items[c.itemId]?.name ?? c.itemId);
      const ok = have >= c.qty;
      const icon = iconUrl(c.itemId);
      return `<tr class="${ok ? '' : 'warn'}"><td>${icon ? `<img src="${icon}">` : ''} ${esc(name)}</td><td>${have} / ${c.qty}</td></tr>`;
    }).join('');
    const act = !un.ok ? `<span class="warn">${esc(un.reason ?? 'Locked')}</span>`
      : r >= max ? 'Max rank'
      : Sk.canAfford(p, costs) ? `Enter: ${known ? 'train' : 'learn'} rank ${r + 1}` : '<span class="warn">Missing materials</span>';
    const bound = Sk.barOf(p).indexOf(id);
    box.innerHTML = `<div class="pv-head"><img src="${skillIconUrl(id)}"><div><div class="pv-name">${esc(sk.name)}</div><div class="pv-type">${sk.branch} · ${sk.type} · rank ${r}/${max}${bound >= 0 ? ` · bound to ${bound + 1}` : ''}</div></div></div>
      <p>${esc(sk.description)}</p>
      <div class="pv-eff">${esc(sk.effect)}</div>
      <div class="pv-eff">${esc(Sk.rankPreview(id, r))} · ${sk.mp_cost} MP</div>
      ${r < max ? `<table class="pv-stats"><tr><th colspan="2">Cost for rank ${r + 1}</th></tr>${costRows}</table>` : ''}
      <div class="pv-act">${act}${known ? ' · 1-4: bind' : ''}</div>`;
  }

  private renderStats() {
    const p = Game.player;
    const desc: Record<string, string> = { STR: `+2 attack (×weapon), +${f('hp_per_str')} max HP`, INT: '+5 max MP', AGI: '+0.4% crit, faster attacks, +acc/eva', SPI: '+0.15 MP/s, faster HP regen' };
    const rows = P.STATS.map((s) => `<button class="statrow" data-nav data-key="stat:${s}" data-stat="${s}" ${p.unspent ? '' : 'aria-disabled="true"'}>
      <b>${s}</b><span class="v">${p.stats[s]}</span><span class="plus">${p.unspent ? '+' : ''}</span><small>${desc[s]}</small></button>`).join('');
    const rage = Sk.rageNumbers(p);
    $('#p-stats').innerHTML = `<div class="frame-title">Character <small>(C)</small><button class="x" data-close="stats">×</button></div>
      <p>Level ${p.level} Warrior · Points to spend: <b>${p.unspent}</b></p>
      <div class="statlist">${rows}</div>
      <table class="derived">
        <tr><td>Attack</td><td>${P.attack(p)}</td></tr><tr><td>Defense</td><td>${P.defense(p)}</td></tr>
        <tr><td>Max HP / MP</td><td>${P.maxHp(p)} / ${P.maxMp(p)}</td></tr>
        <tr><td>Accuracy / Evasion</td><td>${P.accuracy(p).toFixed(1)} / ${P.evasion(p).toFixed(1)}</td></tr>
        <tr><td>MP regen</td><td>${P.mpRegenPerSec(p).toFixed(2)}/s</td></tr>
        <tr><td>Crit chance</td><td>${P.critChance(p).toFixed(1)}%</td></tr>
        <tr><td>Attack interval</td><td>${(P.attackIntervalMs(p) / 1000).toFixed(2)}s</td></tr>
        <tr><td>Rage</td><td>+${rage.dealtPct}% dealt / +${rage.takenPct}% taken</td></tr>
      </table>${hint('↑↓ select · Enter +1 point · Esc close')}`;
  }

  private onClick(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const p = Game.player;
    const d = t.dataset;
    const panel = t.closest('.panel')?.id.replace('p-', '') as Panel | undefined;
    if (panel && d.key) this.sel[panel] = d.key;
    if (this.held && d.idx !== undefined) { this.placeHeld(t); t.blur(); return; }
    if (d.close) this.close(d.close as Panel);
    else if (d.xfer) this.transfer(t);
    else if (d.train) {
      const err = Sk.train(p, d.train);
      if (err) this.toast(err, 'warn');
      else { this.toast(`Trained ${DB.skills[d.train].name} to rank ${Sk.rankOf(p, d.train)}`, 'rare'); playSfx('train'); Game.save(); }
    }
    else if (d.act === 'drop1' || d.act === 'dropall') {
      const id = this.dropItem;
      this.close('drop');
      if (id) { this.doDrop(id, d.act === 'drop1' ? 1 : (this.dropUid ? 1 : Game.player.inventory[id] ?? 0), this.dropUid); this.dropUid = null; }
    }
    else if (d.tab) { this.shopTab = d.tab as 'buy' | 'sell'; }
    else if (d.stat) { if (p.unspent > 0) { P.spendPoint(p, d.stat as P.Stat); Game.save(); } }
    else if (d.use) Game.events.emit('use-item', d.use);
    else if (d.equip) {
      const err = P.equip(p, d.equip);
      if (err) this.toast(err, 'warn');
      else {
        const piece = P.inst(p, d.equip) ?? Object.values(p.gearItems).find((g) => Object.values(p.equipment).includes(g.uid) && (g.uid === d.equip || g.itemId === d.equip));
        this.toast(`Equipped ${piece ? displayName(piece) : 'gear'}`, 'loot');
      }
    }
    else if (d.unequip) P.unequip(p, d.unequip as P.EquipSlot);
    else if (d.buy) {
      const price = shopPrice(d.buy);
      if (price !== null && p.coins >= price) { p.coins -= price; P.addItem(p, d.buy, 1); this.toast(`Bought ${DB.items[d.buy].name}`, 'loot'); Game.save(); }
      else this.toast('Not enough copper', 'warn');
    } else if (d.sell) {
      const price = vendorBuyPrice(d.sell);
      const uid = d.uid;
      const ok = price !== null && (uid ? !!P.removeGear(p, uid) : P.removeItem(p, d.sell));
      if (ok && price !== null) { p.coins += price; this.toast(`Sold ${DB.items[d.sell].name} for ${price}c`, 'loot'); Game.save(); }
    } else if (d.act === 'save') { Game.save(); this.toast('Saved', 'info'); }
    else if (d.act === 'reset') { this.sel.confirm = 'no'; this.open('confirm'); }
    else if (d.act === 'erase') { clearSave(); location.reload(); }
    Game.changed();
    t.blur(); // keep keyboard focus on the game
  }

  // ───────────────────────── console ─────────────────────────
  private setupConsole() {
    const input = $<HTMLInputElement>('#console-in');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === '`') { e.preventDefault(); this.toggleConsole(false); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const line = input.value.trim();
        input.value = '';
        if (!line) return;
        this.consoleHistory.unshift(line);
        this.historyIdx = -1;
        this.log(`> ${line}`, 'cmd');
        try { this.log(runCommand(line)); } catch (err) { this.log(String((err as Error).message ?? err), 'err'); }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.historyIdx = Math.max(-1, Math.min(this.consoleHistory.length - 1, this.historyIdx + (e.key === 'ArrowUp' ? 1 : -1)));
        input.value = this.historyIdx >= 0 ? this.consoleHistory[this.historyIdx] : '';
      }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
  }

  private log(text: string, cls = '') {
    const out = $('#console-out');
    const el = document.createElement('pre');
    el.className = cls;
    el.textContent = text;
    out.append(el);
    out.scrollTop = out.scrollHeight;
  }

  private toggleConsole(force?: boolean) {
    const open = force ?? !Game.consoleOpen;
    Game.consoleOpen = open;
    $('#console').hidden = !open;
    Game.events.emit('keyboard', !open); // stop Phaser from eating keystrokes while typing
    const input = $<HTMLInputElement>('#console-in');
    if (open) {
      if (!$('#console-out').childElementCount) this.log('Test console — type help. Commands mark this save as cheated.', 'muted');
      input.focus();
      setTimeout(() => input.focus(), 0);
    } else input.blur();
  }
}

const hint = (s: string) => `<div class="hint">${s}</div>`;
