#!/usr/bin/env node
/**
 * data/*.json is the source of truth. This writes it out as sheet/Game_Design_DB_v0.xlsx for sharing
 * (one tab per file; a NOTE row first when the file has a note). Derived fields (num, spawns, links) are
 * left out; list cells (dialogue lines) are joined with newlines. Formatting in the old xlsx is not kept.
 *   npm run sheet:export
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'sheet', 'Game_Design_DB_v0.xlsx');
const DERIVED = new Set(['num', 'spawns', 'links']);
const wb = XLSX.utils.book_new();
const files = fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
for (const f of files) {
  const t = JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
  const cols = (t.columns ?? Object.keys(t.rows[0] ?? {})).filter((c) => !DERIVED.has(c));
  const grid = [];
  if (t.note) grid.push([t.note]);
  grid.push(cols);
  for (const r of t.rows) grid.push(cols.map((c) => (Array.isArray(r[c]) ? r[c].join('\n') : r[c] ?? null)));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), (t.tab ?? f.replace('.json', '')).slice(0, 31));
}
XLSX.writeFile(wb, out);
console.log(`Wrote ${files.length} tabs to ${path.relative(root, out)}`);
