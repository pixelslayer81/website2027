// Hero site loader. For every <section class="site-page" data-page="NN-slug">
// in the root index.html, in document order: fetch pages/NN-slug/index.html,
// put its body into the section's shadow root together with reset.css and the
// page's own style.css, load the page's scripts once into this document, and
// call its window.<Name>Sketch.mount(...). Shadow roots keep each page's CSS
// and ids to itself, so the pages stay independent and need no build step.
// Classic script (no modules), like the pages.

(function () {
"use strict";

const sections = Array.from(document.querySelectorAll(".site-page[data-page]"));
const sectionIdFor = {}; // "03-styleshift" -> "styleshift"
for (const s of sections) sectionIdFor[s.dataset.page] = s.id;

// Where every page lives. Since 2026-11-04 each project has its own root HTML
// file (the home, index.html, is the splash + CT index + AI Task Force). A
// ../NN-slug/index.html link to a page in this document jumps to its section;
// any other goes to the file here. Add a row when a page gets its own file.
const PAGE_HOME = {
  "01-intro": "index.html#intro",
  "02-flock": "intro.html", // 2026-11-05: its own page, (00) Intro in the CT index
  "03-styleshift": "styleshift.html",
  "04-always-on-social": "always-on-social.html",
  "05-exporter": "exporter.html",
  "06-azure-retexture": "azure-retexture.html",
  "07-excel": "excel.html",
  "08-excel-cell-art": "excel.html#excel-cell-art",
  "09-about": "pages/09-about/index.html",
};

const loadedScripts = new Set();

// The splash (pages/00-splash) is the site's landing, laid over the first page:
// its styles go into that page's shadow root, it sets the start frame before
// the page is first shown, and is handed the page once the page's own sketch
// has mounted (it then waits for CT Index, or plays if that click reloaded us).
const splash = window.SplashSketch && sections.length && window.SplashSketch.wanted() ? window.SplashSketch : null;

// On a local dev server every page file gets a fresh query string, so an edit
// shows on plain reload instead of the browser reusing a cached style.css or
// sketch.js. Hosted (GitHub Pages etc.) the URLs stay clean and cacheable.
const DEV = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
const stamp = Date.now().toString(36);
const fresh = (url) => (DEV ? url + (url.includes("?") ? "&" : "?") + "v=" + stamp : url);

function isRelative(url) {
  return url && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(url);
}

/** Rewrite one URL written relative to pages/<slug>/ so it resolves from the root. */
function rebase(url, slug) {
  if (!isRelative(url)) return url;
  // ../NN-slug/index.html -> #<section id> when that page is in this document,
  // else to the file it lives in (PAGE_HOME)
  const m = url.match(/^\.\.\/(\d\d-[\w-]+)\/(?:index\.html)?(#.*)?$/);
  if (m && sectionIdFor[m[1]]) return "#" + sectionIdFor[m[1]];
  if (m && PAGE_HOME[m[1]]) return PAGE_HOME[m[1]];
  if (url.startsWith("../../shared/")) return "shared/" + url.slice("../../shared/".length);
  // normalise "../" so a file two pages share (a sketch used as another page's
  // background) resolves to one URL and loads once
  return new URL(`pages/${slug}/${url}`, "http://x/").pathname.slice(1);
}

function rebaseTree(rootEl, slug) {
  const attrs = ["src", "href", "poster"];
  for (const el of rootEl.querySelectorAll("*")) {
    for (const a of attrs) {
      if (el.hasAttribute(a)) el.setAttribute(a, rebase(el.getAttribute(a), slug));
    }
    if (el.hasAttribute("srcset")) {
      el.setAttribute("srcset", el.getAttribute("srcset").split(",").map((part) => {
        const [u, d] = part.trim().split(/\s+/, 2);
        return rebase(u, slug) + (d ? " " + d : "");
      }).join(", "));
    }
  }
}

function loadStyle(shadow, href) {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fresh(href);
    link.onload = resolve;
    link.onerror = resolve; // a missing sheet must not stall the page
    shadow.appendChild(link);
  });
}

function loadScript(src) {
  if (loadedScripts.has(src)) return Promise.resolve();
  loadedScripts.add(src);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = fresh(src);
    s.onload = resolve;
    s.onerror = () => reject(new Error("script failed: " + src));
    document.body.appendChild(s);
  });
}

