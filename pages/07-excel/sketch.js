// Page 07: Excel - Beyond the Grid. Places the lower grid's few lines (from the
// user's reference), lights the grid cell under the cursor, scrubs
// the EXCEL title, portrait and car clips with the scroll;
// everything else is static markup and CSS.
// Exposes window.ExcelSketch = { mount(container), unmount() } so the stitched
// site can host it as one section. Classic script (not a module) so the page
// works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

// The grid, measured off the user's reference (2026-10-26): 20 columns of 72,
// rows of 31.22; the top grid is 28 rows, then the lower grid has only a few
// lines (most of them under the photos): rows across the page at these y's,
// columns at these x's (from the lower grid's top down to y1).
const COL_W = 72;
const ROW_H = 31.22;
// 2026-11-04: 6 rows added at the top (top grid 28 -> 34 rows); everything
// below moved down by ADDED (style.css / index.html positions match).
const ADDED = 6 * ROW_H;
const TOP_H = 34 * ROW_H;
const PAGE_H = 1976 + ADDED;
const LOWER_ROWS = [TOP_H, ...[1488.6, 1642.2, 1681.5, 1738.3, 1873.9, 1915.2].map((y) => y + ADDED)];
const LOWER_COLS = [
  { x: 72, y1: PAGE_H }, { x: 432, y1: PAGE_H }, { x: 454.82, y1: PAGE_H } /* 2026-11-05: page 08 start box 40% larger */,
  { x: 576, y1: PAGE_H }, { x: 720, y1: PAGE_H }, { x: 936, y1: 1488.6 + ADDED }, { x: 1368, y1: PAGE_H },
];

let root;
let listeners = [];

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}

function buildLowerRows() {
  const grid = root.querySelector("#grid-lower");
  if (!grid) return;
  grid.textContent = "";
  for (const y of LOWER_ROWS) {
    const line = document.createElement("div");
    line.className = "grid-row";
    line.style.top = `calc(${y - TOP_H} * var(--u))`;
    grid.appendChild(line);
  }
  for (const c of LOWER_COLS) {
    const line = document.createElement("div");
    line.className = "grid-col";
    line.style.left = `calc(${c.x} * var(--u))`;
    line.style.top = "0";
    line.style.height = `calc(${c.y1 - TOP_H} * var(--u))`;
    grid.appendChild(line);
  }
}

// ------------------------------------------------------------ cell glow

// The grid cell under the cursor lights up mint and fades out, so a pass over
// the page leaves a short trail of cells (the Style Shift board's lit cells,
// page 03). Top grid: 72 x 31.22 cells; lower grid: the boxes its few lines
// make. Drawn on one canvas over the grids, under the boxes.
const LOWER_EDGES = [...LOWER_ROWS, PAGE_H]; // lower rows lie between these
const GLOW = { rgb: "79, 240, 160", alpha: 0.55, fadeMs: 700 };

let glowCanvas = null;
let glowCtx = null;
let glowScale = 1; // css px per spec unit
let glowRaf = 0;
const litCells = new Map(); // "x,y,w,h" in spec units -> time lit

function sizeGlow() {
  if (!glowCanvas) return;
  const r = glowCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  glowCanvas.width = Math.round(r.width * dpr);
  glowCanvas.height = Math.round(r.height * dpr);
  glowScale = r.width / 1440;
  glowCtx.setTransform(dpr * glowScale, 0, 0, dpr * glowScale, 0, 0);
}

/** The cell (spec units) under a page point, or null outside the grids. */
function cellAt(x, y) {
  if (x < 0 || x >= 1440 || y < 0 || y >= PAGE_H) return null;
  if (y < TOP_H) {
    const cx = Math.floor(x / COL_W) * COL_W;
    const cy = Math.floor(y / ROW_H) * ROW_H;
    return [cx, cy, COL_W, Math.min(ROW_H, TOP_H - cy)];
  }
  for (let i = 0; i < LOWER_EDGES.length - 1; i++) {
    if (y >= LOWER_EDGES[i + 1]) continue;
    const y0 = LOWER_EDGES[i], y1 = LOWER_EDGES[i + 1];
    // the columns that run through this row, plus the page edges
    const xs = [0, 1440, ...LOWER_COLS.filter((c) => c.y1 >= y1).map((c) => c.x)].sort((a, b) => a - b);
    let k = 0;
    while (k < xs.length - 2 && x >= xs[k + 1]) k++;
    return [xs[k], y0, xs[k + 1] - xs[k], y1 - y0];
  }
  return null;
}

function drawGlow(now) {
  glowRaf = 0;
  if (!glowCtx) return;
  glowCtx.save();
  glowCtx.setTransform(1, 0, 0, 1, 0, 0);
  glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
  glowCtx.restore();
  for (const [key, t] of litCells) {
    const age = (now - t) / GLOW.fadeMs;
    if (age >= 1) { litCells.delete(key); continue; }
    const [x, y, w, h] = key.split(",").map(Number);
    glowCtx.fillStyle = `rgba(${GLOW.rgb}, ${(GLOW.alpha * (1 - age) * (1 - age)).toFixed(3)})`;
    // fill inside the grid lines (1 css px in from the cell's top-left line)
    const px = 1 / glowScale;
    glowCtx.fillRect(x + px, y + px, w - px, h - px);
  }
  if (litCells.size) glowRaf = requestAnimationFrame(drawGlow);
}

function mountGlow() {
  glowCanvas = root.querySelector("#grid-glow");
  if (!glowCanvas) return;
  glowCtx = glowCanvas.getContext("2d");
  sizeGlow();
  on(window, "resize", sizeGlow);
  on(root, "pointermove", (e) => {
    const r = glowCanvas.getBoundingClientRect();
    const cell = cellAt((e.clientX - r.left) / glowScale, (e.clientY - r.top) / glowScale);
    if (!cell) return;
    litCells.set(cell.join(","), performance.now()); // re-entering a cell relights it
    if (!glowRaf) glowRaf = requestAnimationFrame(drawGlow);
  });
}

// ------------------------------------------------------------ ASCII globe

// 2026-11-05: press and hold (left button) on the top grid: the cells around
// the press clear away, a ripple out from the pressed cell, each one fading in
// mint (it scaled open from its centre until 2026-11-05), and show a slowly
// turning ASCII globe (dark type) through them; let go and they fade back off,
// the outermost first. Drawn on its
// own canvas (#globe-reveal), over the cell glow, under the boxes and photos.

