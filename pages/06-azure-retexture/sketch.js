// Page 06: Azure Re-Textureing. Builds the page's generated layers: the
// 5 x 4 compositions grid (random renders per colour column, with an
// expand-to-lightbox) and starts the looping clips.
// Exposes window.AzureRetextureSketch = { mount(container), unmount() } so the
// stitched site can host it as one section. Classic script (not a module) so
// the page works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

// ---------------------------------------------------------------- spec

// Compositions: the renders in assets/comps (made by assets/make-comps.py),
// sorted into the grid's five colour columns by their background. Each load
// picks COMP.rows of each column's renders at random, so the columns stay
// colour-coded while the selection changes.
const COMP = {
  rows: 4,
  columns: [
    { key: "royal", name: "Electric blue", bg: "#0a17c4", ink: "#fff" },
    { key: "navy", name: "Navy blue", bg: "#120f74", ink: "#fff" },
    { key: "teal", name: "Forest green", bg: "#1c3a38", ink: "#fff" },
    { key: "white", name: "Neutral", bg: "#f3f3f3", ink: "#111" },
    { key: "gray", name: "Neutral grey", bg: "#d8dbdb", ink: "#111" },
  ],
  // per column: renders 01-03 are the base renders, 04-07 the Runway retextures
  perColumn: 7,
  base: 3,
};

// ---------------------------------------------------------------- helpers

let root;
let listeners = [];

const $ = (sel) => root.querySelector(sel);
// the lightbox sits outside <main>: look it up in whatever tree holds the page
const byId = (id) => root.getRootNode().getElementById(id);

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}

// ---------------------------------------------------------------- builders

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const compSrc = (id, thumb) => asset(`assets/comps/${id}${thumb ? "-thumb" : ""}.jpg`);

function buildCompositions() {
  const grid = $("#comp-grid");
  if (!grid) return;
  grid.textContent = "";
  // a random pick per column, laid out row by row
  const picks = COMP.columns.map(() =>
    shuffle(Array.from({ length: COMP.perColumn }, (_, i) => i + 1)).slice(0, COMP.rows));
  for (let r = 0; r < COMP.rows; r++) {
    COMP.columns.forEach((col, c) => {
      const n = picks[c][r];
      const id = `${col.key}-${String(n).padStart(2, "0")}`;
      const kind = n <= COMP.base ? "Base render" : "Retexture";
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "comp-cell";
      cell.dataset.id = id;
      cell.dataset.col = String(c);
      cell.dataset.kind = kind;
      cell.style.setProperty("--cell-bg", col.bg);
      cell.title = "Click to expand";
      cell.innerHTML = `<img src="${compSrc(id, true)}" alt="${col.name}: ${kind.toLowerCase()}" loading="lazy" decoding="async">`;
      grid.appendChild(cell);
    });
  }
}

/** The page's clips (the hero and the shapes sheet) loop muted, like GIFs.
    The stitched site parses the page before it rebases src, so a first fetch
    that failed needs a fresh load. */
function startClips() {
  for (const v of root.querySelectorAll("video.loop-clip")) {
    v.muted = true;
    if (v.error || v.readyState === 0) v.load();
    const p = v.play && v.play();
    if (p && p.catch) p.catch(() => {});
  }
}

// ------------------------------------------------------------ lightbox

// A clicked composition grows from its tile to a large centred frame (the
// Style Shift looks lightbox). While open, the arrows, the arrow keys or the
// mouse wheel step through the grid's renders, wrapping at the ends; the
// caption is coloured like the render's column. Backdrop, the picture, x or
// Esc close it, and it flies back to whichever tile is showing.
const STEP_WHEEL_MS = 380; // one step per wheel gesture, at most this often

let lbOpen = false;
let lbTile = null;
let lastWheel = 0;

const compCells = () => Array.from($("#comp-grid").querySelectorAll(".comp-cell"));

function lbTargetRect() {
  // room for the side arrows: their inset + width + the same gap again (72 at
  // 1440); measured, since the arrows are sized in fluid units (2026-11-11)
  const prev = byId("comp-lightbox-prev");
  const pad = prev && prev.offsetWidth ? prev.offsetLeft * 2 + prev.offsetWidth : 72;
  const maxW = Math.min(window.innerWidth - pad * 2, 1560);
  const maxH = window.innerHeight - 48 * 2;
  let w = maxW;
  let h = (w * 9) / 16;
  if (h > maxH) { h = maxH; w = (h * 16) / 9; }
  return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
}

