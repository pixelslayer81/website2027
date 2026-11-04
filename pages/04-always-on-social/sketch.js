// Page 04: Always On Social. Doubles the PRESSPLAY marquee track so its drift
// loops seamlessly, and opens the app card large (the Press play viewer) when
// a PRESSPLAY word is clicked. The card is a render; a video will replace it.
// Exposes window.AlwaysOnSocialSketch = { mount(container), unmount() } so the
// stitched site can host it as one section. Classic script (not a module) so
// the page works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

let listeners = [];
let root;

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}
const $ = (sel) => root.querySelector(sel);

// ------------------------------------------------------------- marquee

function mountMarquee() {
  const track = $("#marquee-track");
  if (!track || track.dataset.doubled) return;
  // a second copy of the items, so translateX(-50%) lands exactly on the first
  track.innerHTML += track.innerHTML;
  track.dataset.doubled = "1";
}

// ------------------------------------------------------------- draw-on

// Every .draw element (the title, the statement) fills in letter by letter
// as the user scrolls: progress 0 when its top enters the lower part of the
// viewport, 1 when its bottom has risen to mid-screen. Progress maps onto
// the letters in reading order.
const DRAW_START = 0.92; // element top at this fraction of the viewport height -> 0
const DRAW_END = 0.5;    // element bottom at this fraction -> 1
let drawTargets = []; // { el, letters, lit }
let drawRaf = 0;

function splitLetters(el) {
  const letters = [];
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  for (const [i, word] of words.entries()) {
    const w = document.createElement("span");
    w.className = "w";
    for (const ch of word) {
      const c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      w.appendChild(c);
      letters.push(c);
    }
    el.appendChild(w);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
  }
  return letters;
}

function mountDrawOn() {
  for (const el of root.querySelectorAll(".draw")) {
    if (el.dataset.split) continue;
    drawTargets.push({ el, letters: splitLetters(el), lit: -1 });
    el.dataset.split = "1";
  }
  if (!drawTargets.length) return;
  const onScroll = () => { if (!drawRaf) drawRaf = requestAnimationFrame(drawOn); };
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", onScroll);
  drawOn();
}

function drawOn() {
  drawRaf = 0;
  const vh = window.innerHeight;
  for (const t of drawTargets) {
    const r = t.el.getBoundingClientRect();
    const from = vh * DRAW_START;          // where the top starts the fill
    const to = vh * DRAW_END - r.height;   // where the top is when the fill ends
    const p = Math.min(1, Math.max(0, (from - r.top) / (from - to)));
    const lit = Math.round(p * t.letters.length);
    if (lit === t.lit) continue;
    for (let i = 0; i < t.letters.length; i++) t.letters[i].classList.toggle("on", i < lit);
    t.lit = lit;
  }
}

// ---------------------------------------------------------- system rise

// The Touchstone System heading rises from behind the still once it is well
// in view; scrolling it fully out resets it, so it plays again on return.
let systemObserver = null;

function mountSystemRise() {
  const title = $("#system-title");
  if (!title) return;
  if (typeof IntersectionObserver === "undefined" || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    title.classList.add("is-in");
    return;
  }
  systemObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) title.classList.add("is-in");
      else if (!e.isIntersecting) title.classList.remove("is-in");
    }
  }, { threshold: [0, 0.6] });
  systemObserver.observe(title);
}

// -------------------------------------------------------------- viewer

// The viewer sits outside <main>: look it up in whatever tree holds the page
// (the document on its own, a shadow root in the stitched site).
const byId = (id) => root.getRootNode().getElementById(id);

// the two demo videos: the app card / PRESSPLAY marquee play the social
// reel, the Touchstone still plays the system demo
const SOCIAL_VIDEO = "assets/social.mp4";
const DEMO_VIDEO = "assets/Touchstone_Demo_video_v06.mp4";

/** Open the viewer with a video (the card image stays hidden). */
function openVideoViewer(src, label) {
  const v = byId("viewer");
  const video = byId("viewer-video");
  if (!v || !video) return;
  byId("viewer-img").hidden = true;
  video.hidden = false;
  byId("viewer-label").textContent = label;
  const url = asset(src);
  if (video.getAttribute("src") !== url) { video.src = url; video.load(); } // loaded on first play only
  v.hidden = false;
  document.body.style.overflow = "hidden";
  const p = video.play();
  if (p && p.catch) p.catch(() => {}); // autoplay refusal: the controls are there
}

/** Press play on the app card or a PRESSPLAY word: the social reel. */
function openViewer() {
  openVideoViewer(SOCIAL_VIDEO, "Always On Social");
}

function closeViewer() {
  const v = byId("viewer");
  if (!v || v.hidden) return;
  const video = byId("viewer-video");
  if (video && !video.hidden) video.pause();
  v.hidden = true;
  document.body.style.overflow = "";
}

function mountViewer() {
  const v = byId("viewer");
  if (!v) return;
  on($("#marquee"), "click", openViewer);
  on($("#btn-play"), "click", openViewer);
  on($("#btn-system-play"), "click", () => openVideoViewer(DEMO_VIDEO, "Touchstone System"));
  on(v, "click", (e) => {
    // the stage keeps its clicks, except the picture itself, which closes
    if (e.target.closest(".viewer-stage") && e.target.id !== "viewer-img") return;
    closeViewer();
  });
  on(byId("viewer-close"), "click", closeViewer);
  on(window, "keydown", (e) => { if (e.key === "Escape") closeViewer(); });
}

// ------------------------------------------------------------------ api

// ------------------------------------------------------- system parallax

// As the system still scrolls past, the picture drifts against the scroll
// inside its frame (reads slower) and Press play runs with it (reads faster),
// as on the Style Shift stage. Offsets are zero when the still is centred.
const SYSTEM_PARALLAX = {
  on: true,
  image: 0.07, // picture travel, as a fraction of the frame height, either side of centre
  zoom: 1.16, // picture scale, so its drift never shows the frame edge
  type: 0.12, // Press play travel, as a fraction of the frame height
};

let systemRaf = 0;

function updateSystemParallax() {
  systemRaf = 0;
  const m = $(".system-media");
  if (!m) return;
  const r = m.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  // -1 when the still has just left the top, +1 when it is just entering below
  const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / ((vh + r.height) / 2)));
  m.style.setProperty("--px-img", `${(-p * r.height * SYSTEM_PARALLAX.image).toFixed(1)}px`);
  m.style.setProperty("--px-type", `${(p * r.height * SYSTEM_PARALLAX.type).toFixed(1)}px`);
}

function mountSystemParallax() {
  const m = $(".system-media");
  if (!SYSTEM_PARALLAX.on || !m) return;
  m.style.setProperty("--px-zoom", String(SYSTEM_PARALLAX.zoom));
  const queue = () => { if (!systemRaf) systemRaf = requestAnimationFrame(updateSystemParallax); };
  on(window, "scroll", queue, { passive: true });
  on(window, "resize", queue);
  updateSystemParallax();
}

function mount(el) {
  root = el;
  mountMarquee();
  mountDrawOn();
  mountSystemRise();
  mountSystemParallax();
  mountViewer();
}

function unmount() {
  if (systemObserver) { systemObserver.disconnect(); systemObserver = null; }
  cancelAnimationFrame(drawRaf);
  drawRaf = 0;
  drawTargets = [];
  cancelAnimationFrame(systemRaf);
  systemRaf = 0;
  for (const off of listeners) off();
  listeners = [];
}

window.AlwaysOnSocialSketch = { mount, unmount, asset };
})();