// The land: Natural Earth's 1:50m land polygons (public domain,
// naturalearthdata.com), rasterised to a half-degree grid (720 x 360, row 0 at
// 90 N) and run-length encoded: rows split by '|', each row's runs alternate
// sea / land starting with sea, in base 36, split by '.'. Decoded once.
const LAND_RES = 2; // cells per degree
const LAND_RLE = "k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|7m.1.3.3.2.p.bg|5i.1.2.5.2.h.2.6.10.5.3.13.b8|58.5.3.15.c.3.2.1.4.5.4.2.1.12.bf|4x.1i.7.5.1.1v.2.5.9.6.3z.2.6q|4s.4.6.6.2.d.1.p.9.26.2.h.3s.5.22.2.4o|4q.8.5.3.1.d.3.k.6.2u.3e.2.1.1.1.5.6.6.4.5.2.3.1l.a.4k|4o.e.1.2.2.5.2.q.6.2n.1.5.1z.1.1.2.3.1.2.3.17.4.6.4.2.1.1.2.1.2.1v.a.4m|4o.i.2.8.2.f.1.3.d.2i.2.2.1l.7.1.1.2.4.2.2.2.b.3n.2.2.c.4g|45.5.l.f.1.i.k.2l.1o.1.1.7.1.6.8.2.3x.9.5.3.4a|49.7.3.3.7.c.1.p.9.2q.1r.1.2.j.4e.9.46|4d.4.3.5.7.3.1.1.1.1.2.o.6.2u.4.1.1s.1.4.7.4.3.4a.7.6.1.43|3n.1.2.6.f.3.a.5.b.4.1.f.f.2u.3.1.1v.5.6.7.8m|3d.8.k.2.s.1.6.a.1.2.n.2r.1.1.1u.6.3z.1.o.8.45|3b.9.3.2.8.2.n.8.5.p.h.2m.1.1.23.2.2q.6.1s.c.2c.1.1p|37.7.6.4.1.1.6.4.9.2.1.2.1.6.9.8.g.2.m.9.1.1.2.2c.3.1.4f.2.2.a.1j.3.5.q.1.1.3p|3e.2.2.b.5.7.6.9.c.6.a.6.18.27.4c.c.1k.14.1.2.17.1.3.6.1.7.1z|3h.n.2.3.7.4.4.5.2.q.17.23.1.1.1.2.46.8.1j.1e.1b.b.1.4.2.5.1.1.1p|3o.7.v.3.3.h.1.6.1a.20.1.2.47.8.1g.1.1.1e.1h.2.29|33.9.3.2.3e.21.46.7.1k.1b.4.2.1j.1.26|34.g.k.2.8.8.4.9.6.5.8.1.1d.1p.1.9.45.7.1i.1.1.3.1.16.2.2.1.2.2.1.1j.4.22|33.g.2.3.c.1.1.1.1.3.8.5.5.8.5.6.2.8.1.8.16.1m.2.4.4a.5.s.3.i.b.1.13.4.l.a.a.s.2.21|32.d.1.7.2.4.3.2.2.5.6.2.2.7.3.3.2.2.5.6.2.a.1d.2.1.1k.1.8.45.6.r.7.5.1.7.1.2.1t.1.v.o.2.24|31.c.3.j.1.6.8.9.3.2.8.7.3.8.2.4.1.5.13.1r.2.2.45.6.q.8.5.1.5.4.4.2k.1.2.j.a.2.8.1q|33.8.3.m.1.6.a.5.3.3.8.8.1.l.2.1.10.4.1.1q.43.8.q.8.2.4.1.b.2.1.1.2k.6.1.d.b.2.6.1q|0.5.15.2.1t.3.a.p.g.7.9.6.2.r.y.1.1.1j.2.6.44.1.1.5.m.b.2.5.4.9.1.2l.5.b.1.r.1j.2|14.1.1.d.1x.s.f.8.7.10.1.3.t.3.3.1b.1.4.3.5.2h.1.2.2.1.1.1.2.1.2.1e.6.k.a.3.i.1.48.15|11.r.15.1.n.5.1.m.a.a.a.f.1.i.2.1.r.2.1.1g.2.3.2l.2.1.3.1.b.1j.2.f.b.3.h.1.4a.14|y.17.j.3.1.7.3.1.3.3.9.t.1.2.5.2.4.6.e.3.7.2.5.i.1.1.o.6.1.1.1.1i.2c.2.1.j.1.2.1.3.1h.6.9.b.2.4t.g.3.2.c.7|x.1e.5.7.1.q.a.e.1.9.7.5.3.1.1.5.3.1.7.8.5.1.2.1.3.i.v.1g.2c.z.1.1.q.3.l.9.6.9.3.59.5.h.1|0.2.q.2v.2.9.4.3.7.1.6.6.4.6.1.4.6.7.a.1.3.c.z.1e.29.4.2.14.m.1.8.2.8.3.2.d.4.8.3.5.1.4n.1.11|0.5.n.2u.d.2.2.3.d.4.4.c.3.1.1.7.c.3.3.d.1.1.r.1.1.17.2f.1.1.1.2.1a.a.4.9.6.1.1.1.10.3.6.1.5o|0.9.m.2s.5.5.3.b.3.3.1.2.2.2.1.f.3.9.9.5.5.g.m.1.2.1.1.10.2o.1f.7.3.7.1c.3.5v|0.a.m.34.1.14.1.b.9.1.9.i.i.15.2q.1f.6.3.5.1c.4.5w|0.a.2.5.i.31.1.1a.1.4.i.n.h.12.2n.13.2.e.7.1d.2.3.3.5y|0.1.1.i.8.4.6.46.2.1.k.e.2.8.i.v.1.4.p.2.b.3.1k.1.1.14.6.6.4.3.1.7k|0.1.2.g.6.4b.2.5.1.3.m.b.5.6.j.3.1.r.s.4.2.c.1i.k.4.l.b.7r|0.1.7.7.c.4e.3.4.d.l.4.3.m.p.z.i.1h.h.8.i.b.7s|b.3.d.9.2.43.2.8.9.6.1.g.1.1.r.1.3.j.x.1.2.h.1f.j.7.l.3.5.2.7i.1.2.1.4.2|12.42.3.a.9.1.7.f.s.k.1.1.11.d.1g.l.6.o.4.7t.3|12.3t.1.4.6.6.3.4.g.g.q.m.14.6.1g.1.1.m.5.8n.3|j.4.c.40.a.1.d.2.c.6.3.4.s.k.2q.m.6.8q.2|u.41.i.3.m.1.2.5.3.1.t.h.2r.l.6.8o.1.4.1|t.41.j.1.6.1.3.6.1.3.9.5.x.e.1z.1.o.o.8.7v.2.o.8|s.41.r.1.3.c.19.e.2n.p.8.7k.6.5.2.k.c|t.t.2.34.x.c.1a.c.2n.o.9.7i.7.3.5.h.f|u.1.2.n.1.6.4.2w.y.g.17.1.3.7.2n.p.8.7h.8.1.5.h.h|q.3.2.o.2.9.5.2s.y.g.2.1.6.1.12.2.1.2.2b.1.c.r.2.1.4.7.7.70.e.7.2.1.6.1.j|10.i.2.4.i.2.1.2h.z.g.8.3.3u.1.1.q.j.70.d.5.x|10.g.4.2.o.2g.y.h.8.4.3t.1.1.9.1.f.a.6m.7.1.b.6.a.6.y|10.1.4.1.1.2.1.7.v.3.1.2b.1.1.u.h.1.2.4.7.3t.8.3.c.d.6l.z.6.2.1.w|19.7.2.2.w.2.1.2b.v.t.34.1.2.4.k.4.6.a.b.1.4.6g.10.7.10|19.4.3.3.x.1.2.1.1.2a.v.u.35.3.v.a.4.1.b.6f.y.c.y|17.4.4.3.y.2.1.1.1.2a.w.t.33.9.n.2.3.9.3.1.6.3.3.6d.10.c.y|16.3.19.2.3.2g.o.u.33.7.m.4.4.9.8.6j.z.e.y|13.4.1b.1.2.1.1.2h.h.2.4.u.34.6.l.6.4.6.a.6i.10.f.x|10.4.1h.2.2.2i.j.x.30.1.2.6.k.4.4.1.1.2.e.6g.11.d.10|y.2.2.1.1i.2s.b.z.1.1.2w.1.4.7.k.2.1.5.4.1.c.6e.13.d.10|v.3.1o.1.5.2o.5.17.2r.6.4.4.k.3.2.2.b.2.3.6e.5.1.z.d.b.1.o|2s.2n.6.16.2p.9.4.6.j.4.2.2.6.6q.3.1.1.1.5.1.q.8.14|q.1.1v.1.4.2p.6.12.2.5.2l.8.6.6.h.b.1.6u.2.4.4.1.q.8.14|n.1.1z.1.5.1.1.2l.6.1a.2l.7.3.a.a.7k.1.2.q.8.14|2o.1.4.1.1.2l.2.1.3.1a.2l.7.4.b.6.7m.1.3.p.5.17|b.1.2d.1.7.2j.7.1a.2i.8.4.c.6.7p.r.4.17|5.2.2p.2n.3.19.2l.3.7.c.6.7m.2.3.q.3.18|2x.2n.1.16.3.2.2y.9.3.7n.3.3.q.2.19|2v.2.2.3r.4.2.2v.7.5.7q.3.3.p.1.1b|2w.3g.5.1.2.4.5.2.2u.1.2.1.a.7q.3.4.m.2.1c|2y.4.2.36.6.2.a.2.1.1.35.7s.3.4.20|30.4.2.32.a.2.8.5.1.3.2w.7w.3.2.2.1.1z|32.3.2.2z.2.7.c.9.2t.1.3.7v.4.2.22|33.1.3.2y.1.9.b.b.2q.81.4.1.23|33.3.1.2x.1.9.b.a.2.2.2q.7y.5.1.23|34.2.1.37.j.1.2.2.2u.29.1.5k.6.2.22|34.3a.1.1.6.1.e.1.2u.26.3.n.6.4r.7.3.21|35.2t.1.g.2.2.2.3.3a.1r.2.8.6.l.8.4q.8.1.23|34.3e.3.1.1.1.3a.s.1.x.6.4.6.k.a.4p.o.1.1o|34.2r.1.g.4.6.3c.q.3.w.7.7.1.l.8.4r.9.2.b.1.1r|34.37.2.5.3g.r.5.s.9.2.6.j.8.4r.b.2.8.1.1t|34.32.6.3.3i.k.2.6.5.r.l.g.7.4r.b.4.3.1.1x|34.30.8.2.3j.i.6.5.6.p.m.g.7.4p.c.7.1y|33.30.3f.p.4.2.8.7.6.m.p.e.8.4h.1.4.e.8.1x|33.2z.3g.o.e.1.1.6.8.k.r.c.a.4e.3.1.d.8.20|33.2z.3h.n.b.2.4.6.9.i.r.d.9.4c.j.1.4.2.21|34.2z.3f.o.b.2.6.7.7.h.9.6.c.e.8.1.2.48.k.1.27|34.2u.3l.l.n.6.6.j.5.b.8.g.b.46.n.1.25|34.2u.3l.j.e.3.a.6.4.9.1.1.2.3.5.13.7.1.2.3p.2.f.l.3.25|33.2t.3m.j.g.2.b.4.2.1.2.6.1.3.4.1a.6.3s.3.d.n.4.24|34.2s.3m.i.5.2.a.2.d.1.6.7.6.1b.8.3o.4.4.2.6.p.4.24|34.2n.1.1.1.1.3m.i.i.2.d.2.7.6.5.1b.8.3n.5.1.7.4.p.4.24|35.2m.1.2.2n.1.z.j.w.1.9.4.8.18.a.3j.g.5.n.4.25|36.2k.2.2.3o.h.w.2.a.1.2.3.4.19.a.3k.e.7.m.3.26|38.2j.1.1.2s.1.w.g.r.5.b.1.1.3.7.19.a.3m.3.1.b.5.k.4.26|37.2k.3r.e.n.1.7.3.d.3.9.1a.7.3m.2.5.9.5.i.5.26|38.2k.3v.5.2.1.b.4.1.b.7.1.p.6.2.6.1.1.1.u.4.3t.9.7.e.8.27|38.2k.3w.1.c.k.12.1.5.3.4.4p.c.6.7.1.5.9.27|39.2k.3v.1.a.n.1e.4o.d.6.d.a.26|3a.2h.3x.3.1.1.4.p.p.4.1.1.d.2.4.4n.e.6.6.d.2.1.27|3b.2g.3w.10.16.2.5.4m.f.1.a.5.1.3.2.2.2b|3d.2b.3z.x.1f.4q.h.1.3.3.2.6.2f|3g.26.3z.11.1d.4q.i.1.1.1.3.4.2.1.2g|3h.24.3y.13.1c.4r.b.1.6.5.1.1.2m|3h.23.3i.1.f.1a.e.3.p.4s.f.1.2.4.2o|3i.21.3y.1e.9.6.o.4t.i.2.2p|3j.1z.3z.1e.9.a.j.4v.f.4.2p|3j.3.4.1r.3z.1h.7.f.5.5.3.4v.39|3k.3.3.1r.3z.1k.4.5n.39|3k.3.3.19.1.1.2.1.4.9.40.78.1.1.39|3l.3.3.z.1.1.2.7.8.1.3.5.3y.39.4.3z.38|3m.4.2.y.8.2.1.1.c.4.3x.2e.1.3.1.q.5.3z.38|3n.3.2.x.q.4.3h.1.d.2j.1.r.5.3x.39|3l.1.2.2.3.t.t.4.3j.1.a.2h.1.u.6.3v.g.1.2t|3m.1.1.3.4.q.t.5.3r.2l.4.r.6.3t.3b|3n.5.3.q.u.5.3p.2n.4.r.7.3r.3b|3q.3.3.p.v.4.3p.2n.4.s.7.3.1.1.2.3h.h.1.2v|3r.2.4.o.v.4.3n.2p.5.r.e.3h.g.1.2w|3s.1.4.p.v.3.3n.2q.5.q.2.1.9.1.2.3g.3d|3s.2.5.m.x.1.3n.2s.4.r.1.1.8.2.9.3.1.1.6.2y.3d|3s.3.5.l.12.1.3i.2s.4.t.6.4.l.2v.5.2.38|3t.3.5.k.13.1.3g.2u.4.t.5.5.l.2t.5.2.39|3v.2.5.j.4j.2v.6.13.k.2r.5.3.39|3w.1.6.h.4k.2v.6.15.j.2o.7.3.39|44.g.s.9.a.1.37.2x.6.15.m.14.1.1c.a.2.3a|45.f.r.2.3.7.3g.2y.5.16.i.6.2.10.2.17.e.1.3a|45.g.t.1.5.5.3d.30.4.15.k.5.1.y.5.14.3s|46.f.f.6.h.4.3b.30.4.14.m.4.1.t.a.v.5.1.3v|1b.1.2t.h.d.7.i.4.3b.2z.5.12.o.1.4.s.b.t.6.1.3v|45.h.d.6.k.7.38.2y.6.10.1.1.s.r.d.r.43|1c.2.2r.i.c.6.s.3.1.2.30.30.7.x.u.p.h.p.7.3.3u|1c.1.2t.i.a.7.t.8.2x.30.7.y.u.o.h.p.5.4.3v|48.g.9.8.u.8.2x.2z.7.w.w.n.j.n.6.4.3v|4a.h.1.c.j.4.5.6.1.1.2.1.3.3.2r.31.6.u.x.m.l.n.t.4.37|4d.r.1a.1.2p.31.7.r.z.l.m.o.s.3.38|4e.p.41.32.7.p.10.j.o.p.r.4.37|4h.m.40.33.7.m.14.i.o.3.1.1.1.k.q.4.37|4j.7.1.c.1h.2.2h.33.8.j.16.f.q.4.3.l.p.3.38|4m.2.5.a.1.8.3r.34.6.j.17.e.y.m.n.3.39|4u.i.3c.1.d.35.6.i.19.c.10.m.m.3.39|4v.i.3o.39.4.d.1d.c.10.m.o.1.39|4w.i.3o.39.3.c.1f.b.10.m.n.2.2.1.36|50.d.3q.39.1.1.1.8.1i.b.10.m.m.1.1.1.1.1.1.3.33|53.1.1.8.18.1.2g.3b.1.5.1m.c.10.3.2.h.m.2.4.1.34|55.8.3p.3c.1.2.1p.a.p.1.b.3.2.h.n.1.39|56.7.n.2.31.3c.1r.a.11.3.5.d.o.1.3.2.1.2.31|57.6.m.2.34.39.f.1.1d.9.p.1.b.3.6.c.q.1.5.1.31|58.4.k.4.3.4.2x.3b.a.5.1e.8.11.2.7.c.q.2.1.1.1.2.31|59.4.g.e.e.1.2l.39.3.b.1e.8.10.3.7.a.s.1.1.1.35|58.5.g.7.1.b.3.4.2.1.2l.3n.1e.7.12.1.b.4.p.1.7.2.34|59.1.1.3.f.7.2.j.2o.3l.1f.5.2.1.10.1.c.3.o.1.7.1.2.1.33|5c.3.5.4.4.8.2.k.2n.3k.1g.6.1.2.z.3.a.2.o.1.9.1.4.1.30|5d.8.2.2.2.v.2o.3j.1g.3.4.2.y.4.z.1.e.3.2z|5g.3.4.12.2l.3i.1i.2.4.3.y.4.19.7.2z|5h.3.3.13.2l.3h.1o.3.z.2.18.1.1.1.1.5.2z|5i.1.5.13.2l.3f.1p.4.z.2.x.1.9.1.3.3.1.1.2z|5p.13.2l.3d.1q.4.10.3.u.2.d.3.31|5p.14.2m.p.5.2h.1q.3.11.4.s.3.d.3.31|5p.1b.2g.k.a.2g.2v.4.r.5.d.1.31|5p.1e.2e.c.1.4.d.2e.2l.4.7.5.p.8.3d|5p.1f.2f.4.o.2d.2n.5.5.6.m.8.3f|5p.1g.3d.26.2o.5.4.6.l.8.3g|5q.1g.3b.1.1.24.2q.5.4.5.9.1.a.8.3h|5p.1h.3e.22.2s.5.4.4.j.9.3h|5o.1i.3e.21.2q.1.3.5.3.4.g.d.3g|5n.1k.3d.1z.2x.5.3.4.e.e.k.1.2v|19.1.4c.1m.3b.1z.2z.6.3.2.b.1.2.e.j.1.2w|5m.1m.3b.1x.2y.1.3.7.d.j.5.1.6.1.5.2.2v|5k.1n.3c.1w.30.1.2.7.d.i.4.9.6.2.2v|5k.1n.1.1.3a.1v.35.6.1.1.b.h.k.1.2w|4x.2.k.1m.2.4.38.1u.37.7.b.h.4.1.f.1.6.1.2p|4x.1.l.1s.1.2.34.1u.38.7.c.g.4.1.6.1.7.3.6.5.3.1.2g|5i.1s.1.5.32.1u.35.1.3.8.b.e.5.2.1.3.h.6.2k|5i.1r.1.9.30.1s.3a.8.2.1.8.d.6.5.5.1.a.1.3.4.4.2.1.2.2b|5i.21.30.1r.39.1.2.8.a.d.5.6.l.1.7.6.29|5k.23.2x.1o.3f.a.2.1.4.d.5.3.1.2.k.1.1.3.3.b.25|5k.29.2s.1n.3f.9.c.2.1.5.6.3.1.3.7.2.3.4.4.5.1.e.i.1.1k|5i.2d.2r.1m.3g.8.h.2.1.1.6.2.1.3.8.1.7.1.4.1.1.k.20|5i.2e.2r.1k.3i.7.r.2.2.3.o.k.d.1.1.1.1i|5h.2g.2r.1i.3l.5.r.2.2.1.t.i.c.2.1j|5i.2j.2n.1i.1.1.3k.4.r.2.4.1.t.h.a.2.1k|5i.2k.2m.1i.3p.1.1h.1.2.1.7.h.4.6.6.1.1e|5i.2k.2n.1i.3p.4.1g.1.8.i.4.2.9.1.1d|5k.2i.2n.1i.3o.6.4.2.19.1.9.g.h.1.1c|5l.2h.2o.1h.3q.c.1h.g.k.1.19|5l.2h.2o.1h.3t.1.2.a.n.1.9.1.d.c.2.5.i.1.3.1.16|5m.2g.2p.1g.3z.9.f.4.p.3.2.7.5.4.i.2.18|5m.2g.2p.1g.47.1.1.1.1.3.3.4.6.4.r.6.6.4.o.1.12|5n.2e.2p.1h.4p.3.y.1.8.4.2.1.l.1.11|5n.2d.2q.1h.4g.2.6.3.19.5.k.2.12|5o.2c.2r.1h.4n.1.1e.4.1m|5o.2a.2t.1i.4l.1.25.1.z|5p.29.2u.1h.51.1.1.1.j.2.22|5q.27.2v.1h.5.1.4t.2.3.2.h.2.22|5q.26.2v.1i.h.1.4j.1.1.8.1.1.9.3.22|5r.25.2u.1j.h.1.4i.c.b.3.21|5r.23.2v.1k.h.2.4g.c.b.4.21|f.1.5c.22.2v.1k.f.4.4g.d.a.4.21|5s.22.2v.1k.f.4.48.3.4.d.1.1.9.4.21|5s.22.2u.1m.d.5.46.6.3.c.c.7.1y|5u.20.2u.1l.d.7.45.6.1.f.b.8.16.1.q|5v.1z.2u.1l.c.6.1.1.44.o.a.8.1x|5x.1x.2u.1k.9.b.43.1.1.q.8.8.19.1.m.1|5z.1v.2u.1j.a.a.42.1.1.u.5.9.19.1.k.1.2|61.1t.2t.1h.c.b.41.y.4.a.1w|1p.1.4c.1s.2t.1f.e.b.41.1c.1r.2.3|63.1q.2v.1e.e.b.41.1d.1v|63.1q.2w.1c.f.a.41.1e.1v|63.1q.2w.1a.i.9.41.1f.1u|64.1o.2y.17.k.9.3z.1i.1t|64.1n.2z.17.k.8.i.1.3e.1n.1r|64.1n.30.17.i.9.3s.1t.v.1.4.1.p|64.1m.31.17.h.a.e.1.3c.1u.w.1.t|64.1m.32.17.g.9.3q.1x.w.2.r|64.1l.34.16.g.9.3p.1y.y.1.q|63.1l.35.16.g.9.3n.23.1m|63.1g.3a.16.g.8.3p.22.1m|63.1e.3c.16.g.8.3o.24.1l|63.1b.3f.16.g.8.3o.25.1k|63.1a.3g.15.i.6.3p.26.1.1.1h|63.19.3i.11.m.3.3s.25.1.1.1h|63.18.3j.10.4i.26.1i|63.18.3j.10.4g.1.1.26.1i|62.19.3j.10.4h.27.1i|62.19.3k.z.4i.26.1i|62.19.3k.y.4j.27.1h|62.19.3l.x.4k.26.1h|61.19.3n.v.4l.26.1h|61.18.3p.t.4n.25.1h|61.17.3q.s.4o.25.1h|61.14.1.2.3r.r.4o.24.1i|61.14.3u.q.4p.24.1i|61.14.3v.o.4r.23.1i|61.13.3w.n.4s.r.6.16.1i|61.13.3x.l.4t.o.c.12.1j|61.12.3x.k.4v.j.i.10.1k|61.12.3x.j.4w.h.l.6.1.r.1l|60.11.40.f.4y.h.n.4.1.s.1l|60.r.1.9.41.6.56.9.w.2.2.r.1m|60.s.3.4.44.1.5c.5.y.1.3.1.1.p.1m|5z.u.aw.o.19.2.c|5z.u.as.2.3.m.1b.2.b|5y.w.ax.l.1d.1.a|5y.x.ax.k.1d.1.1.1.8|5x.x.ay.k.1d.3.8|5x.w.b0.i.1f.3.2.2.3|5x.v.b3.6.1.5.1i.8.3|5x.s.d0.7.4|5y.l.d5.6.6|5x.n.d5.5.6|5x.m.d7.3.7|5w.n.bi.1.1o.3.7|5w.i.bn.8.1b.2.1.5.8|5x.1.1.f.bo.7.1a.6.b|5w.1.1.j.bm.5.1b.5.c|5w.1.1.g.2.1.bm.5.1a.5.d|5v.2.1.g.bq.2.1a.5.f|7.1.5q.f.d1.8.e|5y.f.cz.7.h|5v.1.1.g.cy.7.i|5w.e.d0.8.i|5x.c.d1.7.j|5u.2.1.c.d2.5.k|5u.g.dq|5v.h.do|5v.1.1.f.do|5u.h.dp|5u.g.dq|5u.f.7l.1.1.1.63|5t.f.ds|5t.1.1.c.dt|5u.c.du|5u.1.1.a.du|5w.a.i.4.d8|5u.1.1.9.1.1.dt|5x.1.1.3.1.4.dt|5y.2.1.1.1.4.dt|5x.2.1.2.2.5.dr|61.1.3.5.1o.1.c1|63.1.1.9.1.1.1j.1.c0|66.1.1.2.dq|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|k0|6t.1.1.3.d2|6m.1.2.3.d8|6j.1.2.4.2.1.d7|6g.2.1.4.dd|6g.4.dg|6f.5.dg|6a.1.2.6.1.1.69.a.2i.9.a.7.x.7.2.2.2g|68.1.2.5.69.1.3.c.1w.10.3.b.f.8.5.n.18.1.x|66.2.1.5.6c.k.1e.1o.3.7.3.1c.1z|6a.3.65.16.v.3h.1.4.1v|6a.4.5z.1j.i.3s.1u|6a.5.1.1.5.1.57.2.d.1m.h.42.1.2.2.3.1e|60.4.6.8.1.1.59.5.9.1o.f.4j.17|5t.1.6.5.2.c.4d.1.x.8.1.1.3.1n.e.4o.14|64.2.2.b.3j.1.5.1.9.1.7.1.5.1.4.1.e.2.8.21.a.4x.12|5u.3.5.5.2.b.34.1.4.2.e.e.1.e.4.3.2.2.7.2a.6.4z.1.a.q|5z.8.2.d.2t.3.3.3.d.3s.6.5e.n|5t.6.1.8.2.c.2r.4e.7.5k.i|4f.7.1.2.1c.1.1.4.3.d.2q.4e.2.1.2.5k.k|4a.1.m.1.4.1.16.e.2k.1.2.4g.2.5o.k|4a.c.3.2.1.5.2.6.3.1.a.3.6.3.1.1.7.g.2.2.2g.4m.1.5j.q|2z.1.5.5.10.4.1.10.2.9.2.u.28.1.9.a4.s|36.4.c.3.3.2.j.27.2a.1.b.a0.u|2g.3.d.8.5.f.5.2.l.22.1.1.2g.a1.2.1.w|28.1r.5.9.6.1x.2j.a0.11|1z.4f.2a.ad.z|1q.5.1.4b.29.al.z|1m.2.1.2.6.3t.a.1.2a.ar.y|18.8.5.1.4.2.5.3u.2f.ax.6.1.q|17.h.1.49.25.b1.5.1.q|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0|0.k0";
const GLOBE = {
  rows: 42,             // text lines across the globe (~7px type at the reveal's size)
  revealCols: 5,        // the reveal: a block this many cells wide
  revealRows: 10,       // and this many high (2026-11-05: 5 x 10, was 6 x 6)
  font: 12,             // px (scaled with the page)
  spinDegPerSec: 8,     // slow turn, west to east
  rippleMs: 520,        // the ripple's spread from the pressed cell to the edge
  cellMs: 260,          // each cell's own open / close
  mint: "#5FEFA8",
  ink: "#0F4F32",
};

