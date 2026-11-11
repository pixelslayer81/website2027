// Page 10: Dotdasher. Draws the dot pattern on the demo block (the whole
// rounded block is the canvas) and plays it: CLICK TO PLAY DEMO (or a click on
// the block) sweeps the pattern in a slow wave, the dots stretching into dashes
// as it passes; click again to pause. (The sidebar with shape / pattern /
// colour options was removed 2026-11-10; `state` keeps the defaults.)
// Exposes window.DotdasherSketch = { mount(container), unmount() } so the
// stitched site can host it as one section. Classic script (not a module) so
// the page works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

const GRID = {
  cell: 26, // px between shapes (at 1x)
  dot: 1.1, // px radius of a resting dot (2026-11-10: halved from 2.2)
  dash: 11, // px half-length of a full dash
  ring: 5, // px radius of a ring
  restAlpha: 0.28, // the resting pattern (the mockup's faint grid)
  speed: 0.00045, // wave phase per ms
  waves: 2.2, // wave cycles across the stage
};

const state = { shape: "dot", pattern: "grid", color: "#eae4dc", playing: false };

let root, stage, canvas, ctx;
let raf = 0;
let t0 = 0;
let phase = 0;
let listeners = [];
let ro = null;

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => Array.from(root.querySelectorAll(sel));

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resize() {
  // the untransformed size: during the intro the stage is scaled up to fill the window
  const r = { width: stage.clientWidth, height: stage.clientHeight };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

/** How "on" a cell is, 0..1, for the current pattern and wave phase. */
function energy(col, row, cols, rows) {
  if (!state.playing && phase === 0) return 0;
  const x = col / Math.max(1, cols - 1);
  const y = row / Math.max(1, rows - 1);
  let v;
  if (state.pattern === "wave") v = Math.sin((x * GRID.waves + y * 0.6) * Math.PI * 2 - phase);
  else if (state.pattern === "radial") {
    const d = Math.hypot(x - 0.5, (y - 0.5) * (rows / cols));
    v = Math.sin(d * GRID.waves * 2 * Math.PI * 2 - phase);
  } else v = Math.sin((x + y * 0.35) * GRID.waves * Math.PI * 2 - phase); // grid: a diagonal sweep
  return Math.max(0, v); // only the crest lights up
}

function draw() {
  const w = canvas.width / (Math.min(2, window.devicePixelRatio || 1));
  const h = canvas.height / (Math.min(2, window.devicePixelRatio || 1));
  ctx.clearRect(0, 0, w, h);
  const [r, g, b] = hexToRgb(state.color);
  const cell = GRID.cell;
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  const ox = (w - (cols - 1) * cell) / 2;
  const oy = (h - (rows - 1) * cell) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const e = energy(i, j, cols, rows);
      const x = ox + i * cell;
      const y = oy + j * cell;
      const alpha = GRID.restAlpha + (1 - GRID.restAlpha) * e;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
      ctx.strokeStyle = ctx.fillStyle;
      if (state.shape === "ring") {
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, GRID.ring * (0.6 + 0.4 * e) , 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // a dot that stretches into a dash as its energy rises (a dash starts stretched)
        const base = state.shape === "dash" ? 0.5 : 0;
        const len = GRID.dash * Math.min(1, base + e);
        ctx.beginPath();
        if (len < 0.5) ctx.arc(x, y, GRID.dot, 0, Math.PI * 2);
        else ctx.roundRect(x - len, y - GRID.dot, len * 2, GRID.dot * 2, GRID.dot);
        ctx.fill();
      }
    }
  }
}

function frame(now) {
  raf = 0;
  if (!state.playing) return;
  if (!t0) t0 = now;
  phase += (now - (frame.last || now)) * GRID.speed * Math.PI * 2;
  frame.last = now;
  draw();
  raf = requestAnimationFrame(frame);
}

function play(onOff) {
  state.playing = onOff;
  stage.classList.toggle("is-playing", onOff);
  frame.last = 0;
  if (onOff && !raf) raf = requestAnimationFrame(frame);
  if (!onOff) { cancelAnimationFrame(raf); raf = 0; draw(); }
}

