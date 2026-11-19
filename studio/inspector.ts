// The inspector (right): the selected part and bone, the layer order of the
// current key, and pose tools.
import { S, clip, key, pose, edit, checkpoint, edited, changed } from './state';
import { render, selectBone, selectPart, COLOURS } from './stage';
import { mirrorPose, clonePose, drawOrder, type Pose } from '../src/anim/rig';

const side = document.getElementById('side')!;
let clipboard: Pose | null = null;
const open: Record<string, boolean> = { sel: true, layers: true, pose: true, legend: false };

const on = (sel: string, ev: string, f: (el: HTMLInputElement & HTMLSelectElement & HTMLElement, e: Event) => void) =>
  side.querySelectorAll<HTMLInputElement & HTMLSelectElement>(sel).forEach(el => el.addEventListener(ev, e => f(el, e)));
const fmt = (v: number) => String(Math.round(v * 10) / 10);

function section(id: string, title: string, badge: string, body: string) {
  return `<details data-sec="${id}" ${open[id] ? 'open' : ''}>
    <summary><h3>${title}</h3>${badge ? `<span class="badge">${badge}</span>` : ''}</summary>
    <div class="sec">${body}</div></details>`;
}

// ---------- layers ----------
const defaultOrder = () => S.asset!.rig.parts.map(q => q.name);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** Write an order into a pose (none when it is the rig's own order). */
function setOrder(p: Pose, order: string[]) {
  delete p.layer;
  if (same(order, defaultOrder())) delete p.order; else p.order = order;
}
/** Move a part one step forward (+1) or back (-1), or to the front / back (±99). */
export function moveLayer(part: string | null, dir: number) {
  if (!part) return;
  edit(() => {
    const p = pose();
    const order = drawOrder(S.asset!.rig, p);
    const i = order.indexOf(part);
    const j = Math.max(0, Math.min(order.length - 1, i + dir));
    if (i === j) return;
    order.splice(i, 1);
    order.splice(j, 0, part);
    setOrder(p, order);
  });
}

// ---------- render ----------
export function renderSide() {
  if (!S.asset || !S.file) return;
  side.querySelectorAll<HTMLDetailsElement>('details').forEach(d => { open[d.dataset.sec!] = d.open; });
  const rig = S.asset.rig;
  const p = pose();
  const bone = S.sel ? rig.bones[S.sel] : null;
  const ang = S.sel ? (p.a[S.sel] ?? 0) : 0;
  const off = S.sel ? (p.x?.[S.sel] ?? [0, 0]) : [0, 0];
  const swapPart = S.part && rig.swaps?.[S.part]?.length ? S.part : rig.parts.find(q => q.bone === S.sel && rig.swaps?.[q.name]?.length)?.name;
  const order = drawOrder(rig, p);
  const def = defaultOrder();
  const posable = (n: string) => !!rig.bones[n].parent && (!!rig.bones[n].tip || rig.bones[n].kind === 'move');
  const bones = Object.keys(rig.bones).filter(posable);

  const selBody = `
    <label class="row"><span>Bone</span><select id="bone-pick"><option value="">none</option>${bones.map(n => `<option ${n === S.sel ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${S.part ? `<div class="row"><span>Part</span><b>${S.part}</b></div>` : ''}
    ${bone && posable(S.sel!) ? `
      <div class="angle">
        <span class="muted">Angle</span>
        <input id="ang" type="range" min="-180" max="180" step="0.5" value="${Math.max(-180, Math.min(180, ang))}">
        <input id="ang-num" type="number" step="1" value="${fmt(ang)}">
      </div>
      <div class="nudge">${[-5, -1, 1, 5].map(d => `<button data-d="${d}" title="Turn ${d > 0 ? 'clockwise' : 'anticlockwise'} by ${Math.abs(d)}°">${d > 0 ? '+' : '−'}${Math.abs(d)}°</button>`).join('')}</div>
      ${bone.kind === 'move' ? `
        <div class="row"><span>Move x</span><input id="off-x" type="number" step="1" value="${fmt(off[0])}"></div>
        <div class="row"><span>Move y</span><input id="off-y" type="number" step="1" value="${fmt(off[1])}"></div>` : ''}` : ''}
    ${swapPart ? `<label class="row"><span>Picture</span><select id="swap"><option value="">normal</option>${rig.swaps![swapPart].map(f =>
      `<option ${p.swap?.[swapPart] === f ? 'selected' : ''} value="${f}">${f.replace(`${swapPart}_`, '')}</option>`).join('')}</select></label>` : ''}
    ${S.part ? `<div class="btns"><button id="lay-front" title="Bring forward (])">▲ Forward</button><button id="lay-back" title="Send back ([)">▼ Back</button></div>` : ''}
    ${bone ? `<button id="bone-reset">Reset this bone to rest</button>` : ''}
    ${!S.sel && !S.part ? '<p class="empty">Click a part or drag a handle on the stage to select it.</p>' : ''}`;

  const layersBody = `
    <ul class="layers">${[...order].reverse().map((n, i) => `
      <li data-part="${n}" class="${n === S.part ? 'on' : ''}" title="${n} (bone ${rig.parts.find(q => q.name === n)!.bone})">
        <span class="n">${order.length - i}</span><span class="nm">${n}</span>
        ${def.indexOf(n) !== order.indexOf(n) ? '<span class="moved" title="Moved from the rig\'s order on this key">●</span>' : ''}
        <button data-up="${n}" title="Bring forward" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button data-down="${n}" title="Send back" ${i === order.length - 1 ? 'disabled' : ''}>▼</button>
      </li>`).join('')}</ul>
    <div class="btns">
      <button id="lay-all" title="Use this key's layer order on every key of the clip">Use on all keys</button>
      <button id="lay-reset" title="Back to the rig's own order on this key" ${same(order, def) ? 'disabled' : ''}>Reset order</button>
    </div>`;

  const poseBody = `
    <div class="btns">
      <button id="copy" title="Ctrl+C">Copy</button>
      <button id="paste" ${clipboard ? '' : 'disabled'} title="Ctrl+V">Paste</button>
      <button id="mirror" title="Swap the left and right limbs">Mirror</button>
    </div>
    <button id="reset-pose">Reset this key to rest</button>`;

  const legendBody = `<div class="legend">
      <span><i style="background:${COLOURS.turn}"></i>turn a bone</span>
      <span><i style="background:${COLOURS.ik}"></i>hand / foot (IK)</span>
      <span><i style="background:${COLOURS.item}"></i>held item</span>
      <span><i class="sq" style="background:${COLOURS.move}"></i>move (hips)</span>
      <span><i style="background:${COLOURS.spring}"></i>follow-through</span>
    </div>`;

  side.innerHTML =
    section('sel', 'Selected', S.part ?? S.sel ?? '', selBody) +
    section('layers', 'Layers', `key ${S.key + 1}`, layersBody) +
    section('pose', 'Pose', `key ${S.key + 1}`, poseBody) +
    section('legend', 'Handle colours', '', legendBody);

  on('#bone-pick', 'change', el => { selectBone(el.value || null); changed(); });
  on('#ang', 'input', el => {
    if (!S.sel) return;
    if (!sliding) { checkpoint(); sliding = true; }
    pose().a[S.sel] = +el.value;
    (side.querySelector('#ang-num') as HTMLInputElement).value = el.value;
    render();
  });
  on('#ang', 'change', () => { sliding = false; edited(); });
  on('#ang-num', 'change', el => edit(() => { pose().a[S.sel!] = +el.value || 0; }));
  on('.nudge button', 'click', el => edit(() => { const p = pose(); p.a[S.sel!] = Math.round(((p.a[S.sel!] ?? 0) + +el.dataset.d!) * 10) / 10; }));
  on('#off-x', 'change', el => edit(() => { const p = pose(); (p.x ??= {})[S.sel!] = [+el.value || 0, p.x[S.sel!]?.[1] ?? 0]; }));
  on('#off-y', 'change', el => edit(() => { const p = pose(); (p.x ??= {})[S.sel!] = [p.x[S.sel!]?.[0] ?? 0, +el.value || 0]; }));
  on('#swap', 'change', el => edit(() => {
    const p = pose();
    if (el.value) (p.swap ??= {})[swapPart!] = el.value;
    else if (p.swap) { delete p.swap[swapPart!]; if (!Object.keys(p.swap).length) delete p.swap; }
  }));
  on('#lay-front', 'click', () => moveLayer(S.part, 1));
  on('#lay-back', 'click', () => moveLayer(S.part, -1));
  on('#bone-reset', 'click', () => edit(() => { const p = pose(); delete p.a[S.sel!]; if (p.x) delete p.x[S.sel!]; }));
  on('.layers li', 'click', (el, e) => { if ((e.target as HTMLElement).closest('button')) return; selectPart(el.dataset.part!); changed(); });
  on('[data-up]', 'click', el => { selectPart(el.dataset.up!); moveLayer(el.dataset.up!, 1); });
  on('[data-down]', 'click', el => { selectPart(el.dataset.down!); moveLayer(el.dataset.down!, -1); });
  on('#lay-all', 'click', () => edit(() => { for (const k of clip().keys) setOrder(k.pose, [...order]); }));
  on('#lay-reset', 'click', () => edit(() => { delete pose().order; delete pose().layer; }));
  on('#copy', 'click', copyPose);
  on('#paste', 'click', pastePose);
  on('#mirror', 'click', () => edit(() => { key().pose = mirrorPose(S.asset!.rig, pose()); }));
  on('#reset-pose', 'click', () => edit(() => { key().pose = { a: {} }; }));
  on('details', 'toggle', el => { open[el.dataset.sec!] = (el as unknown as HTMLDetailsElement).open; });
}
let sliding = false;

export function copyPose() { clipboard = clonePose(pose()); changed(); }
export function pastePose() { if (clipboard) { const c = clipboard; edit(() => { key().pose = clonePose(c); }); } }
