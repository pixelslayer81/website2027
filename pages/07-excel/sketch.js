// Page 07: Excel - Beyond the Grid. Places the lower grid's few lines (from the
// user's reference), lights the grid cell under the cursor, scrubs
// the portrait and car clips with the scroll, and rises the EXCEL title into
// view;
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
const TOP_H = 28 * ROW_H;
const PAGE_H = 1976;
const LOWER_ROWS = [TOP_H, 1488.6, 1642.2, 1681.5, 1738.3, 1873.9, 1915.2];
const LOWER_COLS = [
  { x: 72, y1: PAGE_H }, { x: 432, y1: PAGE_H }, { x: 448.3, y1: PAGE_H },
  { x: 576, y1: PAGE_H }, { x: 720, y1: PAGE_H }, { x: 936, y1: 1488.6 }, { x: 1368, y1: PAGE_H },
];

let root;
let titleObserver = null;
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
    // the hair shrinks; drawn from stills (frames). play: the scroll only triggers
    // it: once the frame's top passes startAt it plays through at real time, and
    // scrolling back above that runs it back to the start; speed: times real time
    // content: the picture inside the clip's frame (source px): hair.mp4 is a
    // square picture with black bars either side, so the stills use just that
    { video: "#portrait-video", box: "#formula-1", track: [0.9, -0.08], frames: true, play: true, speed: 4, content: [420, 0, 1080, 1080] },
    // the car sits at the very bottom of the site, so the page cannot scroll it
    // far enough for the usual run: it starts lower and ends at the bottom of the page
    // play: like the hair, the scroll only triggers it; it then plays at real time.
    // trackStart / trackEnd: its TRIM squeezes over the whole clip, first frame to last
    { video: "#car-video", box: "#formula-2", track: [0.7, -0.08], startAt: 0.8, endAtPageBottom: true, frames: true, play: true, speed: 2, trackStart: 0, trackEnd: 1 },
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
  let encoding = 0, ended = false;
  const finish = () => {
    if (!ended || encoding || !root) return;
    // a frame the playback skipped borrows its neighbour
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
  const formula = root.querySelector(clip.box);
  let target = 0;
  // the formula's tracking rides the clip's own playhead, so the two move together
  const track = (time) => {
    if (!formula || !v.duration) return;
    const t = time / Math.max(0.01, v.duration - 0.05);
    // a beat behind the clip: holds wide until trackOffset (or the clip's trackStart),
    // then catches up by trackEnd (the last frame unless the clip says otherwise)
    const start = clip.trackStart ?? SCRUB.trackOffset;
    const end = clip.trackEnd || 1;
    const f = Math.max(0, Math.min(1, (t - start) / Math.max(0.01, end - start)));
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

// The EXCEL title rises letter by letter (the Style Shift title, page 03):
// .is-in once it is 60% in view, removed once it is fully out, so it replays.
function mountTitleRise() {
  const title = root.querySelector("#title");
  if (!title) return;
  if (typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    title.classList.add("is-in");
    return;
  }
  titleObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) e.target.classList.add("is-in");
      else if (!e.isIntersecting) e.target.classList.remove("is-in");
    }
  }, { threshold: [0, 0.6] });
  titleObserver.observe(title);
}

// ---------------------------------------------------------------- api

function mount(container) {
  root = container;
  buildLowerRows();
  mountGlow();
  SCRUB.clips.forEach(mountScrub);
  mountTitleRise();
}

function unmount() {
  for (const id of scrubRafs) cancelAnimationFrame(id);
  scrubRafs = [];
  for (const url of scrubUrls) URL.revokeObjectURL(url);
  scrubUrls = [];
  for (const bmp of scrubBitmaps) bmp.close();
  scrubBitmaps = [];
  cancelAnimationFrame(glowRaf);
  glowRaf = 0;
  litCells.clear();
  for (const off of listeners) off();
  listeners = [];
  if (titleObserver) { titleObserver.disconnect(); titleObserver = null; }
  root = null;
}

window.ExcelSketch = { mount, unmount, asset };
})();
