// Page 03: Style Shift. Wires the app mock: radio groups, before/after,
// accordion adjustments, a staged restyle run (the real pipeline's step
// labels), look selection, the accordion library, results collapse.
// Exposes window.StyleShiftSketch = { mount(container), unmount() }. Classic
// script (not a module) so the page works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder, so they work both when
// the page opens on its own and when the stitched site (root index.html) loads
// the script from pages/03-styleshift/.
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

const LOOK_LABEL = {
  original: "Original",
  candid: "Candid",
  shadows: "Shadows",
  "pantone-blue": "Pantone Blue",
  "pantone-green": "Pantone Green",
  "pantone-pink": "Pantone Pink",
};
const RES_PX = { "1k": "1376×768", "2k": "2752×1536", "4k": "5504×3072" };

// The live pipeline's step labels (lowercased by the UI) with a detail each.
const RUN_STEPS = [
  ["queued", ""],
  ["analyzing photo", "claude vision — writing the content lock"],
  ["building the locked prompt", "locks: identity · pose/wardrobe · camera · composition · environment · era · 16:9 native"],
  ["generating on runway", "gemini_image3_pro @ 16:9 (2K)"],
  ["downloading the render", "4.6 MB received"],
  ["content audit", "comparing render vs source — 5 hard rules"],
  ["colorist grading", "measuring luminance percentiles · deriving exposure / warmth / saturation / levels"],
  ["applying the treatment", "adding film grain — strength 19.5 @ 2752px · scale 1.5"],
];

// Library: the app's own library (library/library.json) in its served order,
// newest first, mirrored by library-data.js into assets/library/<id>.jpg.
// Each item: { id, name, look, favorite, aspect }.
const LIBRARY = window.StyleShiftLibrary || [];

let listeners = [];
let root;
let state = { look: "candid", res: "2k", ba: "after", format: "single", crop: "off" };
let runTimer = 0;
let hoverTimer = 0; // library hover-dwell timer
let readyTimer = 0; // library ready-fade fallback
let libraryObserver = null; // expands the first thumbnail when the library scrolls into view

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}
const $ = (sel) => root.querySelector(sel);
// The lightbox and viewer sit outside <main>: look them up in whatever tree
// holds the page (the document on its own, a shadow root in the stitched site).
const byId = (id) => root.getRootNode().getElementById(id);

function setStatus(html, proc) {
  const el = $("#status");
  if (!el) return;
  el.innerHTML = html;
  el.classList.toggle("proc", proc !== false);
}

// --------------------------------------------------------- radio groups

function mountGroups() {
  for (const group of root.querySelectorAll("[data-group]")) {
    const key = group.dataset.group;
    on(group, "click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn || !group.contains(btn)) return;
      for (const b of group.querySelectorAll("button[data-value]")) b.classList.toggle("on", b === btn);
      state[key] = btn.dataset.value;
      onChange(key);
    });
  }
}

function onChange(key) {
  const img = $("#stage-img");
  if (key === "look") {
    setStatus(`Look — ${LOOK_LABEL[state.look]}. Hit Run restyle to render.`);
  }
  if (key === "ba") img.classList.toggle("is-before", state.ba === "before");
  if (key === "res") setStatus(`Resolution — ${state.res.toUpperCase()} (${RES_PX[state.res]}px).`);
  if (key === "format" && $("#panel-note")) {
    $("#panel-note").innerHTML = state.format === "batch"
      ? "Batch runs every photo on automatic settings — flash, grain, levels and crop are set to auto."
      : "Adjustments re-process the generated photo locally — no new generation. Set them, then hit <em>Apply</em>.";
    $("#btn-run").textContent = state.format === "batch" ? "Run restyle (1)" : "Run restyle";
  }
  if (key === "crop") setStatus(state.crop === "off" ? "Crop off." : `Crop — ${state.crop}. Use the gizmo: red/green arrows move on one axis, the yellow centre square scales, the ring rotates.`);
}

// ---------------------------------------------------------- accordions

