// Page 05: Exporter. Wires the plugin panel's two buttons (a staged send and
// a copied-code note in the status line) and CLICK TO PLAY / the video block,
// which open the viewer and play the demo video.
// Exposes window.ExporterSketch = { mount(container), unmount() } so the
// stitched site can host it as one section. Classic script (not a module) so
// the page works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

const SENT = "✓ Sent 4 layers (code 5EBN). Express picks it up automatically.";
const SEND_STEPS = ["Reading the frame…", "Flattening to PNG…", "Collecting 4 text layers…", SENT];

let listeners = [];
let root;
let sendTimer = 0;

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}
const $ = (sel) => root.querySelector(sel);

function setStatus(text) {
  const el = $("#status");
  if (el) el.textContent = text;
}

function mountPanel() {
  const send = $("#btn-send");
  const json = $("#btn-json");
  on(send, "click", () => {
    if (send.disabled) return;
    send.disabled = true;
    let i = 0;
    const tick = () => {
      setStatus(SEND_STEPS[i++]);
      if (i < SEND_STEPS.length) sendTimer = setTimeout(tick, 550);
      else send.disabled = false;
    };
    tick();
  });
  on(json, "click", () => {
    setStatus("JSON copied: 4 layers, 1 image, fonts Inter / Anton.");
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => setStatus(SENT), 2400);
  });
}

// ------------------------------------------------------------ scroll open

// The frame opens while it rises into place: --open is 0 while the frame's
// top is at or below OPEN_FROM of the window height (it has just come into
// view) and 1 when the frame reaches its resting place at the top of the
// window (64 units down, as on the standalone page). The copy band grows
// with an ease, everything below slides down, and the black copy types on in
// reading order with the raw progress. Scrolling back up closes it again.
// Standalone, where the frame already sits at the top, the first stretch of
// scrolling drives it instead.
const OPEN_FROM = 1.0;   // frame top at this fraction of the window height -> 0 (the moment it enters the window)
const BAND = 290;        // the copy band's open height (units; style.css --band: spec 210 + 80 for the 14px copy)
const OPEN_TRAVEL = 320; // standalone only: px of scrolling to open
const TYPE_START = 0.3;  // the typing waits for this much of the opening, then runs to the end with it
const TYPE_RATE = 90;    // characters per second at the slowest: scroll sets the target, time types it
const TYPE_CATCH = 100;  // ms: the typing closes most of any gap to the target within this, so it ends with the scroll
let openRaf = 0;
let lastOpen = 1; // the eased value last applied
const unit = () => Math.min(document.documentElement.clientWidth, 1560) / 1440; // the page's --u in px
// the copy types on in two columns at once, both at the same speed: the left
// column (What is it) and the right (Why we built it, then Click to play)
let typeCols = []; // [{ els: [{ el, full }], total }]
let typeLongest = 0; // characters in the longest column: the shared speed
let typeTarget = 0;  // characters the scroll position asks for
let typeShown = -1;  // characters on screen (chases the target); -1 until the first tick trims the markup's full text
let typeRaf = 0;
let typeLast = 0;

function mountOpen() {
  const frame = $("#frame");
  if (!frame) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { frame.classList.add("is-in"); return; }
  const cols = {};
  for (const el of root.querySelectorAll(".type")) {
    const key = el.dataset.col || "left";
    cols[key] = cols[key] || { els: [], total: 0 };
    cols[key].els.push({ el, full: el.textContent });
    cols[key].total += el.textContent.length;
  }
  typeCols = Object.values(cols);
  typeLongest = Math.max(...typeCols.map((c) => c.total), 1);
  const onScroll = () => { if (!openRaf) openRaf = requestAnimationFrame(applyOpen); };
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", onScroll);
  applyOpen();
}

