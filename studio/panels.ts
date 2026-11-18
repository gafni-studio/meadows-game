// The side panel (selected bone, pose tools, view toggles) and the timeline
// (keys with their timing, ease and event; play controls).
import { S, clip, key, pose, edit, checkpoint, edited, changed } from './state';
import { render, play, resetView } from './stage';
import { EASES, keyTimes, clipLength, type Ease, type Key } from '../src/anim/clip';
import { mirrorPose, clonePose, type Pose } from '../src/anim/rig';

const side = document.getElementById('side')!;
const tl = document.getElementById('timeline')!;
let clipboard: Pose | null = null;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const on = (root: HTMLElement, sel: string, ev: string, f: (el: HTMLInputElement & HTMLSelectElement, e: Event) => void) =>
  root.querySelectorAll<HTMLInputElement & HTMLSelectElement>(sel).forEach(el => el.addEventListener(ev, e => f(el, e)));

// ---------- side panel ----------
export function renderSide() {
  if (!S.asset || !S.file) return;
  const rig = S.asset.rig;
  const p = pose();
  const b = S.sel ? rig.bones[S.sel] : null;
  const ang = S.sel ? (p.a[S.sel] ?? 0) : 0;
  const off = S.sel ? (p.x?.[S.sel] ?? [0, 0]) : [0, 0];
  const layerSpec = S.sel ? rig.layers?.[rig.parts.find(q => q.bone === S.sel)?.name ?? ''] : undefined;
  const item = rig.parts.find(q => q.bone === S.sel)?.name ?? '';
  const swapPart = rig.parts.find(q => q.bone === S.sel && rig.swaps?.[q.name]?.length)?.name;
  const boneList = Object.keys(rig.bones).filter(n => rig.bones[n].parent);
  side.innerHTML = `
    <section>
      <h3>Bone</h3>
      <select id="bone-pick"><option value="">(click a handle)</option>${boneList.map(n => `<option ${n === S.sel ? 'selected' : ''}>${n}</option>`).join('')}</select>
      ${b ? `
        <label class="row">Angle <input id="ang-num" type="number" step="1" value="${ang}"></label>
        <input id="ang" type="range" min="-180" max="180" step="0.5" value="${Math.max(-180, Math.min(180, ang))}">
        ${b.kind === 'move' ? `<label class="row">Move x <input id="off-x" type="number" step="1" value="${off[0]}"></label>
          <label class="row">Move y <input id="off-y" type="number" step="1" value="${off[1]}"></label>` : ''}
        ${layerSpec ? `<label class="row">Layer <select id="layer">${['back', 'mid', 'front'].map(l =>
          `<option ${(p.layer?.[item] ?? 'mid') === l ? 'selected' : ''} value="${l}">${{ back: 'behind body', mid: 'normal', front: 'in front' }[l]}</option>`).join('')}</select></label>` : ''}
        ${swapPart ? `<label class="row">Picture <select id="swap"><option value="">normal</option>${rig.swaps![swapPart].map(f =>
          `<option ${p.swap?.[swapPart] === f ? 'selected' : ''} value="${f}">${f.replace(`${swapPart}_`, '')}</option>`).join('')}</select></label>` : ''}
        <button id="bone-reset">Reset bone</button>` : '<p class="hint">Click a handle on the stage, or pick a bone here.</p>'}
    </section>
    <section>
      <h3>Pose (this key)</h3>
      <div class="btns">
        <button id="copy" title="Ctrl+C">Copy</button>
        <button id="paste" ${clipboard ? '' : 'disabled'} title="Ctrl+V">Paste</button>
        <button id="mirror" title="Swap left and right limbs">Mirror</button>
        <button id="reset-pose">Reset to rest</button>
      </div>
    </section>
    <section>
      <h3>Tools</h3>
      <label class="check"><input type="checkbox" id="t-ik" ${S.ik ? 'checked' : ''}> IK: hand / foot handles move the whole limb</label>
      <label class="check"><input type="checkbox" id="t-pin" ${S.pin ? 'checked' : ''}> Pin feet while moving the hips</label>
      <label class="check"><input type="checkbox" id="t-onion" ${S.onion ? 'checked' : ''}> Onion skin (previous and next key)</label>
      <label class="check"><input type="checkbox" id="t-handles" ${S.handles ? 'checked' : ''}> Show handles</label>
      <label class="check"><input type="checkbox" id="t-springs" ${S.springs ? 'checked' : ''}> Follow-through (scarf, tails) on play</label>
      <button id="fit">Fit view</button>
    </section>
    <section class="legend">
      <span><i style="background:#3b82f6"></i>turn</span>
      <span><i style="background:#10b981"></i>IK end</span>
      <span><i style="background:#f59e0b"></i>item</span>
      <span><i class="sq" style="background:#8b5cf6"></i>move</span>
    </section>`;

  on(side, '#bone-pick', 'change', el => { S.sel = el.value || null; changed(); });
  on(side, '#ang', 'input', el => { if (!S.sel) return; if (!dragging) { checkpoint(); dragging = true; } pose().a[S.sel] = +el.value; (side.querySelector('#ang-num') as HTMLInputElement).value = el.value; render(); });
  on(side, '#ang', 'change', () => { dragging = false; edited(); });
  on(side, '#ang-num', 'change', el => edit(() => { pose().a[S.sel!] = +el.value || 0; }));
  on(side, '#off-x', 'change', el => edit(() => { const p = pose(); (p.x ??= {})[S.sel!] = [+el.value || 0, p.x[S.sel!]?.[1] ?? 0]; }));
  on(side, '#off-y', 'change', el => edit(() => { const p = pose(); (p.x ??= {})[S.sel!] = [p.x[S.sel!]?.[0] ?? 0, +el.value || 0]; }));
  on(side, '#layer', 'change', el => edit(() => { const p = pose(); (p.layer ??= {})[item] = el.value as 'back' | 'mid' | 'front'; if (el.value === 'mid') delete p.layer[item]; }));
  on(side, '#swap', 'change', el => edit(() => {
    const p = pose();
    if (el.value) (p.swap ??= {})[swapPart!] = el.value;
    else if (p.swap) { delete p.swap[swapPart!]; if (!Object.keys(p.swap).length) delete p.swap; }
  }));
  on(side, '#bone-reset', 'click', () => edit(() => { const p = pose(); delete p.a[S.sel!]; if (p.x) delete p.x[S.sel!]; }));
  on(side, '#copy', 'click', copyPose);
  on(side, '#paste', 'click', pastePose);
  on(side, '#mirror', 'click', () => edit(() => { key().pose = mirrorPose(S.asset!.rig, pose()); }));
  on(side, '#reset-pose', 'click', () => edit(() => { key().pose = { a: {} }; }));
  const tog = (id: string, k: 'ik' | 'pin' | 'onion' | 'handles' | 'springs') =>
    on(side, id, 'change', el => { S[k] = el.checked; changed(); });
  tog('#t-ik', 'ik'); tog('#t-pin', 'pin'); tog('#t-onion', 'onion'); tog('#t-handles', 'handles'); tog('#t-springs', 'springs');
  on(side, '#fit', 'click', resetView);
}
let dragging = false;