function mountAccordions() {
  for (const acc of root.querySelectorAll(".acc")) {
    const head = acc.querySelector(".acc-head");
    const caret = acc.querySelector(".acc-caret");
    on(head, "click", () => {
      const open = acc.classList.toggle("is-open");
      caret.innerHTML = open ? "&#9662;" : "&#9656;";
    });
    // Live value readouts.
    for (const row of acc.querySelectorAll(".sliderrow")) {
      const range = row.querySelector('input[type="range"]');
      const val = row.querySelector(".val");
      const num = row.querySelector(".numinput");
      if (!range) continue;
      on(range, "input", () => {
        const v = Number(range.value);
        if (num) num.value = String(v);
        if (val) {
          const label = row.querySelector("label").textContent.toLowerCase();
          val.textContent = label === "hue" ? `${v}°` : Number.isInteger(Number(range.step)) || Number(range.step) >= 1 ? String(v) : v.toFixed(2);
        }
        applyPreview();
      });
      if (num) on(num, "input", () => { range.value = num.value; range.dispatchEvent(new Event("input")); });
    }
  }
  on($("#btn-revert"), "click", () => {
    for (const range of root.querySelectorAll('.acc input[type="range"]')) {
      range.value = range.defaultValue;
      range.dispatchEvent(new Event("input"));
    }
    setStatus("Reverted to the original render.");
  });
}

/** Local preview of the colour controls on the stage image. */
function applyPreview() {
  const get = (acc, i = 0) => Number(root.querySelectorAll(`[data-acc="${acc}"] input[type="range"]`)[i]?.value || 0);
  const heat = get("flash");
  const warmth = get("colour", 0);
  const exposure = get("colour", 1) || 1;
  const hue = get("hue", 0);
  const sat = get("hue", 1);
  const img = $("#stage-img");
  img.style.filter = `brightness(${exposure * (1 + heat / 400)}) sepia(${Math.max(0, warmth) * 0.4}) hue-rotate(${hue}deg) saturate(${1 + sat / 100})`;
}

// ------------------------------------------------------------- restyle

function runRestyle() {
  const img = $("#stage-img");
  if (img.classList.contains("is-rendering")) return;
  img.classList.add("is-rendering");
  const runBtn = $("#btn-run");
  if (runBtn) runBtn.textContent = "Working…";
  let i = 0;
  const tick = () => {
    if (i < RUN_STEPS.length) {
      const [step, detail] = RUN_STEPS[i++];
      setStatus(`<span class="proc-cursor">▌</span> ${step}${detail ? " — " + detail : ""}`);
      runTimer = setTimeout(tick, 520);
    } else {
      img.classList.remove("is-rendering");
      if (runBtn) runBtn.textContent = state.format === "batch" ? "Run restyle (1)" : "Run restyle";
      setStatus(`Done — ${RES_PX[state.res]}px.`);
    }
  };
  tick();
}

function mountButtons() {
  on($("#btn-run"), "click", runRestyle);
  on($("#btn-run-2"), "click", runRestyle);
  on($("#btn-rerun"), "click", runRestyle);
  on($("#btn-clear"), "click", () => setStatus("Cleared. Drop in a photo."));
  on($("#btn-download"), "click", () => setStatus(`Downloading — ${LOOK_LABEL[state.look]} ${RES_PX[state.res]}px PNG.`));
  on($("#btn-library"), "click", addToLibrary);
  on($("#btn-library-2"), "click", addToLibrary);
  on($("#btn-download-all"), "click", () => setStatus("Downloading the library as a zip."));
  on($("#looks-grid"), "click", (e) => {
    const fig = e.target.closest(".look");
    if (!fig || fig.dataset.look === "original") return;
    const radio = root.querySelector(`[data-group="look"] button[data-value="${fig.dataset.look}"]`);
    if (radio) radio.click();
    else {
      state.look = fig.dataset.look;
      onChange("look");
    }
  });
  // Results card collapse / expand: the card animates its height to zero
  // (a pill-capped line pivoting at the top edge) and the button strip
  // below it masks away with it, as in the app.
  const card = $("#auditcard");
  const mask = $("#auditactions");
  const btn = $("#btn-collapse");
  if (btn) on(btn, "click", () => {
    const collapsing = !card.classList.contains("is-collapsed");
    card.style.height = `${card.scrollHeight}px`;
    mask.style.height = `${mask.scrollHeight}px`;
    requestAnimationFrame(() => {
      card.classList.toggle("is-collapsed", collapsing);
      mask.classList.toggle("is-collapsed", collapsing);
      if (!collapsing) {
        card.style.height = `${card.scrollHeight}px`;
        mask.style.height = `${mask.scrollHeight}px`;
        setTimeout(() => { card.style.height = ""; mask.style.height = ""; }, 620);
      }
    });
    btn.title = collapsing ? "Expand the results" : "Collapse the results";
    btn.innerHTML = collapsing
      ? '<span class="audit-collapse-caret">&#9656;</span> Expand'
      : '<span class="audit-collapse-caret">&#9662;</span> Collapse';
  });
}

