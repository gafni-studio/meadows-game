/** The journal window (J) and its quest preview (moved out of Hud). */
import { DB } from '../../data/db';
import { Game } from '../../systems/GameState';
import { skillIconUrl } from '../../art/sprites';
import * as Q from '../../systems/Quests';
import { esc, hint } from '../Hud';

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export function renderJournal() {
  const entries = Q.journal(Game.player);
  const tiles = entries.map((e) => {
    const tag = e.status === 'active' ? `s${e.step}` : e.status === 'done' ? 'done' : 'new';
    return `<button class="tile t-quest t-${e.status}" data-nav data-key="q:${e.line}" data-line="${e.line}" data-mode="quest">
      ${e.skill ? `<img src="${skillIconUrl(e.skill)}" alt="">` : '<span class="empty"></span>'}
      <span class="qty">${tag}</span><span class="price">${esc(e.name)}</span></button>`;
  }).join('') || '<p class="muted">No quests yet. Reach level 2 to begin The Weight of a Swing.</p>';
  $('#p-journal').innerHTML = `<div class="frame-title">Journal <small>(J)</small><button class="x" data-close="journal">×</button><button class="obj-btn" data-nav data-key="objectives" data-act="objectives">Objectives (L)</button></div>
    <p class="muted">Skill questlines. Calden finishes a step when you talk to him. Named foes appear only on their hunt step.</p>
    <div class="split"><div class="grid sk">${tiles}</div><div class="preview" id="journal-preview"></div></div>
    ${hint('↑↓ select · Esc close · J toggle')}`;
}

export function renderJournalPreview(box: HTMLElement, el: HTMLElement) {
  const line = el.dataset.line;
  const e = Q.journal(Game.player).find((x) => x.line === line);
  if (!e) { box.innerHTML = '<p class="muted">Select a quest.</p>'; return; }
  const steps = e.steps.map((st) =>
    // v0.3.1: the step's line, then one count line per mob or item underneath.
  `<li class="${st.done ? 'done' : st.current ? 'current' : 'soon'}"><b>${st.n}.</b> ${esc(st.objective)}${st.counts?.length
    ? `<ul class="j-counts">${st.counts.map((c) => `<li class="${c.done ? 'ok' : ''}">${c.done ? '✓' : '·'} ${esc(c.label)}: ${c.have}/${c.need}</li>`).join('')}</ul>` : ''}</li>`
  ).join('');
  const status = e.status === 'active' ? 'In progress' : e.status === 'done' ? 'Complete' : 'Not started';
  box.innerHTML = `<div class="pv-name">${esc(e.name)}</div>
    <div class="pv-type">${status}${e.skill && DB.skills[e.skill] ? ' · unlocks ' + DB.skills[e.skill].name : ''}</div>
    <p>${esc(e.desc)}</p>
    <ol class="j-steps">${steps}</ol>
    ${e.rewards ? `<div class="pv-eff">Reward: ${esc(e.rewards)}</div>` : ''}`;
}
