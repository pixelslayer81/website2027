// Page 00: Splash, the site's landing. Laid over the CT index (page 01): the
// site opens on its start frame and waits; CT Index plays the transition, which
// lands exactly on page 01's layout, so the last frame IS the CT index
// (reference: assets/splash_anim_ref_v001.mp4):
//   1. start frame: a masthead (PIXELSLAYER wordmark, rule, info row with the
//      Creative Tech / Motion Design buttons) over the girl video, inset by a
//      border; header as usual. It waits here until Creative Tech is clicked
//      (the header link or the masthead button). Motion Design (2026-11-11)
//      turns this start frame into the Motion Design index's (site.js
//      switchIndex swaps the index rows, headline and colours in place, no
//      reload, so the picture never drops out) and plays the same transition
//      into that index. On the Motion Design index (motion.html, a twin of the
//      home) the roles swap. Without the site's switch (no handler set) the
//      button falls back to opening the other page with a one-shot "play"
//      flag, which plays the transition from its start frame after a reload.
//   2. the photo rises to its CT index place, covering (masking off) the
//      masthead, while its borders open out and the picture parallaxes inside
//   3. DESIGN / & TECHNOLOGY rise into place through a mask inside the photo
//   4. as the photo lands, each project row gets the CT index's hover banner
//      wiped up through it, top-down, staggered with overlap; the row is
//      revealed behind it
// The root site.js calls mount(shadowRoot) on page 01 before its first frame
// (start frame) and ready() once page 01's own sketch has mounted; its header
// calls start() on CT Index (Pixelslayer.tv reloads back to the start frame).
// The transition only runs from the splash: CT Index from further down the
// site (sessionStorage "splash" = "skip" on its reload) or from the About page
// (index.html#intro) opens the CT index already formed. ?splash plays straight
// through, for previewing. Skipped for deep links (#hash), ?nosplash, a
// restored scroll position and reduced motion.
// Exposes window.SplashSketch = { wanted, mount, ready, waiting, start, unmount }.
// Classic script.

