---
name: no-toolchain-verify-in-browser-manually
description: Machine has no Node/npm/git and sessions have no browser automation, so pages open from file:// and runtime checks fall to the user
metadata:
  type: project
---

Confirmed 2026-10-09: `node`, `npm`, `pnpm` and `git` are all absent on this machine
(in addition to Python, see [[hooks-are-powershell-not-python]]). The Claude Code session
also had no browser-automation tool (no Chrome extension or built-in browser MCP), so
the agent cannot run the page or read its console.

**Why:** This is why the site is plain HTML/CSS/JS with no build step, and why page scripts
are classic `<script src>` files rather than ES modules: Chrome/Edge refuse `import` from
`file://` (origin `null`), and with no server available the user opens files directly.

**How to apply:**
- Do not propose frameworks, bundlers or `npm install` steps without first checking
  whether the toolchain has since been installed (`Get-Command node, git`).
- Keep every `sketch.js` a classic IIFE exposing a `window.*Sketch` global; no `import`/`export`.
- After writing a page, do a careful static read of the script, then
  `Start-Process pages\NN-slug\index.html` and ask the user to report behaviour and
  console errors. State plainly that runtime was not verified by the agent.
- Git for Windows was installed 2026-10-14 (`C:\Program Files\Git\cmd`, add it to PATH in
  the agent shell) and the repo pushes to https://github.com/pixelslayer81/website2027 (private; it was pixelslayer81/StyleShiftinfo until 2026-11-11, when the user moved it).
  The harness sets `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never`, so a push that
  needs credentials fails with "could not read Username" unless the command sets
  `$env:GIT_TERMINAL_PROMPT="1"; $env:GCM_INTERACTIVE="always"` first (then Git Credential
  Manager opens the browser sign-in; credentials are stored after the first success).
  Before that date there was no git: `pages/NN-slug/versions/<name>-<date>/` folders were the
  revert mechanism and still exist; prefer commits for new work.
- No bundler/linter means syntax errors surface only in the browser. A duplicate `const`
  in one scope once broke the entire page 02. After editing, re-read the edited scope for
  redeclared names and unbalanced braces.
- Update 2026-10-21: Node LTS (winget) and Python 3.12
  (`C:\Users\v-andradej\AppData\Local\Programs\Python\Python312\python.exe`) are now installed.
  "Spin up a local server" = `Start-Process python.exe -ArgumentList "-I tools/serve.py 8080"
  -WorkingDirectory <repo> -WindowStyle Hidden`, then open `http://127.0.0.1:8080/` (or
  `/pages/NN-slug/index.html`). Use `tools/serve.py`, NOT plain `-m http.server`: the plain
  server sends no Cache-Control, and on 2026-10-21 the user's browser kept a stale
  `pages/01-intro/style.css` and showed the stitched index unstyled (serif, no hero) while the
  headless check passed. `serve.py` sends `no-store`; `site.js` also stamps page-file URLs with
  `?v=` on localhost. If a user reports an unstyled section, first ask for a hard reload
  (Ctrl+Shift+R). Pages still must work from `file://` too.
  Before starting, check whether 8080 is already taken (`Get-NetTCPConnection -LocalPort 8080
  -State Listen`): on 2026-10-27 a leftover `serve.py` from an earlier session still held 8080
  but timed out on every request. The auto-mode classifier refuses `Stop-Process` on it, so
  either start a new one on 8081 or ask the user to run `! Stop-Process -Id <pid>`.
- Browser automation IS possible since 2026-10-21: `tools/headless-shot.js` drives headless
  Edge over the DevTools protocol with Node's built-in WebSocket (no npm):
  `node tools/headless-shot.js <url> <out.png> [waitMs] [jsExpression]` prints console output,
  4xx/5xx URLs and the expression's JSON value (evaluate inside shadow roots via
  `document.getElementById('styleshift').shadowRoot`), then saves a 1440x900 viewport
  screenshot; Read the PNG to see it. Works for `file://` URLs too. Do NOT trust Edge's plain
  `--headless --screenshot --virtual-time-budget` flag for this site: the pages' rAF loops burn
  the virtual time before fetch-loaded sections mount, so later sections screenshot blank.
  Gotchas (2026-11-04): from the PowerShell tool (5.1), double quotes inside the `jsExpression`
  argument are stripped and the eval reports `"Uncaught"`; write the JS with single quotes only.
  Each run leaves a `tools/cdp-profile-<port>/` folder (~20 MB each, 3.8 GB had piled up); they
  are git-ignored and safe to delete.
  More (2026-11-10): the Bash tool passes the JS arg cleanly, so run headless-shot from Bash with
  single quotes round the whole expression and double quotes inside. The eval is not async:
  top-level `await` throws; return a `new Promise(...)` instead (the tool awaits it). An
  expression that calls `location.reload()` kills the target ("Inspected target navigated").
  `SHOT_DRAG` runs BEFORE the eval, so state the eval sets (a theme toggle) does not affect the
  drag; use a URL that sets the state instead (`?theme=dark`, `?nosplash`). On the About page
  the drawing layer sits UNDER the page content, so a drag over the photo or the name shows
  nothing; drag across empty page. Even there the headless drag only left the cursor-follower
  mark, not a full path, in both themes (unexplained; check paths in a real browser).
  Video frames (2026-11-10): to SEE a reference video, do not seek a <video> in headless Edge:
  every seek returned the same first frame (an H.264 from After Effects; HEVC was not the
  cause, and the WinRT transcoder copy behaved the same). Instead play() it and capture with
  requestVideoFrameCallback into a contact-sheet canvas (a temporary tools/_play.html served by
  serve.py, screenshot with headless-shot, then deleted). The Shell "Video compression"
  property is empty for these files; the codec fourcc is readable from the mp4 stsd box.
  Reusable recipe (2026-11-10): the contact-sheet page also works from `file://` in the
  scratchpad next to a copy of the video (no server needed); give it `?step=0.033&cols=2&t0=1.4&t1=2.2`
  style params to zoom on a time window, pass `window.done` (a Promise) as the eval, and raise
  `SHOT_H` so the whole sheet is captured. A 4 s clip at 80 ms steps reads fine at 6 columns.
  headless-shot runs Edge with `--disable-gpu` (software raster), so GPU compositing artefacts
  never reproduce in it: see [[compositor-layer-pop-on-transitioned-text]].
- The Bash tool's git (Git for Windows under MSYS) refuses the repo with "dubious ownership"
  (seen 2026-10-21): `E:\Claude_Code\Projects\website` is owned by a different SID than the
  REDMOND user. Run `git config --global --add safe.directory E:/Claude_Code/Projects/website`
  once, or run git from the PowerShell tool, which has worked before. On 2026-11-11 PowerShell
  git hit it too; `git -c safe.directory=E:/Claude_Code/Projects/website ...` per command
  works without touching global config.
- Wrong GitHub account (2026-11-11): Git Credential Manager had the work login `v-andradej`
  cached for github.com, so `git push origin main` failed with 403 "Permission ... denied to
  v-andradej". Push to `https://pixelslayer81@github.com/pixelslayer81/website2027.git main` (origin now has the username in it)
  so GCM picks/asks for the pixelslayer81 account (opens a sign-in window, which can sit
  hidden and stall the command). Commits use the repo-local `user.email` joseph@pixelslayer.tv.
- Big history (~800 MB packed: demo MP4s, ref PNGs) fails a first push with HTTP 408 "RPC failed". Fix
  (2026-11-11): push one commit at a time, oldest first (`git rev-list --reverse main`, then
  `git push origin <sha>:refs/heads/main` each) with `-c http.postBuffer=524288000`.
