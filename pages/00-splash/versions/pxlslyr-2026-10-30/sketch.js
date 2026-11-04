// Page 00: Splash, the site's landing. Laid over the CT index (page 01): the
// site opens on its start frame and waits; CT Index plays the transition, which
// lands exactly on page 01's layout, so the last frame IS the CT index
// (reference: assets/splash_anim_ref_v001.mp4):
//   1. start frame: the girl video, lowered under a big red PXLSLYR!; header
//      as usual. It waits here until CT Index is clicked.
//   2. the photo rises to its CT index place, covering (masking off) the type
//      and panning from the bottom of the video to its top
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
  type: "PXLSLYR!",
  dropOfView: 0.39, // the photo starts this far down the area under the header (reference: 330 of 844)
  typeGap: 6, // px between the type's box and the photo's top edge at the start
  videoWait: 1500, // ms at most to wait for the video's first picture before starting
  hold: 450, // ms on the start frame (with the picture up) before the photo moves
  typeLeft: 24, // the type's left (style.css .splash__type left); the photo's border matches the ink gap
  widen: 1200, // ms for the border to open out to full bleed, over the whole rise; keep in step with style.css
  riseAfter: 0, // ms into the widen before the photo starts rising (0: together)
  parallax: 0.35, // the picture rises this much slower than its frame (a fraction of the drop)
  rise: 1200, // ms; keep in step with --splash-rise in style.css
  titleAt: 0.42, // DESIGN starts rising at this fraction of the rise
  titleStagger: 140, // ms between DESIGN and & TECHNOLOGY
  rowsAt: 0.8, // the row cascade starts at this fraction of the rise (as it lands)
  rowStagger: 90, // ms between rows (each wipe runs 600ms, so they overlap)
  rowCover: 260, // ms a banner takes to cover its row before it moves on
  headerH: 56, // the site header's height (site.css --header-h)
};

let root = null; // page 01's shadow root
let page = null; // page 01's .page
let timers = [];
let running = false; // the splash owns page 01 (start frame or transition)
let isWaiting = false; // on the start frame, waiting for CT Index
let started = false;
let heroH = 0; // the photo box's CT index height
let fill = 0; // px from the box's top to the window's bottom on the start frame
let parWanted = 0; // the parallax head start before the tall-window clamp

const later = (ms, fn) => timers.push(setTimeout(fn, ms));

// The transition only ever runs from the splash. A CT Index click from further
// down the site reloads with a one-shot sessionStorage "skip" flag, and the
// About page links to index.html#intro, so both open on the CT index already
// formed. ?splash plays straight through, for previewing. Read once, at load.
const flag = (() => {
  let v = null;
  try {
    v = sessionStorage.getItem("splash");
    sessionStorage.removeItem("splash");
  } catch (err) {}
  return v;
})();
const autoplay = /[?&]splash\b/.test(location.search);

function wanted() {
  if (flag === "skip") return false;
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
  const drop = Math.round((window.innerHeight - SPLASH.headerH) * SPLASH.dropOfView);
  page.style.setProperty("--splash-drop", `${drop}px`);
  // on the start frame the photo shows down to the window's bottom (less its
  // border), whatever the window's shape
  fill = window.innerHeight - SPLASH.headerH - drop;

  const type = document.createElement("p");
  type.className = "splash__type";
  type.setAttribute("aria-hidden", "true");
  type.textContent = SPLASH.type;
  page.prepend(type);
  // sit the type's box just above the photo's starting top edge
  page.style.setProperty("--splash-type-top", `${drop - type.offsetHeight - SPLASH.typeGap}px`);
  // parallax: the picture starts this far up inside its frame and drifts down
  // to rest as the frame rises, so it moves slower than the frame
  parWanted = Math.round(drop * SPLASH.parallax); // set (clamped) in setBorder
  setBorder(type);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (running && !started) setBorder(type); });

  for (const row of root.querySelectorAll(".index__row")) row.classList.add("is-pre");
}

/** The photo's left / right / bottom border on the start frame: the gap between
    the window's left edge and the ink of the type's first letter. The bottom one
    is a clip measured from the box's own bottom, so it can sit below the box
    (a negative inset) on a tall window, where the picture runs past the box. */
function setBorder(type) {
  const cs = getComputedStyle(type);
  let gap = SPLASH.typeLeft;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(SPLASH.type.charAt(0));
    if (Number.isFinite(m.actualBoundingBoxLeft)) gap = SPLASH.typeLeft - m.actualBoundingBoxLeft;
  } catch (err) {}
  gap = Math.max(0, gap);
  page.style.setProperty("--splash-gap", `${gap.toFixed(1)}px`);
  // the picture is never scaled, so it is only so tall (the width-fitted video);
  // shrink the parallax head start on tall windows so it still reaches the
  // bottom border (when the video is too short even then, the border grows)
  const vid = root.querySelector(".hero__photo");
  const aspect = vid && vid.videoWidth ? vid.videoHeight / vid.videoWidth : 9 / 16;
  const picH = page.getBoundingClientRect().width * aspect;
  const par = Math.max(0, Math.min(parWanted, picH - (fill - gap)));
  page.style.setProperty("--splash-par", `${Math.round(par)}px`);
  page.style.setProperty("--splash-clip-b", `${(heroH - (fill - gap)).toFixed(1)}px`);
}

/** Page 01's sketch has mounted (its row banners exist): wait on the start
    frame for CT Index, or play straight through after a CT Index reload. */
function ready() {
  if (!running || !page) return;
  isWaiting = true;
  if (autoplay) play(SPLASH.hold);
}

/** CT Index on the start frame. */
function start() {
  play(0);
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
  for (const t of timers) clearTimeout(t);
  timers = [];
  const type = page.querySelector(".splash__type");
  if (type) type.remove();
  for (const el of root.querySelectorAll(".splash .is-in, .splash .is-pre, .splash .is-wiping")) el.classList.remove("is-in", "is-pre", "is-wiping");
  page.classList.remove("splash", "is-wide", "is-rising");
  page.style.removeProperty("--splash-drop");
  page.style.removeProperty("--splash-type-top");
  page.style.removeProperty("--splash-clip-b");
  page.style.removeProperty("--splash-par");
  page.style.removeProperty("--splash-gap");
  document.documentElement.style.overflow = "";
}

function unmount() {
  finish();
  root = null;
  page = null;
}

window.SplashSketch = { wanted, mount, ready, waiting, start, unmount };
})();
