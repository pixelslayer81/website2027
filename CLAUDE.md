# website

Scroll-through, blog-style site built one page at a time, stitched together at the end. Plain HTML/CSS/JS, no build step (no Node, npm or Python on this machine; Git for Windows is installed at `C:\Program Files\Git\cmd`, which may not be on the agent shell's PATH).

## Git

- Remote: `origin` = https://github.com/pixelslayer81/StyleShiftinfo.git, branch `main`.
- Pushing from the agent shell needs the prompt blocks lifted for that command:
  `$env:GIT_TERMINAL_PROMPT="1"; $env:GCM_INTERACTIVE="always"` (the harness sets them off).
- `.claude/memory/sessions/` is git-ignored; the curated knowledge is committed.

## Structure

- `index.html` + `site.js` + `site.css` — the stitched hero site: one `<section data-page="NN-slug">` per page; `site.js` fetches each page into the section's shadow root and mounts its sketch. Needs a server: `python -I tools/serve.py` from the repo root (no-cache http.server), then `http://127.0.0.1:8080/`. Verify pages headlessly with `node tools/headless-shot.js <url> <out.png> [waitMs] [js]`.
- `pages/NN-slug/` — one folder per page (`index.html`, `style.css`, `sketch.js`); the number is scroll order. Pages still open standalone from `file://`.
- `shared/` — `reset.css`, `tokens.css` (all brand values), `fonts/`.
- Each `sketch.js` is a classic script exposing `window.<Name>Sketch = { mount, unmount }`. No ES modules: pages are opened from `file://`.
- Stitching conventions (see README): custom properties on `:root, :host`; a `:host` copy of the page's `body` colours/fonts; JS asset paths through `asset()`; no `document.getElementById` in sketches; `../NN-slug/index.html` links become section jumps.
- Pages are full-viewport sections; design against a 1440 x 900 reference.
- Preview one page: `Start-Process pages\NN-slug\index.html`.

<!-- quickstart-memory -->
## Project memory

This project has an auto-memory system (`.claude/memory/`). Every session is captured to `sessions/`; durable learnings are curated into `knowledge/` and indexed in `MEMORY.md`, which is injected at the start of each session. Run `/memory` for a deeper distillation pass. See `.claude/memory/README.md`.
