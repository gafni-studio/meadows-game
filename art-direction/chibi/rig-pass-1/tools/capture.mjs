// Records the rig pass 1 preview frame by frame (exact 1/30 s steps) and
// shoots the keyframe stills for the side-by-side.
//   node art-direction/chibi/rig-pass-1/tools/capture.mjs
// Writes rig-pass-1/: hero-rig-pass-1.mp4, hero-rig-pass-1.gif, still.png and
// _keys/<n>.png (used by tools/compare.py, then deleted by it).
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find(existsSync);

const PASS = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = join(PASS, '../../..');
const BUILD = join(PASS, '_build');
const FRAMES = join(PASS, '_frames');

execSync(`npx vite build ${join(PASS, 'preview')} --outDir ${BUILD} --emptyOutDir --base ./ --logLevel warn`, { stdio: 'inherit', cwd: ROOT });
const server = spawn(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', BUILD, '--port', '4189', '--strictPort'], { cwd: join(PASS, 'preview') });
await new Promise(r => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });

// 1. the reel
mkdirSync(FRAMES, { recursive: true });
await page.goto('http://localhost:4189/?capture=1');
await page.waitForFunction(() => window.__rig?.ready, null, { timeout: 30000 });
const len = await page.evaluate(() => window.__rig.len);
const n = Math.round(len * 30);
for (let i = 0; i < n; i++) {
  await page.evaluate(() => window.__rig.step(1));
  await page.screenshot({ path: join(FRAMES, `f${String(i).padStart(4, '0')}.png`) });
}
// 2. keyframe stills on a plain background
// [clip, t]: the sheet keyframes, in tools/compare.py's order (t from anims.ts)
const keys = [['idle', 0], ['run', 0], ['run', 0.13], ['combo', 0.12], ['combo', 0.20], ['combo', 0.30], ['combo', 0.60], ['combo', 0.68], ['combo', 0.80]];
mkdirSync(join(PASS, '_keys'), { recursive: true });
await page.goto('http://localhost:4189/?compare=1');
await page.waitForFunction(() => window.__rig?.ready, null, { timeout: 30000 });
for (let i = 0; i < keys.length; i++) {
  const [clip, t] = keys[i];
  await page.evaluate(([c, tt]) => { window.__rig.pose(c, tt); window.__rig.step(1); }, [clip, t]);
  await page.screenshot({ path: join(PASS, '_keys', `${i}.png`), clip: { x: 420, y: 160, width: 1080, height: 780 } });
}
await browser.close();
server.kill();

const f = join(FRAMES, 'f%04d.png');
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${f} -c:v libx264 -pix_fmt yuv420p -crf 20 ${join(PASS, 'hero-rig-pass-1.mp4')}`);
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${f} -vf "fps=25,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=sierra2_4a" ${join(PASS, 'hero-rig-pass-1.gif')}`);
execSync(`cp ${join(FRAMES, `f${String(Math.round((3.0 + 3.2 + 0.24) * 30)).padStart(4, '0')}.png`)} ${join(PASS, 'still.png')}`);
rmSync(FRAMES, { recursive: true });
rmSync(BUILD, { recursive: true });
console.log('frames', n);
