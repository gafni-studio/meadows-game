import { DB } from '../../data/db';
import { Game } from '../../systems/GameState';
import * as Q from '../../systems/Quests';
import { esc } from '../Hud';
import type { Hud } from '../Hud';

/** E on an NPC: their quest talk, else their window (shop, exchange, Paths), else a greeting (moved out of Hud). */
export function routeNpc(hud: Hud, id: string, role: string, name: string): void {
  if (role === 'shop') {
    if (Q.wantsTalk(Game.player, id)) { hud.openTalk(Q.talk(Game.player, id)); return; }
    hud.shopTab = 'buy'; hud.open('shop'); return;
  }
  if (role === 'exchange') {
    if (Q.wantsTalk(Game.player, id)) { hud.openTalk(Q.talk(Game.player, id)); return; }
    hud.open('exchange'); return;
  }
  if (role === 'path') {
    // v0.2.8 Tamsin: her tutorial first; once it is done, E opens the Paths window on the Magician tab.
    if (Q.wantsTalk(Game.player, id)) { hud.openTalk(Q.talk(Game.player, id)); return; }
    if (Q.pathRevealed(Game.player, 'magician')) { hud.pathTab = 'magician'; hud.open('skills'); return; }
    hud.openTalk(Q.greeting(id));
    return;
  }
  if (role === 'trainer') {
    if (Q.wantsTalk(Game.player, id)) { hud.openTalk(Q.talk(Game.player, id)); return; }
    hud.open('skills');
    return;
  }
  if (id === 'pell' && Q.wantsTalk(Game.player, 'pell')) {
    hud.openTalk(Q.talk(Game.player, 'pell'));
    return;
  }
  const lines: Record<string, string> = {};
  for (const n of Object.values(DB.npcs ?? {})) if (n.desc) lines[n.id] = n.desc;
  const greet = Q.greeting(id);
  if (greet) { hud.openTalk(greet); return; }
  hud.dialogHtml = `<h3>${esc(name)}</h3><p>${esc(lines[id] ?? '...')}</p>`;
  hud.sel.dialog = undefined;
  hud.open('dialog');
}
