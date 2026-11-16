/**
 * v0.3.0 geometry queries on an AreaGeometry, in tiles (pure; used by spawns, arrivals and tests).
 */
import type { AreaGeometry, SpawnZone } from './areas';

/** Height of the solid ground at x: the tallest block covering it, else the base ground (0). */
export function groundAt(geo: AreaGeometry, x: number): number {
  let h = 0;
  for (const b of geo.blocks ?? []) if (x >= b.x && x < b.x + b.w) h = Math.max(h, b.h);
  return h;
}

/** The stretch of walkable surface at height y that contains x: a one-way ledge, or a run of solid ground. */
export function surfaceSpan(geo: AreaGeometry, x: number, y: number): [number, number] | null {
  for (const p of geo.platforms) if (Math.abs(p.y - y) < 0.01 && x >= p.x && x <= p.x + p.w) return [p.x, p.x + p.w];
  if (Math.abs(groundAt(geo, x) - y) > 0.01) return null;
  // walk out to where the ground changes height
  let lo = x, hi = x;
  while (lo > 0 && Math.abs(groundAt(geo, lo - 0.5) - y) < 0.01) lo -= 0.5;
  while (hi < geo.widthTiles && Math.abs(groundAt(geo, hi + 0.5) - y) < 0.01) hi += 0.5;
  return [lo, hi + 0.5];
}

/**
 * Where a spawn zone's mobs stand and patrol: the zone's surface height and its x-range, clipped to the ledge
 * (or ground run) under the zone's middle. Ground zones (no y) keep their whole range: mobs on the base ground
 * walk the half-tile slopes.
 */
/** v0.3.1: a ground zone has no `y`: each mob stands on the solid ground under its own x (hills included). */
export function zoneBounds(geo: AreaGeometry, z: SpawnZone): { y?: number; x0: number; x1: number; ledge: boolean } {
  if (z.y == null) return { y: undefined, x0: z.x[0], x1: z.x[1], ledge: false };
  const mid = (z.x[0] + z.x[1]) / 2;
  const span = surfaceSpan(geo, mid, z.y);
  if (!span) return { y: z.y, x0: z.x[0], x1: z.x[1], ledge: true };
  return { y: z.y, x0: Math.max(z.x[0], span[0] + 0.6), x1: Math.min(z.x[1], span[1] - 0.6), ledge: true };
}

/** How many of `count` mobs go to each zone: explicit `n` first, the rest spread over zones without one. */
export function splitCount(zones: SpawnZone[], count: number): number[] {
  const fixed = zones.reduce((a, z) => a + (z.n ?? 0), 0);
  const free = zones.filter((z) => z.n == null).length;
  const rest = Math.max(0, count - fixed);
  let given = 0;
  return zones.map((z, i) => {
    if (z.n != null) return z.n;
    const k = zones.slice(0, i + 1).filter((q) => q.n == null).length;
    const n = Math.round((rest * k) / free) - given;
    given += n;
    return n;
  });
}

/**
 * Auto step-up for walkers (v0.3.0 half-tile slopes): a block edge just ahead whose top is at most `maxRisePx`
 * above the feet. Returns the new feet y (px), or null. groundY is the base-ground feet line in px.
 */
export function stepUpTo(geo: AreaGeometry, groundY: number, aheadX: number, feetY: number, maxRisePx = 18): number | null {
  const T = 32;
  let best: number | null = null;
  for (const b of geo.blocks ?? []) {
    if (aheadX < b.x * T - 2 || aheadX > (b.x + b.w) * T + 2) continue;
    const top = groundY - b.h * T;
    const rise = feetY - top;
    if (rise > 0.5 && rise <= maxRisePx) best = best == null ? top : Math.min(best, top);
  }
  return best;
}

/** v0.3.1: the surface height (tiles) a mob spawns on at x: its zone's level, else the solid ground there. */
export function spawnHeight(geo: AreaGeometry, x: number, y?: number): number {
  return y ?? groundAt(geo, x);
}
