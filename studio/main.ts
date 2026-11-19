// Meadows Animation Studio: pose a rigged asset key by key, time and blend the
// keys, preview the clip, and save every clip to animations/<asset>.json.
// The rigs (rigs/<asset>/) are cut and built in code; poses are made here.
import './style.css';
import { S, onChange, changed, clip, edit, normalise, readDraft, clearDraft, clearHistory, doUndo, doRedo, saveView, type Asset, type Frame } from './state';
import { render, play, setOnTick, resetView, zoomBy, refreshHint, selectBone } from './stage';
import { renderSide, copyPose, pastePose, moveLayer } from './inspector';
import { renderTimeline, updatePlayhead, selectKey, addKey, deleteKey } from './timeline';
import { openHelp, closeHelp, helpOpen } from './help';
import * as gh from './github';
import type { RigDef } from '../src/anim/rig';
import type { AnimFile } from '../src/anim/clip';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const assetSel = $<HTMLSelectElement>('asset');
const clipSel = $<HTMLSelectElement>('clip');
const toast = $('toast');
const banner = $('banner');

type IndexEntry = { id: string; name: string; clips: string[] };
let index: IndexEntry[] = [];

let toastTimer = 0;
/** A message in the corner of the stage; errors stay until clicked. */
function say(msg: string, kind: '' | 'ok' | 'err' = '') {
  toast.textContent = msg;
  toast.className = `show ${kind}`;
  clearTimeout(toastTimer);
  if (kind !== 'err') toastTimer = window.setTimeout(() => { toast.className = kind; }, msg.length > 70 ? 7000 : 4000);
}
toast.onclick = () => { toast.className = ''; };

// ---------- loading ----------
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

async function loadAsset(id: string) {
  if (S.playing) play(false);
  const entry = index.find(e => e.id === id)!;
  const rig = await getJson<RigDef>(`rigs/${id}/rig.json`);
  const atlas = await getJson<{ frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; pivot: { x: number; y: number } }> }>(`rigs/${id}/${rig.frames}`);
  const img = new Image();
  img.src = `rigs/${id}/${rig.atlas}`;
  await img.decode();
  const frames: Record<string, Frame> = {};
  for (const [n, f] of Object.entries(atlas.frames)) frames[n] = { ...f.frame, px: f.pivot.x, py: f.pivot.y };
  const asset: Asset = { id, name: entry.name, clips: entry.clips, rig, img, frames };
  S.asset = asset;
  S.sel = null;
  S.part = null;
  S.key = 0;
  S.t = 0;

  let file: AnimFile | null = null;
  let answered = false;          // GitHub said what is there (even "nothing yet")
  S.source = 'new';
  const st = gh.settings();
  if (st.token) {
    try {
      const got = await gh.load(id);
      answered = true;
      file = got?.file ?? null;
      if (got) S.source = 'github';
      say(got ? `Loaded ${id}.json from GitHub (${st.branch})` : `No ${id}.json on GitHub yet: starting fresh`, 'ok');
    } catch (e) {
      say(`${(e as Error).message} Showing the copy published with this site.`, 'err');
    }
  }
  if (!answered) {
    try {
      file = await getJson<AnimFile>(`animations/${id}.json`);
      S.source = 'site';
      if (!st.token) say(`Loaded ${id}.json as published with this site. Add a GitHub token in Settings to load the latest and to save.`);
    } catch { /* none published: start fresh */ }
  }
  S.file = normalise(file, asset);
  S.clip = asset.clips[0] in S.file.clips ? asset.clips[0] : Object.keys(S.file.clips)[0];
  S.dirty = false;
  clearHistory();

  const draft = readDraft();
  if (draft && JSON.stringify(draft) !== JSON.stringify(S.file)) showDraftBanner(draft);
  else banner.hidden = true;
  changed();
}

function showDraftBanner(draft: AnimFile) {
  banner.hidden = false;
  banner.innerHTML = `This browser has unsaved changes to <b>${S.asset!.name}</b> from an earlier session.
    <button id="draft-restore" class="primary">Restore them</button> <button id="draft-drop">Discard</button>`;
  $('draft-restore').onclick = () => {
    S.file = normalise(draft, S.asset!);
    if (!(S.clip in S.file.clips)) S.clip = Object.keys(S.file.clips)[0];
    S.key = 0; S.dirty = true; banner.hidden = true;
    changed();
  };
  $('draft-drop').onclick = () => { clearDraft(); banner.hidden = true; };
}