// ── the scroll-triggered zoom-out (style.css .is-intro / .is-opening; after
// the user's motion reference assets/DD_animref_v001.mp4). The page opens
// zoomed in on the canvas: the stage gets an inline transform that scales it
// (origin top-left) to cover the window below the site header. The first
// scroll input eases everything to the design. Skipped when the page opens
// scrolled (a restored position, a #hash) or with reduced motion.
// ms: A = the canvas's drop; B = the card's narrowing, from phaseBAt (the copy's
// clip-path wipe in style.css runs on the same B timing); total = B's end
const INTRO = { headerH: 56, phaseA: 1100, phaseBAt: 600, phaseB: 1500, total: 2100 };
let intro = false;
let introOffs = [];
let scrollLocked = false;

// The page cannot be scrolled from load until the sequence has ended: the
// scroll only triggers it. (The document's overflow, as the Exporter viewer
// does with the body; wheel and touch events still fire with it hidden.)
const holdTop = () => { if (scrollLocked && window.scrollY) window.scrollTo(0, 0); };
function lockScroll(onOff) {
  if (onOff === scrollLocked) return;
  scrollLocked = onOff;
  const html = document.documentElement;
  if (onOff) {
    html.style.overflow = "hidden";
    window.scrollTo(0, 0);
    window.addEventListener("scroll", holdTop, { passive: true }); // anchors, focus: back to the top while locked
  } else {
    html.style.overflow = "";
    window.removeEventListener("scroll", holdTop);
  }
}

// the canvas's start transform (origin top-left) and the design's sizes: the
// card's width, the gap from the card to the copy capsule, the capsule's left
// (relative to the card's) and its text block's width
const start = { tx: 0, ty: 0, s: 1, stageW: 0, cardW: 0, stageRadius: 0, gap: 0, copyLeft: 0, copyInW: 0 };
let introRaf = 0;

const easeOut = (t) => 1 - Math.pow(1 - t, 3.2); // steady, then a long settle (the canvas)
const easeInOut = (t) => easeOut(Math.pow(t, 1.8)); // the card's narrowing: eases in slowly, ramps up to the same speed, settles
const lerp = (a, b, t) => a + (b - a) * t;

/** The intro at progress t (ms since the trigger; 0 = the start frame):
 *  the canvas eases from its cover transform to its place (phase A), and the
 *  card rides with it, its bottom the design's gap above the canvas's top and
 *  its side edges ON the canvas's side edges (the same gaps, after the
 *  reference), until its right edge eases to the column (phase B, from 0.6s).
 *  Both the card and the canvas sit at the page's content left, so the card's
 *  margin-left is the canvas's own horizontal shift. */
function setIntroFrame(t) {
  const card = $(".card");
  const eA = easeOut(Math.min(1, Math.max(0, t / INTRO.phaseA)));
  const eB = easeInOut(Math.min(1, Math.max(0, (t - INTRO.phaseBAt) / INTRO.phaseB)));
  const tx = start.tx * (1 - eA);
  const ty = start.ty * (1 - eA);
  const s = lerp(start.s, 1, eA);
  stage.style.transform = "translate(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px) scale(" + s.toFixed(4) + ")";
  stage.style.borderRadius = (start.stageRadius / s).toFixed(2) + "px"; // the scale would enlarge it: kept at its final size on screen
  const canvasW = start.stageW * s;
  const cardW = lerp(canvasW, start.cardW, eB);
  card.style.marginLeft = tx.toFixed(2) + "px";
  card.style.width = cardW.toFixed(2) + "px";
  card.style.transform = "translateY(" + ty.toFixed(2) + "px)";
  // the copy capsule (the reference's second block): the design's gap right of
  // the card, its right edge on the canvas's right edge, so it grows in from
  // the right as the card narrows; it rides down with the card
  const copy = $(".copy");
  const copyLeft = tx + cardW + start.gap; // relative to the card's column left
  const copyW = Math.max(0, tx + canvasW - copyLeft);
  copy.style.marginLeft = (copyLeft - start.copyLeft).toFixed(2) + "px";
  copy.style.width = copyW.toFixed(2) + "px";
  copy.style.visibility = copyW < 4 ? "hidden" : "";
  copy.style.transform = "translateY(" + ty.toFixed(2) + "px)";
}