(function () {
"use strict";

const SPLASH = {
  // the start frame's masthead (2026-10-30 redesign, after the user's mockup)
  mark: "Pixelslayer",
  tags: ["[Creative Technologist]", "[3D &middot; Motion &middot; AI]", "[Est. 2005]"], // 2026-11-11: the last was "[20+ yrs]"
  meta: ["[AI Task Force] &middot; [Microsoft]", "[Est. 2005] &middot; Palm Springs"], // the credentials lines: right-aligned above the buttons (restored 2026-11-12)
  ctaTech: "[Creative Tech &rarr;]", // the home's own: plays the transition, like the header's Creative Tech
  ctaMotion: "[Motion Design &rarr;]", // the Motion Design index's own; on the home it hands over to motion.html (2026-11-11)
  handoff: 150, // ms on the start frame after arriving from the other index's splash, before the photo moves
  margin: 24, // px: the page margin; also the photo's left / right / bottom border on the start frame, at 1440 wide (live: style.css --splash-margin, measured)
  photoGap: 18, // px between the masthead's lowest button / info line and the photo's top edge at the start; fixed at every window size (2026-11-11)
  photoAt: 0.46, // the photo's top edge on the start frame, as a share of the window's height from its top (2026-11-11, the user's mockup); lower if the masthead needs the room
  flexShare: 0.325, // the open space above the tags / buttons, as a share of what photoAt leaves (2026-11-11: reduced 25%, then another 10%, then 50% (2026-11-12); 1 = the photo at photoAt)
  videoWait: 1500, // ms at most to wait for the video's first picture before starting
  hold: 450, // ms on the start frame (with the picture up) before the photo moves
  glitchMs: 1400, // ms the CT index glitch keeps spawning from the start of the transition
  widen: 1200, // ms for the border to open out to full bleed, over the whole rise; keep in step with style.css
  riseAfter: 0, // ms into the widen before the photo starts rising (0: together)
  parallax: 0.35, // the picture rises this much slower than its frame (a fraction of the drop)
  rise: 1200, // ms; keep in step with --splash-rise in style.css
  titleAt: 0.42, // DESIGN starts rising at this fraction of the rise
  titleStagger: 140, // ms between DESIGN and & TECHNOLOGY
  rowsAt: 0.8, // the row cascade starts at this fraction of the rise (as it lands)
  rowStagger: 90, // ms between rows (each wipe runs 600ms, so they overlap)
  rowCover: 260, // ms a banner takes to cover its row before it moves on
  headerH: 56, // the site header's height at 1440 wide; live value from siteHeaderH() (fluid since 2026-11-11)
};

let root = null; // page 01's shadow root
let page = null; // page 01's .page
let timers = [];
let running = false; // the splash owns page 01 (start frame or transition)
let isWaiting = false; // on the start frame, waiting for CT Index
let started = false;
let heroH = 0; // the photo box's CT index height
let onResize = null; // the start frame's resize handler (2026-11-11)
let resizeFrame = 0;
let fill = 0; // px from the box's top to the window's bottom on the start frame

const later = (ms, fn) => timers.push(setTimeout(fn, ms));
// the site header's live height (fluid since 2026-11-11); 56 when standalone
const siteHeaderH = () => {
  const h = document.querySelector(".site-header");
  return h ? h.getBoundingClientRect().height : SPLASH.headerH;
};

// which index this page is (2026-11-11): the home (Creative Tech) or the
// Motion Design index (motion.html, body.site-motion). Its own button plays the
// transition here; the other one hands over to the other page.
let own = document.body && document.body.classList.contains("site-motion") ? "motion" : "tech";
let otherHome = own === "motion" ? "index.html" : "motion.html";
let handOverHandler = null; // set by site.js: the in-place switch (switchIndex)

// The transition only ever runs from the splash. A CT Index click from further
// down the site reloads with a one-shot sessionStorage "skip" flag, and the
// About page links to index.html#intro, so both open on the CT index already
// formed. ?splash plays straight through, for previewing. A one-shot "play"
// flag (set by the other index's splash, 2026-11-11) does the same after a
// short handoff hold; it is the only way the Motion Design index shows the
// splash at all. Read once, at load.
const flag = (() => {
  let v = null;
  try {
    v = sessionStorage.getItem("splash");
    sessionStorage.removeItem("splash");
  } catch (err) {}
  return v;
})();
const autoplay = flag === "play" || /[?&]splash\b/.test(location.search);

function wanted() {
  if (flag === "skip") return false;
  if (own === "motion" && !autoplay) return false; // the Motion Design index opens formed unless a splash sent us here
  if (location.hash || /[?&]nosplash\b/.test(location.search)) return false;
  if (window.scrollY > 0) return false;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

/** Start frame: called before page 01 is first shown. */
function mount(shadowRoot) {
  root = shadowRoot;
  page = root.querySelector(".page");
  const hero = root.querySelector(".hero");
  if (!page || !hero) { page = null; return; }
  running = true;
  document.documentElement.style.overflow = "hidden"; // no scrolling until it lands

  heroH = hero.getBoundingClientRect().height; // the CT index height (the box never changes size)
  page.classList.add("splash");

  // the start frame's masthead: wordmark, rule, info row; the rising photo
  // covers (masks off) all of it
  const head = document.createElement("header");
  head.className = "splash__head";
  head.innerHTML = headHTML();
  page.prepend(head);
  const mine = head.querySelector(".splash__cta--own");
  if (mine) mine.addEventListener("click", start);
  const other = head.querySelector(".splash__cta:not(.splash__cta--own)");
  if (other) other.addEventListener("click", handOver);
  layout(head);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (running && !started) layout(head); });
  // the crop and parallax depend on the video's shape, known once it loads
  const vid = root.querySelector("video.hero__photo");
  if (vid && !vid.videoWidth) vid.addEventListener("loadedmetadata", () => { if (running && !started) layout(head); }, { once: true });
  // 2026-11-11: the layout is fluid, so the masthead and the photo box change
  // size with the window: re-measure both on resize (once per frame), or the
  // photo would sit over the buttons / info after the window shrinks
  onResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!running || started) return;
      heroH = hero.getBoundingClientRect().height;
      layout(head);
    });
  };
  window.addEventListener("resize", onResize);

  for (const row of root.querySelectorAll(".index__row")) row.classList.add("is-pre");
}

function headHTML() {
  const s = SPLASH;
  const tags = s.tags.map((t) => `<li>${t}</li>`).join("");
  const meta = s.meta.map((line) => `<span>${line}</span>`).join("");
  return `
    <h1 class="splash__mark">${s.mark}</h1>
    <div class="splash__info">
      ${meta ? `<p class="splash__meta">${meta}</p>` : ""}
      <ul class="splash__tags">${tags}</ul>
      <div class="splash__ctas">
        <button type="button" class="splash__cta splash__cta--tech${own === "tech" ? " splash__cta--own" : ""}">${s.ctaTech}</button>
        <button type="button" class="splash__cta splash__cta--motion${own === "motion" ? " splash__cta--own" : ""}">${s.ctaMotion}</button>
      </div>
    </div>`;
}