// -------------------------------------------------------------- library

// The app's AccordionGallery as App.tsx configures it: LIB_EXPAND 0.45, gap 2,
// radius 4, showLabels false, defaultIndex 0. The hero's overlay is one row:
// heart · Save · Crop · View · Delete (the app's renderOverlay).
const LIB_EXPAND = 0.45;
const HEART_SVG = '<svg viewBox="0 0 34 30"><path d="M17 27 C 8 20, 2 15, 2 9 C 2 4.5, 5.5 2, 9.2 2 C 12.4 2, 15.2 3.8, 17 6.8 C 18.8 3.8, 21.6 2, 24.8 2 C 28.5 2, 32 4.5, 32 9 C 32 15, 26 20, 17 27 Z"/></svg>';

/** The hero window's width follows the photo's own aspect (the app's
    heroPctFor): a 16:9 render opens to LIB_EXPAND, a portrait save narrower,
    capped at 92% — the window always matches the photo in X. */
function heroPctFor(aspect) {
  return Math.min(92, LIB_EXPAND * 100 * ((aspect || 16 / 9) / (16 / 9)));
}

function libSrc(p) {
  return asset(`assets/library/${p.dataset.id}.jpg`);
}

function makePanel(item) {
  const el = document.createElement("div");
  el.className = "ag-panel" + (item.favorite ? " is-fav" : "");
  el.dataset.id = item.id;
  el.dataset.label = item.name || item.look || "";
  el.dataset.look = item.look || "";
  el.dataset.aspect = String(item.aspect || 16 / 9);
  el.style.setProperty("--hero", `${heroPctFor(item.aspect)}%`);
  el.innerHTML = `
    <img src="${asset(`assets/library/${item.id}.jpg`)}" alt="${el.dataset.label.replace(/"/g, "&quot;")}" loading="eager" decoding="async">
    <div class="ag-actions">
      <div class="ag-actions-row">
        <button class="heart${item.favorite ? " on" : ""}" title="Favourite">${HEART_SVG}</button>
        <button class="btn btn--fill btn--save">Save</button>
        <button class="btn btn--fill btn--tocanvas" title="Send this image back to the canvas to apply a crop">Crop</button>
        <button class="btn btn--fill btn--view" title="View this image at full size">View</button>
        <button class="btn btn--delete">Delete</button>
      </div>
    </div>`;
  return el;
}

/** The action buttons are sized from the hero's FINAL pixel width, decided
    once when a panel is selected (the app's btnTierFor), so nothing
    re-evaluates during the slide. */
function btnTierFor(ag, p) {
  const px = (ag.clientWidth * heroPctFor(Number(p.dataset.aspect))) / 100;
  if (!ag.clientWidth) return "";
  return px < 190 ? "ag-panel--btn-xs" : px < 250 ? "ag-panel--btn-s" : px < 300 ? "ag-panel--btn-m" : "";
}

/** Proxy scrollbar below the panel: its inner width mirrors the gallery's
    true width (hero + slivers + padding), and the two scroll in sync. */
function measureLibrary() {
  const panel = $("#library-panel");
  const inner = $("#library-scrollbar-inner");
  const ag = $("#gallery");
  if (!panel || !inner || !ag) return;
  const pad = 28; // panel padding 14px each side
  const agW = panel.clientWidth - pad;
  const n = ag.children.length;
  const hero = LIB_EXPAND * agW;
  const sliver = Math.min(44, Math.max(18, 0.022 * agW));
  const total = hero + Math.max(0, n - 1) * (sliver + 2) + pad;
  inner.style.width = `${Math.max(total, panel.scrollWidth)}px`;
}

function libPanels() {
  return Array.from($("#gallery").querySelectorAll(".ag-panel"));
}

/** Expand one panel (sticky selection). The hero's title says a click opens it large. */
function selectPanel(p) {
  const ag = $("#gallery");
  const tier = btnTierFor(ag, p);
  for (const q of libPanels()) {
    const onNow = q === p;
    q.classList.remove("ag-panel--btn-xs", "ag-panel--btn-s", "ag-panel--btn-m");
    if (onNow && tier) q.classList.add(tier);
    q.classList.toggle("ag-panel--on", onNow);
    if (onNow) q.title = "Click to view large";
    else q.removeAttribute("title");
  }
}

