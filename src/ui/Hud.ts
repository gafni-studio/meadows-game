import { DB, xpToNext, shopPrice, vendorBuyPrice, consumableEffect, descOf } from '../data/db';
import { ASSUME } from '../data/assumptions';
import { DEV_CONSOLE } from '../config';
import { Game } from '../systems/GameState';
import { resetAndReload } from '../systems/Save';
import { runCommand } from '../systems/Cheats';
import * as P from '../systems/Player';
import { iconUrl, skillIconUrl } from '../art/sprites';
import { displayName, formatAffix, instanceQuality, isGear, makeGear, GearInstance } from '../systems/Gear';
import * as Sk from '../systems/Skills';
import { SLOT_KEYS, GROUP_SLOTS } from '../systems/Bar';
import * as Q from '../systems/Quests';
import * as Pa from '../systems/Passives';
import * as Ex from '../systems/Exchange';
import { playSfx } from '../systems/Sfx';
import { routeNpc } from './panels/npc';
import { renderSkills, renderSkillPreview } from './panels/skills';
import { renderJournal, renderJournalPreview } from './panels/journal';
import { trackerHtml } from './panels/tracker';
import * as Farm from '../systems/Farm';

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
export const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** The rewards screen: a quest's name, one flavor line and the rows. `final` = the quest is complete (banner first). */
interface RewardPayload { line?: string; name: string; flavor: string; rows: string[]; title?: string; final?: boolean }
type Panel = 'inventory' | 'stats' | 'shop' | 'storage' | 'skills' | 'journal' | 'passives' | 'exchange' | 'dialog' | 'rewards' | 'pause' | 'confirm' | 'drop';
const PANELS: Panel[] = ['inventory', 'stats', 'shop', 'storage', 'skills', 'journal', 'passives', 'exchange', 'dialog', 'rewards', 'pause', 'confirm', 'drop'];
const TYPE_ORDER = ['consumable', 'gear', 'currency', 'material', 'misc'];
const TYPE_LABEL: Record<string, string> = { consumable: 'Consumable', gear: 'Gear', currency: 'Currency', material: 'Material', misc: 'Junk' };

export class Hud {
  private stack: Panel[] = [];
  sel: Partial<Record<Panel, string>> = {}; // selected data-key per panel
  shopTab: 'buy' | 'sell' = 'buy';
  private treeTab: 'nature' | 'elemental' = 'nature';
  pathTab = 'warrior';
  /** v0.3.1: the skill pulsing in the Paths window after its Path quest (cleared on the first click or close). */
  highlightSkill: string | null = null;
  private lastSettleAt = 0;
  private areaName = '';
  dialogHtml = '';
  private dialogTalk: Q.TalkResult | null = null;
  private dialogPage = 0;
  /** v0.2.6: the quest rewards screen, shown after a quest's last conversation page. */
  private rewards: RewardPayload | null = null;
  private consoleHistory: string[] = [];
  private historyIdx = -1;
  /** Stack picked up for moving (keyboard M or mouse drag). */
  private held: { c: P.Container; idx: number } | null = null;
  private dropItem: string | null = null;
  private dropUid: string | null = null;
  private invTab: 'all' | 'gear' | 'consumable' | 'material' | 'misc' = 'all';
  private trackHidden = (typeof localStorage !== 'undefined' && localStorage.getItem('meadows.trackHidden') === '1');

