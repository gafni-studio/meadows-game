// Records the rig-test preview frame by frame (exact 30 fps steps, not real time).
//   npx vite build art-direction/rig-test/preview --outDir ../out   (done by this script)
//   node art-direction/rig-test/tools/capture.mjs [seconds=6.8]
// Writes art-direction/rig-test/out/: mock-1920x1080.png, rig-test.mp4, rig-test.gif,
// and frames/ (deleted after encoding).
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(existsSync);

const RIG = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(RIG, 'out');
const SECONDS = Number(process.argv[2] ?? 6.8);
const STILL_AT = Number(process.env.STILL_AT ?? 0.97); // s: hit 1, slash arc mid-sweep

execSync(`npx vite build ${join(RIG, 'preview')} --outDir ${join(RIG, 'build')} --emptyOutDir --base ./ --logLevel warn`, { stdio: 'inherit' });
const server = spawn(process.execPath, [join(RIG, '../../node_modules/vite/bin/vite.js'), 'preview', '--outDir', join(RIG, 'build'), '--port', '4188', '--strictPort'], { cwd: join(RIG, 'preview') });
await new Promise(r => setTimeout(r, 2500));

mkdirSync(join(OUT, 'frames'), { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
await page.goto('http://localhost:4188/?capture=1');
await page.waitForFunction(() => window.__rig?.ready, null, { timeout: 30000 });
await page.evaluate(() => window.__rig.step(30)); // settle the springs
const n = Math.round(SECONDS * 30);
for (let i = 0; i < n; i++) {
  await page.evaluate(() => window.__rig.step(1));
  await page.screenshot({ path: join(OUT, 'frames', `f${String(i).padStart(4, '0')}.png`) });
  if (i === Math.round(STILL_AT * 30)) await page.screenshot({ path: join(OUT, 'mock-1920x1080.png') });
}
await browser.close();
server.kill();

const f = join(OUT, 'frames', 'f%04d.png');
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${f} -c:v libx264 -pix_fmt yuv420p -crf 20 ${join(OUT, 'rig-test.mp4')}`);
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${f} -vf "fps=25,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a" ${join(OUT, 'rig-test.gif')}`);
rmSync(join(OUT, 'frames'), { recursive: true });
rmSync(join(RIG, 'build'), { recursive: true });
console.log('wrote', OUT);
