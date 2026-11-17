// Hit effects for the rig test (polish 1): a procedural slash arc and a hit
// spark, drawn with Graphics each frame. The arc follows the idea of the
// "procedural cyclic slash" shader: a crescent band along an (elliptical) arc
// whose head races ahead, whose tail catches up, and whose width peaks near
// the head. A fuller effects pass (shader, textures, colours per skill) comes
// later; this is the cheap version that already sells the impact.
import Phaser from 'phaser';

export interface ArcSpec {
  cx: number; cy: number;     // centre (screen px)
  rx: number; ry: number;     // ellipse radii
  rot: number;                // ellipse rotation (rad)
  from: number; to: number;   // sweep (rad, ellipse parameter; any direction)
  width: number;              // max band width (px)
}

interface Live { spec: ArcSpec; age: number }
interface Spark { x: number; y: number; r: number; age: number; seed: number }

const ARC_LIFE = 0.24;
const SPARK_LIFE = 0.16;
const smooth = (a: number, b: number, x: number) => { const t = Phaser.Math.Clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class HitFx {
  private arcs: Live[] = [];
  private sparks: Spark[] = [];
  constructor(private g: Phaser.GameObjects.Graphics) {}

  slash(spec: ArcSpec) { this.arcs.push({ spec, age: 0 }); }
  spark(x: number, y: number, r: number, seed: number) { this.sparks.push({ x, y, r, age: 0, seed }); }

  /** Point on the arc's ellipse at parameter th. */
  static at(s: ArcSpec, th: number): [number, number] {
    const ex = s.rx * Math.cos(th), ey = s.ry * Math.sin(th);
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    return [s.cx + ex * c - ey * sn, s.cy + ex * sn + ey * c];
  }

  update(dt: number) {
    const g = this.g;
    for (const a of this.arcs) { a.age += dt; this.drawArc(a); }
    this.arcs = this.arcs.filter(a => a.age < ARC_LIFE);
    for (const s of this.sparks) {
      s.age += dt;
      const k = s.age / SPARK_LIFE;
      if (k >= 1) continue;
      // flash
      g.fillStyle(0xffffff, 0.9 * (1 - smooth(0, 0.5, k))).fillCircle(s.x, s.y, s.r * (0.35 + 0.5 * k));
      // rays: deterministic per hit, fly out and thin
      for (let i = 0; i < 9; i++) {
        const ang = s.seed * 1.7 + i * (Math.PI * 2 / 9) + Math.sin(i * 12.9898 + s.seed) * 0.35;
        const len = s.r * (0.9 + 0.7 * ((i * 7) % 3) / 2);
        const r0 = s.r * 0.3 + len * 0.9 * k, r1 = r0 + len * (1 - k) * 0.9;
        g.lineStyle(Math.max(1, s.r * 0.09 * (1 - k)), i % 2 ? 0xfff2b8 : 0xffffff, 1 - k);
        g.lineBetween(s.x + Math.cos(ang) * r0, s.y + Math.sin(ang) * r0, s.x + Math.cos(ang) * r1, s.y + Math.sin(ang) * r1);
      }
    }
    this.sparks = this.sparks.filter(s => s.age < SPARK_LIFE);
  }

  private drawArc(a: Live) {
    const s = a.spec, t = a.age;
    // head runs out fast, tail follows; both along the sweep (0..1)
    const head = 1 - (1 - Math.min(1, t / 0.09)) ** 3;
    const tail = smooth(0.03, ARC_LIFE, t);
    if (head - tail < 0.01) return;
    const fade = 1 - smooth(ARC_LIFE * 0.55, ARC_LIFE, t);
    const N = 36;
    const layer = (wk: number, colour: number, alpha: number) => {
      const outer: Phaser.Math.Vector2[] = [], inner: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;                                  // tail (0) -> head (1)
        const along = tail + (head - tail) * u;
        const th = s.from + (s.to - s.from) * along;
        const [x, y] = HitFx.at(s, th);
        // width: crescent, thick just behind the head, sharp at both ends
        const w = s.width * wk * Math.pow(u, 1.4) * Math.pow(1 - u, 0.35) * 1.9;
        const dx = x - s.cx, dy = y - s.cy, d = Math.hypot(dx, dy) || 1;
        outer.push(new Phaser.Math.Vector2(x + dx / d * w * 0.15, y + dy / d * w * 0.15));
        inner.push(new Phaser.Math.Vector2(x - dx / d * w, y - dy / d * w));
      }
      this.g.fillStyle(colour, alpha * fade);
      this.g.fillPoints([...outer, ...inner.reverse()], true);
    };
    layer(1.0, 0xffd98a, 0.38);   // warm glow
    layer(0.55, 0xfff8e6, 0.75);  // bright core
    layer(0.18, 0xffffff, 0.95);  // edge highlight along the tip path
  }
}