// The app's library actions, on the demo's static assets.
function saveLibItem(p) {
  const a = document.createElement("a");
  a.href = libSrc(p);
  a.download = `style-shift_${p.dataset.label}_${p.dataset.look}.jpg`.replace(/[\\/:*?"<>|]+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function sendToCanvas(p) {
  // gallery -> canvas: the saved image lands on the stage, as in the app
  stopStageShow(); // the chosen image stays on the canvas
  stageShow(libSrc(p));
  const stage = $("#stage");
  if (stage) stage.scrollIntoView({ behavior: "smooth", block: "center" });
  setStatus("Sent back to the canvas — pick a crop format.");
}
function deleteLibItem(p) {
  // the app keeps the same index selected, so the next item becomes the hero
  const next = p.nextElementSibling || p.previousElementSibling;
  p.remove();
  if (next) selectPanel(next);
  measureLibrary();
}
function toggleFav(p) {
  const on = !p.classList.contains("is-fav");
  p.classList.toggle("is-fav", on);
  p.querySelector(".heart").classList.toggle("on", on);
}

function mountLibrary() {
  const ag = $("#gallery");
  if (!ag) return;
  for (const item of LIBRARY) ag.appendChild(makePanel(item));
  // Every panel starts as a sliver (no hero). When the user scrolls the
  // library into view the first thumbnail expands, once; after that hover
  // and clicks own the selection as usual.
  const panelEl = $("#library-panel");
  if (typeof IntersectionObserver === "undefined" || !panelEl) {
    selectPanel(libPanels()[0]);
  } else {
    libraryObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (!libPanels().some((q) => q.classList.contains("ag-panel--on"))) selectPanel(libPanels()[0]);
          libraryObserver.disconnect();
          libraryObserver = null;
        }
      }
    }, { threshold: [0.5] });
    libraryObserver.observe(panelEl);
  }
  // One fade for the whole row: stay invisible until every image has loaded
  // (or 2.5 s, whichever first), then fade everything in together.
  let pending = 0;
  const loadedOne = () => { if (--pending <= 0) ag.classList.add("ag--ready"); };
  for (const img of ag.querySelectorAll("img")) {
    if (img.complete) continue;
    pending++;
    img.addEventListener("load", loadedOne, { once: true });
    img.addEventListener("error", loadedOne, { once: true });
  }
  if (pending === 0) ag.classList.add("ag--ready");
  readyTimer = setTimeout(() => ag.classList.add("ag--ready"), 2500);
  // Hover expands after a short dwell (so sweeping across the strip does not
  // ripple every sliver open); it stays expanded after the pointer leaves,
  // so there is always one hero.
  const HOVER_DWELL = 660; // ms (three beats of 220)
  on(ag, "pointerover", (e) => {
    const p = e.target.closest(".ag-panel");
    if (!p || p.classList.contains("ag-panel--on")) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => selectPanel(p), HOVER_DWELL);
  });
  on(ag, "pointerout", (e) => {
    const p = e.target.closest(".ag-panel");
    const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(".ag-panel") : null;
    if (p && to !== p) clearTimeout(hoverTimer); // left the panel before the dwell elapsed
  });
  on(ag, "click", (e) => {
    const p = e.target.closest(".ag-panel");
    if (!p) return;
    if (e.target.closest(".ag-actions")) {
      // the overlay swallows its clicks (the app's stopPropagation)
      const heart = e.target.closest(".heart");
      if (heart) { toggleFav(p); return; }
      const btn = e.target.closest(".btn");
      if (!btn) return;
      if (btn.classList.contains("btn--delete")) deleteLibItem(p);
      else if (btn.classList.contains("btn--save")) saveLibItem(p);
      else if (btn.classList.contains("btn--tocanvas")) sendToCanvas(p);
      else if (btn.classList.contains("btn--view")) openViewer(p);
      return;
    }
    // first click expands the panel in the gallery; a click on the
    // already-open panel hands off to the full-size viewer
    if (p.classList.contains("ag-panel--on")) openViewer(p);
    else selectPanel(p);
  });
  // Scroll sync, both ways, guarded against feedback.
  const panel = $("#library-panel");
  const bar = $("#library-scrollbar");
  let syncing = false;
  on(panel, "scroll", () => { if (syncing) return; syncing = true; bar.scrollLeft = panel.scrollLeft; syncing = false; });
  on(bar, "scroll", () => { if (syncing) return; syncing = true; panel.scrollLeft = bar.scrollLeft; syncing = false; });
  on(window, "resize", measureLibrary);
  measureLibrary();
}

