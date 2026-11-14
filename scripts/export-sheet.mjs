#!/usr/bin/env node
/**
 * IMPORT an edited xlsx into /data/*.json — this OVERWRITES the JSON, which is the source of truth since v0.2.9.
 * Only use it when someone edited the sheet on purpose (run `npm run sheet:export` first to get a current xlsx).
 * Requires --yes. Usage:
 *   1. In Google Sheets: File → Download → Microsoft Excel (.xlsx)
 *   2. Save it as sheet/Game_Design_DB_v0.xlsx (or pass a path)
 *   3. npm run export-sheet [-- path/to/file.xlsx]
 *
 * Every tab becomes data/<tab>.json:
 *   { "tab": "...", "note": "<first-row NOTE/DRAFT text>", "columns": [...], "rows": [ {...}, ... ] }
 * Numbers and TRUE/FALSE are converted. Key/value tabs (game_rules, combat_formulas)
 * also get a parsed "num" field (first number found in "value").
 * map_layout rows get parsed "spawns" and "links" objects.
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const input = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(root, 'sheet', 'Game_Design_DB_v0.xlsx'));
const outDir = path.join(root, 'data');

if (!fs.existsSync(input)) {
  console.error(`Sheet file not found: ${input}\nDownload the sheet as .xlsx first (see README).`);
  process.exit(1);
}

if (!process.argv.includes('--yes')) {
  console.error('This overwrites data/*.json (the source of truth) from the xlsx. Re-run with: npm run sheet:import -- --yes');
  process.exit(1);
}
const wb = XLSX.read(fs.readFileSync(input));
fs.mkdirSync(outDir, { recursive: true });

const convert = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '') return null;
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
};

const firstNumber = (v) => {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const parseList = (s, sep) => {
  const out = {};
  if (!s || typeof s !== 'string') return out;
  for (const part of s.split(sep)) {
    const m = part.trim().match(/^([a-z_]+)\s*:?\s*(.*)$/);
    if (m && m[1]) out[m[1]] = m[2].trim();
  }
  return out;
};

const summary = [];
for (const name of wb.SheetNames) {
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
  const nonEmpty = grid.filter((r) => r.some((c) => c !== null && String(c).trim() !== ''));
  if (nonEmpty.length === 0) continue;
  let note = null;
  let idx = 0;
  const filled = (r) => r.filter((c) => c !== null && String(c).trim() !== '').length;
  if (filled(nonEmpty[0]) === 1 && /^(NOTE|DRAFT)/i.test(String(nonEmpty[0][0]))) {
    note = String(nonEmpty[0][0]);
    idx = 1;
  }
  const header = nonEmpty[idx].map((h) => (h === null ? null : String(h).trim()));
  const columns = header.filter(Boolean);
  const rows = [];
  for (const r of nonEmpty.slice(idx + 1)) {
    const obj = {};
    header.forEach((h, i) => { if (h) obj[h] = convert(r[i]); });
    if (Object.values(obj).every((v) => v === null)) continue;
    if (columns.includes('key') && columns.includes('value')) obj.num = firstNumber(obj.value);
    if (name === 'map_layout') {
      // "field_mouse 8, wool_sheep 5" → { field_mouse: 8, wool_sheep: 5 }
      const spawns = {};
      for (const part of String(obj.spawn_counts ?? '').split(',')) {
        const m = part.trim().match(/^([a-z_]+)\s+(\d+)/);
        if (m) spawns[m[1]] = Number(m[2]);
      }
      obj.spawns = spawns;
      obj.links = parseList(obj.connections, ';'); // { east: "sunny_pasture" }
    }
    rows.push(obj);
  }
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ tab: name, note, columns, rows }, null, 2) + '\n');
  summary.push(`${name}: ${rows.length} rows`);
}
fs.writeFileSync(
  path.join(outDir, '_export_meta.json'),
  JSON.stringify({ source: path.relative(root, input), exportedAt: new Date().toISOString(), tabs: summary }, null, 2) + '\n',
);
console.log(`Exported ${summary.length} tabs to data/:\n  ` + summary.join('\n  '));
