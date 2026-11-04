---
name: site-vision-and-page-workflow
description: The site is ~10 interactive pages built one at a time, then stitched into a scroll-through blog; why pages are 100vh sections at a 1440x900 reference, not 1440x1080
metadata:
  type: project
---

Decided 2026-10-09 with the user. The site is a portfolio of ~10 interactive "vibe coding / AI tools"
pages, each about one project. The user builds them one page at a time (page 02, the
flocking-particle page, was first), and will connect them at the end into a single
scroll-down, blog-style site where each page is one section.

**Why:** The user asked whether to use one folder per page and whether the default size
should be 1440 x 1080. Per-page folders were chosen because organization matters at
10 pages; `pages/NN-slug/` with a numeric prefix gives scroll order for free. 1440 x 1080
was rejected because it is a TV aspect; common laptop viewports (1440 x 900, 1536 x 864)
are shorter and would crop it. Pages are full-viewport (`100vw x 100vh`) sections instead,
laid out against a 1440 x 900 reference.

**Stitched 2026-10-21.** The root `index.html` + `site.js` + `site.css` is the hero site:
one `<section class="site-page" data-page="NN-slug">` per page; `site.js` fetches each page's
`index.html` into the section's **shadow root** (with `shared/reset.css` and the page's own
`style.css` as `<link>`s), loads the page's scripts once, and calls `window.<Name>Sketch.mount`.
Chosen over iframes (page 03's `position: fixed` viewer would centre in a content-height
iframe, not the viewport) and over a build script (no toolchain, fragile CSS prefixing).
Decisions: "about" = page 02 (AI Task Force); index clicks are instant anchor jumps
(`#intro`, `#about`, `#styleshift`; `../NN-slug/index.html` links are rewritten by the loader).
The stitched site needs a server (`python -I -m http.server 8080 --bind 127.0.0.1`); pages
still open from `file://`, and the root shows a fallback link list there. Conventions a page
must follow are in README "Stitching rules" (`:root, :host`; a `:host` copy of `body`
colours; `asset()` for JS asset paths; no `document.getElementById`, use
`root.getRootNode().getElementById` for elements outside `<main>`).
Known limits: page 02's `touch-action: none` blocks touch-scrolling past it; pages 01/02 keep
their rAF loops running off screen.

**Page 04 (Always On Social, started 2026-10-21):** built from a design-spec JSON the user
pasted (kept as `pages/04-always-on-social/spec.json`; a 1440 x 2350 dark page, every value
mapped through `--u = width / 1440`). Built standalone first, then added to the stitched root site
the same evening as section `#always-on-social` under Style Shift, with index row 02 linking to
it. Its app card is a supplied render (`assets/app-card.png`) with a centred Press play button
and the PRESSPLAY marquee both opening a viewer; a video will replace the image later. A
"Touchstone System" section (display heading + `assets/touchstone-system.png` with a Click to
play button) closes the page; the click opens the same viewer in video mode and plays
`assets/Touchstone_Demo_video_v06.mp4` (71 MB, loaded only on click). Gallery
images are still placeholders (ghost "We have" text) and the closing text is marked temporary.
No Always On Social app project exists on this machine; the spec is the only source.

**Page 05 (Exporter, 2026-10-21):** built from a second design-spec JSON (kept as
`pages/05-exporter/spec.json`): a white 1440 x 1346 page whose content is one red-lined
1300 x 1206 frame; every layer is absolutely positioned at its spec coordinate through
`--u = width / 1440`. Fonts Anton + Space Mono come from Google Fonts and are also in the
root `index.html` link (shadow roots need the host document to load fonts). Added to the
stitched site straight away as `#exporter` under Always On Social; there is no index row
for it yet (the spec tags it "03"). Its video block is a red placeholder with a label.

**How to apply:**
- New pages go in `pages/NN-slug/` with `index.html`, `style.css`, `sketch.js`; keep
  `window.<Name>Sketch = { mount, unmount }` so the final stitch can host each page as
  a section. (Structure details are in CLAUDE.md and README.md; this file is the why.)
- Design and screenshot against 1440 x 900; nothing should depend on a fixed pixel size.
- Page 01 (intro) is an empty placeholder; the user has not described it yet.
- Page 02's copy is temp text ("The AI Task Force is a cross-functional team...") that the
  user supplied as a placeholder; expect it to be replaced.
- The user's reference for page 02's feel was https://brik.space/toolviewer?slug=canvas-context-guard-mo49tab6
  (right-click draw, release spawns flocking particles following the path). The page is
  JS-rendered, so WebFetch returns only Brik marketing copy; do not expect to read the demo.
- Work from a plan first: the user opened this session in plan mode and wanted the plan
  reviewed before any files were written.