export function copyPose() { clipboard = clonePose(pose()); changed(); }
export function pastePose() { if (clipboard) { const c = clipboard; edit(() => { key().pose = clonePose(c); }); } }

// ---------- timeline ----------
export function renderTimeline() {
  if (!S.asset || !S.file) return;
  const c = clip();
  const len = clipLength(c);
  const starts = keyTimes(c);
  const segs = c.keys.map((k, i) => {
    const ms = c.loop || i < c.keys.length - 1 ? k.ms : 0;
    return `<div class="seg ${i === S.key ? 'on' : ''}" data-i="${i}" style="flex:${Math.max(ms, 1)}" title="Key ${i + 1}: ${starts[i]} ms">${i + 1}${k.event ? ` <b>${esc(k.event)}</b>` : ''}</div>`;
  }).join('');
  tl.innerHTML = `
    <div class="tl-bar">
      <button id="play" class="primary" title="Space">${S.playing ? '❚❚ Pause' : '▶ Play'}</button>
      <label class="check"><input type="checkbox" id="loop" ${c.loop ? 'checked' : ''}> Loop</label>
      <label>Speed <select id="speed">${[0.25, 0.5, 1, 2].map(v => `<option ${v === S.speed ? 'selected' : ''} value="${v}">${v}×</option>`).join('')}</select></label>
      <span class="muted">${c.keys.length} keys · ${len} ms${c.loop ? ' (loop)' : ''}</span>
      <span class="spacer"></span>
      <button id="k-add" title="Duplicate this key after it (Insert)">+ Add key</button>
      <button id="k-left" ${S.key === 0 ? 'disabled' : ''}>◀ Move</button>
      <button id="k-right" ${S.key === c.keys.length - 1 ? 'disabled' : ''}>Move ▶</button>
      <button id="k-del" ${c.keys.length < 2 ? 'disabled' : ''}>Delete key</button>
    </div>
    <div class="track"><div class="segs">${segs}</div><div id="playhead" class="playhead" ${S.playing ? '' : 'hidden'}></div></div>
    <div class="keys">${c.keys.map((k, i) => keyCard(k, i)).join('')}</div>`;

  on(tl, '#play', 'click', () => play(!S.playing));
  on(tl, '#loop', 'change', el => edit(() => { clip().loop = el.checked; }));
  on(tl, '#speed', 'change', el => { S.speed = +el.value; });
  on(tl, '#k-add', 'click', addKey);
  on(tl, '#k-del', 'click', () => edit(() => { clip().keys.splice(S.key, 1); S.key = Math.max(0, S.key - 1); }));
  on(tl, '#k-left', 'click', () => moveKey(-1));
  on(tl, '#k-right', 'click', () => moveKey(1));
  tl.querySelectorAll<HTMLElement>('.seg, .key').forEach(el => el.addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('input, select')) return;
    selectKey(+el.dataset.i!);
  }));
  on(tl, '.k-ms', 'change', el => edit(() => { clip().keys[+el.dataset.i!].ms = Math.max(0, Math.round(+el.value || 0)); }));
  on(tl, '.k-ease', 'change', el => edit(() => { clip().keys[+el.dataset.i!].ease = el.value as Ease; }));
  on(tl, '.k-ev', 'change', el => edit(() => {
    const k = clip().keys[+el.dataset.i!];
    if (el.value.trim()) k.event = el.value.trim(); else delete k.event;
  }));
  updatePlayhead();
}

