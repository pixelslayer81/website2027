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

// ------------------------------------------------------------ title rise

// 2026-11-05: the scroll-driven expand is gone (it opened the copy band as the
// frame rose into place, slid everything below it down and typed the copy on).
// The page now sits fully open (style.css --open defaults to 1) with all its
// copy from the start. Only the title's letters still rise in, once the frame
// is well into view (a quarter of the way up the window; at once standalone,
// where it is in view from the start).
const RISE_AT = 0.3; // how far the frame must have risen (0 = entering the window, 1 = at its resting place)
let riseRaf = 0;
const unit = () => Math.min(document.documentElement.clientWidth, 1560) / 1440; // the page's --u in px

function mountOpen() {
  const frame = $("#frame");
  if (!frame) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { frame.classList.add("is-in"); return; }
  const onScroll = () => { if (!riseRaf) riseRaf = requestAnimationFrame(applyRise); };
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", onScroll);
  applyRise();
}

function applyRise() {
  riseRaf = 0;
  const frame = $("#frame");
  const vh = window.innerHeight;
  const rest = 64 * unit(); // the frame's offset from the top of its page
  const docTop = frame.getBoundingClientRect().top + window.scrollY;
  const arrive = docTop - rest; // scrollY at which the frame rests at the top
  const start = docTop - vh;    // scrollY at which its top enters the window
  const p = start > 0 ? (window.scrollY - start) / (arrive - start) : 1;
  frame.classList.toggle("is-in", start <= 0 || p > RISE_AT);
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
  cancelAnimationFrame(riseRaf);
  riseRaf = 0;
  for (const off of listeners) off();
  listeners = [];
}

window.ExporterSketch = { mount, unmount, asset };
})();
