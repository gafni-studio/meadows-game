# Meadow East tile kit

Grid: **1 world TILE = 32 px**. Hero is 160 px tall (5 tiles) at 1920×1080. All kit pieces snap to this grid. Colors and lighting follow the existing East painted backdrop (late-morning, light from the upper left, warm cocoa dirt, lime-to-mid grass).

## Draw order (back → front)

1. Sky
2. Far hills
3. Near hills
4. Ground and platform tiles (fill, then tops/caps, then undersides, then ladder and rope)
5. Props behind characters (portal, optional contact shade)
6. Characters
7. Front grass (`grass_front`)
8. Foreground (none in this kit)

## Rules

- Interiors are fully opaque; edges may have 1 px of cleanup. Do not premultiply or color-key interiors.
- Two exceptions may use a soft alpha gradient: `shade_contact` (grass-tinted, never gray) and the portal glow.
- No uniform dark outlines, no haloes, no gray drop shadows.
- Mid tiles are long (512 or 256 px) so stones do not repeat every two tiles. `_256` variants are the same art, shorter run.
- `grass_front` is only the tuft tips (~8–12 px, with gaps). It is a separate layer, not the ground’s baked grass. Place it at the **same world X** as `ground_top` / `platform_mid` so the pattern stays in phase, and at the **same Y as the walking line**, in front of feet and prop bases. It should overlap the bottom ~8–12 px of feet/hooves, not bury them.
- Walking line = top row of `ground_top` or `platform_*`. The baked grass band is a lush ~28–34 px painted strip with a soft rounded lip/overhang and varied tuft heights (tips are not clipped at the canvas top). Stand characters so their feet sit ~16–20 px below that line — in the notches, with only the front lip covering the bottom of the boots.
- `platform_mid` / `platform_left` / `platform_right` are the same pieces as the ground top and caps (shared art).
- Underside tiles use the same dirt/stone language as the platform body. Tuck them **16 px** under the body’s bottom; the underside’s top 16 rows are identical to the body’s last 16 rows so the join disappears. Ends are rounded/tapered; the bottom edge is irregular and rooty, not a flat slab.

## Files

| File | Size (px) | Anchor / pivot | Tiles | Notes |
|---|---|---|---|---|
| `ground_top.png` | 512×96 | Top-left = walking line | X | Lush ~28–34 px painted grass, rounded lip over dirt. |
| `ground_top_256.png` | 256×96 | same | X | Shorter mid. |
| `ground_fill.png` | 512×64 | Top-left | X, Y | Place flush under `ground_top` (no gap, no overlap). |
| `ground_fill_256.png` | 256×64 | same | X, Y | Shorter mid. |
| `ground_cap_left.png` | 64×96 | Top-left = walking line | — | Grass overhangs; rounded/tapered dirt face. |
| `ground_cap_right.png` | 64×96 | Top-left = walking line | — | Mirror of the left cap (rounded/tapered face). |
| `ground_fill_cap_left.png` | 64×64 | Top-left | — | Dirt-only end for a fill run. |
| `ground_fill_cap_right.png` | 64×64 | Top-left | — | Dirt-only end for a fill run. |
| `platform_mid.png` | 512×96 | Top-left = walking line | X | Same art as `ground_top`. |
| `platform_mid_256.png` | 256×96 | same | X | Same art as `ground_top_256`. |
| `platform_left.png` | 64×96 | Top-left = walking line | — | Same art as `ground_cap_left`. |
| `platform_right.png` | 64×96 | Top-left = walking line | — | Same art as `ground_cap_right`. |
| `platform_under_mid.png` | 256×96 | Top-left | X | Same dirt as the body. Tuck 16 px (top 16 rows match the body). |
| `platform_under_left.png` | 128×96 | Top-left | — | Tapered left end + rooty bottom. |
| `platform_under_right.png` | 128×96 | Top-left | — | Tapered right end + rooty bottom. |
| `oneway_mid.png` | 256×64 | Top-left = walking line | X | Short one-way ledge; grass matched to East greens. |
| `oneway_left.png` | 64×64 | Top-left = walking line | — | Rounded left end. |
| `oneway_right.png` | 64×64 | Top-left = walking line | — | Rounded right end. |
| `grass_front.png` | 512×32 | Top-left = walking line | X | Sparse 8–12 px tuft tips; phase-aligned with `ground_top`. |
| `grass_front_256.png` | 256×32 | same | X | Shorter run. |
| `ladder_top.png` | 64×96 | Top-left of canvas | — | Both rails hook over the lip. Lower 64 px is exact `ladder_mid`. Overlap the lip by ~24–28 px. |
| `ladder_mid.png` | 64×64 | Top-left | Y | Slim rails; rungs every 32 px. |
| `ladder_bottom.png` | 64×64 | Top-left | — | One rung + feet. Sit the feet in the ground grass. |
| `rope_top.png` | 64×128 | Loop sits on the lip; stem hangs down the canvas center | — | Small knot, open loop, thin stem ~15 px. |
| `rope_mid.png` | 32×64 | Rope centered in the canvas | Y | Thin braid, ~15 px. Line up with the stem. |
| `rope_bottom.png` | 64×96 | Body centered; fray at the bottom | — | Knotted, frayed end. |
| `portal.png` | 128×192 | Bottom-center on (or slightly in) the grass | — | Still of a generic blue-white swirl, no arch. |
| `portal_master.png` | 515×774 | same idea | — | Larger source if you later slice animation frames. |
| `shade_contact.png` | 64×16 | Center on the contact point, under the sprite | — | Optional soft green contact, not a gray oval. |

## Placement examples

**Ground strip.** `ground_cap_left` at the start, then `ground_top` (and `ground_fill` flush beneath it) across the run, `ground_cap_right` at the end. Characters stand with feet ~16–20 px below the walking line. `grass_front` over the same X range, same Y as the walking line, after the characters, overlapping the bottom ~8–12 px of the feet.

**Terrace.** `platform_left` + `platform_mid` + `platform_right` at the ledge walking line. Underside pieces (`under_left`, tiled `under_mid`, `under_right`) span the same width, top edge tucked 16 px under the body’s bottom so the ledge reads as one earth mass. `grass_front` on the ledge top, in phase with `platform_mid`.

**Ladder.** `ladder_top` with both rails hooked over the ledge lip (~24–28 px of overlap). `ladder_mid` tiled down the face until `ladder_bottom` meets the ground grass.

**Rope.** `rope_top` with the loop on the lip (often the right cap). `rope_mid` tiled down, centered on the stem. `rope_bottom` at the end.

**Portal.** Sit the 128×192 still on the ground so the glow base is in the grass; `grass_front` can overlap that base.