function clearIntroFrame() {
  const card = $(".card");
  const copy = $(".copy");
  stage.style.transform = "";
  stage.style.borderRadius = "";
  for (const el of [card, copy]) {
    el.style.marginLeft = "";
    el.style.width = "";
    el.style.transform = "";
  }
  copy.style.visibility = "";
}

/** After the intro: the capsule back to its natural height. */
function releaseCopyHeight() {
  const copy = $(".copy");
  if (copy) copy.style.removeProperty("--copy-h");
}

function fitStageToWindow() {
  clearIntroFrame();
  const card = $(".card");
  const copy = $(".copy");
  const copyIn = $(".copy__in");
  // Everything is measured in the design layout (no intro classes): the copy
  // capsule then has its natural height (in the intro its text is out of
  // flow), which sets where the canvas sits and how tall the capsule is held.
  root.classList.remove("is-intro");
  copy.style.removeProperty("--copy-in-w");
  copy.style.removeProperty("--copy-h");
  const r = stage.getBoundingClientRect();
  const top = INTRO.headerH;
  const vw = window.innerWidth;
  const vh = window.innerHeight - top;
  const s = Math.max(vw / r.width, vh / r.height); // cover
  start.tx = (vw - r.width * s) / 2 - r.left;
  start.ty = top + (vh - r.height * s) / 2 - r.top;
  start.s = s;
  start.stageW = r.width;
  start.stageRadius = parseFloat(getComputedStyle(stage).borderRadius) || 0;
  const cr = card.getBoundingClientRect();
  const pr = copy.getBoundingClientRect();
  start.cardW = cr.width;
  start.gap = pr.left - cr.right;
  start.copyLeft = pr.left - cr.left;
  start.copyInW = copyIn.getBoundingClientRect().width;
  copy.style.setProperty("--copy-in-w", start.copyInW.toFixed(2) + "px");
  copy.style.setProperty("--copy-h", pr.height.toFixed(2) + "px");
  root.classList.add("is-intro");
  setIntroFrame(0);
}

function runIntro() {
  const t0 = performance.now();
  const frame = (now) => {
    const t = now - t0;
    setIntroFrame(t);
    if (t < INTRO.total) introRaf = requestAnimationFrame(frame);
    else { introRaf = 0; clearIntroFrame(); }
  };
  introRaf = requestAnimationFrame(frame);
}

function openIntro() {
  if (!intro) return;
  intro = false;
  for (const off of introOffs) off();
  introOffs = [];
  root.classList.add("is-opening");
  runIntro();
  setTimeout(() => {
    lockScroll(false);
    if (!root) return;
    root.classList.remove("is-intro", "is-opening");
    clearIntroFrame();
    releaseCopyHeight();
  }, INTRO.total + 100);
}

function mountIntro() {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || window.scrollY > 4 || location.hash) return;
  intro = true;
  root.classList.add("is-intro");
  lockScroll(true);
  fitStageToWindow();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (intro) fitStageToWindow(); });
  const hook = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    introOffs.push(() => target.removeEventListener(type, fn, opts));
  };
  hook(window, "resize", () => { if (intro) fitStageToWindow(); });
  const go = () => openIntro();
  hook(window, "wheel", go, { passive: true });
  hook(window, "touchmove", go, { passive: true });
  hook(window, "scroll", go, { passive: true });
  hook(window, "keydown", (e) => { if ([" ", "ArrowDown", "PageDown", "End"].includes(e.key)) go(); });
}

