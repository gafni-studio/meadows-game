// The stage: draws the rig and lets you pose it.
//   drag a round handle   turn that bone (IK on: a hand / foot handle moves the whole limb)
//   drag a square handle  move that joint (hips); pinned feet stay put
//   drag empty space      pan; wheel: zoom
import { S, clip, pose, checkpoint, edited, changed } from './state';
import {
  solve, carry, aimAngle, unwrap, solveIk, chainEnd, Springs,
  type Pose, type Xform, type IkChain,
} from '../src/anim/rig';
import { sample } from '../src/anim/clip';

const cv = document.getElementById('stage') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const view = { zoom: 1, panX: 0, panY: 0, fitted: '' };
let springs: Springs | null = null;
let extra: Record<string, number> = {};

interface Handle { bone: string; kind: 'turn' | 'move'; x: number; y: number; colour: string }
let handles: Handle[] = [];
let drag: null | {
  h: Handle; startMouse: [number, number]; startOff: [number, number];
  pins: { chain: IkChain; at: [number, number] }[];
} = null;
let panning: null | { x: number; y: number; px: number; py: number } = null;

// ---------- view ----------
function fit() {
  const r = cv.getBoundingClientRect();
  const h = S.asset!.rig.height;
  view.zoom = (r.height * 0.72) / h;
  view.panX = r.width / 2;
  view.panY = r.height * 0.86;
  view.fitted = S.asset!.id;
}
export function resetView() { view.fitted = ''; changed(); }
const toScreen = (p: [number, number]): [number, number] => [view.panX + p[0] * view.zoom, view.panY + p[1] * view.zoom];
const toRig = (sx: number, sy: number): [number, number] => [(sx - view.panX) / view.zoom, (sy - view.panY) / view.zoom];

// ---------- drawing ----------
function drawOrder(p: Pose): string[] {
  const rig = S.asset!.rig;
  const names = rig.parts.map(q => q.name);
  for (const [item, l] of Object.entries(p.layer ?? {})) {
    const spec = rig.layers?.[item];
    if (!spec || l === 'mid') continue;
    names.splice(names.indexOf(item), 1);
    if (l === 'back') names.splice(names.indexOf(spec.back), 0, item);
    else names.splice(names.indexOf(spec.front) + 1, 0, item);
  }
  return names;
}

function drawRig(p: Pose, w: Record<string, Xform>, alpha: number) {
  const a = S.asset!;
  const boneOf = Object.fromEntries(a.rig.parts.map(q => [q.name, q.bone]));
  ctx.globalAlpha = alpha;
  for (const name of drawOrder(p)) {
    const f = a.frames[name], t = w[boneOf[name]];
    const [sx, sy] = toScreen([t.x, t.y]);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t.r);
    ctx.scale(view.zoom, view.zoom);
    ctx.drawImage(a.img, f.x, f.y, f.w, f.h, -f.px * f.w, -f.py * f.h, f.w, f.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
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
    if (b.kind === 'move') handles.push({ bone: n, kind: 'move', ...xy(toScreen([w[n].x, w[n].y])), colour: '#8b5cf6' });
    if (!b.tip) continue;
    const colour = b.kind === 'item' ? '#f59e0b' : b.kind === 'spring' ? '#94a3b8' : effectors.has(n) && S.ik ? '#10b981' : '#3b82f6';
    handles.push({ bone: n, kind: 'turn', ...xy(toScreen(tipOf(w, n))), colour });
  }
  window.__studioHandles = handles;   // test hook: where each handle is on the stage
}
declare global { interface Window { __studioHandles: Handle[] } }
const xy = (p: [number, number]) => ({ x: p[0], y: p[1] });