function addToLibrary() {
  const ag = $("#gallery");
  // the newest library render of the chosen look stands in for a fresh result
  const sample = LIBRARY.find((it) => it.look === LOOK_LABEL[state.look]) || LIBRARY[0];
  if (!sample) return;
  const p = makePanel({ ...sample, favorite: false, id: sample.id });
  p.classList.add("ag-panel--new");
  ag.prepend(p);
  selectPanel(p); // a newly added item becomes the expanded one
  measureLibrary();
  setStatus("Added to the library.");
}

// ------------------------------------------------------------ title rise

// The title's letters rise from behind the canvas once the title is well in
// view, and the LOOKS / LIBRARY / AUDIT headings (.rise) rise the same way
// inside their own box; scrolling one fully out resets it, so it plays again
// on return.
let titleObserver = null;

function mountTitleRise() {
  const heads = root.querySelectorAll("#title, .rise");
  if (!heads.length) return;
  if (typeof IntersectionObserver === "undefined" || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    for (const h of heads) h.classList.add("is-in");
    return;
  }
  titleObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) e.target.classList.add("is-in");
      else if (!e.isIntersecting) e.target.classList.remove("is-in");
    }
  }, { threshold: [0, 0.6] });
  for (const h of heads) titleObserver.observe(h);
}

// ----------------------------------------------------------- board open

// The How it works cards open down with the scroll: as the board's top
// travels from BOARD_FROM to BOARD_TO of the window height, each card's open
// fraction (--so) runs 0 -> 1 over a window of the progress, Upload first and
// the rest staggered so neighbours overlap most of the way. Scrolling back
// closes them. Where the page cannot scroll that far (standalone, near the
// bottom) the travel is cut to what is scrollable so the sequence still ends.
const BOARD_FROM = 0.8;  // board top at this fraction of the window height -> progress 0 (a little after it enters the window)
const BOARD_TO = 0.25;   // board top at this fraction -> progress 1
const CARD_STEP = 0.1;   // progress between one card's start and the next
const CARD_SPAN = 0.3;   // progress one card takes to open: the next starts a third of the way in, so the order reads
let boardRaf = 0;
let boardCards = [];

function mountBoardOpen() {
  const frame = $(".board-frame");
  if (!frame) return;
  boardCards = [...frame.querySelectorAll(".card")];
  if (!boardCards.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const c of boardCards) c.style.setProperty("--so", "1");
    return;
  }
  const onScroll = () => { if (!boardRaf) boardRaf = requestAnimationFrame(applyBoardOpen); };
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", onScroll);
  applyBoardOpen();
}

function applyBoardOpen() {
  boardRaf = 0;
  const frame = $(".board-frame");
  if (!frame) return;
  const vh = window.innerHeight;
  const docTop = frame.getBoundingClientRect().top + window.scrollY;
  const travel = vh * (BOARD_FROM - BOARD_TO); // scroll distance the whole run takes
  const maxScroll = document.documentElement.scrollHeight - vh;
  // if the page cannot scroll far enough for the board to reach BOARD_TO, the
  // run ends where the scroll does and begins earlier, keeping its full length
  const end = Math.min(docTop - vh * BOARD_TO, maxScroll);
  const start = Math.max(0, end - travel);
  const p = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
  const n = boardCards.length;
  // the last card's window ends at progress 1
  const scale = 1 / ((n - 1) * CARD_STEP + CARD_SPAN);
  for (let i = 0; i < n; i++) {
    const f = Math.min(1, Math.max(0, (p - i * CARD_STEP * scale) / (CARD_SPAN * scale)));
    const ease = f * f * (3 - 2 * f);
    boardCards[i].style.setProperty("--so", ease.toFixed(3));
  }
}

// ---------------------------------------------------------- board cells

// The how-it-works panel's grid cell under the cursor lights up blue (only
// that one: no trail behind it) and fades out once the cursor leaves it or
// comes to rest. The panel paints its grid as a 12-unit background
// (lines at -1px + k * cell); the canvas fills the matching cells, inset so
// the lines stay visible.
const CELL_UNITS = 1252 / 12; // cells across the panel's width
const CELL_FADE = 700;       // ms a cell takes to fade out
let cellCanvas = null;
let cellCtx = null;
let cellSize = 0;
let cellRaf = 0;
const litCells = new Map(); // "col,row" -> time lit