// ---------- top bar ----------
function renderTop() {
  if (!S.file) return;
  assetSel.innerHTML = index.map(e => `<option value="${e.id}" ${e.id === S.asset?.id ? 'selected' : ''}>${e.name}</option>`).join('');
  clipSel.innerHTML = Object.keys(S.file.clips).map(c => `<option ${c === S.clip ? 'selected' : ''}>${c}</option>`).join('');
  $('dirty').hidden = !S.dirty;
  for (const k of ['ik', 'pin', 'onion', 'handles', 'springs'] as const) $(`t-${k}`).classList.toggle('on', S[k]);
  // tools this rig has nothing for (an NPC has no pinned feet and no springs)
  const rig = S.asset!.rig;
  $<HTMLButtonElement>('t-pin').disabled = !rig.ik?.some(c => c.pin);
  $<HTMLButtonElement>('t-springs').disabled = !Object.keys(rig.springs ?? {}).length;
  $<HTMLButtonElement>('t-ik').disabled = !rig.ik?.length;
  refreshHint();
}

// ---------- stage toolbar ----------
for (const k of ['ik', 'pin', 'onion', 'handles', 'springs'] as const) {
  $(`t-${k}`).onclick = () => { S[k] = !S[k]; saveView(); changed(); };
}
$('v-fit').onclick = () => resetView();
$('v-zoom-in').onclick = () => zoomBy(1.2);
$('v-zoom-out').onclick = () => zoomBy(1 / 1.2);
$('undo').onclick = () => doUndo();
$('redo').onclick = () => doRedo();

// clip menu (⋯)
const menu = $('clip-menu-list');
$('clip-menu').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
document.addEventListener('click', () => { menu.hidden = true; });

assetSel.onchange = async () => {
  if (S.dirty && !confirm('Switch asset? Unsaved changes stay in this browser as a draft.')) { renderTop(); return; }
  await loadAsset(assetSel.value);
};
clipSel.onchange = () => { if (S.playing) play(false); S.clip = clipSel.value; S.key = 0; S.t = 0; changed(); };

const clipName = (q: string, def = '') => {
  const n = prompt(q, def)?.trim().replace(/\s+/g, '_');
  if (!n) return null;
  if (n in S.file!.clips && n !== def) { alert(`There is already a clip called ${n}.`); return null; }
  return n;
};
$('clip-new').onclick = () => {
  const n = clipName('Name of the new clip (e.g. jump):');
  if (!n) return;
  edit(() => { S.file!.clips[n] = { loop: true, keys: [{ ms: 400, ease: 'smooth', pose: { a: {} } }] }; S.clip = n; S.key = 0; });
};
$('clip-dup').onclick = () => {
  const n = clipName('Name of the copy:', `${S.clip}_copy`);
  if (!n) return;
  edit(() => { S.file!.clips[n] = JSON.parse(JSON.stringify(clip())); S.clip = n; S.key = 0; });
};
$('clip-ren').onclick = () => {
  const n = clipName('New name:', S.clip);
  if (!n || n === S.clip) return;
  edit(() => {
    const entries = Object.entries(S.file!.clips).map(([k, v]) => [k === S.clip ? n : k, v]);
    S.file!.clips = Object.fromEntries(entries);
    S.clip = n;
  });
};
$('clip-del').onclick = () => {
  if (Object.keys(S.file!.clips).length < 2) return alert('A file needs at least one clip.');
  if (!confirm(`Delete the clip "${S.clip}"? (Undo with Ctrl+Z.)`)) return;
  edit(() => { delete S.file!.clips[S.clip]; S.clip = Object.keys(S.file!.clips)[0]; S.key = 0; });
};

