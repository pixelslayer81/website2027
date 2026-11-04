# Curated Memory

One bullet per knowledge file. The `memory-keeper` subagent maintains this.
Full per-session logs live in `sessions/` and `INDEX.md` (auto-captured).

<!-- Example row (the agent will fill these in):
- [Topic title](knowledge/topic-slug.md) — one-line hook
-->

- [Hooks are PowerShell, not Python](knowledge/hooks-are-powershell-not-python.md) — no Python on this machine; keep `.ps1` hooks ASCII, and `settings.json` uses absolute paths
- [Site vision and page workflow](knowledge/site-vision-and-page-workflow.md) — ~10 interactive pages built one at a time; stitched 2026-10-21 by root `site.js` (fetch each page into a shadow-root section, needs a server; about = page 02; index links jump to `#styleshift`); page conventions in README "Stitching rules"; 100vh sections at 1440x900
- [Drawn paths: smooth and dashed](knowledge/drawn-paths-smooth-and-dashed.md) — standing rule: user-drawn paths render as smooth dashed splines; followers use the smoothed path
- [No toolchain; verify in browser manually](knowledge/no-toolchain-verify-in-browser-manually.md) — Node + Python 3.12 installed as of 2026-10-21 (local server: `python -I tools/serve.py 8080` from the repo root; a stale one may already hold 8080 and hang, so check the port first), browser automation via `node tools/headless-shot.js <url> <out.png> [waitMs] [js]` (headless Edge over DevTools; avoid the plain `--screenshot` flag); classic scripts not ES modules because pages open from `file://`; user must report runtime results; duplicate `const` once broke a page; git installed 2026-10-14 (set GIT_TERMINAL_PROMPT=1 / GCM_INTERACTIVE=always to push), remote pixelslayer81/StyleShiftinfo; Bash-tool git hits "dubious ownership" (add safe.directory or use PowerShell)
- [Page 02 flock rendering architecture](knowledge/flock-page-02-rendering-architecture.md) — pencil/chrome trails, rogue boids, depth-sorted weave with second canvas over text, 3D shapes; pencil backup location; also runs as the About page background via `mount(el, { input: document })` (2026-10-30)
- [User working style](knowledge/user-working-style-visual-iteration.md) — small visual increments, quick "dial" summaries, "always" = every instance
- [Style Shift page sources](knowledge/styleshift-page-sources.md) — since 2026-10-30 page 03 is a port of `D:\repos\commercial-creative-design\projects\web-style-shift-info\pages\style-shift` (port recipe inside: the loader only loads `style.css` and never runs inline scripts); originally built from the `342450 Give Photo` app at `C:\Users\v-andradej\Microsoft\Commercial Brand - 342450 Give Photo`; library is a port of its `AccordionGallery.tsx` (hover-dwell expand is site-only and intentional); Runway outpaint via REST from PowerShell
- [Splash (page 00)](knowledge/splash-page-00.md) — 2026-10-30: the site LANDS on the splash start frame; CT Index plays the transition ONLY from there (elsewhere, incl. About, it opens the formed CT index), Pixelslayer.tv returns to it (`?splash` previews); drives page 01's real elements and lands on the CT index; site.js hook; burst-capture trick for checking animations headlessly
- [Video in stitched pages](knowledge/video-in-stitched-pages.md) — page 01 hero is a looping MP4 `<video>` (square H.264 loop since 2026-10-30; check user videos for HEVC and transcode with WinRT MediaTranscoder from PowerShell, no ffmpeg; crop via `--hero-focus-y`); stitched site needs `v.load()` on mount after src rebase or the video errors; scribble reveal no longer aligned
