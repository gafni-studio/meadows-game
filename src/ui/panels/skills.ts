/** The Paths window (K): tabs, equip bar, the skill tree and the selected skill's preview (moved out of Hud). */
import { DB, descOf } from '../../data/db';
import { Game } from '../../systems/GameState';
import { iconUrl, skillIconUrl } from '../../art/sprites';
import * as Sk from '../../systems/Skills';
import { SLOT_KEYS, GROUP_SLOTS } from '../../systems/Bar';
import * as Q from '../../systems/Quests';
import { esc, hint } from '../Hud';
import type { Hud } from '../Hud';

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export function renderSkills(hud: Hud) {
  const p = Game.player;
  const FAMILY: Record<string, string> = { basic: 'Basic', nature: 'Nature', elemental: 'Elemental', spiritual: 'Spirit' };
  // v0.2.9: a Path's tree is hidden until its Path quest is done; a tab you have not earned does not exist.
  const paths = Sk.PATHS.filter((x) => Q.pathRevealed(p, x.id));
  if (!paths.length) {
    $('#p-skills').innerHTML = `<div class="frame-title">Paths <small>(K)</small><button class="x" data-close="skills">×</button></div>
      <p class="path-none">Calden in Meadow Town can set you on a Path.</p>${hint('Esc close')}`;
    return;
  }
  const path = paths.find((x) => x.id === hud.pathTab) ?? paths[0];
  hud.pathTab = path.id;
  const tabs = paths.map((x) => `<button data-nav data-key="ptab:${x.id}" data-ptab="${x.id}" class="${x.id === path.id ? 'on' : ''}">${esc(x.name)}</button>`).join('');
  // equip slots: attack 1-4, buff 5-6 (potions live on Q / G and are bound from the bag)
  const bar = Sk.barOf(p);
  const slotHtml = (i: number) => {
    const id = bar[i];
    const sk = id ? DB.skills[id] : null;
    return `<span class="eq-slot${sk ? ' full' : ''}"><kbd>${SLOT_KEYS[i]}</kbd>${sk ? `<img src="${skillIconUrl(sk.id)}" alt=""><span class="eq-name">${esc(sk.name)}</span>` : '<span class="eq-name empty">empty</span>'}</span>`;
  };
  const equip = `<div class="equipbar"><div class="eq-group"><span class="eq-label">Attack</span>${GROUP_SLOTS.attack.map(slotHtml).join('')}</div>
    <div class="eq-group"><span class="eq-label">Buff</span>${GROUP_SLOTS.buff.map(slotHtml).join('')}</div></div>`;
  let tree = '';
  const layout = Sk.TREE_LAYOUT[path.id];
  if (!layout) {
    tree = `<div class="path-soon"><b>${esc(path.name)}</b><p>${esc(path.description)}</p></div>`;
  } else {
    const NW = 84, NH = 92, GX = 118, GY = 104, PAD = 10;
    const px = (c: number) => PAD + c * GX, py = (r: number) => PAD + r * GY;
    const lines: string[] = [];
    const nodes: string[] = [];
    let maxC = 0, maxR = 0;
    const mid = (c: number, r: number) => ({ rx: px(c) + NW, lx: px(c), y: py(r) + NH / 2 });
    for (const sk of Sk.pathSkills(path.id)) {
      const pos = layout.nodes[sk.id];
      if (!pos) continue;
      maxC = Math.max(maxC, pos.c); maxR = Math.max(maxR, pos.r);
      const prev = Sk.prevOf(sk);
      if (prev && layout.nodes[prev.id]) {
        const a = mid(layout.nodes[prev.id].c, layout.nodes[prev.id].r), b = mid(pos.c, pos.r);
        const lit = Sk.known(p, prev.id);
        const cx = (a.rx + b.lx) / 2;
        lines.push(`<path class="ln fam-${sk.branch}${lit ? ' lit' : ''}" d="M ${a.rx} ${a.y} C ${cx} ${a.y}, ${cx} ${b.y}, ${b.lx} ${b.y}"/>`);
      }
    }
    for (const f of layout.future) {
      const from = layout.nodes[f.from];
      if (!from) continue;
      const a = mid(from.c, from.r), b = mid(f.c, f.r);
      const cx = (a.rx + b.lx) / 2;
      maxC = Math.max(maxC, f.c); maxR = Math.max(maxR, f.r);
      lines.push(`<path class="ln future fam-${f.family}" d="M ${a.rx} ${a.y} C ${cx} ${a.y}, ${cx} ${b.y}, ${b.lx} ${b.y}"/>`);
      nodes.push(`<div class="pnode future fam-${f.family}" style="left:${px(f.c)}px;top:${py(f.r)}px"><span class="pn-q">?</span><span class="pn-name">${esc(f.label)}</span></div>`);
    }
    for (const sk of Sk.pathSkills(path.id)) {
      const pos = layout.nodes[sk.id];
      if (!pos) continue;
      const r = Sk.rankOf(p, sk.id);
      const st = Sk.nodeState(p, sk);
      const max = sk.max_rank ?? 10;
      const costs = r < max ? Sk.nextCost(sk.id, r + 1) : [];
      const afford = costs.length > 0 && Sk.canAfford(p, costs);
      const un = Sk.unlockStatus(p, sk);
      const label = st === 'trained' ? `rank ${r}` : st === 'available' ? (afford ? 'learn' : 'learn…') : 'locked';
      const attr = `data-skill="${sk.id}" data-mode="${st === 'trained' ? 'skill' : 'locked'}"${r < max && un.ok ? ` data-train="${sk.id}"` : ''}`;
      nodes.push(`<button class="pnode st-${st} fam-${sk.branch}${st === 'available' && !afford ? ' poor' : ''}" style="left:${px(pos.c)}px;top:${py(pos.r)}px" data-nav data-key="sk:${sk.id}" ${attr}>
        <span class="pn-ico"><img src="${skillIconUrl(sk.id)}" alt=""></span>
        <span class="pn-name">${esc(sk.name)}</span><span class="pn-state">${label}</span><span class="pn-fam">${FAMILY[sk.branch] ?? sk.branch}</span></button>`);
    }
    const W = px(maxC) + NW + PAD, Hh = py(maxR) + NH + PAD;
    tree = `<div class="pathtree" style="width:${W}px;height:${Hh}px"><svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${lines.join('')}</svg>${nodes.join('')}</div>`;
  }
  $('#p-skills').innerHTML = `<div class="frame-title">Paths <small>(K)</small><button class="x" data-close="skills">×</button></div>
    <div class="tabs">${tabs}</div>
    ${equip}
    <div class="split paths"><div class="treewrap">${tree}</div><div class="preview" id="skills-preview"></div></div>
    ${hint('←↑↓→ select · Enter train / learn · 1–4 equip an attack · 5–6 equip a buff · Tab switch path · Esc close')}`;
}