function keyCard(k: Key, i: number) {
  return `<div class="key ${i === S.key ? 'on' : ''}" data-i="${i}">
    <div class="key-h">Key ${i + 1}</div>
    <label>to next <input class="k-ms" data-i="${i}" type="number" min="0" step="10" value="${k.ms}"> ms</label>
    <label>blend <select class="k-ease" data-i="${i}">${EASES.map(e => `<option ${e === k.ease ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
    <label>event <input class="k-ev" data-i="${i}" type="text" placeholder="e.g. hit" value="${esc(k.event ?? '')}"></label>
  </div>`;
}

export function updatePlayhead() {
  const ph = document.getElementById('playhead');
  if (!ph || !S.file) return;
  ph.hidden = !S.playing;
  const len = clipLength(clip());
  if (!len) return;
  const t = clip().loop ? ((S.t % len) + len) % len : Math.min(S.t, len);
  ph.style.left = `${(t / len) * 100}%`;
}

export function selectKey(i: number) {
  if (S.playing) play(false);
  S.key = Math.max(0, Math.min(i, clip().keys.length - 1));
  changed();
}
export function addKey() {
  edit(() => {
    const k = key();
    clip().keys.splice(S.key + 1, 0, { ms: k.ms, ease: k.ease, pose: clonePose(k.pose) });
    S.key++;
  });
}
function moveKey(d: number) {
  edit(() => {
    const ks = clip().keys, j = S.key + d;
    [ks[S.key], ks[j]] = [ks[j], ks[S.key]];
    S.key = j;
  });
}