  constructor() {
    $('#ui').innerHTML = `
      <div id="hud">
        <div class="row"><b id="lvl"></b> <span id="area"></span></div>
        <div class="bar hp"><i></i><span></span></div>
        <div class="bar mp"><i></i><span></span></div>
        <div class="bar xp"><i></i><span></span></div>
        <div id="coins"></div>
        <div id="prod-line"></div>
        <div id="buffs"></div>
      </div>
      <div id="hotbar"></div>
      <div id="toasts"></div>
      <div id="levelup" hidden></div>
      <div id="questup" hidden></div>
      <div id="quest-track" hidden></div>
      <div id="help">↑↓ climb · ↓+Space drop · F attack · 1–4 attacks · 5–6 buffs · Q/G potions · E talk · I bag · C hero · K paths · J journal · L objectives · T passives · Esc${DEV_CONSOLE ? ' · `' : ''} · v${__APP_VERSION__}</div>
      <div id="dead" hidden>Defeated…</div>
      ${PANELS.map((p) => `<div class="panel" id="p-${p}" hidden></div>`).join('')}
      <div id="console" hidden><div id="console-out"></div><input id="console-in" autocomplete="off" spellcheck="false" placeholder="type help, Enter to run, Esc to close" /></div>`;

    Game.events.on('changed', () => this.renderPanels());
    Game.events.on('toast', (m: string, k: string, icon?: string) => this.toast(m, k, icon));
    Game.events.on('levelup', (lvl: number, pts: number) => this.levelBanner(lvl, pts));
    Game.events.on('quest-rewards', (r: RewardPayload) => this.showRewards(r));
    Game.events.on('chest', () => {
      this.held = null;
      // Welcome to Meadow Town: Mara's words about her chest come first, then the chest opens.
      if (Q.wantsTalk(Game.player, 'chest')) {
        const t = Q.talk(Game.player, 'chest');
        if (t) { const fin = t.onFinish; t.onFinish = () => { fin?.(); this.open('storage'); }; this.openTalk(t); return; }
      }
      this.open('storage');
    });
    Game.events.on('area', (n: string) => {
      this.areaName = n;
      this.stack = this.stack.filter((p) => p !== 'shop' && p !== 'dialog' && p !== 'storage');
      this.renderPanels();
      this.toast(`Entered ${n}`, 'info');
    });
    Game.events.on('close-all', () => { this.stack = []; this.renderPanels(); });
    Game.events.on('dead', (d: boolean) => ($('#dead').hidden = !d));
    Game.events.on('npc', (id: string, role: string, name: string) => routeNpc(this, id, role, name));
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
    if (top === 'confirm' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (k === 'Enter' || k === 'y' || k === 'Y') { e.preventDefault(); resetAndReload(); return; }
      if (k === 'n' || k === 'N') { e.preventDefault(); this.close('confirm'); return; }
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
    // v0.2.7: E also closes the NPC window it opened (shop, training, exchange, storage, talk).
    if ((k === 'e' || k === 'E') && !e.ctrlKey && !e.altKey && !e.metaKey && top && ['shop', 'skills', 'exchange', 'storage', 'dialog'].includes(top)) {
      e.preventDefault();
      this.close(top);
      return;
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      if (k === 'i' || k === 'I') { this.toggle('inventory'); return; }
      if (k === 'c' || k === 'C') { this.toggle('stats'); return; }
      if (k === 'k' || k === 'K') { this.toggle('skills'); return; }
      if (k === 'j' || k === 'J') { this.toggle('journal'); return; }
      if (k === 't' || k === 'T') { this.toggle('passives'); return; }
      if (k === 'l' || k === 'L') {
        e.preventDefault();
        this.trackHidden = !this.trackHidden;
        try { localStorage.setItem('meadows.trackHidden', this.trackHidden ? '1' : '0'); } catch { /* ignore */ }
        this.renderHud();
        return;
      }
    }
    if (!top) return;
    if (top === 'dialog' && this.dialogTalk && (k === 'Backspace' || k === 'ArrowLeft')) { e.preventDefault(); this.backTalk(); return; }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[k]) { e.preventDefault(); this.move(top, dirs[k]); return; }
    if (top === 'skills' && ['1', '2', '3', '4', '5', '6'].includes(k)) {
      e.preventDefault();
      const cur = this.selectedEl('skills');
      if (cur?.dataset.skill && Sk.known(Game.player, cur.dataset.skill)) {
        const err = Sk.assignBar(Game.player, Number(k) - 1, cur.dataset.skill);
        if (err) this.toast(err, 'warn');
        else { this.toast(`Equipped ${DB.skills[cur.dataset.skill].name} in slot ${k}`, 'info'); Game.save(); Game.changed(); }
      } else if (cur?.dataset.skill) this.toast('Train it first', 'warn');
      return;
    }
    if (top === 'inventory' && ['q', 'Q', 'g', 'G'].includes(k) && !this.held) {
      e.preventDefault();
      const cur = this.selectedEl('inventory');
      const id = cur?.dataset.item;
      if (id && DB.items[id]?.item_type === 'consumable') {
        const slot = k.toLowerCase() === 'q' ? 6 : 7;
        Sk.assignBar(Game.player, slot, id);
        this.toast(`Bound ${DB.items[id].name} to ${SLOT_KEYS[slot]}`, 'info');
        Game.save(); Game.changed();
      } else if (id) {
        this.toast('Only potions and food can be bound to Q or G', 'warn');
      }
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      const cur = this.selectedEl(top);
      if (top === 'inventory' && cur && !this.held) { this.invPrimary(cur); return; }
      cur?.click();
      return;
    }
    if (k === 'Tab' && top === 'inventory') {
      e.preventDefault();
      const tabs: typeof this.invTab[] = ['all', 'gear', 'consumable', 'material', 'misc'];
      this.invTab = tabs[(tabs.indexOf(this.invTab) + 1) % tabs.length];
      this.sel.inventory = undefined;
      this.renderPanels();
      return;
    }
    if (k === 'Tab' && top === 'shop') { e.preventDefault(); this.shopTab = this.shopTab === 'buy' ? 'sell' : 'buy'; this.sel.shop = undefined; this.renderPanels(); }
    if (k === 'Tab' && top === 'skills') {
      e.preventDefault();
      const ids = Sk.PATHS.filter((x) => Q.pathRevealed(Game.player, x.id)).map((x) => x.id);
      if (ids.length < 2) return;
      this.pathTab = ids[(ids.indexOf(this.pathTab) + 1) % ids.length];
      this.sel.skills = undefined;
      this.renderPanels();
      return;
    }
    if (k === 'Tab' && top === 'passives') { e.preventDefault(); this.treeTab = this.treeTab === 'nature' ? 'elemental' : 'nature'; this.sel.passives = undefined; this.renderPanels(); }
  }

  private navEls(panel: Panel): HTMLElement[] {
    return [...$(`#p-${panel}`).querySelectorAll<HTMLElement>('[data-nav]')];
  }
  private selectedEl(panel: Panel): HTMLElement | null {
    const els = this.navEls(panel);
    // Default to the first tile (not the tab row) so Enter acts on an item right away.
    return els.find((el) => el.dataset.key === this.sel[panel]) ?? els.find((el) => el.dataset.dlg === 'next') ?? els.find((el) => el.classList.contains('pnode')) ?? els.find((el) => el.classList.contains('tile') && !!el.dataset.item && el.dataset.mode !== 'equipped') ?? els.find((el) => el.classList.contains('tile') && el.dataset.mode !== 'equipped') ?? els.find((el) => el.classList.contains('tile')) ?? els[0] ?? null;
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
    if (cur && (panel === 'shop' || panel === 'inventory' || panel === 'storage' || panel === 'skills' || panel === 'journal' || panel === 'passives' || panel === 'exchange')) this.renderPreview(panel, cur);
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
    $('#lvl').textContent = `Lv ${p.level} Hero${p.unspent ? ` (+${p.unspent} pts)` : ''}${p.cheated ? ' ⚑' : ''}`;
    $('#lvl').title = p.cheated ? 'Test console used on this save' : '';
    $('#area').textContent = this.areaName;
    $('#coins').innerHTML = `<img src="${iconUrl('copper_coin')}"> ${p.coins} Copper${p.cheats.god ? ' · <b>GOD</b>' : ''}`;

    const now = Date.now();
    const buffs: string[] = [];
    for (const [id, until] of Object.entries(Game.buffs)) {
      if (until > now) buffs.push(`${DB.skills[id]?.name ?? DB.items[id]?.name ?? id} ${Math.ceil((until - now) / 1000)}s`);
    }
    $('#buffs').textContent = buffs.join(' · ');
    const track = $('#quest-track');
    if (track) {
      // v0.3.1: count lines, ready quests and farm entries (panels/tracker.ts). Repaint only on change so ✕ clicks land.
      const html = this.trackHidden ? '' : trackerHtml(p);
      track.hidden = !html;
      if (html && track.dataset.last !== html) { track.innerHTML = html; track.dataset.last = html; }
    }
    const wall = Date.now();
    if (wall - this.lastSettleAt > 4000) {
      this.lastSettleAt = wall;
      Pa.settle(p);
    }
    if (p.passiveReport) {
      const msg = p.passiveReport;
      p.passiveReport = undefined;
      this.toast(msg, 'rare');
    }
    const prodBits = Pa.liveNodes().filter((n) => n.effect_type === 'production' && Pa.rankOf(p, n.id) >= 1)
      .map((n) => `${n.name.replace(' Essence', '')} ${Pa.rateAt(Pa.rankOf(p, n.id))}/h`);
    let prodHtml = prodBits.length ? `<div id="prod-track">${prodBits.join(' · ')}</div>` : '';
    if (p.passiveUpgrade) {
      prodHtml += `<div id="prod-track">Upgrading ${esc(Pa.node(p.passiveUpgrade.nodeId)?.name ?? '')} ${Pa.formatDur(Pa.remainingMs(p, wall))}</div>`;
    }
    const line = $('#prod-line');
    if (line) line.innerHTML = prodHtml;

    const cd = (id: string) => Math.max(0, (Game.cooldowns[id] ?? 0) - now);
    // v0.2.7: grouped slots (attack 1-4, buff 5-6, potions Q/G). Icon boxed and centred, one-line names.
    const slot = (key: string, name: string, sub: string, cdMs: number, total: number, icon = '') =>
      `<div class="slot${name ? '' : ' empty'}"><kbd>${key}</kbd><div class="s-ico">${icon ? `<img src="${icon}" alt="">` : ''}</div><div class="s-name">${esc(name || '—')}</div><small class="s-sub">${esc(sub)}</small>${cdMs > 0 ? `<em style="height:${(cdMs / total) * 100}%"></em>` : ''}</div>`;
    const bar = Sk.barOf(p);
    const barSlot = (i: number) => {
      const key = SLOT_KEYS[i];
      const id = bar[i];
      if (!id) return slot(key, '', 'empty', 0, 1);
      if (Sk.isHotbarSkill(id)) {
        const sk = DB.skills[id];
        const r = Sk.rankOf(p, id);
        return slot(key, sk.name, `r${r} · ${sk.mp_cost} MP`, cd(id), Sk.cooldownOf(id), skillIconUrl(id));
      }
      if (Sk.isHotbarItem(id)) {
        const it = DB.items[id];
        const n = p.inventory[id] ?? 0;
        return slot(key, it.name, n ? `×${n}` : 'none', cd('potion'), ASSUME.potionCooldownMs ?? 1000, iconUrl(id));
      }
      return slot(key, '', 'empty', 0, 1);
    };
    const grp = (label: string, idx: number[]) => `<div class="hb-group"><div class="hb-label">${label}</div><div class="hb-slots">${idx.map(barSlot).join('')}</div></div>`;
    const html =
      `<div class="hb-group"><div class="hb-label">Basic</div><div class="hb-slots">${slot('F', 'Attack', 'hold', 0, 1)}</div></div>` +
      grp('Attacks', GROUP_SLOTS.attack) + grp('Buffs', GROUP_SLOTS.buff) + grp('Potions', GROUP_SLOTS.potion);
    const hb = $('#hotbar');
    if (hb.dataset.last !== html) { hb.innerHTML = html; hb.dataset.last = html; }
  }

