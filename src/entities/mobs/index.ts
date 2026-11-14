import Phaser from 'phaser';
import type { MonsterDef } from '../../data/db';
import { Monster, MobOpts } from '../Monster';
import { HollowStag } from './HollowStag';

/** v0.3.0: the Hollow Stag has its own AI; every other mob is a Monster with its MOB_KIND. */
export function createMonster(scene: Phaser.Scene, def: MonsterDef, x: number, y: number, patrol?: [number, number], opts: MobOpts = {}): Monster {
  if (def.id === 'hollow_stag') return new HollowStag(scene, def, x, y, patrol, opts);
  return new Monster(scene, def, x, y, patrol, opts);
}
