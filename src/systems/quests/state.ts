import type * as P from '../Player';

export interface QuestState { step: number; done: boolean; killed?: boolean; dummyHits?: number; kills?: Record<string, number>; chestIn?: boolean }
export type QuestLog = Record<string, QuestState>;

export function state(p: P.PlayerData, line: string): QuestState {
  p.questLog ??= {};
  return p.questLog[line] ?? { step: 0, done: false };
}
export function isDone(p: P.PlayerData, line: string): boolean { return !!state(p, line).done; }
export function isActive(p: P.PlayerData, line: string): boolean {
  const s = state(p, line);
  return !s.done && s.step >= 1;
}
export function setState(p: P.PlayerData, line: string, s: QuestState) {
  p.questLog ??= {};
  p.questLog[line] = s;
}