let landMask = null; // 720 x 360, 1 = land, row 0 at 90 N
function buildLandMask() {
  const W = 360 * LAND_RES;
  landMask = new Uint8Array(W * 180 * LAND_RES);
  LAND_RLE.split("|").forEach((row, r) => {
    let c = 0, land = 0;
    for (const run of row.split(".")) {
      const n = parseInt(run, 36);
      if (land) landMask.fill(1, r * W + c, r * W + c + n);
      c += n; land ^= 1;
    }
  });
}
const isLand = (lon, lat) => {
  const W = 360 * LAND_RES;
  const col = ((Math.floor((lon + 180) * LAND_RES) % W) + W) % W;
  const row = Math.max(0, Math.min(180 * LAND_RES - 1, Math.floor((90 - lat) * LAND_RES)));
  return landMask[row * W + col] === 1;
};

// one frame of the globe as text, matched to the user's reference
// hf_20261106_011535 and its ascii-globe JSON (2026-11-10, "identical"; the
// 2026-11-05 digits-and-shadow look is gone): the land is solid type in X, H
// and M (X and H mostly, M where it is deepest), its coast a thin break-up
// of - : . with an empty halo round it; the sea is a field of dots, thinning
// to nothing at the limb; a graticule every 30 degrees, : down the meridians
// and - along the parallels (dashes also cross the land); a dotted rim
// closes the circle. Returns two layers of lines, the land (drawn bold) and
// the rest.
// Accuracy: a true orthographic view tilted (TILT) to look down on the
// northern tropics, as the reference does; a character is land if most of
// its patch of the surface is (3 x 3 samples), not just its centre. Each
// character belongs to a spot on the surface (hashed from its longitude /
// latitude), so the type travels with the land as the globe turns.
const LAND_CH = "XHXHHXM"; // the land's type, hashed per spot
const COAST_CH = "-:.";    // the coast's break-up
const GRAT_DEG = 30;       // the graticule's spacing
const TILT = 15;  // the latitude at the centre of the view (the reference looks at the mid Atlantic)
const surfHash = (lon, lat) => {
  const a = Math.floor(((lon % 360) + 360) % 360 * 2.2), b = Math.floor((lat + 90) * 2.2);
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
// does a multiple of `step` fall between a and b (angles, degrees)?
const crosses = (a, b, step) => Math.floor(Math.min(a, b) / step) !== Math.floor(Math.max(a, b) / step);
function globeLines(cols, rows, spin) {
  const land = [], rest = [];
  const R2D = 180 / Math.PI, sinT = Math.sin(TILT / R2D), cosT = Math.cos(TILT / R2D);
  // a point on the disc (x right, y up, both -1..1) -> its place on the earth
  const geoAt = (nx, ny) => {
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return null;
    const nz = Math.sqrt(1 - d2);
    const lat = Math.asin(Math.max(-1, Math.min(1, nz * sinT + ny * cosT))) * R2D;
    const lon = spin + Math.atan2(nx, nz * cosT - ny * sinT) * R2D;
    return { nx, ny, nz, d2, lat, lon };
  };
  const cx = (c) => (2 * (c + 0.5)) / cols - 1, cy = (r) => 1 - (2 * (r + 0.5)) / rows;
  const dx = 2 / cols, dy = 2 / rows;
  const cover = (c, r) => {
    let n = 0, m = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const p = geoAt(cx(c) + (i * dx) / 3, cy(r) + (j * dy) / 3);
      if (!p) continue;
      m++; if (isLand(p.lon, p.lat)) n++;
    }
    return m ? n / m : 0;
  };
  const cov = [];
  for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) row.push(cover(c, r)); cov.push(row); }
  // each character's neighbourhood: the most land in it (the coast's halo)
  // and the average (how deep inside the land it is)
  const grown = [], depth = [];
  for (let r = 0; r < rows; r++) {
    const g = [], d = [];
    for (let c = 0; c < cols; c++) {
      let m = 0, sum = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const rr = r + j, cc = c + i;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) { m = Math.max(m, cov[rr][cc]); sum += cov[rr][cc]; n++; }
      }
      g.push(m); d.push(n ? sum / n : 0);
    }
    grown.push(g); depth.push(d);
  }
  for (let r = 0; r < rows; r++) {
    let L = "", S = "";
    for (let c = 0; c < cols; c++) {
      const p = geoAt(cx(c), cy(r));
      if (!p) { L += " "; S += " "; continue; }
      // the dotted rim: the disc's edge characters (inside it, with a neighbour outside)
      if (!geoAt(cx(c - 1), cy(r)) || !geoAt(cx(c + 1), cy(r)) || !geoAt(cx(c), cy(r - 1)) || !geoAt(cx(c), cy(r + 1))) {
        L += " "; S += "."; continue;
      }
      const { nz, lat, lon } = p;
      const h = surfHash(lon, lat);
      // the graticule: does a meridian / parallel pass through this character?
      const pw = geoAt(cx(c) - dx / 2, cy(r)), pe = geoAt(cx(c) + dx / 2, cy(r));
      const pn = geoAt(cx(c), cy(r) + dy / 2), ps = geoAt(cx(c), cy(r) - dy / 2);
      const meridian = pw && pe && crosses(pw.lon, pe.lon, GRAT_DEG);
      const parallel = pn && ps && crosses(pn.lat, ps.lat, GRAT_DEG);
      const k = cov[r][c];
      if (k >= 0.5) {
        // the land: solid type, a dash where a parallel crosses it
        if (parallel && h % 2 === 0) { L += " "; S += "-"; continue; }
        const dp = depth[r][c];
        const ch = dp > 0.9 ? LAND_CH[h % LAND_CH.length] : dp > 0.65 ? "XH"[h % 2] : "X";
        L += ch; S += " "; continue;
      }
      if (k > 0) {
        // the coast: a patch only partly land breaks up
        L += " "; S += (h % 3 === 0) ? " " : COAST_CH[h % COAST_CH.length]; continue;
      }
      if (grown[r][c] > 0) { L += " "; S += " "; continue; } // the halo round the land
      // the sea: the graticule, else a field of dots that thins out to the limb
      if (meridian) { L += " "; S += ":"; continue; }
      if (parallel) { L += " "; S += "-"; continue; }
      const dot = (c + r) % 2 === 0 && (nz > 0.5 || (nz > 0.25 && h % 3 === 0));
      L += " "; S += dot ? "." : " ";
    }
    land.push(L); rest.push(S);
  }
  return { land, rest };
}

