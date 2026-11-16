/**
 * v0.3.1 objectives panel (L): each quest as one readable line with its count lines underneath; a quest ready to
 * turn in shows its title bold gold with a check and brighter counts; farm entries follow in green.
 */
import type { PlayerData } from '../../systems/Player';
import * as Q from '../../systems/Quests';
import * as Farm from '../../systems/Farm';
import { esc } from '../Hud';

const countLines = (counts: Q.CountLine[]) => counts.length
  ? `<ul class="qt-counts">${counts.map((c) => `<li class="${c.done ? 'ok' : ''}">${c.done ? '✓' : '·'} ${esc(c.label)}: ${c.have}/${c.need}</li>`).join('')}</ul>`
  : '';

/** The tracker's inner HTML, or '' when there is nothing to show. */
export function trackerHtml(p: PlayerData): string {
  const objs = Q.currentObjectives(p);
  const farm = Farm.entries(p);
  if (!objs.length && !farm.length) return '';
  const quests = objs.map((o) => `<div class="qt-quest${o.ready ? ' ready' : ''}"><div class="qt-name">${o.ready ? '✓ ' : ''}${esc(o.name)}</div>` +
    `<div class="qt-obj">${esc(o.objective)}</div>${countLines(o.counts)}</div>`).join('');
  const farms = farm.map((f) => `<div class="qt-quest farm"><div class="qt-name">Farm: ${esc(f.name)} rank ${f.rank}` +
    `<button class="qt-x" data-farmx="${f.skill}" title="Remove from farm list">✕</button></div>${countLines(f.counts)}</div>`).join('');
  return `<div class="qt-head"><span class="qt-title">Objectives</span><span class="qt-key">L hide</span></div>${quests}${farms}`;
}