function sizeBoardCells() {
  const panel = $(".board-panel");
  if (!panel || !cellCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = panel.clientWidth;
  const h = panel.clientHeight;
  cellCanvas.width = Math.round(w * dpr);
  cellCanvas.height = Math.round(h * dpr);
  cellCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cellSize = w / CELL_UNITS;
}

function drawBoardCells(now) {
  cellRaf = 0;
  if (!cellCtx) return;
  cellCtx.clearRect(0, 0, cellCanvas.width, cellCanvas.height);
  for (const [key, t] of litCells) {
    const age = (now - t) / CELL_FADE;
    if (age >= 1) { litCells.delete(key); continue; }
    const [col, row] = key.split(",").map(Number);
    const a = 0.85 * (1 - age) * (1 - age);
    cellCtx.fillStyle = `rgba(26, 76, 245, ${a.toFixed(3)})`;
    // the grid lines sit at -1 + k * cell; fill the cell between them, 1px in
    cellCtx.fillRect(-1 + col * cellSize + 1, -1 + row * cellSize + 1, cellSize - 1, cellSize - 1);
  }
  if (litCells.size) cellRaf = requestAnimationFrame(drawBoardCells);
}

function mountBoardCells() {
  cellCanvas = $("#board-cells");
  const frame = $(".board-frame");
  if (!cellCanvas || !frame) return;
  cellCtx = cellCanvas.getContext("2d");
  sizeBoardCells();
  on(window, "resize", sizeBoardCells);
  on(frame, "pointermove", (e) => {
    const r = cellCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return;
    const col = Math.floor((x + 1) / cellSize);
    const row = Math.floor((y + 1) / cellSize);
    litCells.clear(); // one cell at a time: the one under the cursor
    litCells.set(`${col},${row}`, performance.now());
    if (!cellRaf) cellRaf = requestAnimationFrame(drawBoardCells);
  });
}

// ------------------------------------------------------------ stage show

// The canvas cycles through these library renders with a crossfade (the
// first is the page's own stage still). Library ids match library-data.js.
const STAGE_SLIDES = [
  "assets/stage.jpg",
  "assets/library/3f154ab44087.jpg", // smiling man, black tee, hard light
  "assets/library/01771cd3503a.jpg", // grey sweater, white collar
  "assets/library/1f804fcf7bb9.jpg", // green suit, armchair
  "assets/library/659dc5e24abf.jpg", // mullet, green suit, facing left (Pantone Green)
  "assets/library/eeca65c05ef3.jpg", // pink room (Pantone Pink)
  "assets/library/ce7f34c184ca.jpg", // sunlit pink room (Shadows)
];
const SLIDE_HOLD = 4000; // ms a slide stays before the next fades in
let slideTimer = 0;
let slideIndex = 0;

/** The slide in front: the image Press play and the viewer should show. */
function stageCurrent() {
  return $(".stage-slide.is-on") || $("#stage-img");
}

/** Crossfade the stage to `src`: the back layer loads it, then comes forward. */
function stageShow(src) {
  const front = stageCurrent();
  const back = front.id === "stage-img" ? $("#stage-img-b") : $("#stage-img");
  if (!back) { front.src = src; return; }
  back.src = src;
  const go = () => {
    front.classList.add("is-under");   // stays opaque beneath while...
    front.classList.remove("is-on");
    back.classList.remove("is-under");
    back.classList.add("is-on");       // ...the new slide fades in on top
    setTimeout(() => front.classList.remove("is-under"), 1300);
  };
  if (back.complete) go();
  else back.addEventListener("load", go, { once: true });
}

function stageNext() {
  slideIndex = (slideIndex + 1) % STAGE_SLIDES.length;
  stageShow(asset(STAGE_SLIDES[slideIndex]));
  slideTimer = setTimeout(stageNext, SLIDE_HOLD);
}

function stopStageShow() {
  clearTimeout(slideTimer);
  slideTimer = 0;
}

function mountStageShow() {
  if (!$("#stage-img-b")) return;
  for (const src of STAGE_SLIDES) { const im = new Image(); im.src = asset(src); } // warm the cache
  slideTimer = setTimeout(stageNext, SLIDE_HOLD);
}

// ------------------------------------------------------- stage parallax

// As the stage scrolls past, the photo drifts against the scroll inside its
// frame (reads slower) and Press play runs with it (reads faster), like the
// intro hero. Offsets are zero when the stage is centred in the viewport.
const STAGE_PARALLAX = {
  on: true,
  image: 0.07, // photo travel, as a fraction of the stage height, either side of centre
  zoom: 1.16, // photo scale, so its drift never shows the frame edge
  type: 0.12, // Press play travel, as a fraction of the stage height
};

let stageRaf = 0;

function updateStageParallax() {
  stageRaf = 0;
  const st = $("#stage");
  if (!st) return;
  const r = st.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  // -1 when the stage has just left the top, +1 when it is just entering below
  const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / ((vh + r.height) / 2)));
  st.style.setProperty("--px-img", `${(-p * r.height * STAGE_PARALLAX.image).toFixed(1)}px`);
  st.style.setProperty("--px-type", `${(p * r.height * STAGE_PARALLAX.type).toFixed(1)}px`);
}