function applyOpen() {
  openRaf = 0;
  const frame = $("#frame");
  const vh = window.innerHeight;
  const rest = 64 * unit(); // the frame's offset from the top of its page
  const docTop = frame.getBoundingClientRect().top + window.scrollY; // stable while it opens
  const arrive = docTop - rest;          // scrollY at which the frame rests at the top
  const start = docTop - vh * OPEN_FROM; // scrollY at which its top is OPEN_FROM down the window
  let p;
  if (start > 0) {
    p = (window.scrollY - start) / (arrive - start);
  } else {
    // standalone: the frame is in view from the first pixel, so the page's own
    // scroll room opens it (kept inside what the page can scroll once open)
    const openDocH = document.documentElement.scrollHeight + (1 - lastOpen) * BAND * unit();
    const travel = Math.min(OPEN_TRAVEL, Math.max(120, (openDocH - vh) * 0.9));
    p = window.scrollY / travel;
  }
  p = Math.min(1, Math.max(0, p));
  // the title letters rise in once the frame is well into view, a quarter of
  // the way up the window (always, standalone)
  frame.classList.toggle("is-in", start <= 0 || p > 0.3);
  const ease = p * p * (3 - 2 * p);
  lastOpen = ease;
  frame.style.setProperty("--open", ease.toFixed(4));
  // the scroll position sets how much copy should be on screen; the typing
  // itself runs on the clock towards that, so a big wheel step still types
  // letter by letter instead of popping a line in at once
  const tp = Math.min(1, Math.max(0, (p - TYPE_START) / (1 - TYPE_START))); // typing progress: starts later
  typeTarget = Math.round(tp * typeLongest);
  if (typeTarget !== typeShown && !typeRaf) { typeLast = 0; typeRaf = requestAnimationFrame(typeTick); }
}

function typeTick(now) {
  typeRaf = 0;
  const dt = typeLast ? Math.min(100, now - typeLast) : 16;
  typeLast = now;
  // at least TYPE_RATE, and faster the further behind the scroll it is, so a
  // quick scroll still lands fully typed as the frame settles
  const gap = Math.abs(typeTarget - typeShown);
  const step = Math.max(1, Math.round(Math.max((TYPE_RATE * dt) / 1000, (gap * dt) / TYPE_CATCH)));
  if (typeShown < typeTarget) typeShown = Math.min(typeTarget, typeShown + step);
  else typeShown = Math.max(typeTarget, typeShown - step);
  // every column shows the same number of characters: both sides type at one
  // speed and the shorter side simply finishes first
  for (const col of typeCols) {
    let left = typeShown;
    for (const t of col.els) {
      const n = Math.max(0, Math.min(t.full.length, left));
      const next = t.full.slice(0, n);
      if (t.el.textContent !== next) t.el.textContent = next;
      left -= t.full.length;
    }
  }
  if (typeShown !== typeTarget) typeRaf = requestAnimationFrame(typeTick);
}

// ------------------------------------------------------------- viewer

const DEMO_VIDEO = "assets/Express_Demo_edit_v004.mp4";

// The viewer sits outside <main>: look it up in whatever tree holds the page
// (the document on its own, a shadow root in the stitched site).
const byId = (id) => root.getRootNode().getElementById(id);

function openViewer() {
  const v = byId("viewer");
  const video = byId("viewer-video");
  if (!v || !video) return;
  if (!video.getAttribute("src")) video.src = asset(DEMO_VIDEO); // loaded on first play only
  v.hidden = false;
  document.body.style.overflow = "hidden";
  const p = video.play();
  if (p && p.catch) p.catch(() => {}); // autoplay refusal: the controls are there
}

function closeViewer() {
  const v = byId("viewer");
  if (!v || v.hidden) return;
  const video = byId("viewer-video");
  if (video) video.pause();
  v.hidden = true;
  document.body.style.overflow = "";
}

function mountCta() {
  const cta = $("#cta-play");
  const block = $("#video");
  const v = byId("viewer");
  if (!v) return;
  on(cta, "click", (e) => { e.preventDefault(); openViewer(); });
  on(block, "click", openViewer);
  on(v, "click", (e) => { if (e.target.closest(".viewer-stage")) return; closeViewer(); });
  on(byId("viewer-close"), "click", closeViewer);
  on(window, "keydown", (e) => { if (e.key === "Escape") closeViewer(); });
}

function mount(el) {
  root = el;
  mountPanel();
  mountCta();
  mountOpen();
}

function unmount() {
  clearTimeout(sendTimer);
  cancelAnimationFrame(openRaf);
  openRaf = 0;
  cancelAnimationFrame(typeRaf);
  typeRaf = 0;
  typeCols = [];
  typeLongest = 0;
  typeTarget = 0;
  typeShown = -1;
  for (const off of listeners) off();
  listeners = [];
}

window.ExporterSketch = { mount, unmount, asset };
})();