// ---------- save / download / open ----------
$('save').onclick = async () => {
  const st = gh.settings();
  if (!st.token) { openSettings('Paste a GitHub token to save straight to the repo. Or use Download.'); return; }
  const btn = $<HTMLButtonElement>('save');
  btn.disabled = true;
  say('Saving to GitHub…');
  try {
    const sha = await gh.save(S.asset!.id, S.file!, `Animation Studio: ${S.asset!.id} (${Object.keys(S.file!.clips).join(', ')})`);
    S.dirty = false;
    clearDraft();
    say(`Saved animations/${S.asset!.id}.json to ${st.branch} (commit ${sha})`, 'ok');
    changed();
  } catch (e) {
    say(`${(e as Error).message} Your work is kept in this browser; Download also works.`, 'err');
  } finally { btn.disabled = false; }
};
$('download').onclick = () => gh.download(S.asset!.id, S.file!);
$('open').onclick = () => $<HTMLInputElement>('open-file').click();
$<HTMLInputElement>('open-file').onchange = async e => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const file = JSON.parse(await f.text()) as AnimFile;
    if (file.asset && file.asset !== S.asset!.id) throw new Error(`That file is for "${file.asset}", not "${S.asset!.id}".`);
    edit(() => { S.file = normalise(file, S.asset!); S.clip = Object.keys(S.file.clips)[0]; S.key = 0; });
    say(`Opened ${f.name} (not saved to GitHub yet)`);
  } catch (err) { say(`Could not open ${f.name}: ${(err as Error).message}`, 'err'); }
  (e.target as HTMLInputElement).value = '';
};

// ---------- settings ----------
const dlg = $<HTMLDialogElement>('settings');
function openSettings(note = '') {
  const st = gh.settings();
  $<HTMLInputElement>('s-token').value = st.token;
  $<HTMLInputElement>('s-repo').value = st.repo;
  $<HTMLInputElement>('s-branch').value = st.branch;
  $('s-note').textContent = note;
  dlg.showModal();
}
$('settings-btn').onclick = () => openSettings();
$('s-cancel').onclick = () => dlg.close();
$('s-forget').onclick = () => { $<HTMLInputElement>('s-token').value = ''; };
$('s-ok').onclick = async () => {
  gh.saveSettings({
    token: $<HTMLInputElement>('s-token').value.trim(),
    repo: $<HTMLInputElement>('s-repo').value.trim() || 'gafni-studio/meadows-game',
    branch: $<HTMLInputElement>('s-branch').value.trim() || 'main',
  });
  dlg.close();
  if (gh.settings().token && S.asset) {
    try {
      const got = await gh.load(S.asset.id);
      say(got ? `Connected: animations/${S.asset.id}.json is on GitHub.${S.dirty ? ' Your unsaved changes are kept.' : ''}` : 'Connected. The file will be created on first save.', 'ok');
      if (got && !S.dirty) { S.file = normalise(got.file, S.asset); S.source = 'github'; changed(); }
    } catch (e) { say((e as Error).message, 'err'); }
  }
};

// ---------- keys ----------
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).closest('input, select, textarea, dialog') || !S.file) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
  else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); $('save').click(); }
  else if (mod && e.key.toLowerCase() === 'c') copyPose();
  else if (mod && e.key.toLowerCase() === 'v') pastePose();
  else if (e.key === ' ') { e.preventDefault(); play(!S.playing); }
  else if (e.key === 'ArrowLeft') selectKey(S.key - 1);
  else if (e.key === 'ArrowRight') selectKey(S.key + 1);
  else if (e.key === 'Insert') addKey();
  else if (e.key === 'Delete') deleteKey();
  else if (e.key === '[') moveLayer(S.part, -1);
  else if (e.key === ']') moveLayer(S.part, 1);
  else if (e.key.toLowerCase() === 'f' && !mod) resetView();
  else if (e.key.toLowerCase() === 'h' && !mod) { S.handles = !S.handles; saveView(); changed(); }
  else if (e.key === '?') helpOpen() ? closeHelp() : openHelp();
  else if (e.key === 'Escape') { if (helpOpen()) closeHelp(); else { selectBone(null); changed(); } }
});
window.addEventListener('beforeunload', e => { if (S.dirty) e.preventDefault(); });

// ---------- wire up ----------
onChange(() => { render(); renderTop(); renderSide(); renderTimeline(); });
setOnTick(updatePlayhead);

(async () => {
  try {
    index = await getJson<IndexEntry[]>('rigs/index.json');
    const want = new URLSearchParams(location.search).get('asset');
    await loadAsset(index.find(e => e.id === want)?.id ?? index[0].id);
  } catch (e) {
    say(`Could not load the rigs: ${(e as Error).message}`, 'err');
  }
})();
declare global { interface Window { __studio: typeof S } }
window.__studio = S;
