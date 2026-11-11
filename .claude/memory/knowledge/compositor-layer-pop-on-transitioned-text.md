---
name: compositor-layer-pop-on-transitioned-text
description: Big text with -webkit-text-stroke visibly "pops" when a transform transition ends (GPU layer dropped, text re-rasterised); fix with permanent will-change: transform; not reproducible headlessly
metadata:
  type: project
---

Seen 2026-11-10 on the Style Shift title (page 03): the outline SHIFT letters rise with a
`transform` transition and, the instant each letter landed, its 3px stroke snapped from a clean
solid line to a thinner, broken-looking one (user's reference clip `shift.mp4`, frames 1.7-2.0 s).

**Why:** while a transform transition runs, Chromium/Edge promotes the element to its own
compositor layer and rasterises the text on the GPU; when the transition ends it drops the layer
and re-rasterises through the normal path, which draws `-webkit-text-stroke` under a
page-coloured fill (`paint-order: stroke fill`) differently. Filled letters hide it; outlined ones
do not. The headless checker (`tools/headless-shot.js`) runs with `--disable-gpu`, so both states
rasterise identically there and the pop can only be seen in a real browser or the user's capture.

**How to apply:**
- Any letter-by-letter rise (`.title .l`, `.rise .l` in `pages/03-styleshift/style.css`) keeps
  `will-change: transform; backface-visibility: hidden;` so the layer is permanent and the look
  never switches. Do the same for any new transitioned outlined/stroked text.
- The landed look then equals the mid-animation (GPU) look, the cleaner of the two.
- Do not claim a headless screenshot proves such a pop is fixed; ask the user to confirm, see
  [[no-toolchain-verify-in-browser-manually]].
