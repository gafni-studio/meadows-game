// The stage: draws the rig and lets you pose it.
//   drag a round handle   turn that bone (IK on: a hand / foot handle moves the whole limb)
//   drag a square handle  move that joint (hips); pinned feet stay put
//   click a part          select it (for its layer, its picture, its bone)
//   drag empty space      pan; wheel: zoom
import { S, clip, pose, checkpoint, edited, changed } from './state';
import {
  solve, carry, aimAngle, unwrap, solveIk, chainEnd, Springs, drawOrder,
  type Pose, type Xform, type IkChain,
} from '../src/anim/rig';
import { sample } from '../src/anim/clip';

const cv = document.getElementById('stage') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const hint = document.getElementById('stage-hint')!;
const view = { zoom: 1, panX: 0, panY: 0, fitted: '' };
let springs: Springs | null = null;
let extra: Record<string, number> = {};

interface Handle { bone: string; kind: 'turn' | 'move'; x: number; y: number; colour: string }
let handles: Handle[] = [];
let hover: { bone?: string; part?: string; kind?: Handle['kind'] } = {};
let drag: null | {
  h: Handle; startMouse: [number, number]; startOff: [number, number];
  pins: { chain: IkChain; at: [number, number] }[];
} = null;
let panning: null | { x: number; y: number; px: number; py: number } = null;

export const COLOURS = { turn: '#2563eb', ik: '#059669', item: '#d97706', spring: '#94a3b8', move: '#7c3aed' };

// ---------- view ----------
function fit() {
  const r = cv.getBoundingClientRect();
  view.zoom = (r.height * 0.7) / S.asset!.rig.height;
  view.panX = r.width / 2;
  view.panY = r.height * 0.87;
  view.fitted = S.asset!.id;
}
export function resetView() { view.fitted = ''; render(); }
export function zoomBy(k: number) {
  const r = cv.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, k);
}
function zoomAt(mx: number, my: number, k: number) {
  view.panX = mx - (mx - view.panX) * k;
  view.panY = my - (my - view.panY) * k;
  view.zoom *= k;
  render();
}
const toScreen = (p: [number, number]): [number, number] => [view.panX + p[0] * view.zoom, view.panY + p[1] * view.zoom];
const toRig = (sx: number, sy: number): [number, number] => [(sx - view.panX) / view.zoom, (sy - view.panY) / view.zoom];

// ---------- drawing ----------
const boneOf = (part: string) => S.asset!.rig.parts.find(q => q.name === part)!.bone;
const frameOf = (p: Pose, part: string) => S.asset!.frames[p.swap?.[part] ?? part] ?? S.asset!.frames[part];

/** Draw a pose with `g` in screen space (zoom z, origin at the root). */
function drawRig(g: CanvasRenderingContext2D, p: Pose, w: Record<string, Xform>, alpha: number, z: number, ox: number, oy: number) {
  const a = S.asset!;
  g.globalAlpha = alpha;
  for (const name of drawOrder(a.rig, p)) {
    const f = frameOf(p, name), t = w[boneOf(name)];
    g.save();
    g.translate(ox + t.x * z, oy + t.y * z);
    g.rotate(t.r);
    g.scale(z, z);
    g.drawImage(a.img, f.x, f.y, f.w, f.h, -f.px * f.w, -f.py * f.h, f.w, f.h);
    g.restore();
  }
  g.globalAlpha = 1;
}

/** The selected (or hovered) part: a dashed box around it. */
function outlinePart(p: Pose, w: Record<string, Xform>, part: string, colour: string, dash: number[]) {
  const f = frameOf(p, part), t = w[boneOf(part)];
  const [sx, sy] = toScreen([t.x, t.y]);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t.r);
  ctx.setLineDash(dash);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-f.px * f.w * view.zoom - 2, -f.py * f.h * view.zoom - 2, f.w * view.zoom + 4, f.h * view.zoom + 4);
  ctx.restore();
}

