---
name: dark-mode-home-and-about
description: Light/dark switch (2026-11-10) exists only on the home and About pages; how the theme reaches shadow roots, the About page and the flock drawing, and what stays hard-coded
metadata:
  type: project
---

Added 2026-11-10 at the user's request, and made the DEFAULT the same day (a new visitor gets dark; light only when chosen): a "Light mode" / "Dark mode" button at the right end
of the header nav (after About) on `index.html` and `pages/09-about/index.html` only. Dark
replaces the warm white `--bg` with `#222221`; the red accent is unchanged. The user was
explicit that the project pages (`intro.html`, `styleshift.html`, ...) must stay light.

**Why:** the mechanism is split across files in a non-obvious way:
- `shared/theme.js` (loaded in `<head>`) sets `data-theme="dark"` on `<html>`; the tokens flip in
  `shared/tokens.css` under `:root[data-theme="dark"]`. Custom properties inherit into the
  pages' shadow roots, so page 01 and the splash follow with no change of their own
  (`--cream: var(--bg)`).
- The About page redefines `--bg`, `--text`, `--ink`, `--paper` on its own `:root`, so it
  carries its own `:root[data-theme="dark"]` block in `pages/09-about/style.css`; a new
  colour there needs a dark value too.
- Site chrome colours went from hard-coded `#1b1a19` to `--ui-ink` / `--ui-ink-contrast` /
  `--ui-rule` (site.css, splash style.css). Use those, not literals, for header/masthead type.
- The flock sketch reads `--bg` / `--pencil-rgb` once at mount; it now also listens for the
  `themechange` event theme.js fires on `window`. In dark mode `--pencil-rgb` is a light
  graphite and the About front canvas drops `mix-blend-mode: multiply` (light lines vanish
  under multiply on a dark page). Boids already drawn keep their old pencil.
- The project pages never load theme.js, so a stored dark choice does not reach them.

**How to apply:** when adding a page that should follow the theme, load
`shared/theme.js` in its head, add the button markup from index.html, and avoid literal
ink colours. `?theme=dark` / `?theme=light` on a URL forces and stores a mode (used for
headless checks). Button styling: `.site-theme` / `.site-theme__dot` in site.css (empty dot =
light, filled = dark). See [[splash-page-00]], [[flock-page-02-rendering-architecture]].