function placeFigure(fig, r) {
  fig.style.left = `${r.left}px`;
  fig.style.top = `${r.top}px`;
  fig.style.width = `${r.width}px`;
  fig.style.height = `${r.height}px`;
}

/** Show a tile's render in the lightbox: the thumb at once, the large when loaded. */
function lbShow(tile) {
  const img = byId("comp-lightbox-img");
  const cap = byId("comp-lightbox-cap");
  const col = COMP.columns[Number(tile.dataset.col)];
  lbTile = tile;
  img.src = compSrc(tile.dataset.id, true);
  img.alt = tile.querySelector("img").alt;
  const big = new Image();
  big.onload = () => { if (lbTile === tile) img.src = big.src; };
  big.src = compSrc(tile.dataset.id, false);
  cap.innerHTML = `${col.name}<span>${tile.dataset.kind}</span>`;
  cap.style.setProperty("--cap-bg", col.bg);
  cap.style.setProperty("--cap-ink", col.ink);
  const cells = compCells();
  byId("comp-lightbox-count").textContent = `${cells.indexOf(tile) + 1} / ${cells.length}`;
}

function openLightbox(tile) {
  const lb = byId("comp-lightbox");
  const fig = lb.querySelector(".lightbox__figure");
  lbShow(tile);
  lb.hidden = false;
  // start at the tile's rect (no transition), then fly to the centre
  fig.style.transition = "none";
  placeFigure(fig, tile.getBoundingClientRect());
  void fig.offsetHeight;
  fig.style.transition = "";
  requestAnimationFrame(() => {
    lb.classList.add("is-open");
    placeFigure(fig, lbTargetRect());
  });
  lbOpen = true;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lbOpen) return;
  const lb = byId("comp-lightbox");
  const fig = lb.querySelector(".lightbox__figure");
  lb.classList.remove("is-open");
  if (lbTile) placeFigure(fig, lbTile.getBoundingClientRect());
  lbOpen = false;
  document.body.style.overflow = "";
  setTimeout(() => { if (!lbOpen) lb.hidden = true; }, 540);
}

function stepLightbox(d) {
  if (!lbOpen || !lbTile) return;
  const cells = compCells();
  const i = cells.indexOf(lbTile);
  if (i < 0 || cells.length < 2) return;
  lbShow(cells[(i + d + cells.length) % cells.length]);
}

function mountLightbox() {
  const lb = byId("comp-lightbox");
  const grid = $("#comp-grid");
  if (!lb || !grid) return;
  on(grid, "click", (e) => {
    const tile = e.target.closest(".comp-cell");
    if (tile) openLightbox(tile);
  });
  on(lb.querySelector(".lightbox__backdrop"), "click", closeLightbox);
  on(lb.querySelector(".lightbox__figure"), "click", closeLightbox);
  on(byId("comp-lightbox-close"), "click", closeLightbox);
  on(byId("comp-lightbox-prev"), "click", () => stepLightbox(-1));
  on(byId("comp-lightbox-next"), "click", () => stepLightbox(1));
  on(window, "keydown", (e) => {
    if (!lbOpen) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); stepLightbox(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); stepLightbox(-1); }
  });
  on(lb, "wheel", (e) => {
    e.preventDefault();
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const now = performance.now();
    if (Math.abs(d) < 4 || now - lastWheel < STEP_WHEEL_MS) return;
    lastWheel = now;
    stepLightbox(d > 0 ? 1 : -1);
  }, { passive: false });
  on(window, "resize", () => { if (lbOpen) placeFigure(lb.querySelector(".lightbox__figure"), lbTargetRect()); });
}

// ------------------------------------------------------------- title

// Once this page has scrolled up into place, AZURE rises from behind the hero (the
// Touchstone System heading's rise on page 04: 0.9 s ease-out after a 300 ms
// beat), then RE-TEXTUREING types on left to right, and "with Runway 04" types
// on a beat after it starts. Like that heading it replays: scrolled fully off
// screen it resets.
const TITLE = {
  riseDelay: 100, // ms after the page reaches startAt before AZURE rises (matches the CSS)
  typeAt: 700, // ms after the rise starts: AZURE has all but landed
  charMs: 55, // RE-TEXTUREING: ms per letter
  subLag: 350, // ms after RE-TEXTUREING starts that the subtitle starts
  subCharMs: 45, // subtitle: ms per letter
  startAt: 0.85, // plays once the page's top is within this fraction of the screen height from the top
};