/** A key's pose, small, for the timeline. */
export function drawThumb(c: HTMLCanvasElement, p: Pose) {
  if (!S.asset) return;
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth || 62, H = c.clientHeight || 78;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const z = (H * 0.84) / S.asset.rig.height;
  drawRig(g, p, solve(S.asset.rig, p), 1, z, W / 2, H * 0.94);
}

/** Where a bone's handle is drawn, in rig space. */
function tipOf(w: Record<string, Xform>, bone: string): [number, number] {
  const b = S.asset!.rig.bones[bone];
  return carry(S.asset!.rig, w, bone, b.tip ?? b.at);
}

function buildHandles(w: Record<string, Xform>) {
  const rig = S.asset!.rig;
  const effectors = new Set((rig.ik ?? []).map(c => c.lower));
  handles = [];
  for (const [n, b] of Object.entries(rig.bones)) {
    if (!b.parent) continue;
    if (b.kind === 'move') handles.push({ bone: n, kind: 'move', ...xy(toScreen([w[n].x, w[n].y])), colour: COLOURS.move });
    if (!b.tip) continue;
    const colour = b.kind === 'item' ? COLOURS.item : b.kind === 'spring' ? COLOURS.spring : effectors.has(n) && S.ik ? COLOURS.ik : COLOURS.turn;
    handles.push({ bone: n, kind: 'turn', ...xy(toScreen(tipOf(w, n))), colour });
  }
  window.__studioHandles = handles;   // test hook: where each handle is on the stage
}
declare global { interface Window { __studioHandles: Handle[] } }
const xy = (p: [number, number]) => ({ x: p[0], y: p[1] });

