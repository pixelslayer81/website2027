---
name: styleshift-page-sources
description: Page 03 (Style Shift, aka "the photo style site") is built from the "342450 Give Photo" app project; where its CSS, copy, photos and the Runway outpaint recipe come from
metadata:
  type: reference
---

Page 03 (`pages/03-styleshift/`; the user refers to it as "the photo style web site", "the
library on the website" means its Library section, and "spin up" means open it with
`Start-Process`) is a static case study of the real Style Shift app at
`C:\Users\v-andradej\Microsoft\Commercial Brand - 342450 Give Photo` (React frontend + FastAPI
backend; a OneDrive/SharePoint sync folder, moved there from `E:\Claude_Code\Projects\342450 Give
Photo` by 2026-10-21). Built 2026-10-12/13 to match a Figma frame and a Design-canvas artboard
the user supplied.

**Upstream since 2026-10-30:** the page was replaced wholesale by the info-site version at
`D:\repos\commercial-creative-design\projects\web-style-shift-info\pages\style-shift` (itself a
fork of this page: grey instead of blue, Press play demo video, step cards replaced by the
interactive workflow graph from its `pages/workflow/`). Port recipe when it changes again:
concatenate its `style.css` + `../workflow/workflow.css` + `combined.css` into our `style.css`
(the loader only loads `style.css`); drop its `site.js`/`header.css` tab header and
`data-root`; move its trailing inline `<script>` into `sketch.js` (the loader never runs inline
scripts); the graph lives in `workflow/` (`workflow.js` adapted to `mount(shadowRoot)`, json,
`exports/` images). Pre-port copy: `versions/pre-app-2026-10-30/`.
Re-synced 2026-11-03 (workflow only: Global rules / Published graph / Colorist detail panels).
Fast path: upstream's git HEAD (commit 0296853, 2026-10-30) is what we ported, so
`git -c safe.directory='*' diff` in that repo shows exactly what changed. `workflow.js` adaptation
is mechanical: our header + `mount()` (fetch + the modal-click/keydown listeners, keydown uses
`e.composedPath()[0]`), upstream body with `document.getElementById(` -> `$id(` and
`document.querySelectorAll(".flow-intro` -> `dom.querySelectorAll(`, guard
`if (!modal.classList.contains("open")) return;` in `closeDrawer`, then
`window.StyleShiftWorkflow = { mount }; })();`. CSS: our block between the `===== workflow graph`
and `===== workflow in the How it works panel` markers is upstream `workflow.css` with
`body {` -> `body, :host {`. JSON is copied verbatim; any new `exports/...` path it names is
copied from upstream's project-root `exports/` into `pages/03-styleshift/workflow/exports/`.
Verify by serving upstream (`python -I -m http.server 8091 -d <upstream>`) and comparing
headless shots of the same open panel. The sections below
describe the older, original build.

**Where things come from:**
- UI strings, colours and type sizes: `frontend/src/styles.css` and `frontend/src/App.tsx`
  in that project (blue `#1a4cf5`, cream `#f5f1e9`, Inter from Google Fonts, 13px radii,
  1.5px borders). The page's `style.css` is a port of them.
- The library gallery is a port of the app's `AccordionGallery.tsx` plus the `renderOverlay`
  and lightbox JSX in `App.tsx` (search "Library:" and "full-size viewer") and the
  "AccordionGallery (library)" / "full-size image viewer" blocks of `styles.css`. Re-ported
  2026-10-21 to be identical: `LIB_EXPAND` 0.45 hero, one-row heart · Save · Crop · View ·
  Delete pills with the staggered fade and `ag-panel--btn-*` size tiers, row-wide
  `.ag--ready` load fade, click on the open hero opens the viewer (site class `.viewer*`,
  the app's `.lightbox*` renamed to avoid the Looks lightbox). When the app's library
  changes, re-diff those blocks rather than restyling by eye.
- Site-only, user-requested in Oct 2026 sessions and deliberately kept: slivers expand on a
  660 ms hover dwell (the app expands on click only) and the slide runs 1.1 s. The header
  keeps the Figma layout (arrow left, title right), unlike the app (title left).
- Workflow card copy was transcribed from `style_shift_workflow.png` at that project's root;
  it exists nowhere as text. The intro / Looks / Audit paragraphs exist only in the Figma
  frame, not in the project.
- Library photos: since 2026-10-21 the site mirrors the app's whole library. The app's
  `library/library.json` (newest first; that order IS the gallery order) drives
  `pages/03-styleshift/assets/build-library.py`, which writes one 1376px JPEG per entry to
  `assets/library/<id>.jpg` and `library-data.js` (`window.StyleShiftLibrary`: id, name,
  look, favorite, aspect). Run it again whenever the app's library changes:
  `python -I pages/03-styleshift/assets/build-library.py "<app>/library" pages/03-styleshift`.
  Not every render is 16:9 (portrait and square saves exist), so the hero width is set per
  panel from `aspect`, as the app's `heroPctFor` does. The old hand-picked `lib-NN.jpg`
  placeholders were deleted that day.
- Looks grid photos: the man-on-the-steps set (`look-*.jpg`), from the same renders folder.
- Layout proportions come from a Figma spec JSON the user pasted (4036px-wide design,
  scaled by `--u = pageWidth/4036`) and from the Design artboard
  https://claude.ai/artifact/1zFX5tACYKGf4r374K1KcQ (audit card + how-it-works board,
  1290- and 1296-px frames, scaled by `--a` / `--b`).

**Runway outpaint recipe (works from PowerShell, no Python needed):**
`pages/03-styleshift/assets/runway-outpaint.ps1` calls the Runway dev API
(`POST https://api.dev.runwayml.com/v1/text_to_image`, header `X-Runway-Version:
2024-11-06`, key from that project's `.env` `RUNWAYML_API_SECRET`) with the app's model
`gemini_image3_pro`, ratio `2752:1536`, the photo inline as the `@photo` reference, and the
pipeline's 16:9 extension prompt. It spends the user's Runway credits (~25 s per image).

**Gotchas:**
- Windows PowerShell 5.1 `Invoke-RestMethod` sends string bodies as Latin-1; a prompt with
  em dashes makes the API answer "Invalid JSON". Send `[Text.Encoding]::UTF8.GetBytes($body)`.
- The model tends to re-render rather than extend: the first attempt shrank the subject and
  added a ceiling. Pinning the scale in the prompt ("kept pixel-for-pixel at its original
  scale, filling the full height, only new width at the sides, do not zoom out") fixed it.
- `python` on this machine is only the Store stub, so the app's own `scripts/runway.py`
  cannot be run here; call the REST API directly instead.
