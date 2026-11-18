// Load and save animations/<asset>.json through the GitHub contents API.
// The token (fine-grained, this repo only, Contents: read and write) is kept
// in this browser's localStorage and only ever sent to api.github.com.
import type { AnimFile } from '../src/anim/clip';

export interface GhSettings { token: string; repo: string; branch: string }
const KEY = 'meadows-studio:github';
const DEFAULTS: GhSettings = { token: '', repo: 'gafni-studio/meadows-game', branch: 'main' };

export function settings(): GhSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s: GhSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage off */ }
}

const pathOf = (asset: string) => `animations/${asset}.json`;
const api = (s: GhSettings, asset: string) => `https://api.github.com/repos/${s.repo}/contents/${pathOf(asset)}`;
const headers = (s: GhSettings) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${s.token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

const toB64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

async function failure(r: Response, what: string): Promise<Error> {
  let msg = '';
  try { msg = (await r.json()).message ?? ''; } catch { /* no body */ }
  if (r.status === 401) return new Error(`${what}: the token was refused (401). Check it in Settings.`);
  if (r.status === 403 || r.status === 404) return new Error(`${what}: no access (${r.status}). The token needs this repo with Contents: read and write. ${msg}`);
  return new Error(`${what}: GitHub said ${r.status} ${msg}`);
}

/** The file on GitHub, or null if it doesn't exist yet. */
export async function load(asset: string): Promise<{ file: AnimFile; sha: string } | null> {
  const s = settings();
  const r = await fetch(`${api(s, asset)}?ref=${encodeURIComponent(s.branch)}`, { headers: headers(s), cache: 'no-store' });
  if (r.status === 404) {
    // 404 is also what a token without access gets: check the repo itself
    const repo = await fetch(`https://api.github.com/repos/${s.repo}`, { headers: headers(s) });
    if (!repo.ok) throw await failure(repo, 'Load');
    return null;
  }
  if (!r.ok) throw await failure(r, 'Load');
  const j = await r.json();
  return { file: JSON.parse(fromB64(j.content)) as AnimFile, sha: j.sha };
}

/** Commit the file. Returns the commit's short sha. */
export async function save(asset: string, file: AnimFile, message: string): Promise<string> {
  const s = settings();
  const body = JSON.stringify(file, null, 1) + '\n';
  const put = async (sha?: string) => fetch(api(s, asset), {
    method: 'PUT',
    headers: { ...headers(s), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: toB64(body), branch: s.branch, ...(sha ? { sha } : {}) }),
  });
  // always write over the latest version: this studio is the file's only author
  const cur = await load(asset);
  let r = await put(cur?.sha);
  if (r.status === 409 || r.status === 422) r = await put((await load(asset))?.sha);
  if (!r.ok) throw await failure(r, 'Save');
  const j = await r.json();
  return String(j.commit?.sha ?? '').slice(0, 7);
}

export function download(asset: string, file: AnimFile) {
  const blob = new Blob([JSON.stringify(file, null, 1) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${asset}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