function drawHandles(w: Record<string, Xform>) {
  for (const h of handles) {
    const sel = h.bone === S.sel;
    if (h.kind === 'turn') {
      const [jx, jy] = toScreen([w[h.bone].x, w[h.bone].y]);
      ctx.strokeStyle = sel ? 'rgba(220,38,38,0.8)' : 'rgba(30,41,59,0.35)';
      ctx.lineWidth = sel ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(h.x, h.y); ctx.stroke();
    }
    ctx.fillStyle = h.colour;
    ctx.strokeStyle = sel ? '#dc2626' : '#fff';
    ctx.lineWidth = sel ? 3 : 2;
    ctx.beginPath();
    if (h.kind === 'move') ctx.rect(h.x - 7, h.y - 7, 14, 14);
    else ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
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
  // ground line through the rest root (the feet)
  const [, gy] = toScreen([0, 0]);
  ctx.fillStyle = '#e4ecd9'; ctx.fillRect(0, gy, r.width, r.height - gy);
  ctx.fillStyle = '#9cc27f'; ctx.fillRect(0, gy - 1, r.width, 2);

  const rig = S.asset.rig;
  const c = clip();
  if (S.playing) {
    const p = sample(c, S.t);
    drawRig(p, solve(rig, p, S.springs ? extra : undefined), 1);
    return;
  }
  if (S.onion && c.keys.length > 1) {
    const n = c.keys.length;
    const prev = S.key > 0 ? S.key - 1 : c.loop ? n - 1 : -1;
    const next = S.key < n - 1 ? S.key + 1 : c.loop ? 0 : -1;
    for (const i of new Set([prev, next])) if (i >= 0 && i !== S.key) drawRig(c.keys[i].pose, solve(rig, c.keys[i].pose), 0.18);
  }
  const p = pose();
  const w = solve(rig, p);
  drawRig(p, w, 1);
  buildHandles(w);
  if (S.handles) drawHandles(w);
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
  S.t = on ? (S.t || 0) : S.t;
  springs = S.asset ? new Springs(S.asset.rig) : null;
  extra = {};
  changed();
}

// ---------- posing ----------
function isAncestor(a: string, b: string): boolean {
  const bones = S.asset!.rig.bones;
  for (let p = bones[b]?.parent; p; p = bones[p].parent) if (p === a) return true;
  return false;
}

function pickHandle(x: number, y: number): Handle | null {
  let best: Handle | null = null, bd = 13;
  // items and IK ends win ties: they sit on top of other joints
  for (const h of [...handles].reverse()) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

function mouse(e: PointerEvent): [number, number] {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

cv.addEventListener('pointerdown', e => {
  if (!S.asset || S.playing) return;
  const [mx, my] = mouse(e);
  const h = e.button === 0 && S.handles ? pickHandle(mx, my) : null;
  cv.setPointerCapture(e.pointerId);
  if (!h) { panning = { x: mx, y: my, px: view.panX, py: view.panY }; return; }
  checkpoint();
  S.sel = h.bone;
  const rig = S.asset.rig, p = pose(), w = solve(rig, p);
  // feet pinned to the ground while the body moves above them
  const pins = S.pin ? (rig.ik ?? [])
    .filter(c => c.pin && c.upper !== h.bone && c.lower !== h.bone && (isAncestor(h.bone, c.upper)))
    .map(c => ({ chain: c, at: chainEnd(rig, w, c) })) : [];
  drag = { h, startMouse: toRig(mx, my), startOff: p.x?.[h.bone] ?? [0, 0], pins };
  changed();
});

cv.addEventListener('pointermove', e => {
  const [mx, my] = mouse(e);
  if (panning) {
    view.panX = panning.px + mx - panning.x; view.panY = panning.py + my - panning.y;
    render();
    return;
  }
  if (!drag || !S.asset) {
    cv.style.cursor = S.handles && pickHandle(mx, my) ? 'grab' : 'default';
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
  render();
  changed();
});

const round = (v: number) => Math.round(v * 10) / 10;

function endDrag() {
  if (drag) { drag = null; edited(); }
  panning = null;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [mx, my] = [e.offsetX, e.offsetY];
  const k = Math.exp(-e.deltaY * 0.0015);
  view.panX = mx - (mx - view.panX) * k;
  view.panY = my - (my - view.panY) * k;
  view.zoom *= k;
  render();
}, { passive: false });

new ResizeObserver(() => render()).observe(cv);