function mountStageParallax() {
  const st = $("#stage");
  if (!STAGE_PARALLAX.on || !st) return;
  st.style.setProperty("--px-zoom", String(STAGE_PARALLAX.zoom));
  const queue = () => { if (!stageRaf) stageRaf = requestAnimationFrame(updateStageParallax); };
  on(window, "scroll", queue, { passive: true });
  on(window, "resize", queue);
  updateStageParallax();
}

// ---------------------------------------------------------- library viewer

// The app's full-size viewer: the library photo at screen size over a dimmed
// page, with heart · Save · Crop · Delete · Click to close under it. Clicking
// the photo, the backdrop, ×, or pressing Esc drops back to the gallery as it was.
let viewerPanel = null;

/** Show the viewer with any picture. `panel` is the library panel it came
    from (heart / Save / Crop / Delete act on it); without one the viewer is
    plain, with only "Click to close". */
function showViewer(src, label, panel) {
  const v = byId("viewer");
  if (!v) return;
  viewerPanel = panel || null;
  const img = byId("viewer-img");
  img.src = src;
  img.alt = label || "";
  byId("viewer-label").textContent = label || "";
  byId("viewer-heart").classList.toggle("on", !!panel && panel.classList.contains("is-fav"));
  v.classList.toggle("viewer--plain", !panel);
  v.classList.toggle("viewer--single", !panel || libPanels().length < 2);
  v.hidden = false;
}

/** Step the viewer through the whole library (the app's stepLib), wrapping
    at the ends. Only for library photos; the plain stage viewer stays put. */
function stepViewer(d) {
  if (!viewerPanel) return;
  const all = libPanels();
  const i = all.indexOf(viewerPanel);
  if (i < 0 || all.length < 2) return;
  openViewer(all[(i + d + all.length) % all.length]);
}

function openViewer(p) {
  showViewer(libSrc(p), p.dataset.label || "", p);
}

/** Press play on the stage: the still (a video later) expands like a library photo. */
function openStageViewer() {
  const img = stageCurrent();
  if (img) showViewer(img.currentSrc || img.src, "Style Shift", null);
}

function closeViewer() {
  const v = byId("viewer");
  if (!v || v.hidden) return;
  v.hidden = true;
  viewerPanel = null;
}