let globeCanvas = null, globeCtx = null, globeRaf = 0;
// 2026-11-05: the stat that comes with the globe: a cell box on the reveal's
// lower left (STAT.row of its rows down, from a cell left of it, STAT.cols
// cells wide). It wipes open left to right and types on as the cells open,
// and wipes back off and untypes as they close.
const STAT = { delayMs: 260, inMs: 520, outMs: 360 }; // the box's timing (its text and place: REVEALS)
// 2026-11-06: the press-and-hold reveals, taking turns press by press: the
// globe, then the REPT sheet (a block of rows each typing "40+ Years of
// Making Cells Look Good", with the =REPT formula that "made" them), then the
// globe again. Each: the block's size in cells and its box (text, the row it
// sits on, its start in cells from the block's left, its width in cells).
const REVEALS = {
  globe: { cols: GLOBE.revealCols, rows: GLOBE.revealRows, stat: { text: "1.2B users world wide", row: 7, colOff: -1, cols: 3 } },
  rept: {
    cols: 4, rows: 11, line: "40+ Years of Making Cells Look Good",
    stat: { text: '=REPT("40+ Years of Making Cells Look Good. ",11)', row: 2, colOff: -2, cols: 5, font: 11.4 }, // (its 47 characters fit 5 cells at 11.4)
  },
};
const REVEAL_ORDER = ["globe", "rept"];
let revealTurn = 0;
let statEl = null;
function drawStat(g, now) {
  if (!statEl) return;
  let p;
  if (!g || (g.upAt && now - g.upAt > STAT.outMs)) p = 0;
  else if (!g.upAt) p = (now - g.downAt - STAT.delayMs) / STAT.inMs;
  else {
    const held = Math.max(0, Math.min(1, (g.upAt - g.downAt - STAT.delayMs) / STAT.inMs));
    p = held - (now - g.upAt) / STAT.outMs;
  }
  p = Math.max(0, Math.min(1, p));
  if (p <= 0) { statEl.style.display = "none"; return; }
  statEl.style.display = "flex";
  statEl.style.left = `calc(${g.statX} * var(--u))`;
  statEl.style.width = `calc(${g.stat.cols * COL_W} * var(--u))`;
  statEl.style.fontSize = g.stat.font ? `calc(${g.stat.font} * var(--u))` : "";
  statEl.style.top = `calc(${g.statY} * var(--u))`;
  const box = easeOut(Math.min(1, p * 1.6));            // the box opens first
  const typed = Math.max(0, Math.min(1, p * 1.4 - 0.35)); // then the type follows it
  statEl.style.clipPath = `inset(0 ${((1 - box) * 100).toFixed(2)}% 0 0)`;
  statEl.textContent = g.stat.text.slice(0, Math.round(typed * g.stat.text.length));
}
let globeHold = null; // { cx, cy (spec units: the globe's centre), cells: [{x,y,w,h,delay}], downAt, upAt }
const GLOBE_START_LON = -30; // each press starts the globe centred on the mid Atlantic, as the reference is (30 W; TILT gives the latitude; was the USA, 98 W, until 2026-11-10)
let globeSpin = GLOBE_START_LON, globeLast = 0;