export function renderSkillPreview(_hud: Hud, box: HTMLElement, el: HTMLElement) {
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
  const slotsHint = sk.type === 'buff' ? '5–6: equip' : '1–4: equip';
  const prevSk = Sk.prevOf(sk);
  box.innerHTML = `<div class="pv-head"><img src="${skillIconUrl(id)}"><div><div class="pv-name">${esc(sk.name)}</div><div class="pv-type">${sk.branch} · ${sk.type === 'buff' ? 'buff' : 'attack'} · rank ${r}/${max}${bound >= 0 ? ` · slot ${SLOT_KEYS[bound]}` : ''}</div></div></div>
    ${prevSk ? `<div class="pv-chain">Needs ${esc(prevSk.name)} ${Sk.known(p, prevSk.id) ? '✓' : '(not learned)'}</div>` : '<div class="pv-chain">Root of the path</div>'}
    <p>${esc(descOf(sk))}</p>
    <div class="pv-eff">${esc(sk.effect)}</div>
    <div class="pv-eff">${esc(Sk.rankPreview(id, r))} · ${sk.mp_cost} MP</div>
    ${r < max ? `<table class="pv-stats"><tr><th colspan="2">Cost for rank ${r + 1}</th></tr>${costRows}</table>` : ''}
    <div class="pv-act">${act}${known ? ` · ${slotsHint}` : ''}</div>`;
}
