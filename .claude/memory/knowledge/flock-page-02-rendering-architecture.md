---
topic: Page 02 flock - rendering architecture and versions
updated: 2026-10-09
---

Page 02 (`pages/02-flock/`): right-click draws a spline; release spawns a flock following it. On 2026-10-09 it evolved from plain particles into a layered stylised renderer. Per-iteration parameter values are intentionally not recorded; read `sketch.js` for current dials.

**Tried and reverted 2026-10-21:** running this sketch as a background drawing layer across
page 03 (a sticky full-viewport layer, the sketch turned into a factory with `create()`,
`opts.input` = the whole page, letter coupling off). The user asked to revert the same
evening; the sketch is single-instance again. If it comes back, the gotchas were: take
pointer capture only when the canvas itself is the input (capturing from a page root
retargets the following click and breaks buttons), and headless Edge paints the flock only
faintly (about 20 pixels per stroke on either page), so judge the look in a real browser.

**Background layer on the About page (2026-10-30, user asked):** page 09 loads
`../02-flock/sketch.js` into a fixed full-window `.flock-bg` layer behind its content
(`FlockSketch.mount(el, { input: document })`). `mount` gained the optional `opts.input`:
when set, strokes start anywhere on that element except links/buttons, moves and the release
are heard on the window, no pointer capture, and the context menu is blocked only right after
a right-drag stroke. `opts.scroll` (also on About) keeps the drawing in page coordinates. A
position:fixed layer redrawn per frame LAGGED the scroll (user noticed); the fix: an absolute
layer (window + 400px overscan each side, in a page-size overflow:hidden clip) that scrolls
natively and is re-centred on the window each frame. A page-tall canvas was avoided as too
heavy. Without opts (page 02)
behaviour is unchanged. Opaque About bands hide
the drawing, so its paper band was made transparent. Pre-change backup:
`pages/02-flock/versions/pre-bg-input-2026-10-30/`. `opts.copy` (2026-10-30): a list of elements
whose letters the shapes shove (default: el's `.copy`); About passes its small red mono labels
(hero tags, job roles, 03.x codes, edu dates), measured in page coords in scroll mode and
re-measured on fonts-ready and window load.

Durable structure and decisions:
- Trail styles tried, in order: pencil (graphite, layered passes, paper grain, pressure variation), skinny white hand-drawn tubes, silver and black chrome tubes. Style is swappable; the pencil version is the user's reference look.
- Flock behaviour has "rogue" boids and per-boid speed profiles so the flock is not uniform.
- Depth-sorted "weave" rendering: a second canvas sits above the copy text so some boids/trails pass in front of the text and others behind.
- Orbiting 3D shapes (cubes, black chrome cones, wireframe spheres; lead shapes at the front) are part of the depth sort.
- Backup of the pencil version: `pages/02-flock/versions/pencil-2026-10-09/`. Next planned experiment: a coloured-pencil palette variant (work on the live files, revert from the backup if needed).

Related: [[drawn-paths-smooth-and-dashed]], [[site-vision-and-page-workflow]].