  /** v0.2.9: every quest completion plays the banner and sound first, then the rewards screen. */
  private showRewards(r: RewardPayload) {
    const open = () => { this.rewards = r; this.sel.rewards = undefined; this.open('rewards'); };
    if (r.final) { this.questBanner(r.name); window.setTimeout(open, 1100); } else open();
  }

  private questBanner(name: string) {
    const el = $('#questup');
    if (!el) return;
    el.innerHTML = `<div class="burst"></div><div class="lv-title quest">QUEST COMPLETE</div><div class="lv-sub">${esc(name)}</div>`;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout((this as unknown as { qT?: number }).qT);
    (this as unknown as { qT?: number }).qT = window.setTimeout(() => { el.hidden = true; el.classList.remove('show'); }, 2800);
  }

  /** Show the objectives tracker (what L toggles). Used by the journal's Objectives button. */
  private showTracker() {
    this.trackHidden = false;
    try { localStorage.setItem('meadows.trackHidden', '0'); } catch { /* ignore */ }
    this.renderHud();
    const el = document.getElementById('quest-track');
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
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
      if (h.c !== target.dataset.c) Q.onAction(Game.player, target.dataset.c === 'storage' ? 'chest_put' : 'chest_take');
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
    if (from !== to) Q.onAction(Game.player, to === 'storage' ? 'chest_put' : 'chest_take');
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
  open(p: Panel) {
    if (!this.stack.includes(p) && (p === 'inventory' || p === 'storage' || p === 'shop')) this.sel[p] = undefined; // reopen at the first item
    this.stack = this.stack.filter((x) => x !== p);
    this.stack.push(p);
    this.renderPanels();
  }
  private close(p: Panel) {
    if (p === 'dialog') this.dialogTalk = null;
    if (p === 'skills') this.highlightSkill = null;
    if (p === 'rewards') { const r = this.rewards; this.rewards = null; if (r) this.afterRewards(r); }
    this.stack = this.stack.filter((x) => x !== p); this.renderPanels(); }
  /** v0.3.1: after Path of the Warrior / Magician, open that Path's tree once with its first skill pulsing. */
  private afterRewards(r: RewardPayload): void {
    const first: Record<string, [string, string]> = { ql_warrior: ['warrior', 'power_strike'], ql_magician: ['magician', 'magic_bolt'] };
    const hit = r.final && r.line ? first[r.line] : undefined;
    const p = Game.player;
    if (!hit || p.questFlags[`tree_shown_${hit[0]}`]) return;
    p.questFlags[`tree_shown_${hit[0]}`] = true;
    this.pathTab = hit[0];
    this.highlightSkill = hit[1];
    this.sel.skills = `sk:${hit[1]}`;
    setTimeout(() => this.open('skills'), 0);
  }
  private toggle(p: Panel) { if (this.stack.includes(p)) this.close(p); else this.open(p); }

  /** Open a multi-page talk. Enter or click advances; the last page runs onFinish. Esc closes without finishing. */
  openTalk(talk: Q.TalkResult | null): void {
    if (!talk || !talk.pages.length) return;
    this.dialogTalk = talk;
    this.dialogPage = 0;
    this.paintTalk();
    this.sel.dialog = undefined;
    this.open('dialog');
  }

  private paintTalk(): void {
    const talk = this.dialogTalk;
    if (!talk) { this.dialogHtml = ''; return; }
    const n = talk.pages.length;
    const i = Math.min(this.dialogPage, n - 1);
    const last = i >= n - 1;
    this.dialogHtml = `<h3>${esc(talk.speaker)}</h3>
      <p class="dlg-line">${esc(talk.pages[i] ?? '')}</p>
      ${n > 1 ? `<div class="dlg-pager">${i + 1} / ${n}</div>` : ''}
      <div class="btns">${i > 0 ? '<button data-nav data-key="back" data-dlg="back">Back</button>' : ''}<button data-nav data-key="ok" data-dlg="next">${last ? 'OK' : 'Continue'}</button></div>
      ${hint(`Enter or click: ${last ? 'OK' : 'continue'}${i > 0 ? ' · Backspace / ← back' : ''} · Esc close`)}`;
  }

  /** Previous page. Going back never repeats or undoes a quest step: the step only advances on the last page. */
  private backTalk(): void {
    if (!this.dialogTalk || this.dialogPage <= 0) return;
    this.dialogPage -= 1;
    this.sel.dialog = 'ok';
    this.paintTalk();
    this.renderPanels();
  }

  private advanceTalk(): void {
    const talk = this.dialogTalk;
    if (!talk) { this.close('dialog'); return; }
    if (this.dialogPage < talk.pages.length - 1) {
      this.dialogPage += 1;
      this.paintTalk();
      this.renderPanels();
      return;
    }
    this.dialogTalk = null;
    this.close('dialog');
    talk.onFinish?.();
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
    if (this.stack.includes('skills')) renderSkills(this);
    if (this.stack.includes('journal')) renderJournal();
    if (this.stack.includes('passives')) this.renderPassives();
    if (this.stack.includes('exchange')) this.renderExchange();
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
    if (this.stack.includes('dialog')) {
      if (this.dialogTalk) $('#p-dialog').innerHTML = this.dialogHtml;
      else $('#p-dialog').innerHTML = `${this.dialogHtml}<div class="btns"><button data-nav data-key="ok" data-close="dialog">OK</button></div>${hint('Enter OK · Esc close')}`;
    }
    if (this.stack.includes('rewards') && this.rewards) {
      const r = this.rewards;
      $('#p-rewards').innerHTML = `<h3>${esc(r.name)} — ${esc(r.title ?? 'Complete')}</h3>
        <p class="rw-flavor">${esc(r.flavor)}</p>
        <div class="rw-title">Rewards</div>
        <ul class="rw-list">${r.rows.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="btns"><button data-nav data-key="ok" data-close="rewards">Continue</button></div>${hint('Enter or click: Continue')}`;
    }
    if (this.stack.includes('pause')) {
      const saved = p.savedAt ? new Date(p.savedAt).toLocaleTimeString() : 'never';
      $('#p-pause').innerHTML = `<h3>Menu</h3><p>Last saved: ${saved}${p.cheated ? ' · <span class="warn">test console used</span>' : ''}</p>
        <div class="btns col"><button data-nav data-key="resume" data-close="pause">Resume</button>
        <button data-nav data-key="save" data-act="save">Save now</button>
        <button data-nav data-key="reset" data-act="reset">New game (erase save)</button></div>${hint('↑↓ select · Enter choose · Esc close')}`;
    }
    if (this.stack.includes('confirm')) {
      $('#p-confirm').innerHTML = `<h3>Erase save?</h3><p>This deletes your character and starts over.</p>
        <div class="btns"><button data-nav data-key="no" data-close="confirm">Cancel</button><button data-nav data-key="yes" data-act="erase" class="danger">Erase save</button></div>${hint('Enter / Y erase · N / Esc cancel')}`;
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
      // v0.2.3: click only selects; Unequip lives on the preview, not on the tile.
      return this.tile(`eq:${s}`, id, 'equipped', '', s, false, `data-slot="${s}"${piece ? ` data-uid="${piece.uid}"` : ''}`, piece);
    }).join('');
    const items = this.bagTiles();
    const tabBtn = (id: typeof this.invTab, label: string) =>
      `<button data-nav data-key="tab:${id}" data-invtab="${id}" class="${this.invTab === id ? 'on' : ''}">${label}</button>`;
    $('#p-inventory').innerHTML = `<div class="frame-title">Inventory <small>(I)</small><button class="x" data-close="inventory">×</button></div>
      <div class="tabs"><span class="label">Equipped</span><span class="coins"><img src="${iconUrl('copper_coin')}"> ${p.coins}</span></div>
      <div class="grid eq">${eq}</div>
      <div class="tabs bagtabs">
        ${tabBtn('all', 'All')}${tabBtn('gear', 'Gear')}${tabBtn('consumable', 'Consumables')}${tabBtn('material', 'Materials')}${tabBtn('misc', 'Junk')}
      </div>
      <div class="split"><div class="grid bag">${items}</div><div class="preview" id="inv-preview"></div></div>
      ${hint(this.held ? 'Moving: ←↑↓→ pick a slot · Enter / M place · Esc cancel' : '←↑↓→ select · Enter use / equip / remove · click for options · Tab filter · 1-6 hotbar · M move · X drop · Esc close')}`;
  }

