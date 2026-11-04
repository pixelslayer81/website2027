# website

A scroll-through, blog-style site about projects, built one page at a time and stitched together at runtime. Plain HTML, CSS and JS with no build step.

## Layout

```
index.html          The stitched site: one <section data-page="NN-slug"> per page, in scroll order
site.js, site.css   The loader: fetches each page into its section's shadow root and mounts its sketch
shared/             reset.css, tokens.css (brand values), fonts/
pages/NN-slug/      One folder per page: index.html, style.css, sketch.js
```

- The two-digit prefix is the scroll order of the final site.
- Each page is self-contained except for `shared/`.
- Each `sketch.js` is a classic script (not an ES module, so pages work from `file://` with no server) that exposes `window.<Name>Sketch = { mount(container), unmount() }` so the final site can host it as one full-viewport section.
- Pages are designed as full-viewport sections (`100vw x 100vh`). The reference frame for layout and screenshots is 1440 x 900.

## Stitching rules

The root `index.html` loads each page by `fetch`, so it needs a web server; the pages themselves
still open from `file://`. On localhost the loader adds a `?v=` stamp to every page file it loads,
so a browser never reuses a stale `style.css` or `sketch.js`; hosted, the URLs stay cacheable. Shadow roots keep each page's CSS and ids private, so a page only has
to follow these conventions to work both ways:

- Declare custom properties on `:root, :host` and copy the page's `body` background / font /
  colour into a `:host { display: block; ... }` rule (the section stands in for `body`).
- In `sketch.js`, resolve asset URLs through `asset("assets/...")`, which is built from
  `document.currentScript.src`; never `document.getElementById` (use the mount container, or
  `root.getRootNode().getElementById` for elements outside `<main>`).
- A link to another page written as `../NN-slug/index.html` becomes a jump to that page's
  section (`#intro`, `#about`, `#styleshift`).
- To add a page: create `pages/NN-slug/`, then add one `<section class="site-page" id="..."
  data-page="NN-slug">` to the root `index.html` in scroll order.
- `pages/00-splash/` is not a section: it is the site's landing, laid over page 01. The site
  opens on its start frame and waits; the header's CT Index plays the transition, which lands on
  the CT index layout; Pixelslayer.tv reloads back to the start frame. The transition only runs
  from the splash: CT Index from further down the site reloads onto the CT index already formed
  (one-shot `sessionStorage` "skip" flag), and the About page links to `index.html#intro`, which
  does the same. `?splash` plays it straight through, for previewing. The root `index.html` loads its `sketch.js` before `site.js`;
  `site.js` adds its `style.css` to page 01's shadow root, calls `SplashSketch.mount(shadow)`
  before the page is first drawn and `ready()` once page 01's sketch has mounted, and its header
  calls `start()`. It drives page 01's own elements (`.hero`, `.hero__photo`, `.hero__design`,
  `.hero__sub`, `.index__row`, `.marquee`), so renaming those breaks it. Skipped for `#hash`
  links, a restored scroll position, reduced motion, and `?nosplash`.

## Preview

Stitched site (needs a server): from the repo root run `python -I tools/serve.py` (http.server with
no-cache headers, so edits show on a plain reload), then open `http://127.0.0.1:8080/`.

A single page: open `pages/NN-slug/index.html` directly, e.g. `Start-Process pages\02-flock\index.html`.