function mountViewer() {
  const v = byId("viewer");
  if (!v) return;
  on(v, "click", (e) => {
    // the stage keeps its clicks, except the photo itself, which closes
    if (e.target.closest(".viewer-stage") && e.target.id !== "viewer-img") return;
    closeViewer();
  });
  on(byId("viewer-close"), "click", closeViewer);
  on($("#btn-play"), "click", openStageViewer);
  on(byId("viewer-x"), "click", closeViewer);
  on(byId("viewer-prev"), "click", (e) => { e.stopPropagation(); stepViewer(-1); });
  on(byId("viewer-next"), "click", (e) => { e.stopPropagation(); stepViewer(1); });
  on(byId("viewer-heart"), "click", () => {
    if (!viewerPanel) return;
    toggleFav(viewerPanel);
    byId("viewer-heart").classList.toggle("on", viewerPanel.classList.contains("is-fav"));
  });
  on(byId("viewer-save"), "click", () => { if (viewerPanel) saveLibItem(viewerPanel); });
  on(byId("viewer-crop"), "click", () => {
    if (!viewerPanel) return;
    const p = viewerPanel;
    closeViewer();
    sendToCanvas(p);
  });
  on(byId("viewer-delete"), "click", () => {
    if (!viewerPanel) return;
    const p = viewerPanel;
    closeViewer();
    deleteLibItem(p);
  });
  on(window, "keydown", (e) => {
    if (e.key === "Escape") { closeViewer(); return; }
    if (v.hidden || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const t = e.composedPath()[0];
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    stepViewer(e.key === "ArrowRight" ? 1 : -1);
  });
}

// ------------------------------------------------------------- lightbox

// Clicking one of the six looks expands it. Set false to revert to plain tiles.
const LOOKS_EXPAND = true;

let lightboxOpen = false;
let lightboxFrom = null; // the tile that opened it, for the return flight

function lightboxTargetRect() {
  const pad = 48;
  const maxW = Math.min(window.innerWidth - pad * 2, 1560);
  const maxH = window.innerHeight - pad * 2;
  let w = maxW;
  let h = w * 9 / 16;
  if (h > maxH) { h = maxH; w = h * 16 / 9; }
  return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
}

function placeFigure(fig, r) {
  fig.style.left = `${r.left}px`;
  fig.style.top = `${r.top}px`;
  fig.style.width = `${r.width}px`;
  fig.style.height = `${r.height}px`;
}

function openLightbox(tile) {
  const lb = byId("lightbox");
  const fig = lb.querySelector(".lightbox__figure");
  const img = byId("lightbox-img");
  const cap = byId("lightbox-cap");
  const tileImg = tile.querySelector("img");
  const tag = tile.querySelector(".look-tag");
  img.src = tileImg.src;
  img.alt = tileImg.alt;
  cap.innerHTML = tag ? tag.innerHTML : "";
  cap.className = "lightbox__cap";
  for (const c of tag ? tag.classList : []) {
    if (c.startsWith("look-tag--")) cap.classList.add("lightbox__cap--" + c.slice("look-tag--".length));
  }
  lightboxFrom = tile;
  lb.hidden = false;
  // Start at the tile's rect (no transition), then fly to the centre.
  fig.style.transition = "none";
  placeFigure(fig, tileImg.getBoundingClientRect());
  void fig.offsetHeight;
  fig.style.transition = "";
  requestAnimationFrame(() => {
    lb.classList.add("is-open");
    placeFigure(fig, lightboxTargetRect());
  });
  lightboxOpen = true;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lightboxOpen) return;
  const lb = byId("lightbox");
  const fig = lb.querySelector(".lightbox__figure");
  lb.classList.remove("is-open");
  if (lightboxFrom) placeFigure(fig, lightboxFrom.querySelector("img").getBoundingClientRect());
  lightboxOpen = false;
  document.body.style.overflow = "";
  setTimeout(() => { if (!lightboxOpen) lb.hidden = true; }, 540);
}

function mountLightbox() {
  if (!LOOKS_EXPAND) return;
  const lb = byId("lightbox");
  const grid = $("#looks-grid");
  if (!lb || !grid) return;
  on(grid, "click", (e) => {
    const tile = e.target.closest(".look");
    if (tile) openLightbox(tile);
  });
  on(lb.querySelector(".lightbox__backdrop"), "click", closeLightbox);
  on(lb.querySelector(".lightbox__figure"), "click", closeLightbox);
  on(window, "keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
  on(window, "resize", () => { if (lightboxOpen) placeFigure(lb.querySelector(".lightbox__figure"), lightboxTargetRect()); });
}

// ------------------------------------------------------------------ api

function mount(el) {
  root = el;
  mountGroups();
  mountAccordions();
  mountButtons();
  mountLibrary();
  mountTitleRise();
  mountBoardCells();
  mountBoardOpen();
  mountStageShow();
  mountStageParallax();
  mountLightbox();
  mountViewer();
}

function unmount() {
  clearTimeout(runTimer);
  clearTimeout(hoverTimer);
  clearTimeout(readyTimer);
  stopStageShow();
  cancelAnimationFrame(stageRaf);
  stageRaf = 0;
  if (titleObserver) { titleObserver.disconnect(); titleObserver = null; }
  cancelAnimationFrame(boardRaf);
  boardRaf = 0;
  boardCards = [];
  cancelAnimationFrame(cellRaf);
  cellRaf = 0;
  litCells.clear();
  if (libraryObserver) { libraryObserver.disconnect(); libraryObserver = null; }
  for (const off of listeners) off();
  listeners = [];
}

window.StyleShiftSketch = { mount, unmount };
})();
