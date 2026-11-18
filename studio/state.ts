// Studio state: the loaded asset, the clip file being edited, selection,
// view toggles, undo/redo and the local draft. Plain module state; every
// change calls `changed()` so the UI redraws.
import type { RigDef, Pose } from '../src/anim/rig';
import { newFile, type AnimFile, type Clip, type Key } from '../src/anim/clip';

export interface Frame { x: number; y: number; w: number; h: number; px: number; py: number }
export interface Asset {
  id: string;
  name: string;
  clips: string[];
  rig: RigDef;
  img: HTMLImageElement;
  frames: Record<string, Frame>;
}

export const S = {
  asset: null as Asset | null,
  file: null as AnimFile | null,
  clip: '',
  key: 0,
  sel: null as string | null,
  playing: false,
  t: 0,            // playback time (ms)
  speed: 1,
  ik: true,
  pin: true,
  onion: true,
  handles: true,
  springs: true,
  dirty: false,
  /** where the open file came from: 'github' | 'site' | 'new' | 'file' */
  source: 'new',
};

const listeners: (() => void)[] = [];
export const onChange = (f: () => void) => listeners.push(f);
export const changed = () => listeners.forEach(f => f());

export const clip = (): Clip => S.file!.clips[S.clip];
export const key = (): Key => clip().keys[S.key];
export const pose = (): Pose => key().pose;

// ---------- undo / redo (snapshots of the whole file) ----------
const undo: string[] = [];
const redo: string[] = [];
const snap = () => JSON.stringify({ file: S.file, clip: S.clip, key: S.key });

/** Call before a change: remembers the state to undo to. */
export function checkpoint() {
  undo.push(snap());
  if (undo.length > 200) undo.shift();
  redo.length = 0;
}
/** After a change: mark unsaved, keep a local draft, redraw. */
export function edited() {
  S.dirty = true;
  saveDraft();
  changed();
}
/** checkpoint + change + edited, for one-shot edits. */
export function edit(fn: () => void) {
  checkpoint();
  fn();
  edited();
}
function restore(s: string) {
  const o = JSON.parse(s);
  S.file = o.file;
  S.clip = o.clip in S.file!.clips ? o.clip : Object.keys(S.file!.clips)[0];
  S.key = Math.min(o.key, clip().keys.length - 1);
}
export function doUndo() {
  const s = undo.pop();
  if (!s) return;
  redo.push(snap());
  restore(s);
  edited();
}
export function doRedo() {
  const s = redo.pop();
  if (!s) return;
  undo.push(snap());
  restore(s);
  edited();
}
export function clearHistory() { undo.length = 0; redo.length = 0; }

// ---------- local draft: nothing is lost before it reaches GitHub ----------
const draftKey = () => `meadows-studio:draft:${S.asset?.id}`;
export function saveDraft() {
  try { localStorage.setItem(draftKey(), JSON.stringify(S.file)); } catch { /* storage off: no draft */ }
}
export function readDraft(): AnimFile | null {
  try { const s = localStorage.getItem(draftKey()); return s ? JSON.parse(s) as AnimFile : null; } catch { return null; }
}
export function clearDraft() {
  try { localStorage.removeItem(draftKey()); } catch { /* ignore */ }
}

/** Make sure the file has the asset's starting clips, each with a key. */
export function normalise(file: AnimFile | null, a: Asset): AnimFile {
  const f = file && file.clips ? file : newFile(a.id, a.clips);
  f.asset = a.id;
  f.version = 1;
  for (const c of a.clips) f.clips[c] ??= newFile(a.id, [c]).clips[c];
  for (const c of Object.values(f.clips)) if (!c.keys.length) c.keys.push(newFile(a.id, ['x']).clips.x.keys[0]);
  return f;
}