/** Where the photo starts (just under the masthead) and its borders: left /
    right / bottom, all the page margin. The bottom one is a clip measured from
    the box's own bottom, so it can sit below the box (a negative inset) on a
    tall window, where the picture runs past the box. */
function layout(head) {
  // fluid since 2026-11-11: the margin is style.css --splash-margin (the
  // masthead's side padding), measured; photoGap scales with it
  const gap = parseFloat(getComputedStyle(head).paddingLeft) || SPLASH.margin;
  // 2026-11-11: the photo always sits exactly photoGap (18px, never scaled)
  // under the lowest of the masthead's buttons / info lines, measured, so the
  // gap holds at every window size and however the text wraps
  // (measured at the masthead's natural height: the least room it needs)
  page.style.removeProperty("--splash-head-h");
  const headTop = head.getBoundingClientRect().top;
  let low = head.offsetHeight;
  head.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height) low = Math.max(low, r.bottom - headTop);
  });
  const minDrop = Math.round(head.offsetTop + low + SPLASH.photoGap);
  // 2026-11-11 (the user's mockup): the photo's top sits photoAt of the way
  // down the window; the masthead stretches to fill the room above it, its
  // tags and buttons at the bottom, photoGap above the photo. Never higher
  // than the masthead needs.
  const page0 = page.getBoundingClientRect().top + window.scrollY; // the page's top in the document (under the site header)
  // the open space between the rule and the tags / buttons is flexShare of
  // what photoAt alone would leave (2026-11-11: 25% less)
  const room = Math.max(0, window.innerHeight * SPLASH.photoAt - page0 - minDrop);
  const drop = Math.round(minDrop + room * SPLASH.flexShare);
  page.style.setProperty("--splash-head-h", `${drop - SPLASH.photoGap - head.offsetTop}px`);
  page.style.setProperty("--splash-drop", `${drop}px`);
  page.style.setProperty("--splash-gap", `${gap}px`);
  // on the start frame the photo shows down to the window's bottom (less its
  // border; full bleed since 2026-11-11, so no border), whatever the window's shape
  fill = window.innerHeight - siteHeaderH() - drop;
  // parallax: the picture starts up to this far up inside its frame and drifts
  // down to rest as the frame rises, so it moves slower than the frame. It is
  // never scaled, so it is only so tall (the width-fitted video): on tall
  // windows the head start shrinks so it still reaches the bottom border
  // (when the video is too short even then, the border grows)
  const vid = root.querySelector(".hero__photo");
  const aspect = vid && vid.videoWidth ? vid.videoHeight / vid.videoWidth : 9 / 16;
  const picH = page.getBoundingClientRect().width * aspect;
  // the CT index crops the (taller) video at --hero-focus-y of the spare height
  const focus = parseFloat(getComputedStyle(page).getPropertyValue("--hero-focus-y")) || 0;
  const shift = Math.max(0, picH - heroH) * focus;
  page.style.setProperty("--splash-shift", `${shift.toFixed(1)}px`);
  const par = Math.max(0, Math.min(drop * SPLASH.parallax, picH - shift - fill));
  page.style.setProperty("--splash-par", `${Math.round(par)}px`);
  page.style.setProperty("--splash-clip-b", `${(heroH - fill).toFixed(1)}px`);
}

/** Page 01's sketch has mounted (its row banners exist): wait on the start
    frame for CT Index, or play straight through after a CT Index reload. */
function ready() {
  if (!running || !page) return;
  isWaiting = true;
  if (autoplay) play(flag === "play" ? SPLASH.handoff : SPLASH.hold);
}

/** The page's own index button on the start frame. */
function start() {
  play(0);
}

/** The other index's button on the start frame (2026-11-11): the site swaps
    this start frame into the other index's and plays the transition in place
    (onHandOver); without that, over to that page, which opens on the same
    start frame and plays. */
function handOver() {
  if (!waiting()) return;
  if (handOverHandler) { handOverHandler(own === "motion" ? "tech" : "motion"); return; }
  try { sessionStorage.setItem("splash", "play"); } catch (err) {}
  location.href = otherHome;
}
function onHandOver(fn) { handOverHandler = fn; }

/** The page has become the other index (site.js switchIndex, 2026-11-11):
    swap which masthead button is the page's own, and hide the new rows until
    their wipe, like the originals. */