let titleRaf = 0;
let titleTimers = [];

/** Wrap each character of el's text in a span that appears at its own delay. */
function splitChars(el, startMs, stepMs, from) {
  const text = el.textContent;
  el.textContent = "";
  let i = from || 0;
  for (const ch of text) {
    const sp = document.createElement("span");
    sp.className = "ch";
    sp.textContent = ch;
    sp.style.setProperty("--d", `${startMs + i * stepMs}ms`);
    el.appendChild(sp);
    i++;
  }
  return i;
}

function mountTitle() {
  const title = $(".title");
  const sub = $(".subtitle");
  if (!title || !sub) return;
  splitChars(title.querySelector(".title-outline"), 0, TITLE.charMs);
  // the subtitle's two parts type as one run
  const n = splitChars(sub.querySelector(".subtitle-text"), TITLE.subLag, TITLE.subCharMs);
  splitChars(sub.querySelector(".subtitle-num"), TITLE.subLag + TITLE.subCharMs, TITLE.subCharMs, n);
  const play = () => {
    if (title.classList.contains("is-in")) return;
    title.classList.add("is-in");
    titleTimers.push(setTimeout(() => {
      title.classList.add("is-typed");
      sub.classList.add("is-typed");
    }, TITLE.riseDelay + TITLE.typeAt));
  };
  // off screen again: sink back and clear the letters, so it replays
  const reset = () => {
    for (const t of titleTimers) clearTimeout(t);
    titleTimers = [];
    title.classList.remove("is-in", "is-typed");
    sub.classList.remove("is-typed");
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    title.classList.add("is-in", "is-typed");
    sub.classList.add("is-typed");
    return;
  }
  // Driven by the page's own position, not the title's: it plays once the top
  // of this page has scrolled up near the top of the screen (where a jump to
  // the section lands it), so it never runs while the page above is still in
  // view. Scrolled off again (page back below the screen, or the title above
  // it) it resets and replays next time.
  const check = () => {
    titleRaf = 0;
    const vh = window.innerHeight || 1;
    const pageTop = root.getBoundingClientRect().top;
    const titleBottom = title.getBoundingClientRect().bottom;
    if (pageTop >= vh || titleBottom <= 0) reset();
    else if (pageTop <= vh * TITLE.startAt) play();
  };
  const queue = () => { if (!titleRaf) titleRaf = requestAnimationFrame(check); };
  on(window, "scroll", queue, { passive: true });
  on(window, "resize", queue);
  check();
}

// ------------------------------------------------------ section titles

// COMPOSITIONS, SHAPES and WORKFLOW type on, one letter at a time, as each
// scrolls into view (its top above SECTION_TYPE.startAt of the screen); each
// resets once it is fully off screen, so it replays like the header.
const SECTION_TYPE = {
  charMs: 120, // ms per letter
  startAt: 0.85, // types once the title's top is within this fraction of the screen height from the top
};

let sectionRaf = 0;

function mountSectionTitles() {
  const titles = Array.from(root.querySelectorAll(".section-title"));
  if (!titles.length) return;
  for (const t of titles) {
    t.setAttribute("aria-label", t.textContent);
    splitChars(t, 0, SECTION_TYPE.charMs);
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const t of titles) t.classList.add("is-typed");
    return;
  }
  const check = () => {
    sectionRaf = 0;
    const vh = window.innerHeight || 1;
    for (const t of titles) {
      const r = t.getBoundingClientRect();
      if (r.top >= vh || r.bottom <= 0) t.classList.remove("is-typed");
      else if (r.top <= vh * SECTION_TYPE.startAt) t.classList.add("is-typed");
    }
  };
  const queue = () => { if (!sectionRaf) sectionRaf = requestAnimationFrame(check); };
  on(window, "scroll", queue, { passive: true });
  on(window, "resize", queue);
  check();
}

// ---------------------------------------------------------------- api

function mount(container) {
  root = container;
  buildCompositions();
  startClips();
  mountLightbox();
  mountTitle();
  mountSectionTitles();
}

function unmount() {
  cancelAnimationFrame(titleRaf);
  titleRaf = 0;
  cancelAnimationFrame(sectionRaf);
  sectionRaf = 0;
  for (const t of titleTimers) clearTimeout(t);
  titleTimers = [];
  if (lbOpen) document.body.style.overflow = "";
  lbOpen = false;
  for (const off of listeners) off();
  listeners = [];
  root = null;
}

window.AzureRetextureSketch = { mount, unmount, asset };
})();
