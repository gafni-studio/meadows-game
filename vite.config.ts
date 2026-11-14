import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { chunkSizeWarningLimit: 2000 },
  // The release number (package.json "version"): shown in the HUD, on window.__version, and in dist/version.json
  // so anyone can check which build is live (e.g. https://meadows-gafni.netlify.app/version.json).
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [{
    name: 'version-json',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, builtAt: new Date().toISOString() }) + '\n' }); },
  }],
});