async function mountPage(section) {
  const slug = section.dataset.page;
  const res = await fetch(fresh(`pages/${slug}/index.html`), { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} for ${slug}`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");

  // the page's scripts: external ones load in order; the inline one names the sketch global
  const scripts = Array.from(doc.querySelectorAll("script"));
  const external = scripts.filter((s) => s.getAttribute("src")).map((s) => rebase(s.getAttribute("src"), slug));
  const inline = scripts.filter((s) => !s.getAttribute("src")).map((s) => s.textContent).join("\n");
  const global = (inline.match(/window\.(\w+Sketch)\.mount/) || [])[1];
  for (const s of scripts) s.remove();

  rebaseTree(doc.body, slug);

  const shadow = section.attachShadow({ mode: "open" });
  const withSplash = splash && section === sections[0];
  const styles = [loadStyle(shadow, "shared/reset.css"), loadStyle(shadow, `pages/${slug}/style.css`)];
  if (withSplash) styles.push(loadStyle(shadow, "pages/00-splash/style.css"));
  await Promise.all(styles);
  for (const node of Array.from(doc.body.childNodes)) shadow.appendChild(document.adoptNode(node));
  if (withSplash) splash.mount(shadow); // start frame, before the page is first drawn

  for (const src of external) await loadScript(src);
  const page = shadow.getElementById("page") || shadow.firstElementChild;
  if (global && window[global] && typeof window[global].mount === "function") {
    window[global].mount(page);
  } else {
    console.warn(`site: no mountable sketch global for ${slug}`, global);
  }
  if (withSplash) splash.ready();
  section.classList.add("site-page--ready");
}

function jumpToHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
}

// The header and the splash (pages/00-splash), which is the site's landing:
// - Pixelslayer.tv goes to the splash: the whole site reloads at the top and
//   waits on the splash's start frame (nothing to do if it is already there).
// - CT Index on the waiting splash plays the transition into the CT index (the
//   only place it runs). From anywhere else it reloads the whole site (every
//   page starts over, the Excel journey included) onto the CT index already
//   formed, no splash (a one-shot sessionStorage flag tells the reload to).
// Both reloads drop the hash and the restored scroll position.
function mountHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  header.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || a.getAttribute("href") !== "#intro") return;
    e.preventDefault();
    const waiting = splash && splash.waiting();
    if (a.id === "site-index" && waiting) { splash.start(); return; }
    if (a.id !== "site-index" && waiting) return; // already on the splash
    history.replaceState(null, "", location.pathname);
    history.scrollRestoration = "manual"; // the reload opens at the top, not where the page was
    if (a.id === "site-index") {
      try { sessionStorage.setItem("splash", "skip"); } catch (err) {} // straight to the CT index, formed
    }
    location.reload();
  });
}

// 2026-11-05: a section with data-height-of="NN-slug" is made as tall as that
// page would be on its own (intro.html: the AI Task Force as tall as the home's
// CT index). The other page is laid out invisibly off screen (its markup and
// CSS only: no scripts, no media), measured, and its height handed to the
// section's page as --page-h (custom properties reach into the shadow root);
// measured again whenever its layout changes (fonts loading, resizes).
async function matchHeight(section) {
  const slug = section.dataset.heightOf;
  if (!slug) return;
  const res = await fetch(fresh(`pages/${slug}/index.html`), { cache: "no-cache" });
  if (!res.ok) return;
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  for (const s of doc.querySelectorAll("script")) s.remove();
  for (const el of doc.querySelectorAll("[src], [srcset], [poster]")) {
    el.removeAttribute("src"); el.removeAttribute("srcset"); el.removeAttribute("poster");
  }
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-200vw;top:0;width:100%;visibility:hidden;pointer-events:none;";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  await Promise.all([loadStyle(shadow, "shared/reset.css"), loadStyle(shadow, `pages/${slug}/style.css`)]);
  for (const node of Array.from(doc.body.childNodes)) shadow.appendChild(document.adoptNode(node));
  const measure = () => {
    const page = shadow.getElementById("page") || shadow.firstElementChild;
    // (data-height-adjust: px added to that height, e.g. -100 on intro.html)
    const adjust = parseFloat(section.dataset.heightAdjust) || 0;
    if (page) section.style.setProperty("--page-h", (page.getBoundingClientRect().height + adjust) + "px");
  };
  measure();
  // again whenever its layout changes: the web fonts arriving (they set the
  // rows' height), a resize
  const page = shadow.getElementById("page") || shadow.firstElementChild;
  if (page && window.ResizeObserver) new ResizeObserver(measure).observe(page);
  else window.addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
}

async function main() {
  mountHeader();
  try {
    for (const section of sections) await matchHeight(section);
    for (const section of sections) await mountPage(section);
  } catch (err) {
    console.error("site: could not load the pages", err);
    const fb = document.getElementById("site-fallback");
    if (fb) fb.hidden = false;
    document.getElementById("site").hidden = true;
    return;
  }
  // the browser's own hash jump happened before any content existed
  jumpToHash();
}

main();
})();