function drawHandles(w: Record<string, Xform>) {
  for (const h of handles) {
    const sel = h.bone === S.sel, hov = h.bone === hover.bone && h.kind === hover.kind;
    if (h.kind === 'turn') {
      const [jx, jy] = toScreen([w[h.bone].x, w[h.bone].y]);
      ctx.strokeStyle = sel ? 'rgba(194,87,12,.9)' : 'rgba(30,41,59,.3)';
      ctx.lineWidth = sel ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(h.x, h.y); ctx.stroke();
      ctx.fillStyle = sel ? 'rgba(194,87,12,.9)' : 'rgba(30,41,59,.35)';
      ctx.beginPath(); ctx.arc(jx, jy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    const r = hov || sel ? 8.5 : 7;
    ctx.fillStyle = h.colour;
    ctx.strokeStyle = sel ? '#c2570c' : '#fff';
    ctx.lineWidth = sel ? 3 : 2;
    ctx.beginPath();
    if (h.kind === 'move') ctx.rect(h.x - r, h.y - r, r * 2, r * 2);
    else ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
}

function drawLabel(text: string, x: number, y: number) {
  ctx.font = '12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(47,36,25,.88)';
  ctx.beginPath(); ctx.roundRect(x + 12, y - 24, w, 20, 5); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x + 18, y - 10);
}

export function render() {
  if (!S.asset || !S.file) return;
  const dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) {
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  }
  if (view.fitted !== S.asset.id) fit();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  // the ground, through the rest root (the feet)
  const [, gy] = toScreen([0, 0]);
  ctx.fillStyle = '#e7eedb'; ctx.fillRect(0, gy, r.width, r.height - gy);
  ctx.fillStyle = '#a8c98c'; ctx.fillRect(0, gy - 1, r.width, 2);
  ctx.fillStyle = 'rgba(80,60,30,.12)';
  ctx.beginPath(); ctx.ellipse(view.panX, gy + 2, 70 * view.zoom, 7 * view.zoom, 0, 0, Math.PI * 2); ctx.fill();

  const rig = S.asset.rig;
  const c = clip();
  if (S.playing) {
    const p = sample(c, S.t);
    drawRig(ctx, p, solve(rig, p, S.springs ? extra : undefined), 1, view.zoom, view.panX, view.panY);
    return;
  }
  if (S.onion && c.keys.length > 1) {
    const n = c.keys.length;
    const prev = S.key > 0 ? S.key - 1 : c.loop ? n - 1 : -1;
    const next = S.key < n - 1 ? S.key + 1 : c.loop ? 0 : -1;
    for (const i of new Set([prev, next])) {
      if (i >= 0 && i !== S.key) drawRig(ctx, c.keys[i].pose, solve(rig, c.keys[i].pose), 0.17, view.zoom, view.panX, view.panY);
    }
  }
  const p = pose();
  const w = solve(rig, p);
  drawRig(ctx, p, w, 1, view.zoom, view.panX, view.panY);
  if (hover.part && hover.part !== S.part && !drag) outlinePart(p, w, hover.part, 'rgba(37,99,235,.55)', [3, 3]);
  if (S.part) outlinePart(p, w, S.part, 'rgba(194,87,12,.85)', [6, 4]);
  buildHandles(w);
  if (S.handles) drawHandles(w);
  if (!drag && (hover.bone || hover.part)) {
    const h = handles.find(x => x.bone === hover.bone && x.kind === hover.kind);
    const label = hover.bone && h ? hover.bone : hover.part!;
    drawLabel(label, h?.x ?? lastMouse[0], h?.y ?? lastMouse[1]);
  }
}

// ---------- playback ----------
let last = 0;
function frame(now: number) {
  const dt = last ? Math.min(50, now - last) : 0;
  last = now;
  if (S.playing && S.asset) {
    S.t += dt * S.speed;
    if (S.springs) {
      springs ??= new Springs(S.asset.rig);
      extra = springs.step(solve(S.asset.rig, sample(clip(), S.t)), dt / 1000);
    }
    render();
    onTick?.();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
let onTick: (() => void) | null = null;
export const setOnTick = (f: () => void) => { onTick = f; };
export function play(on: boolean) {
  S.playing = on;
  springs = S.asset ? new Springs(S.asset.rig) : null;
  extra = {};
  changed();
}

// ---------- picking ----------
let alphaOf: { img: HTMLImageElement; data: Uint8ClampedArray; w: number } | null = null;
function alphaAt(x: number, y: number): number {
  const img = S.asset!.img;
  if (alphaOf?.img !== img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    alphaOf = { img, data: g.getImageData(0, 0, c.width, c.height).data, w: c.width };
  }
  return alphaOf.data[(Math.floor(y) * alphaOf.w + Math.floor(x)) * 4 + 3];
}

/** The front-most part under a screen point. */
function pickPart(sx: number, sy: number): string | null {
  const rig = S.asset!.rig, p = pose(), w = solve(rig, p);
  const [mx, my] = toRig(sx, sy);
  for (const name of [...drawOrder(rig, p)].reverse()) {
    const f = frameOf(p, name), t = w[boneOf(name)];
    const c = Math.cos(-t.r), s = Math.sin(-t.r);
    const dx = mx - t.x, dy = my - t.y;
    const u = dx * c - dy * s + f.px * f.w, v = dx * s + dy * c + f.py * f.h;
    if (u >= 0 && v >= 0 && u < f.w && v < f.h && alphaAt(f.x + u, f.y + v) > 60) return name;
  }
  return null;
}

function pickHandle(x: number, y: number): Handle | null {
  if (!S.handles) return null;
  let best: Handle | null = null, bd = 13;
  for (const h of [...handles].reverse()) {     // items and IK ends win ties: they sit on top
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

/** Select a bone (and the front-most part it carries). */
export function selectBone(bone: string | null) {
  S.sel = bone;
  if (bone && S.asset) {
    const order = drawOrder(S.asset.rig, pose());
    S.part = [...order].reverse().find(n => boneOf(n) === bone) ?? null;
  } else S.part = null;
}
export function selectPart(part: string | null) {
  S.part = part;
  S.sel = part ? boneOf(part) : null;
}

// ---------- posing ----------
function isAncestor(a: string, b: string): boolean {
  const bones = S.asset!.rig.bones;
  for (let p = bones[b]?.parent; p; p = bones[p].parent) if (p === a) return true;
  return false;
}

function mouse(e: PointerEvent | MouseEvent): [number, number] {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
let lastMouse: [number, number] = [0, 0];

const HINTS = {
  idle: 'Drag a handle to pose · click a part to select it · drag empty space to pan · wheel to zoom',
  turn: 'Drag to turn this bone',
  ik: 'Drag to move the whole limb (IK)',
  move: 'Drag to move this joint',
  part: 'Click to select this part',
  playing: 'Playing: press Space or click a key to stop and edit',
};
function setHint(h: keyof typeof HINTS) { if (hint.dataset.h !== h) { hint.dataset.h = h; hint.textContent = HINTS[h]; } }
export function refreshHint() { setHint(S.playing ? 'playing' : 'idle'); }

cv.addEventListener('pointerdown', e => {
  if (!S.asset || S.playing) return;
  const [mx, my] = mouse(e);
  cv.setPointerCapture(e.pointerId);
  const h = e.button === 0 ? pickHandle(mx, my) : null;
  if (!h) {
    if (e.button === 0) { const part = pickPart(mx, my); if (part !== S.part) { selectPart(part); changed(); } }
    panning = { x: mx, y: my, px: view.panX, py: view.panY };
    return;
  }
  checkpoint();
  selectBone(h.bone);
  const rig = S.asset.rig, p = pose(), w = solve(rig, p);
  // feet pinned to the ground while the body moves above them
  const pins = S.pin ? (rig.ik ?? [])
    .filter(c => c.pin && c.upper !== h.bone && c.lower !== h.bone && isAncestor(h.bone, c.upper))
    .map(c => ({ chain: c, at: chainEnd(rig, w, c) })) : [];
  drag = { h, startMouse: toRig(mx, my), startOff: p.x?.[h.bone] ?? [0, 0], pins };
  cv.style.cursor = 'grabbing';
  changed();
});

cv.addEventListener('pointermove', e => {
  const [mx, my] = mouse(e);
  lastMouse = [mx, my];
  if (panning) {
    view.panX = panning.px + mx - panning.x; view.panY = panning.py + my - panning.y;
    cv.style.cursor = 'move';
    render();
    return;
  }
  if (!S.asset || S.playing) return;
  if (!drag) {
    const h = pickHandle(mx, my);
    const part = h ? undefined : pickPart(mx, my) ?? undefined;
    const next = h ? { bone: h.bone, kind: h.kind } : { part };
    if (JSON.stringify(next) !== JSON.stringify(hover)) { hover = next; render(); }
    cv.style.cursor = h ? 'grab' : part ? 'pointer' : 'default';
    setHint(h ? (h.kind === 'move' ? 'move' : S.ik && S.asset.rig.ik?.some(c => c.lower === h.bone) ? 'ik' : 'turn') : part ? 'part' : 'idle');
    return;
  }
  const rig = S.asset.rig, p = pose(), m = toRig(mx, my);
  const b = drag.h.bone;
  if (drag.h.kind === 'move') {
    const par = rig.bones[b].parent!;
    const pr = solve(rig, p)[par].r;
    const dx = m[0] - drag.startMouse[0], dy = m[1] - drag.startMouse[1];
    const c = Math.cos(-pr), s = Math.sin(-pr);
    (p.x ??= {})[b] = [round(drag.startOff[0] + dx * c - dy * s), round(drag.startOff[1] + dx * s + dy * c)];
  } else {
    const chain = S.ik ? rig.ik?.find(c => c.lower === b) : undefined;
    if (chain) solveIk(rig, p, chain, m);
    else p.a[b] = unwrap(aimAngle(rig, solve(rig, p), b, m), p.a[b] ?? 0);
  }
  for (const pin of drag.pins) solveIk(rig, p, pin.chain, pin.at);
  for (const k of Object.keys(p.a)) p.a[k] = round(p.a[k]);
  changed();
});

const round = (v: number) => Math.round(v * 10) / 10;

function endDrag() {
  if (drag) { drag = null; edited(); }
  panning = null;
  cv.style.cursor = 'default';
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { if (!drag && (hover.bone || hover.part)) { hover = {}; render(); } });

cv.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

new ResizeObserver(() => render()).observe(cv);
