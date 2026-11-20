// The timeline (bottom): play controls, the clip's keys as a bar sized by
// time, and a card per key with its picture, timing, blend and event.
import { S, clip, key, edit, changed } from './state';
import { play, drawThumb } from './stage';
import { EASES, keyTimes, clipLength, type Ease, type Key } from '../src/anim/clip';
import { clonePose } from '../src/anim/rig';
import { openHelp } from './help';

const tl = document.getElementById('timeline')!;
let keysScroll = 0;   // the key row's scroll, kept while the timeline redraws
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const on = (sel: string, ev: string, f: (el: HTMLInputElement & HTMLSelectElement & HTMLElement, e: Event) => void) =>
  tl.querySelectorAll<HTMLInputElement & HTMLSelectElement>(sel).forEach(el => el.addEventListener(ev, e => f(el, e)));

const EASE_TIPS: Record<Ease, string> = {
  smooth: 'smooth: a gentle curve through the keys around it (the default)',
  linear: 'linear: even speed',
  easeIn: 'easeIn: starts slow, ends fast (into a hit)',
  easeOut: 'easeOut: starts fast, ends slow (after a hit)',
  easeInOut: 'easeInOut: slow at both ends',
  hold: 'hold: stays on this pose, then jumps to the next',
};

export function renderTimeline() {
  if (!S.asset || !S.file) return;
  const c = clip();
  const len = clipLength(c);
  const starts = keyTimes(c);
  const segs = c.keys.map((k, i) => {
    const ms = c.loop || i < c.keys.length - 1 ? k.ms : 0;
    return `<div class="seg ${i === S.key ? 'on' : ''}" data-i="${i}" style="flex:${Math.max(ms, 1)}" title="Key ${i + 1} at ${starts[i]} ms, ${k.ms} ms to the next">${i + 1}${k.event ? ` <b>${esc(k.event)}</b>` : ''}</div>`;
  }).join('');
  tl.innerHTML = `
    <div class="tl-bar">
      <button id="play" class="primary" title="Play or pause (Space)">${S.playing ? '❚❚ Pause' : '▶ Play'}</button>
      <button id="loop" class="toggle ${c.loop ? 'on' : ''}" title="Loop: the last key blends back into the first">⟳ Loop</button>
      <label class="field">Speed <select id="speed">${[0.25, 0.5, 1, 2].map(v => `<option ${v === S.speed ? 'selected' : ''} value="${v}">${v}×</option>`).join('')}</select></label>
      <span class="tl-info">${c.keys.length} key${c.keys.length > 1 ? 's' : ''} · ${(len / 1000).toFixed(2)} s</span>
      <span class="spacer"></span>
      <button id="k-left" ${S.key === 0 ? 'disabled' : ''} title="Move this key earlier">◀</button>
      <button id="k-right" ${S.key === c.keys.length - 1 ? 'disabled' : ''} title="Move this key later">▶</button>
      <button id="k-add" title="Copy this key and put the copy after it (Insert)">＋ Add key</button>
      <button id="k-del" class="danger" ${c.keys.length < 2 ? 'disabled' : ''} title="Delete this key (Delete)">Delete key</button>
      <button id="help-btn" title="How the studio works (?)">? Help</button>
    </div>
    <div class="track"><div class="segs">${segs}</div><div id="playhead" class="playhead" ${S.playing ? '' : 'hidden'}></div></div>
    <div class="keys">${c.keys.map((k, i) => keyCard(k, i)).join('')}<button class="key-add" id="k-add2" title="Add a key at the end (a copy of the last one)">＋<br>key</button></div>`;

  tl.querySelectorAll<HTMLCanvasElement>('canvas[data-i]').forEach(cv => drawThumb(cv, c.keys[+cv.dataset.i!].pose));
  on('#play', 'click', () => play(!S.playing));
  on('#loop', 'click', () => edit(() => { clip().loop = !clip().loop; }));
  on('#speed', 'change', el => { S.speed = +el.value; });
  on('#k-add', 'click', addKey);
  on('#k-add2', 'click', () => { S.key = clip().keys.length - 1; addKey(); });
  on('#k-del', 'click', deleteKey);
  on('#k-left', 'click', () => moveKey(-1));
  on('#k-right', 'click', () => moveKey(1));
  on('#help-btn', 'click', () => openHelp());
  on('.seg, .key', 'click', (el, e) => {
    if ((e.target as HTMLElement).closest('input, select')) return;
    selectKey(+el.dataset.i!);
  });
  on('.k-ms', 'change', el => edit(() => { clip().keys[+el.dataset.i!].ms = Math.max(0, Math.round(+el.value || 0)); }));
  on('.k-ease', 'change', el => edit(() => { clip().keys[+el.dataset.i!].ease = el.value as Ease; }));
  on('.k-ev', 'change', el => edit(() => {
    const k = clip().keys[+el.dataset.i!];
    if (el.value.trim()) k.event = el.value.trim(); else delete k.event;
  }));
  // keep the scroll position across redraws, then bring the current key into view
  const row = tl.querySelector<HTMLElement>('.keys')!;
  row.style.scrollBehavior = 'auto';
  row.scrollLeft = keysScroll;
  const cur = row.querySelector<HTMLElement>('.key.on');
  if (cur && (cur.offsetLeft < row.scrollLeft || cur.offsetLeft + cur.offsetWidth > row.scrollLeft + row.clientWidth)) {
    row.scrollLeft = cur.offsetLeft - (row.clientWidth - cur.offsetWidth) / 2;
  }
  row.style.scrollBehavior = '';
  row.addEventListener('scroll', () => { keysScroll = row.scrollLeft; });
  // the mouse wheel scrolls the row of keys sideways
  row.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || row.scrollWidth <= row.clientWidth) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }, { passive: false });
  updatePlayhead();
}

function keyCard(k: Key, i: number) {
  return `<div class="key ${i === S.key ? 'on' : ''}" data-i="${i}">
    <canvas data-i="${i}"></canvas>
    <div class="key-h"><span>Key ${i + 1}</span>${k.event ? `<span class="ev">⚑ ${esc(k.event)}</span>` : ''}</div>
    <label title="Milliseconds from this key to the next one">to next <input class="k-ms" data-i="${i}" type="number" min="0" step="10" value="${k.ms}"></label>
    <label title="${EASE_TIPS[k.ease]}">blend <select class="k-ease" data-i="${i}">${EASES.map(e => `<option ${e === k.ease ? 'selected' : ''} title="${EASE_TIPS[e]}">${e}</option>`).join('')}</select></label>
    <label title="A name the game reacts to when this key is reached, e.g. hit">event <input class="k-ev" data-i="${i}" type="text" placeholder="e.g. hit" value="${esc(k.event ?? '')}"></label>
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
export function deleteKey() {
  if (clip().keys.length < 2) return;
  edit(() => { clip().keys.splice(S.key, 1); S.key = Math.max(0, S.key - 1); });
}
function moveKey(d: number) {
  edit(() => {
    const ks = clip().keys, j = S.key + d;
    [ks[S.key], ks[j]] = [ks[j], ks[S.key]];
    S.key = j;
  });
}
