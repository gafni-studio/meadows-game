// The help panel: what every control does, and how to make an animation.
// Opened with the "? Help" button (bottom right) or the ? key.
const panel = document.getElementById('help')!;
const body = document.getElementById('help-body')!;

const HELP = `
<nav class="help-nav">
  <a href="#h-start">Quick start</a><a href="#h-stage">Stage</a><a href="#h-sel">Selected</a><a href="#h-layers">Layers</a>
  <a href="#h-pose">Pose</a><a href="#h-time">Timeline</a><a href="#h-clips">Clips</a><a href="#h-save">Saving</a>
  <a href="#h-keys">Shortcuts</a><a href="#h-tips">Tips</a>
</nav>

<h3 id="h-start">Quick start: make an animation</h3>
<ol>
  <li><b>Pick the asset and the clip</b> at the top (for example Hero → idle). A new clip starts with one key at the rest pose.</li>
  <li><b>Pose key 1.</b> Drag the round handles on the stage. Green handles are hands and feet: dragging one moves the whole arm or leg. The orange handle is the held item (the sword or the staff).</li>
  <li><b>Add a key</b> with <b>＋ Add key</b>. It is a copy of the current key, so you only change what moves.</li>
  <li><b>Set the timing.</b> On each key card, <b>to next</b> is how many milliseconds it takes to reach the next key. <b>blend</b> is how it gets there.</li>
  <li><b>Press Play</b> (or Space) to watch it loop. Click a key card to stop and keep editing.</li>
  <li><b>Save to GitHub</b> when you're happy. Until then, your work is kept in this browser.</li>
</ol>
<p class="tip">Start with 2 to 4 keys: the main poses. Play it, then add in-between keys only where the motion needs them.</p>

<h3 id="h-stage">The stage</h3>
<table>
  <tr><td><b>Round handle</b></td><td>Turns that bone around its joint. The thin line shows the bone it turns.</td></tr>
  <tr><td><b>Green handle</b></td><td>A hand or foot. With <b>IK</b> on, the arm or leg bends to follow it. With IK off, it turns only the lower bone.</td></tr>
  <tr><td><b>Orange handle</b></td><td>A held item. It turns in the hand.</td></tr>
  <tr><td><b>Purple square</b></td><td>The hips: drag to move the whole body. With <b>Pin feet</b> on, the feet stay planted and the knees bend.</td></tr>
  <tr><td><b>Click a part</b></td><td>Selects it (dashed box). Use this for parts without a handle, like an NPC's body, to change their layer.</td></tr>
  <tr><td><b>Drag empty space</b></td><td>Moves the view. The mouse wheel zooms. <b>⤢</b> or <kbd>F</kbd> fits the view.</td></tr>
</table>
<p><b>Toolbar toggles</b> (top left of the stage, remembered in this browser):</p>
<ul>
  <li><b>IK:</b> hand and foot handles move the whole limb.</li>
  <li><b>Pin feet:</b> moving the hips keeps the feet on the ground.</li>
  <li><b>Onion:</b> shows the previous and next key faintly, so you can space the motion evenly.</li>
  <li><b>Handles:</b> hide them to judge the pose (<kbd>H</kbd>).</li>
  <li><b>Follow-through:</b> on playback, loose parts such as the hero's scarf tail swing and settle by themselves. It is never saved: the game adds it too.</li>
</ul>

<h3 id="h-sel">Selected</h3>
<ul>
  <li><b>Bone:</b> pick a bone by name if its handle is hard to grab.</li>
  <li><b>Angle:</b> the slider, a typed number, or the nudge buttons (−5°, −1°, +1°, +5°). 0 is the rest pose, and positive turns clockwise.</li>
  <li><b>Move x / y</b> (hips only): how far the hips are moved from rest.</li>
  <li><b>Picture:</b> for parts that have other pictures, such as an NPC's head (<i>blink</i>, <i>talk</i>). A picture switches at its key and doesn't blend.</li>
  <li><b>▲ Forward / ▼ Back:</b> the selected part's layer (see below).</li>
  <li><b>Reset this bone</b> puts just this bone back to rest on this key.</li>
</ul>

<h3 id="h-layers">Layers (draw order)</h3>
<p>The list shows every part of the current key, <b>front at the top</b>. Use ▲ and ▼ on a row (or <kbd>]</kbd> and <kbd>[</kbd> for the selected part) to bring it forward or send it back. For example, swing the sword <i>behind</i> the body for a wind-up, then in front again for the strike.</p>
<ul>
  <li>The order belongs to <b>this key</b> and switches at the key: it doesn't blend.</li>
  <li>A <span style="color:var(--accent)">●</span> marks a part that is moved from the rig's own order.</li>
  <li><b>Use on all keys</b> copies this key's order to every key of the clip.</li>
  <li><b>Reset order</b> goes back to the rig's own order on this key.</li>
</ul>

<h3 id="h-pose">Pose tools</h3>
<ul>
  <li><b>Copy</b> and <b>Paste</b> (<kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd>): copy a whole pose to another key, or another clip of the same asset.</li>
  <li><b>Mirror:</b> swaps the left and right limbs. Pose one step of a walk, add a key, mirror it, and you have the other step.</li>
  <li><b>Reset this key to rest:</b> clears the pose.</li>
</ul>

<h3 id="h-time">Timeline</h3>
<ul>
  <li><b>The bar</b> shows the keys sized by their time. Click a segment or a card to go to that key.</li>
  <li><b>to next:</b> milliseconds from this key to the next. On a looping clip, the last key's time is the way back to key 1.</li>
  <li><b>blend:</b>
    <ul>
      <li><i>smooth</i> (default): a gentle curve through the keys around it.</li>
      <li><i>linear</i>: even speed.</li>
      <li><i>easeIn</i>: slow, then fast, for going <i>into</i> a hit.</li>
      <li><i>easeOut</i>: fast, then slow, for coming out of one.</li>
      <li><i>easeInOut</i>: slow at both ends.</li>
      <li><i>hold</i>: stays still, then jumps to the next key.</li>
    </ul>
  </li>
  <li><b>event:</b> a name the game reacts to when this key is reached. Put <i>hit</i> on the key where the sword connects, and the game deals damage there. Leave it empty otherwise.</li>
  <li><b>Loop:</b> the clip repeats (idle, run). Turn it off for one-shot clips (an attack, a death). The game decides when to play them.</li>
  <li><b>Speed:</b> preview slower or faster. It's not saved.</li>
  <li><b>◀ ▶</b> move the selected key earlier or later. <b>＋ Add key</b> copies it, and <b>Delete key</b> removes it.</li>
</ul>

<h3 id="h-clips">Clips</h3>
<p>The <b>⋯</b> menu next to the clip name can make a <b>new</b> clip, <b>copy</b> this one (a good start for a variant), <b>rename</b> it, or <b>delete</b> it. Every clip of an asset is saved together in one file.</p>

<h3 id="h-save">Saving</h3>
<ul>
  <li><b>⬆ Save to GitHub</b> commits <code>animations/&lt;asset&gt;.json</code> to the repo, and the game reads it from there. The first time, paste a token in <b>⚙</b> Settings:
    <ul>
      <li>a fine-grained token for this repository only, with <i>Contents: Read and write</i>;</li>
      <li>it stays in this browser.</li>
    </ul>
  </li>
  <li><b>● Unsaved</b> means there are changes not on GitHub yet. They're kept in this browser, and if you close the tab, the studio offers to restore them next time.</li>
  <li><b>⬇ Download</b> and <b>Open…</b> work with the JSON file directly. Use them if saving to GitHub isn't possible.</li>
  <li><b>↶ / ↷</b> undo and redo every change (<kbd>Ctrl+Z</kbd>, <kbd>Ctrl+Shift+Z</kbd>).</li>
</ul>

<h3 id="h-keys">Shortcuts</h3>
<table>
  <tr><td><kbd>Space</kbd></td><td>Play or pause</td></tr>
  <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Previous or next key</td></tr>
  <tr><td><kbd>Insert</kbd></td><td>Add a key (copy of this one)</td></tr>
  <tr><td><kbd>Delete</kbd></td><td>Delete this key</td></tr>
  <tr><td><kbd>[</kbd> <kbd>]</kbd></td><td>Send the selected part back, or bring it forward</td></tr>
  <tr><td><kbd>Ctrl+Z</kbd> <kbd>Ctrl+Shift+Z</kbd></td><td>Undo, redo</td></tr>
  <tr><td><kbd>Ctrl+C</kbd> <kbd>Ctrl+V</kbd></td><td>Copy or paste the pose</td></tr>
  <tr><td><kbd>Ctrl+S</kbd></td><td>Save to GitHub</td></tr>
  <tr><td><kbd>F</kbd></td><td>Fit the view</td></tr>
  <tr><td><kbd>H</kbd></td><td>Show or hide handles</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Deselect, or close this panel</td></tr>
  <tr><td><kbd>?</kbd></td><td>Open this help</td></tr>
</table>

<h3 id="h-tips">Tips for good motion</h3>
<ul>
  <li><b>Few keys, good timing.</b> Timing sells weight more than extra poses do. Try the same keys with different <i>to next</i> values.</li>
  <li><b>Anticipation:</b> before a big move, a small move the other way, such as a wind-up before a swing.</li>
  <li><b>Fast hits, slow recoveries:</b> a short time into the hit (<i>easeIn</i>), a pause on it, then a longer, softer way out (<i>easeOut</i>).</li>
  <li><b>Holds:</b> two identical keys make the character stop for a moment.</li>
  <li><b>Blinks</b> (NPCs): a key with the <i>blink</i> picture and about 120 ms to next, between longer keys without it.</li>
  <li><b>Loops:</b> make the last key lead back into key 1. Onion skin shows key 1 faintly while you pose the last key.</li>
</ul>
`;

body.innerHTML = HELP;
body.querySelectorAll<HTMLAnchorElement>('.help-nav a').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  body.querySelector(a.getAttribute('href')!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
document.getElementById('help-close')!.addEventListener('click', () => closeHelp());

export function openHelp() { panel.hidden = false; }
export function closeHelp() { panel.hidden = true; }
export const helpOpen = () => !panel.hidden;