  /** Bag tiles for the current inventory tab. Empty slots only appear on All. Click selects — no instant use/equip. */
  private bagTiles(): string {
    const p = Game.player;
    const tab = this.invTab;
    const typeOf = (ref: string): string | undefined => {
      const piece = p.gearItems[ref];
      return DB.items[piece ? piece.itemId : ref]?.item_type;
    };
    const match = (ref: string | null): boolean => {
      if (!ref) return tab === 'all';
      const ty = typeOf(ref);
      if (tab === 'all') return true;
      if (tab === 'gear') return ty === 'gear';
      if (tab === 'consumable') return ty === 'consumable';
      if (tab === 'material') return ty === 'material' || ty === 'currency';
      if (tab === 'misc') return ty === 'misc';
      return true;
    };
    const attrFor = (_id: string, uid?: string) => uid ? `data-uid="${uid}"` : '';
    return P.layout(p, 'bag').map((ref, i) => {
      if (!match(ref)) return '';
      const base = `data-c="bag" data-idx="${i}"`;
      if (!ref) return this.tile(`bag-slot:${i}`, null, 'inv', '', '', false, base);
      const piece = p.gearItems[ref];
      if (piece) {
        return this.tile(`inv:${ref}`, piece.itemId, 'inv', piece.magic ? '✦' : '', '', false,
          `${base} data-uid="${piece.uid}" draggable="true" ${attrFor(piece.itemId, piece.uid)}`, piece);
      }
      return this.tile(`inv:${ref}`, ref, 'inv', `${p.inventory[ref]}`, '', false, `${base} draggable="true" ${attrFor(ref)}`);
    }).join('');
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

    /** Item preview for the hovered/selected tile. */
  private renderPreview(panel: Panel, el: HTMLElement) {
    const box = $(`#${panel === 'inventory' ? 'inv' : panel}-preview`);
    if (!box) return;
    if (panel === 'skills') { renderSkillPreview(this, box, el); return; }
    if (panel === 'journal') { renderJournalPreview(box, el); return; }
    if (panel === 'passives') { this.renderPassivePreview(box, el); return; }
    if (panel === 'exchange') { this.renderExchangePreview(box, el); return; }
    const id = el.dataset.item;
    if (!id) {
      box.innerHTML = el.dataset.slot ? `<div class="pv-name">${esc(el.dataset.slot)} slot</div><p class="muted">Empty. Equip gear from your bag.</p>`
        : el.dataset.idx !== undefined ? `<p class="muted">Empty slot${this.held ? ' — Enter to place here' : ''}.</p>` : '<p class="muted">Select an item.</p>';
      return;
    }
    const p = Game.player;
    const it = DB.items[id];
    if (id === 'cracked_bank_stone' || id === 'smoldering_scale') Q.onItem(p, id);
    const eff = consumableEffect(id);
    const g = DB.gear[id];
    const piece = el.dataset.uid ? P.inst(p, el.dataset.uid) : undefined;
    const lines: string[] = [];
    if (eff.hp) lines.push(`+${eff.hp} HP`);
    if (eff.mp) lines.push(`+${eff.mp} MP`);
    if (eff.buff) lines.push(`+${eff.buff.speedPct}% move & attack speed, ${eff.buff.durationS}s`);
    if (g) {
      if ((piece ? piece.weaponDamage : g.weapon_damage) > 0) {
        const rolled = piece ? piece.weaponDamage : g.weapon_damage;
        const q = piece ? instanceQuality(piece) : 'avg';
        lines.push(`Weapon damage <span class="q-${q}">${rolled}</span> ×${piece?.statMultiplier ?? g.stat_multiplier}`);
      }
      if ((piece ? piece.defense : g.defense) > 0 || g.defense) {
        const rolled = piece ? piece.defense : g.defense;
        const q = piece ? instanceQuality(piece) : 'avg';
        lines.push(`Defense <span class="q-${q}">+${rolled}</span>`);
      }
      if (piece?.magic) lines.push(`<span class="magic-tag">Magic · ${esc(piece.prefix ?? '')}</span>${piece.affixes.map((a) => `<br>${esc(formatAffix(a))}`).join('')}`);
      const cmp = piece && el.dataset.mode !== 'equipped' ? this.gearCompare(piece) : null;
      if (cmp) {
        lines.push(`Attack ${this.delta(cmp.atk, cmp.atkDelta)}`);
        lines.push(`Defense ${this.delta(cmp.def, cmp.defDelta)}`);
      }
      lines.push(`Slot: ${g.slot}${g.class_id !== 'any' ? ` · ${g.class_id}` : ''}`);
      if (g.required_stat && g.required_value > 0) lines.push(`Requires ${g.required_value} ${g.required_stat === 'any' ? 'total points' : g.required_stat}`);
      const chk = P.canEquip(p, id);
      if (!chk.ok && el.dataset.mode !== 'equipped') lines.push(`<span class="warn">${esc(chk.reason ?? '')}</span>`);
    }
    const buy = shopPrice(id);
    const mode = el.dataset.mode ?? '';
    const usable = it.item_type === 'consumable' && !!(eff.hp || eff.mp || eff.buff);
    const btns: string[] = [];
    if (mode === 'inv' && usable) btns.push(`<button data-use="${id}">Use</button>`);
    if (mode === 'inv' && g && piece) btns.push(`<button data-equip="${piece.uid}">Equip</button>`);
    if (mode === 'equipped' && el.dataset.slot) btns.push(`<button data-unequip="${el.dataset.slot}">Unequip</button>`);
    if (mode === 'inv') {
      btns.push(`<button data-act="askdrop" data-item="${id}"${piece ? ` data-uid="${piece.uid}"` : ''}>Drop</button>`);
      if (it.item_type === 'consumable') {
        for (const i of GROUP_SLOTS.potion) btns.push(`<button data-act="bind" data-item="${id}" data-slot="${i + 1}">${SLOT_KEYS[i]}</button>`);
      }
    }
    const action: Record<string, string> = {
      buy: buy !== null ? (p.coins >= buy ? 'Enter: buy 1' : '<span class="warn">Not enough copper</span>') : '',
      sell: vendorBuyPrice(id) !== null ? 'Enter: sell 1' : '<span class="warn">Mara does not buy this</span>',
      inv: (usable ? 'Enter: use' : g ? 'Enter: equip' : '') + (mode === 'inv' ? ' · M: move · X: drop' : ''),
      equipped: 'Enter: unequip',
      storage: 'Enter: take the stack · 1: take one',
      bagstore: 'Enter: store the stack · 1: store one',
    };
    const name = piece ? displayName(piece) : it.name;
    const ownedGear = isGear(id) ? P.gearCount(p, id) : 0;
    const worn = piece && Object.values(p.equipment).includes(piece.uid);
    box.innerHTML = `<div class="pv-head"><img src="${iconUrl(id)}"><div><div class="pv-name${piece?.magic ? ' magic' : ''}${piece ? ` q-${instanceQuality(piece)}` : ''}">${esc(name)}</div><div class="pv-type t-${it.item_type}">${TYPE_LABEL[it.item_type] ?? it.item_type}${piece ? ` · ${instanceQuality(piece)} roll` : ''}</div></div></div>
      <p>${esc(descOf(it))}</p>
      ${lines.length ? `<div class="pv-eff">${lines.join('<br>')}</div>` : ''}
      <table class="pv-stats">
        ${mode === 'buy' && buy !== null ? `<tr><td>Shop price</td><td>${buy}c</td></tr>` : ''}
        ${mode === 'sell' && vendorBuyPrice(id) !== null ? `<tr><td>Sells for</td><td>${vendorBuyPrice(id)}c</td></tr>` : ''}
        <tr><td>Owned</td><td>${isGear(id) ? `${ownedGear} piece${ownedGear === 1 ? '' : 's'}${worn ? ' (this one equipped)' : ''}` : `${p.inventory[id] ?? 0}${p.storage[id] ? ` · ${p.storage[id]} in storage` : ''}`}</td></tr>
      </table>
      ${btns.length ? `<div class="pv-btns">${btns.join('')}</div>` : ''}
      <div class="pv-act">${action[mode] ?? ''}</div>`;
  }

  /** Compare a bag piece against the currently equipped item in the same slot (affixes included). */
  private gearCompare(piece: GearInstance): { atk: number; def: number; atkDelta: number; defDelta: number } | null {
    const p = Game.player;
    const g = DB.gear[piece.itemId];
    if (!g) return null;
    const slot = g.slot as P.EquipSlot;
    if (p.equipment[slot] === piece.uid) return null;
    const beforeAtk = P.attack(p), beforeDef = P.defense(p);
    const prev = p.equipment[slot];
    p.equipment[slot] = piece.uid;
    const atk = P.attack(p), def = P.defense(p);
    if (prev) p.equipment[slot] = prev; else delete p.equipment[slot];
    return { atk, def, atkDelta: atk - beforeAtk, defDelta: def - beforeDef };
  }

  private delta(n: number, d: number): string {
    if (d === 0) return `${n} <span class="delta-same">(0)</span>`;
    const cls = d > 0 ? 'delta-up' : 'delta-down';
    const sign = d > 0 ? `+${d}` : `${d}`;
    return `${n} <span class="${cls}">(${sign})</span>`;
  }

  /** Enter in the inventory: use / equip / unequip the selected tile (mouse click only selects). */
  private invPrimary(el: HTMLElement) {
    const p = Game.player;
    const id = el.dataset.item;
    if (el.dataset.mode === 'equipped' && el.dataset.slot) {
      P.unequip(p, el.dataset.slot as P.EquipSlot);
      Game.changed();
      return;
    }
    if (!id) return;
    if (el.dataset.uid && DB.gear[id]) {
      const err = P.equip(p, el.dataset.uid);
      if (err) this.toast(err, 'warn');
      else {
        const piece = P.inst(p, el.dataset.uid);
        this.toast(`Equipped ${piece ? displayName(piece) : 'gear'}`, 'loot');
      }
      Game.changed();
      return;
    }
    const eff = consumableEffect(id);
    if (DB.items[id]?.item_type === 'consumable' && (eff.hp || eff.mp || eff.buff)) {
      Game.events.emit('use-item', id);
    }
  }

  private renderPassives() {
    const p = Game.player;
    Pa.settle(p, Date.now(), true);
    const tree = this.treeTab;
    const tiles = Pa.nodesOf(tree).map((n) => {
      const r = Pa.rankOf(p, n.id);
      const up = p.passiveUpgrade?.nodeId === n.id;
      const costs = r < (n.max_rank ?? 10) ? Pa.nextCost(n.id, r + 1) : [];
      const afford = costs.length > 0 && costs.every((c) => (c.itemId === 'copper_coin' ? p.coins : (p.inventory[c.itemId] ?? 0)) >= c.qty);
      const dim = (!afford && r < (n.max_rank ?? 10) && !up) || !!p.passiveUpgrade && !up;
      const qty = n.effect_type === 'production'
        ? (r >= 1 ? `${Pa.rateAt(r)}/h` : 'r0')
        : (r >= 1 ? `+${2 * r}%` : 'r0');
      return `<button class="tile${dim ? ' dim' : ''} t-${n.effect_type}${up ? ' t-upgrading' : ''}" data-nav data-key="pn:${n.id}" data-node="${n.id}" data-mode="passive"${!p.passiveUpgrade && afford && r < (n.max_rank ?? 10) ? ` data-upgrade="${n.id}"` : ''}>
        <img src="art/icons/passive_${n.id}.png" alt="">
        <span class="qty">${up ? '…' : qty}</span><span class="price">${esc(n.name)}</span></button>`;
    }).join('');
    const rateLine = Pa.nodesOf(tree).filter((n) => n.effect_type === 'production').map((n) => {
      const r = Pa.rankOf(p, n.id);
      const eta = Pa.etaNextEssence(p, n.id);
      return r >= 1 ? `${n.name}: ${Pa.rateAt(r)}/h${eta ? ` · next in ${eta}` : ''}` : `${n.name}: none at rank 0`;
    }).join(' · ');
    $('#p-passives').innerHTML = `<div class="frame-title">Passive tree <small>(T)</small><button class="x" data-close="passives">×</button></div>
      <div class="tabs">
        <button data-nav data-key="tab:nature" data-tree="nature" class="${tree === 'nature' ? 'on' : ''}">Nature</button>
        <button data-nav data-key="tab:elemental" data-tree="elemental" class="${tree === 'elemental' ? 'on' : ''}">Elemental</button>
      </div>
      <p class="muted">${esc(rateLine)}. Essence accrues while you play and while you are away.</p>
      <div class="split"><div class="grid sk">${tiles}</div><div class="preview" id="passives-preview"></div></div>
      ${hint('←↑↓→ select · Enter upgrade · Tab switch tree · Esc close')}`;
  }

  private renderPassivePreview(box: HTMLElement, el: HTMLElement) {
    const id = el.dataset.node ?? el.dataset.tree;
    if (el.dataset.tree && !el.dataset.node) {
      box.innerHTML = `<p class="muted">The ${el.dataset.tree} tree. Select a node.</p>`;
      return;
    }
    const n = id ? Pa.node(id) : undefined;
    if (!n) { box.innerHTML = '<p class="muted">Select a node.</p>'; return; }
    const p = Game.player;
    const r = Pa.rankOf(p, n.id);
    const max = n.max_rank ?? 10;
    const costs = r < max ? Pa.nextCost(n.id, r + 1) : [];
    const costRows = costs.map((c) => {
      const have = c.itemId === 'copper_coin' ? p.coins : (p.inventory[c.itemId] ?? 0);
      const ok = have >= c.qty;
      const name = c.itemId === 'copper_coin' ? 'Copper' : DB.items[c.itemId]?.name ?? c.itemId;
      return `<tr class="${ok ? '' : 'warn'}"><td><img src="${iconUrl(c.itemId === 'copper_coin' ? 'copper_coin' : c.itemId)}"> ${esc(name)}</td><td>${have} / ${c.qty}</td></tr>`;
    }).join('');
    const mins = Pa.upgradeMinutes(r + 1);
    const up = p.passiveUpgrade;
    let act = r >= max ? 'Max rank' : (up ? (up.nodeId === n.id ? `Upgrading — ${Pa.formatDur(Pa.remainingMs(p))}` : 'Another upgrade is in progress') : 'Enter: start upgrade');
    box.innerHTML = `<div class="pv-name">${esc(n.name)}</div>
      <div class="pv-type">${n.tree_id} · ${n.effect_type} · rank ${r}/${max}</div>
      <p>${esc(Pa.flavor(n))}</p>
      <div class="pv-eff">${esc(Pa.preview(p, n.id))}</div>
      ${r < max ? `<table class="pv-stats"><tr><th colspan="2">Cost for rank ${r + 1} · ${Pa.formatDur(mins * 60000)} to finish</th></tr>${costRows}</table>` : ''}
      <div class="pv-act">${act}</div>`;
  }

  private renderExchange() {
    const p = Game.player;
    const recs = Ex.recipes();
    const tiles = recs.map((r) => {
      const have = p.inventory[r.input_item_id] ?? 0;
      const n = Ex.maxBatches(p, r);
      const dim = n <= 0;
      return `<button class="tile${dim ? ' dim' : ''} t-material" data-nav data-key="ex:${r.id}" data-ex="${r.id}" data-mode="exchange"${n > 0 ? ` data-trade="${r.id}"` : ''}>
        <img src="${iconUrl(r.input_item_id)}" alt="">
        <span class="qty">${have}</span><span class="price">${esc(DB.items[r.input_item_id].name)}</span></button>`;
    }).join('');
    $('#p-exchange').innerHTML = `<div class="frame-title">Ila's Exchange<button class="x" data-close="exchange">×</button></div>
      <p class="muted">Ten common materials (or listed shards) for one matching essence. Steep, by design.</p>
      <div class="split"><div class="grid sk">${tiles}</div><div class="preview" id="exchange-preview"></div></div>
      ${hint('←↑↓→ select · Enter exchange 1 · Esc close')}`;
  }

  private renderExchangePreview(box: HTMLElement, el: HTMLElement) {
    const id = el.dataset.ex;
    const r = id ? Ex.recipe(id) : undefined;
    if (!r) { box.innerHTML = '<p class="muted">Select a material.</p>'; return; }
    const p = Game.player;
    const have = p.inventory[r.input_item_id] ?? 0;
    const n = Ex.maxBatches(p, r);
    box.innerHTML = `<div class="pv-name">${esc(DB.items[r.input_item_id].name)} → ${esc(DB.items[r.output_item_id].name)}</div>
      <div class="pv-type">${r.input_qty} : ${r.output_qty}</div>
      <p>You have ${have}. ${n ? `Enter exchanges one batch (${r.input_qty} for ${r.output_qty}). You can make ${n}.` : `Need ${r.input_qty} to exchange.`}</p>
      <div class="pv-act">${n ? 'Enter: exchange 1' : 'Not enough'}</div>`;
  }

  private renderStats() {
    const p = Game.player;
    // v0.3.1: plain wording — what a stat raises, not by how much (numbers live on the character screen).
    const desc: Record<string, string> = { STR: 'Raises attack and max HP.', INT: 'Raises max MP and magic damage.', AGI: 'Raises speed and crit.', SPI: 'Raises HP regen and MP regen.' };
    // v0.2.6: the number is the TOTAL the player has (points + gear), with the gear part named next to it.
    const rows = P.STATS.map((s) => {
      const gearPts = P.affixBonus(p, s);
      return `<button class="statrow" data-nav data-key="stat:${s}" data-stat="${s}" ${p.unspent ? '' : 'aria-disabled="true"'}>
      <b>${s}</b><span class="v">${P.statOf(p, s)}${gearPts ? ` <em class="gear">(+${gearPts} from gear)</em>` : ''}</span><span class="plus">${p.unspent ? '+' : ''}</span><small>${desc[s]}</small></button>`;
    }).join('');
    const SLOT_NAME: Record<string, string> = { weapon: 'Weapon', head: 'Head', torso: 'Torso', legs: 'Legs', gloves: 'Gloves', boots: 'Boots' };
    const worn = P.EQUIP_SLOTS.map((slot) => ({ slot, g: P.inst(p, p.equipment[slot]) })).filter((x): x is { slot: P.EquipSlot; g: GearInstance } => !!x.g);
    const equipRows = worn.map(({ slot, g }) => {
      const base = g.weaponDamage > 0 ? `Weapon damage ${g.weaponDamage} (×${g.statMultiplier.toFixed(2)})` : g.defense > 0 ? `Defense +${g.defense}` : '';
      const aff = g.affixes.map((a) => formatAffix(a)).join(', ');
      return `<tr><td>${SLOT_NAME[slot]}</td><td><b>${esc(displayName(g))}</b> — ${[base, aff].filter(Boolean).join(' · ')}</td></tr>`;
    }).join('');
    const gearDef = worn.reduce((a, x) => a + x.g.defense, 0);
    const wpn = P.inst(p, p.equipment.weapon);
    const gearBits: string[] = [];
    if (gearDef) gearBits.push(`Defense +${gearDef}`);
    if (wpn) gearBits.push(`Attack from weapon ${Math.floor(wpn.weaponDamage * wpn.statMultiplier)}`);
    for (const s of P.STATS) if (P.affixBonus(p, s)) gearBits.push(`+${P.affixBonus(p, s)} ${s}`);
    for (const a of ['hp', 'mp', 'acc', 'crit', 'hpRegen', 'mpRegen'] as const) {
      const v = P.affixBonus(p, a);
      if (v) gearBits.push(formatAffix({ stat: a, value: Math.round(v * 100) / 100 }));
    }
    const equipHtml = worn.length
      ? `<div class="equip-title">Equipment</div><table class="derived equip">${equipRows}</table><div class="muted equip-total">From gear: ${esc(gearBits.join(' · ') || 'nothing')}</div>`
      : '';
    const rage = Sk.rageNumbers(p);
    $('#p-stats').innerHTML = `<div class="frame-title">Hero <small>(C)</small><button class="x" data-close="stats">×</button></div>
      <p>Level ${p.level} Hero · Points to spend: <b>${p.unspent}</b></p>
      <div class="statlist">${rows}</div>
      <table class="derived">
        <tr><td>Attack</td><td>${P.attack(p)}</td></tr><tr><td>Magic attack</td><td>${P.magicAttack(p)}</td></tr><tr><td>Defense</td><td>${P.defense(p)}</td></tr>
        <tr><td>Max HP / MP</td><td>${P.maxHp(p)} / ${P.maxMp(p)}</td></tr>
        <tr><td>Accuracy / Evasion</td><td>${P.accuracy(p).toFixed(1)} / ${P.evasion(p).toFixed(1)}</td></tr>
        <tr><td>MP regen</td><td>${P.mpRegenPerSec(p).toFixed(2)}/s</td></tr>
        <tr><td>Crit chance</td><td>${P.critChance(p).toFixed(1)}%</td></tr>
        <tr><td>Attack interval</td><td>${(P.attackIntervalMs(p) / 1000).toFixed(2)}s</td></tr>
        ${(Game.buffs.rage ?? 0) > Date.now() ? `<tr><td>Rage</td><td>+${rage.dealtPct}% dealt / +${rage.takenPct}% taken <em>(active)</em></td></tr>` : ''}
      </table>${equipHtml}${hint('↑↓ select · Enter +1 point · Esc close')}`;
  }

  private onClick(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) {
      if (this.dialogTalk && (e.target as HTMLElement).closest('#p-dialog')) this.advanceTalk();
      return;
    }
    const p = Game.player;
    const d = t.dataset;
    const panel = t.closest('.panel')?.id.replace('p-', '') as Panel | undefined;
    if (panel === 'skills' && this.highlightSkill) this.highlightSkill = null; // v0.3.1: the pulse ends on the first click
    if (panel && d.key) this.sel[panel] = d.key;
    if (this.held && d.idx !== undefined) { this.placeHeld(t); t.blur(); return; }
    if (d.dlg === 'next') { this.advanceTalk(); t.blur(); return; }
    if (d.dlg === 'back') { this.backTalk(); t.blur(); return; }
    if (d.close) this.close(d.close as Panel);
    else if (d.xfer) this.transfer(t);
    else if (d.train) {
      const err = Sk.train(p, d.train);
      if (err) this.toast(err, 'warn');
      else { this.toast(`Trained ${DB.skills[d.train].name} to rank ${Sk.rankOf(p, d.train)}`, 'rare'); playSfx('train'); Game.save(); }
    }
    else if (d.upgrade) {
      const err = Pa.startUpgrade(p, d.upgrade);
      if (err) this.toast(err, 'warn');
    }
    else if (d.trade) {
      const err = Ex.trade(p, d.trade, 1);
      if (err) this.toast(err, 'warn');
    }
    else if (d.tree) {
      this.treeTab = d.tree as 'nature' | 'elemental';
      this.sel.passives = undefined;
    }
    else if (d.act === 'drop1' || d.act === 'dropall') {
      const id = this.dropItem;
      this.close('drop');
      if (id) { this.doDrop(id, d.act === 'drop1' ? 1 : (this.dropUid ? 1 : Game.player.inventory[id] ?? 0), this.dropUid); this.dropUid = null; }
    }
    else if (d.farm) { const on = Farm.toggle(p, d.farm); this.toast(on ? `Added ${DB.skills[d.farm].name} to the farm list` : 'Removed from the farm list', 'info'); Game.save(); }
    else if (d.farmx) { Farm.remove(p, d.farmx); Game.save(); }
    else if (d.ptab) { this.pathTab = d.ptab; this.sel.skills = undefined; }
    else if (d.invtab) { this.invTab = d.invtab as typeof this.invTab; this.sel.inventory = undefined; }
    else if (d.act === 'askdrop') { this.requestDrop(d.item ?? this.dropItem ?? '', d.uid); }
    else if (d.act === 'bind' && d.item && d.slot) {
      if (DB.items[d.item]?.item_type === 'consumable') {
        Sk.assignBar(p, Number(d.slot) - 1, d.item);
        this.toast(`Bound ${DB.items[d.item].name} to ${SLOT_KEYS[Number(d.slot) - 1]}`, 'info');
        Game.save();
      }
    }
    else if (d.tab) { this.shopTab = d.tab as 'buy' | 'sell'; }
    else if (d.stat) { if (p.unspent > 0) { P.spendPoint(p, d.stat as P.Stat); Q.onAction(p, 'spend_point'); Game.save(); } }
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
      if (price !== null && p.coins >= price) { p.coins -= price; if (isGear(d.buy)) P.addGear(p, makeGear(d.buy, { mode: 'typical', magic: false })); else P.addItem(p, d.buy, 1); this.toast(`Bought ${DB.items[d.buy].name}`, 'loot'); Q.onAction(p, 'buy', d.buy); Game.save(); }
      else this.toast('Not enough copper', 'warn');
    } else if (d.sell) {
      const price = vendorBuyPrice(d.sell);
      const uid = d.uid;
      const ok = price !== null && (uid ? !!P.removeGear(p, uid) : P.removeItem(p, d.sell));
      if (ok && price !== null) { p.coins += price; this.toast(`Sold ${DB.items[d.sell].name} for ${price}c`, 'loot'); Game.save(); }
    } else if (d.act === 'save') { Game.save(); this.toast('Saved', 'info'); }
    else if (d.act === 'objectives') this.showTracker();
    else if (d.act === 'reset') { this.sel.confirm = 'yes'; this.open('confirm'); }
    else if (d.act === 'erase') { resetAndReload(); }
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

export const hint = (s: string) => `<div class="hint">${s}</div>`;
