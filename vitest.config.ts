import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config';

// Fast logic tests: the real game modules, in Node, no browser. `npm test` (~2 s).
export default mergeConfig(vite, defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] },
}));
