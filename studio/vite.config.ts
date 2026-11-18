// Animation Studio build: a static site for GitHub Pages (studio/dist).
// rigs/ and animations/ live at the repo root (the game reads them too), so
// they are served in dev and copied into the build.
import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SHARED = ['rigs', 'animations'];
const TYPES: Record<string, string> = { json: 'application/json', png: 'image/png' };

const shared = (): Plugin => ({
  name: 'studio-shared-folders',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = decodeURIComponent((req.url ?? '').split('?')[0]);
      const dir = SHARED.find(d => url.startsWith(`/${d}/`));
      const file = dir && join(ROOT, url);
      if (!file || !file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', TYPES[file.split('.').pop()!] ?? 'application/octet-stream');
      res.end(readFileSync(file));
    });
  },
  closeBundle() {
    for (const d of SHARED) cpSync(join(ROOT, d), join(HERE, 'dist', d), {
      recursive: true,
      filter: src => !/\.(py|pyc)$/.test(src) && !src.endsWith('rest.png'),
    });
  },
});

export default defineConfig({
  root: HERE,
  base: './',
  server: { port: 5180 },
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [shared()],
});