function mount(el) {
  root = el;
  stage = $("#stage");
  canvas = $("#canvas");
  if (!stage || !canvas) return;
  ctx = canvas.getContext("2d");
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h, r) { this.rect(x, y, w, h); }; // old browsers: square dashes
  resize();
  if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(stage); }
  else on(window, "resize", resize);
  on(stage, "click", () => play(!state.playing));
  on($("#cta-play"), "click", (e) => {
    e.preventDefault();
    play(true);
    stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  mountIntro();
  mountTool();
  mountSteps();
}

// ── the framed app (apps/dotdasher, same origin): its layout is a full-height
// flex row with 10px padding and a canvas that is aspect-constrained by width,
// so a fixed frame leaves cream under the canvas. The frame is sized from the
// app's own content instead: the lower of the canvas's bottom and the control
// rail's, plus the app's padding, so the gap under the canvas matches the
// gaps at its sides (2026-11-10). Re-measured when the app's content changes.
const TOOL = { pad: 10, caption: 40, min: 420 }; // px: the app's padding, its caption reserve under the canvas, a floor
let toolRo = null;

function sizeTool(frame) {
  let doc;
  try { doc = frame.contentDocument; } catch (err) { return; }
  if (!doc || !doc.getElementById("root")) return;
  const app = doc.getElementById("root").firstElementChild;
  if (!app) return;
  const canvas = doc.querySelector('[class*="rounded-[14px]"]');
  const rail = app.firstElementChild;
  let bottom = 0;
  const area = canvas && canvas.parentElement && canvas.parentElement.parentElement; // the preview's viewport (Preview.tsx outerRef)
  if (area) {
    // The canvas fills that viewport aspect-constrained by whichever of width
    // or height is tighter, keeping 40px under it for its caption row
    // (Preview.tsx: availH = container - 40). The frame must fit the WIDTH-
    // constrained size plus that reserve, else a shorter frame shrinks the
    // canvas, which shortens the frame again.
    const c = canvas.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    const aspect = c.width && c.height ? c.width / c.height : 16 / 9;
    bottom = Math.max(bottom, a.top + a.width / aspect + TOOL.caption);
  }
  if (rail && rail !== canvas) bottom = Math.max(bottom, rail.getBoundingClientRect().top + rail.scrollHeight);
  if (!bottom) return;
  const h = Math.max(TOOL.min, Math.round(bottom + TOOL.pad));
  if (Math.abs(h - frame.getBoundingClientRect().height) > 1) frame.style.height = h + "px";
}

function mountTool() {
  const frame = $(".tool__app");
  if (!frame) return;
  const watch = () => {
    sizeTool(frame);
    let doc;
    try { doc = frame.contentDocument; } catch (err) { return; }
    const win = frame.contentWindow;
    const app = doc && doc.getElementById("root");
    if (toolRo) { toolRo.disconnect(); toolRo = null; }
    if (app && win && win.ResizeObserver) {
      toolRo = new win.ResizeObserver(() => sizeTool(frame));
      toolRo.observe(app);
      const canvas = doc.querySelector('[class*="rounded-[14px]"]'); // its aspect can change (the export format)
      if (canvas) toolRo.observe(canvas);
    }
    // the app renders after its engine loads: measure again as it settles
    for (const ms of [500, 1500, 4000, 10000]) setTimeout(() => sizeTool(frame), ms);
  };
  on(frame, "load", watch);
  if (frame.contentDocument && frame.contentDocument.readyState === "complete" && frame.contentDocument.getElementById("root")) watch();
  on(window, "resize", () => sizeTool(frame));
}

// ── the design process (2026-11-10): rolling over a step's type (its number
// or title, not the whole row) shows its picture in the frame beside the
// list; the last one rolled over stays showing.
function mountSteps() {
  const steps = $$(".tool__step");
  const shots = $$(".tool__shot");
  if (!steps.length || !shots.length) return;
  const show = (i) => {
    for (const s of steps) s.classList.toggle("is-on", s.dataset.step === String(i));
    for (const s of shots) s.classList.toggle("is-on", s.dataset.step === String(i));
  };
  for (const s of steps) {
    const type = s.querySelectorAll(".process__node");
    for (const el of type.length ? type : [s]) on(el, "mouseenter", () => show(s.dataset.step));
    on(s, "focus", () => show(s.dataset.step));
    s.tabIndex = 0;
  }
}

function unmount() {
  play(false);
  if (toolRo) { toolRo.disconnect(); toolRo = null; }
  for (const off of introOffs) off();
  introOffs = [];
  intro = false;
  cancelAnimationFrame(introRaf);
  introRaf = 0;
  lockScroll(false);
  if (ro) { ro.disconnect(); ro = null; }
  for (const off of listeners) off();
  listeners = [];
  root = null;
}

window.DotdasherSketch = { mount, unmount, asset };
})();