function sizeGlobe() {
  if (!globeCanvas) return;
  const r = globeCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  globeCanvas.width = Math.round(r.width * dpr);
  globeCanvas.height = Math.round(r.height * dpr);
  globeCtx.setTransform(dpr * glowScale, 0, 0, dpr * glowScale, 0, 0);
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function drawGlobe(now) {
  globeRaf = 0;
  if (!globeCtx || !globeHold) return;
  const g = globeHold;
  globeSpin -= ((now - (globeLast || now)) / 1000) * GLOBE.spinDegPerSec; // land drifts left to right, west to east
  globeLast = now;
  globeCtx.save();
  globeCtx.setTransform(1, 0, 0, 1, 0, 0);
  globeCtx.clearRect(0, 0, globeCanvas.width, globeCanvas.height);
  globeCtx.restore();

  // each cell's openness: while held it opens after its ripple delay; after
  // release it closes, the outermost first (its delay mirrored)
  const maxDelay = GLOBE.rippleMs;
  let anyOpen = false;
  const open = g.cells.map((cell) => {
    let p;
    if (!g.upAt) p = (now - g.downAt - cell.delay) / GLOBE.cellMs;
    else {
      const heldP = Math.max(0, Math.min(1, (g.upAt - g.downAt - cell.delay) / GLOBE.cellMs));
      p = heldP - Math.max(0, (now - g.upAt - (maxDelay - cell.delay)) / GLOBE.cellMs);
    }
    p = easeOut(Math.max(0, Math.min(1, p)));
    if (p > 0) anyOpen = true;
    return p;
  });

  // 2026-11-05: the cells fade (not scale) on and off. The scene (mint, the
  // globe's type) is drawn once a frame on an offscreen canvas over the
  // cells' bounds, then each open cell copies its own piece at its opacity.
  const k = globeCanvas.width / 1440; // device px per spec unit
  if (!g.off) {
    g.bx = Math.min(...g.cells.map((c) => c.x)); g.by = Math.min(...g.cells.map((c) => c.y));
    g.bw = Math.max(...g.cells.map((c) => c.x + c.w)) - g.bx; g.bh = Math.max(...g.cells.map((c) => c.y + c.h)) - g.by;
    g.off = document.createElement("canvas");
    g.off.width = Math.ceil(g.bw * k); g.off.height = Math.ceil(g.bh * k);
  }
  const o = g.off.getContext("2d");
  o.setTransform(k, 0, 0, k, -g.bx * k, -g.by * k);
  o.fillStyle = GLOBE.mint;
  o.fillRect(g.bx, g.by, g.bw, g.bh);
  if (g.mode === "rept") drawRept(o, g, now);
  else drawGlobeText(o, g);
  copyCells(g, open, k);

  drawStat(g, now);
  if (anyOpen || !g.upAt) globeRaf = requestAnimationFrame(drawGlobe);
  else { globeHold = null; drawStat(null, now); } // fully closed
}

// the REPT sheet: one line per row, in the page's mono, each typing on just
// after its row's cells come in (the top row first) and holding once typed
function drawRept(o, g, now) {
  const text = REVEALS.rept.line;
  const held = (g.upAt || now) - g.downAt;
  o.fillStyle = GLOBE.ink;
  o.textBaseline = "middle";
  // as large as fits: at most half a row tall, and the whole line inside the
  // block with a small margin either side
  const pad = COL_W * 0.11;
  o.font = `10px "Space Mono", ui-monospace, monospace`;
  const per10 = o.measureText(text).width; // its width at 10px
  const size = Math.min(ROW_H * 0.48, (10 * (g.cols * COL_W - 2 * pad)) / per10);
  o.font = `${size.toFixed(2)}px "Space Mono", ui-monospace, monospace`;
  for (let j = 0; j < g.rows; j++) {
    const t = Math.max(0, Math.min(1, (held - 140 - j * 55) / 650));
    const n = Math.round(t * text.length);
    if (n) o.fillText(text.slice(0, n), g.bx + pad, g.by + (j + 0.5) * ROW_H);
  }
}

function drawGlobeText(o, g) {
  const lineH = (g.radius * 2) / GLOBE.rows;
  const fontPx = (lineH * 0.95).toFixed(2);
  o.font = `bold ${fontPx}px "Courier New", Courier, monospace`;
  const charW = o.measureText("M").width; // (monospace: the same width at either weight)
  const cols = Math.round((g.radius * 2) / charW);
  o.fillStyle = GLOBE.ink;
  o.strokeStyle = GLOBE.ink;
  o.textBaseline = "middle";
  const { land, rest } = globeLines(cols, GLOBE.rows, globeSpin);
  const left = g.cx - (cols * charW) / 2;
  const rowY = (r) => g.cy - g.radius + (r + 0.5) * lineH;
  // the sea, graticule and rim in a regular weight; the land bold, with a thin
  // stroke on top for extra weight, so the continents stand out
  o.font = `${fontPx}px "Courier New", Courier, monospace`;
  rest.forEach((line, r) => o.fillText(line, left, rowY(r)));
  o.font = `bold ${fontPx}px "Courier New", Courier, monospace`;
  o.lineWidth = Math.max(0.35, lineH * 0.06);
  land.forEach((line, r) => { o.fillText(line, left, rowY(r)); o.strokeText(line, left, rowY(r)); });
}

function copyCells(g, open, k) {
  // 2026-11-05: no grid lines in the box. Copied cell by cell, the pieces'
  // edges fell between pixels (rows are 31.22 apart) and left faint seams
  // that showed the grid. The fully open cells are now one shape (a single
  // clipped copy, no inner edges); the cells still fading are copied on
  // whole device pixels, so neighbours meet exactly.
  globeCtx.save();
  globeCtx.beginPath();
  let anyFull = false;
  g.cells.forEach((cell, i) => { if (open[i] >= 1) { globeCtx.rect(cell.x, cell.y, cell.w, cell.h); anyFull = true; } });
  if (anyFull) {
    globeCtx.clip();
    globeCtx.drawImage(g.off, 0, 0, g.off.width, g.off.height, g.bx, g.by, g.off.width / k, g.off.height / k);
  }
  globeCtx.restore();
  globeCtx.save();
  globeCtx.setTransform(1, 0, 0, 1, 0, 0); // device pixels
  g.cells.forEach((cell, i) => {
    const p = open[i];
    if (p <= 0 || p >= 1) return;
    const x0 = Math.round(cell.x * k), y0 = Math.round(cell.y * k);
    const x1 = Math.round((cell.x + cell.w) * k), y1 = Math.round((cell.y + cell.h) * k);
    const sx = x0 - Math.round(g.bx * k), sy = y0 - Math.round(g.by * k);
    globeCtx.globalAlpha = p;
    globeCtx.drawImage(g.off, sx, sy, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  });
  globeCtx.restore();
}

function mountGlobe() {
  globeCanvas = root.querySelector("#globe-reveal");
  if (!globeCanvas) return;
  globeCtx = globeCanvas.getContext("2d");
  statEl = root.querySelector("#globe-stat");
  if (!landMask) buildLandMask();
  sizeGlobe();
  on(window, "resize", sizeGlobe);
  on(root, "pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest(".box, .photo, a, button")) return; // on the grid itself only
    const r = globeCanvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / glowScale, y = (e.clientY - r.top) / glowScale;
    const cell = cellAt(x, y);
    if (!cell || y >= TOP_H) return; // the top grid's even cells
    e.preventDefault();
    // 2026-11-05: the reveal is a block of revealCols x revealRows cells
    // around the pressed cell (clamped inside the top grid), every cell of
    // it; the globe sits in its middle, scaled to fit it (its shorter side)
    const mode = REVEAL_ORDER[revealTurn++ % REVEAL_ORDER.length];
    const R = REVEALS[mode];
    const RC = R.cols, RR = R.rows;
    // (shifted 1 cell right and 2 up from centred on the press, 2026-11-05)
    const col0 = Math.max(0, Math.min(1440 / COL_W - RC, Math.round(cell[0] / COL_W) - Math.floor((RC - 1) / 2) + 1));
    const row0 = Math.max(0, Math.min(Math.round(TOP_H / ROW_H) - RR, Math.round(cell[1] / ROW_H) - Math.floor((RR - 1) / 2) - 2));
    const cx = (col0 + RC / 2) * COL_W, cy = (row0 + RR / 2) * ROW_H;
    const radius = (Math.min(RC * COL_W, RR * ROW_H) / 2) * 0.94;
    const pressX = cell[0] + COL_W / 2, pressY = cell[1] + ROW_H / 2;
    const cells = [];
    let far = 1;
    for (let j = 0; j < RR; j++) for (let i = 0; i < RC; i++) {
      const gx = (col0 + i) * COL_W, gy = (row0 + j) * ROW_H;
      const d = Math.hypot(gx + COL_W / 2 - pressX, gy + ROW_H / 2 - pressY);
      far = Math.max(far, d);
      cells.push({ x: gx, y: gy, w: COL_W, h: Math.min(ROW_H, TOP_H - gy), d });
    }
    // the ripple runs out from the pressed cell to the block's farthest corner
    cells.forEach((c) => { c.delay = (c.d / far) * GLOBE.rippleMs; });
    // pressing again while it's still closing restarts it from the new cell
    globeHold = { mode, rows: RR, cols: RC, cx, cy, radius, cells, downAt: performance.now(), upAt: 0, stat: R.stat,
      statX: Math.max(0, Math.min(1440 - R.stat.cols * COL_W, (col0 + R.stat.colOff) * COL_W)), statY: (row0 + R.stat.row) * ROW_H };
    globeLast = 0;
    globeSpin = GLOBE_START_LON;
    if (!globeRaf) globeRaf = requestAnimationFrame(drawGlobe);
  });
  const release = () => { if (globeHold && !globeHold.upAt) globeHold.upAt = performance.now(); };
  on(window, "pointerup", release);
  on(window, "pointercancel", release);
  on(window, "blur", release);
}

// ----------------------------------------------------------- photo scrubs

// The photo clips are driven by the scroll, not played: each clip's time
// follows its frame's travel up the screen, from the frame's top reaching
// SCRUB.startAt of the screen height (first frame) to its bottom edge reaching
// SCRUB.endAt (last frame). Scrolling back runs it backwards. The playhead
// eases toward the target so it glides rather than steps. Each clip's TRIM(cell)
// box tracks in with it: letter-spacing (em) from the first frame to the last,
// so it squeezes from wide to very tight.
const SCRUB = {
  startAt: 0.55, // first frame until the frame's top is this far down the screen
  endAt: 0.95, // last frame when the frame's bottom edge is this far down the screen
  ease: 0.18, // fraction of the gap to the target time closed each frame
  trackOffset: 0.5, // the TRIM boxes start squeezing once their clip is this far through
  clips: [
    // the EXCEL title inflates (2026-11-04). It is already on screen when the page
    // opens, so it runs off the page's own scroll (travel): its first frame (flat
    // EXCEL) until the page scrolls at all (or its top passes startAt, if it opens
    // lower than that), then, play: the whole clip plays through at real time;
    // scrolling back to the top runs it back. content: the source has an ~8px
    // light green border baked in, so the stills crop 10px off every edge
    // box: = EXP(10) tracks out (tight -> wide) as the letters inflate, over the
    // first 45% of the clip (where the inflating happens)
    { video: "#title-video", box: "#formula-3", track: [-0.04, 0.9], trackStart: 0, trackEnd: 0.45, startAt: 0.85, travel: 0.6, frames: true, play: true, speed: 1, content: [10, 10, 854, 274] },
    // the hair shrinks; drawn from stills (frames). play: the scroll only triggers
    // it: once the frame's top passes startAt it plays through at real time, and
    // scrolling back above that runs it back to the start; speed: times real time
    // content: the picture inside the clip's frame (source px): hair.mp4 is a
    // square picture with black bars either side (measured: x 420-1499), so the
    // stills use just that, 4px in from each side so no dark edge column shows
    // speed 2026-11-04: 4 -> 1 (real time, like the EXCEL title) -> 2 (~2s, "make faster")
    { video: "#portrait-video", box: "#formula-1", track: [0.9, -0.08], easeTrack: true, frames: true, play: true, speed: 2, content: [424, 0, 1072, 1080] },
    // the car sits at the very bottom of the site, so the page cannot scroll it
    // far enough for the usual run: it starts lower and ends at the bottom of the page
    // play: like the hair, the scroll only triggers it; it then plays at real time.
    // trackStart / trackEnd: its TRIM squeezes over the whole clip, first frame to last
    { video: "#car-video", box: "#formula-2", track: [0.7, -0.08], easeTrack: true, startAt: 0.8, endAtPageBottom: true, frames: true, play: true, speed: 2, trackStart: 0, trackEnd: 1 },
  ],
};

let scrubRafs = [];
let scrubUrls = []; // object URLs of the in-memory clips
let scrubBitmaps = []; // decoded stills of the frame-drawn clips (closed on unmount)

// Seeking a video lands late (each seek decodes on from the last keyframe:
// 50-150 ms for the hair clip), so a scrub that seeks shows a new picture only
// every few scroll ticks and steps. A clip with `frames: true` is read once into
// stills instead (FRAMES.fps of them a second, JPEGs of just the part its frame
// shows) and drawn on a canvas over the video, cross-fading between neighbour
// stills, so every scroll position has its picture at once.
const FRAMES = { fps: 24, quality: 0.9, decoded: 16 };

/** Reads clip v into stills cropped as its object-fit: cover shows it (within
 *  content, [x, y, w, h] in source px, if the picture does not fill the frame); done(blobs). */
function captureFrames(v, box, done, content) {
  const r = box.getBoundingClientRect();
  if (!v.videoWidth || !v.videoHeight || !r.width || !r.height) return;
  const [cx, cy, vw, vh] = content || [0, 0, v.videoWidth, v.videoHeight];
  const s = Math.max(r.width / vw, r.height / vh);
  const sw = Math.min(vw, r.width / s), sh = Math.min(vh, r.height / s);
  const [px, py] = getComputedStyle(v).objectPosition.split(" ").map((q) => parseFloat(q) / 100);
  const sx = cx + (vw - sw) * (isNaN(px) ? 0.5 : px), sy = cy + (vh - sh) * (isNaN(py) ? 0.5 : py);
  const c = document.createElement("canvas");
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  const g = c.getContext("2d");
  // a detached copy plays through once (as fast as seeking would allow, about
  // the clip's own length), each frame it shows grabbed as it comes; the visible
  // clip is left alone
  const reader = document.createElement("video");
  reader.muted = true;
  reader.playsInline = true;
  reader.preload = "auto";
  reader.src = v.currentSrc || v.src;
  const count = Math.max(1, Math.floor(v.duration * FRAMES.fps));
  const blobs = new Array(count);
  let encoding = 0, ended = false, filling = false, filled = false;
  // a frame the playback went past without a callback (often the first few,
  // while the decoder warms up) is then fetched exactly, by seeking to it;
  // borrowing a neighbour there would start the clip on a later picture
  // (2026-11-04: the title opened on a half-inflated E)
  const fillMissing = (missing) => {
    if (!root) return;
    if (!missing.length) { filling = false; filled = true; finish(); return; }
    const k = missing.shift();
    reader.addEventListener("seeked", () => {
      if (!root) return;
      g.drawImage(reader, sx, sy, sw, sh, 0, 0, c.width, c.height);
      c.toBlob((b) => { blobs[k] = b; fillMissing(missing); }, "image/jpeg", FRAMES.quality);
    }, { once: true });
    reader.currentTime = Math.min(Math.max(0, reader.duration - 0.01), (k + 0.25) / FRAMES.fps); // inside still k's slot (grab: k = round(t * fps - 0.5))
  };
  const finish = () => {
    if (!ended || encoding || filling || !root) return;
    if (!filled) {
      const missing = [];
      for (let k = 0; k < count; k++) if (!blobs[k]) missing.push(k);
      if (missing.length) { filling = true; reader.pause(); fillMissing(missing); return; }
    }
    // anything still missing borrows its neighbour
    for (let k = 1; k < count; k++) if (!blobs[k]) blobs[k] = blobs[k - 1];
    for (let k = count - 2; k >= 0; k--) if (!blobs[k]) blobs[k] = blobs[k + 1];
    reader.removeAttribute("src");
    reader.load();
    if (blobs[0]) done(blobs);
  };
  const grab = (now, meta) => {
    if (!root) return;
    const k = Math.max(0, Math.min(count - 1, Math.round(meta.mediaTime * FRAMES.fps - 0.5)));
    if (!blobs[k]) {
      g.drawImage(reader, sx, sy, sw, sh, 0, 0, c.width, c.height);
      encoding++;
      c.toBlob((b) => { blobs[k] = b; encoding--; finish(); }, "image/jpeg", FRAMES.quality);
    }
    if (!ended) reader.requestVideoFrameCallback(grab);
  };
  reader.addEventListener("ended", () => { ended = true; finish(); }, { once: true });
  reader.addEventListener("loadeddata", () => {
    if (!root || !reader.requestVideoFrameCallback) return; // no frame callbacks: stays a seeking scrub
    reader.requestVideoFrameCallback(grab);
    reader.play().catch(() => {});
  }, { once: true });
}

function scrubTargetFor(video, clip) {
  const r = video.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  if (clip.travel) {
    // by scroll distance: from where its top passes startAt (or the page's top,
    // if it is already above that on load) over travel screen heights
    const s0 = Math.max(0, r.top + window.scrollY - vh * clip.startAt);
    const p = (window.scrollY - s0) / (vh * clip.travel);
    return Math.max(0, Math.min(1, p)) * Math.max(0, (video.duration || 0) - 0.05);
  }
  const from = vh * (clip.startAt || SCRUB.startAt); // frame top here -> first frame
  // frame top here -> last frame: its bottom at endAt, or wherever it sits once
  // the page is scrolled all the way down
  const doc = document.scrollingElement || document.documentElement;
  const to = clip.endAtPageBottom
    ? r.top - (doc.scrollHeight - vh - window.scrollY)
    : vh * SCRUB.endAt - r.height;
  const p = (from - r.top) / Math.max(1, from - to);
  return Math.max(0, Math.min(1, p)) * Math.max(0, (video.duration || 0) - 0.05);
}

function mountScrub(clip, n) {
  const v = root.querySelector(clip.video);
  if (!v) return;
  v.muted = true;
  // Scrubbing seeks anywhere in the clip, which only works on data the browser
  // already has (servers without range requests, like the dev server, cannot
  // fetch a middle piece). So load the whole clip into memory and play it from
  // there; if that fails (file://), fall back to the plain src.
  const src = v.currentSrc || v.src;
  fetch(src)
    .then((res) => (res.ok ? res.blob() : Promise.reject(res.status)))
    .then((blob) => {
      if (!root) return;
      const url = URL.createObjectURL(blob);
      scrubUrls.push(url);
      v.src = url;
      if (clip.frames) v.addEventListener("loadeddata", () => captureFrames(v, v.parentElement, useFrames, clip.content), { once: true });
    })
    .catch(() => {
      // the stitched site parses the page before rebasing src: a failed first fetch needs a fresh load
      if (v.error || v.readyState === 0) v.load();
    });
  const formula = clip.box ? root.querySelector(clip.box) : null;
  let target = 0;
  // the formula's tracking rides the clip's own playhead, so the two move together
  const track = (time) => {
    if (!formula || !v.duration) return;
    const t = time / Math.max(0.01, v.duration - 0.05);
    // a beat behind the clip: holds wide until trackOffset (or the clip's trackStart),
    // then catches up by trackEnd (the last frame unless the clip says otherwise)
    const start = clip.trackStart ?? SCRUB.trackOffset;
    const end = clip.trackEnd || 1;
    const lin = Math.max(0, Math.min(1, (t - start) / Math.max(0.01, end - start)));
    // 2026-11-06: the TRIM boxes (clip.easeTrack) ease out: quick at first, then
    // slowing right down so the letters settle into place smoothly
    const f = clip.easeTrack ? 1 - Math.pow(1 - lin, 3) : lin;
    const [wide, tight] = clip.track;
    formula.style.setProperty("--track", `${(wide + (tight - wide) * f).toFixed(3)}em`);
  };

  // ---- drawn from stills (clip.frames), once they are read
  let blobs = null; // one JPEG per still
  let canvas = null, ctx = null;
  let pos = 0; // the eased playhead (s)
  let lastStep = 0; // time of the last glide step (0: at rest)
  const decoded = new Map(); // still index -> ImageBitmap (the few around the playhead)
  const decoding = new Set();
  const bitmap = (k) => {
    if (decoded.has(k)) return decoded.get(k);
    if (!decoding.has(k) && blobs[k]) {
      decoding.add(k);
      createImageBitmap(blobs[k]).then((bmp) => {
        decoding.delete(k);
        if (!root) { bmp.close(); return; }
        decoded.set(k, bmp);
        scrubBitmaps.push(bmp);
        if (decoded.size > FRAMES.decoded) { // let the oldest go
          const [old, oldBmp] = decoded.entries().next().value;
          decoded.delete(old);
          oldBmp.close();
          scrubBitmaps = scrubBitmaps.filter((x) => x !== oldBmp);
        }
        if (!scrubRafs[n]) scrubRafs[n] = requestAnimationFrame(step);
      });
    }
    return null;
  };
  const sizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  };
  // draws the still under the playhead, the next one faded over it by how far
  // between the two the playhead is; false while a still is still decoding
  const draw = () => {
    const last = blobs.length - 1;
    const fi = Math.max(0, Math.min(last, pos * FRAMES.fps - 0.5));
    const k = Math.floor(fi), a = fi - k;
    const k2 = Math.min(last, k + 1);
    const b0 = bitmap(k), b1 = a > 0.02 ? bitmap(k2) : null;
    bitmap(Math.min(last, k2 + 1)); // read one ahead
    if (!b0) return false; // keep the last picture until this one is ready
    ctx.globalAlpha = 1;
    ctx.drawImage(b0, 0, 0, canvas.width, canvas.height);
    if (b1) {
      ctx.globalAlpha = a;
      ctx.drawImage(b1, 0, 0, canvas.width, canvas.height);
    }
    return a <= 0.02 || !!b1;
  };
  function useFrames(stills) {
    blobs = stills;
    canvas = document.createElement("canvas");
    canvas.className = "photo__frames";
    canvas.setAttribute("aria-hidden", "true");
    v.after(canvas);
    ctx = canvas.getContext("2d");
    sizeCanvas();
    v.pause(); // the stills carry on from wherever the clip had got to
    pos = v.currentTime;
    on(window, "resize", sizeCanvas);
    update();
  }

  const step = () => {
    scrubRafs[n] = 0;
    if (!v.duration) return;
    if (blobs) {
      const gap = target - pos;
      // timed by the clock, so it runs the same at 60 or 120 Hz
      const now = performance.now();
      const dt = Math.min(100, now - (lastStep || now - 16.7));
      lastStep = now;
      if (clip.play) {
        // real time toward the end (triggered) or back to the start
        const d = (dt / 1000) * (clip.speed || 1);
        pos = Math.abs(gap) <= d ? target : pos + Math.sign(gap) * d;
      } else {
        const k = 1 - Math.pow(1 - (clip.ease || SCRUB.ease), dt / 16.7);
        pos = Math.abs(gap) < 0.003 ? target : pos + gap * k;
      }
      const ready = draw();
      track(pos);
      if (pos !== target || !ready) scrubRafs[n] = requestAnimationFrame(step);
      else lastStep = 0;
      return;
    }
    if (clip.play) {
      // the stills are not read yet: the clip itself plays (forward only)
      v.playbackRate = clip.speed || 1;
      if (target > 0) { if (v.paused && !v.ended) v.play().catch(() => {}); }
      else if (!v.paused || v.currentTime) { v.pause(); v.currentTime = 0; }
      track(v.currentTime);
      if (!v.paused) scrubRafs[n] = requestAnimationFrame(step);
      return;
    }
    const gap = target - v.currentTime;
    if (Math.abs(gap) < 0.01) { track(v.currentTime); return; }
    if (!v.seeking) v.currentTime += Math.abs(gap) < 0.02 ? gap : gap * SCRUB.ease;
    track(v.currentTime);
    scrubRafs[n] = requestAnimationFrame(step);
  };
  function update() {
    target = scrubTargetFor(v, clip);
    if (clip.play) target = target > 0 ? Math.max(0, (v.duration || 0) - 0.05) : 0; // a trigger, not a position
    if (!scrubRafs[n]) scrubRafs[n] = requestAnimationFrame(step);
  }
  on(window, "scroll", update, { passive: true });
  on(window, "resize", update);
  on(v, "loadedmetadata", update);
  update();
}

// ---------------------------------------------------------------- api

function mount(container) {
  root = container;
  buildLowerRows();
  mountGlow();
  mountGlobe();
  SCRUB.clips.forEach(mountScrub);
}

function unmount() {
  for (const id of scrubRafs) cancelAnimationFrame(id);
  scrubRafs = [];
  for (const url of scrubUrls) URL.revokeObjectURL(url);
  scrubUrls = [];
  for (const bmp of scrubBitmaps) bmp.close();
  scrubBitmaps = [];
  cancelAnimationFrame(glowRaf);
  cancelAnimationFrame(globeRaf);
  globeRaf = 0;
  globeHold = null;
  glowRaf = 0;
  litCells.clear();
  for (const off of listeners) off();
  listeners = [];
  root = null;
}

window.ExcelSketch = { mount, unmount, asset };
})();