function setOwn(which) {
  own = which;
  otherHome = own === "motion" ? "index.html" : "motion.html";
  if (!root) return;
  const tech = root.querySelector(".splash__cta--tech"), motion = root.querySelector(".splash__cta--motion");
  if (tech) tech.classList.toggle("splash__cta--own", own === "tech");
  if (motion) motion.classList.toggle("splash__cta--own", own === "motion");
  for (const row of root.querySelectorAll(".index__row")) row.classList.add("is-pre");
}

function waiting() {
  return isWaiting && !started;
}

function play(hold) {
  if (!running || !page || started) return;
  started = true;
  isWaiting = false;
  // the girl has to be on screen from the first frame: hold the timeline until
  // the video has a picture (or SPLASH.videoWait passes)
  const vid = root.querySelector("video.hero__photo");
  if (vid && vid.readyState < 2) {
    let go = () => { go = null; run(hold); };
    vid.addEventListener("loadeddata", () => go && go(), { once: true });
    later(SPLASH.videoWait, () => go && go());
    return;
  }
  run(hold);
}

function run(hold) {
  if (!running || !page) return;
  const rise = SPLASH.rise;
  // the bordered photo opens out to full bleed in X first; the rise (with its
  // parallax) starts partway into that
  later(hold, () => {
    void page.offsetHeight; // commit the start frame before the transition
    page.classList.add("is-wide");
    // the CT index's glitch kicks in with the transition (its layer shows
    // from is-wide on, see style.css)
    if (window.IntroSketch && window.IntroSketch.burst) window.IntroSketch.burst(SPLASH.glitchMs);
  });
  const up = hold + SPLASH.riseAfter;
  later(up, () => page.classList.add("is-rising"));
  const titles = [root.querySelector(".hero__design"), root.querySelector(".hero__sub")];
  titles.forEach((t, i) => {
    if (t) later(up + rise * SPLASH.titleAt + i * SPLASH.titleStagger, () => t.classList.add("is-in"));
  });
  const rows = Array.from(root.querySelectorAll(".index__row"));
  const rowsStart = up + rise * SPLASH.rowsAt;
  rows.forEach((row, i) => later(rowsStart + i * SPLASH.rowStagger, () => wipeRow(row)));
  // done: the last wipe has left its row, and the photo has settled
  const end = Math.max(up + rise, hold + SPLASH.widen, rowsStart + (rows.length - 1) * SPLASH.rowStagger + SPLASH.rowCover + 650);
  later(end, finish);
}

/** The CT index hover banner, run once: up into the row from below, then out by the top. */
function wipeRow(row) {
  const m = row.querySelector(".marquee");
  if (!m) { row.classList.remove("is-pre"); return; }
  row.classList.add("is-wiping");
  const inner = m.querySelector(".marquee__inner");
  const park = (sign) => {
    m.style.transform = `translate3d(0, ${sign * 101}%, 0)`;
    if (inner) inner.style.transform = `translate3d(0, ${-sign * 101}%, 0)`;
  };
  m.classList.add("is-snapping");
  park(1); // below the row
  void m.offsetHeight;
  m.classList.remove("is-snapping");
  m.style.transform = "translate3d(0, 0, 0)";
  if (inner) inner.style.transform = "translate3d(0, 0, 0)";
  later(SPLASH.rowCover, () => {
    row.classList.remove("is-pre");
    park(-1); // out by the top, revealing the row
  });
}

/** Hand the page back as the plain CT index. */
function finish() {
  if (!page) return;
  running = false;
  if (onResize) window.removeEventListener("resize", onResize);
  onResize = null;
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = 0;
  for (const t of timers) clearTimeout(t);
  timers = [];
  const head = page.querySelector(".splash__head");
  if (head) head.remove();
  for (const el of root.querySelectorAll(".splash .is-in, .splash .is-pre, .splash .is-wiping")) el.classList.remove("is-in", "is-pre", "is-wiping");
  page.classList.remove("splash", "is-wide", "is-rising");
  page.style.removeProperty("--splash-drop");
  page.style.removeProperty("--splash-head-h");
  page.style.removeProperty("--splash-clip-b");
  page.style.removeProperty("--splash-par");
  page.style.removeProperty("--splash-shift");
  page.style.removeProperty("--splash-gap");
  document.documentElement.style.overflow = "";
}

function unmount() {
  finish();
  root = null;
  page = null;
}

window.SplashSketch = { wanted, mount, ready, waiting, start, handOver, onHandOver, setOwn, unmount };
})();
