import { fitSlot } from '../../art/SpriteFactory';
import { TILE } from '../../data/assumptions';
import { Game } from '../../systems/GameState';
import * as Q from '../../systems/Quests';
import type { WorldScene } from '../WorldScene';

/** NPC sprites, names and quest markers (moved out of WorldScene). */
export function buildNpcs(scene: WorldScene, groundY: number): void {
  const W = scene.geo.widthTiles * TILE;
  // NPCs.
  for (const n of scene.geo.npcs) {
    const img = fitSlot(scene, scene.add.image(n.x * TILE, groundY, `npc.${n.id}`).setOrigin(0.5, 1).setDepth(4), `npc.${n.id}`);
    if (n.x * TILE > W / 2) img.setFlipX(true);
    scene.add.text(n.x * TILE, groundY - img.displayHeight - 4, n.name, { fontFamily: 'monospace', fontSize: '11px', color: '#fff6c2', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(4);
    // v0.2.6: a gold ! (quest available) or ? (turn-in ready) bobs above the name.
    const marker = scene.add.text(n.x * TILE, groundY - img.displayHeight - 24, '!', { fontFamily: 'monospace', fontSize: '26px', color: '#ffd23a', stroke: '#3a2400', strokeThickness: 5, fontStyle: 'bold' })
      .setOrigin(0.5, 1).setDepth(6).setVisible(false);
    scene.tweens.add({ targets: marker, y: marker.y - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.npcs.push({ x: n.x * TILE, id: n.id, role: n.role, name: n.name, marker });
  }
}

/** Quest markers above NPCs; hidden while any window (including the conversation) is open. */
export function updateMarkers(scene: WorldScene, time: number): void {
  if (!scene.npcs.length || time - scene.lastMarkerAt < 120) return;
  scene.lastMarkerAt = time;
  for (const n of scene.npcs) {
    if (!n.marker) continue;
    const m = Game.menuOpen ? null : Q.markerFor(Game.player, n.id);
    if (!m) { n.marker.setVisible(false); continue; }
    n.marker.setText(m).setColor(m === '!' ? '#ffd23a' : '#fff4b8').setVisible(true);
  }
}

/** Spawn a named quest foe only while its kill-step is active and it is not already here. */
export function ensureNamed(scene: WorldScene): void {
  for (const n of scene.geo.namedSpawns ?? []) {
    if (scene.monsters.some((m) => m.def.id === n.id && m.alive)) continue;
    if (Q.shouldSpawn(Game.player, n.id)) {
      scene.spawnMonster(n.id, n.x * TILE);
      if (n.id === 'bank_cracker') Game.toast('Bank-Cracker claws out of the bank.', 'rare');
      if (n.id === 'cinderback') Game.toast('Cinderback claws out of the bank.', 'rare');
      if (n.id === 'wool_shoulder') Game.toast('Wool-Shoulder shoulders out of the flock.', 'rare');
    }
  }
}
