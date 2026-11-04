// Page 03's How it works graph, ported from the web-style-shift-info app's pages/workflow/
// workflow.js (2026-10-30; re-synced 2026-11-03). Renders workflow.json as a top-to-bottom node graph. Rows come from
// each node's depth in the edge graph, so adding nodes/edges to the JSON is enough.
// Classic script: exposes window.StyleShiftWorkflow = { mount(dom) }, where dom is the page's
// document or shadow root (ids are looked up there, so it works in the stitched site), called by
// sketch.js. JSON and image paths resolve against this script's folder.
(function () {
"use strict";

const ROOT = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
let dom = document;
const $id = id => dom.getElementById(id);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function mount(d) {
  dom = d || document;
  const flow = $id("flow");
  if (!flow) return;
  // the page's data-src is written relative to the page; only its file name matters here
  fetch(ROOT + (flow.dataset.src || "workflow.json").split("/").pop())
    .then(r => r.json())
    .then(render)
    .catch(err => {
      flow.innerHTML =
        `<p class="flow-error">Couldn't load workflow.json (${esc(err.message)}). Serve the site over HTTP: <code>python -I tools/serve.py</code> from the repo root.</p>`;
    });
  $id("modal").addEventListener("click", e => { if (e.target.id === "modal") closeDrawer(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
    if (outState && e.key === "ArrowLeft") stepOutput(-1);
    if (outState && e.key === "ArrowRight") stepOutput(1);
    const t = e.composedPath()[0];
    if (e.key === "Enter" && t.classList?.contains("node")) t.click();
  });
}
// Text shown under every expanded look (flow.lookNote; a look's own `note` overrides it).
let LOOK_NOTE = "";

function render(flow) {
  LOOK_NOTE = flow.lookNote || "";
  const looks = Object.fromEntries((flow.looks || []).map(l => [l.id, l]));
  const byId = Object.fromEntries(flow.nodes.map(n => [n.id, n]));

  // Depth = longest path from a source node.
  const incoming = {}, outgoing = {};
  flow.nodes.forEach(n => { incoming[n.id] = []; outgoing[n.id] = []; });
  flow.edges.forEach(e => { outgoing[e.from].push(e.to); incoming[e.to].push(e.from); });
  const depth = {};
  const depthOf = id => depth[id] ?? (depth[id] = incoming[id].length ? 1 + Math.max(...incoming[id].map(depthOf)) : 0);
  flow.nodes.forEach(n => depthOf(n.id));

  const columns = [];
  flow.nodes.forEach(n => (columns[depth[n.id]] ||= []).push(n));

  const canvas = $id("flow");
  columns.forEach(col => {
    const el = document.createElement("div");
    el.className = "flow-col";
    col.forEach(n => el.appendChild(renderNode(n, looks)));
    // A label over a row, e.g. "Looks profiles" over the looks (columnLabels: { <node type>: text }),
    // optionally led by a bold prompt, e.g. "CLICK" (columnLabelNotes: { <node type>: text }).
    const label = (flow.columnLabels || {})[col[0].type];
    const lead = (flow.columnLabelNotes || {})[col[0].type];
    if (label) el.insertAdjacentHTML("beforeend",
      `<div class="col-label">${lead ? `<b class="col-label-click">${esc(lead)}</b>` : ""}${esc(label)}</div>`);
    canvas.appendChild(el);
  });

  // Hover a node to trace everything upstream and downstream of it.
  const reach = (id, map, seen = new Set()) => {
    map[id].forEach(next => { if (!seen.has(next)) { seen.add(next); reach(next, map, seen); } });
    return seen;
  };
  canvas.querySelectorAll(".node").forEach(el => {
    const id = el.dataset.id;
    el.addEventListener("mouseenter", () => {
      const on = new Set([id, ...reach(id, incoming), ...reach(id, outgoing)]);
      canvas.classList.add("tracing");
      canvas.querySelectorAll(".node").forEach(n => n.classList.toggle("lit", on.has(n.dataset.id)));
      canvas.querySelectorAll(".edge").forEach(p => p.classList.toggle("lit", on.has(p.dataset.from) && on.has(p.dataset.to)));
    });
    el.addEventListener("mouseleave", () => canvas.classList.remove("tracing"));
    const look = looks[byId[id].lookId];
    if (look) el.addEventListener("click", () => openDrawer(look));
    // The Published graph expands into a live, animated Firefly Graph walkthrough.
    const graph = byId[id].graph;
    if (graph) {
      el.tabIndex = 0;
      el.classList.add("has-graph");
      el.setAttribute("aria-label", `${byId[id].label}: expand the Firefly graph`);
      el.addEventListener("click", () => openGraph(graph));
    }
    // A node with `detail` (Global rules) expands into a text panel in the same style.
    const detail = byId[id].detail;
    if (detail) {
      el.tabIndex = 0;
      el.classList.add("has-detail");
      el.setAttribute("aria-label", `${byId[id].label}: expand`);
      el.addEventListener("click", () => openDetail(detail));
    }
  });

  // Hover a step in the intro list to spotlight its node(s): an id, or "type:<node type>".
  dom.querySelectorAll(".flow-intro li[data-target]").forEach(li => {
    const t = li.dataset.target;
    const ids = new Set(t.startsWith("type:")
      ? flow.nodes.filter(n => n.type === t.slice(5)).map(n => n.id)
      : [t]);
    li.addEventListener("mouseenter", () => {
      canvas.classList.add("tracing", "stepping");
      canvas.style.setProperty("--spot", getComputedStyle(li).getPropertyValue("--hl").trim() || "currentColor");
      canvas.querySelectorAll(".node").forEach(n => {
        n.classList.toggle("lit", ids.has(n.dataset.id));
        n.classList.toggle("spot", ids.has(n.dataset.id));
      });
      canvas.querySelectorAll(".edge").forEach(p => p.classList.toggle("lit", ids.has(p.dataset.to)));
    });
    li.addEventListener("mouseleave", () => {
      canvas.classList.remove("tracing", "stepping");
      canvas.querySelectorAll(".node.spot").forEach(n => n.classList.remove("spot"));
    });
    // A step pointing at a node with a graph ("Prompt, image applied to Fi.") opens it too.
    const g = byId[t]?.graph;
    if (g) { li.classList.add("has-graph"); li.addEventListener("click", () => openGraph(g)); }
    // ...and one pointing at a node with detail ("Global rules applied.") opens that.
    const dt = byId[t]?.detail;
    if (dt) { li.classList.add("has-graph"); li.addEventListener("click", () => openDetail(dt)); }
  });

  // A link like workflow/#pantone-green opens that look; #published-graph opens the graph,
  // #global-rules the rules.
  const hash = decodeURIComponent(location.hash.slice(1));
  const linked = looks[hash];
  if (linked) openDrawer(linked);
  else if (byId[hash]?.graph) openGraph(byId[hash].graph);
  else if (byId[hash]?.detail) openDetail(byId[hash].detail);

  const draw = () => { fitToPanel(); drawEdges(flow.edges, looks, byId); };
  draw();
  window.addEventListener("resize", draw);
  canvas.querySelectorAll("img").forEach(img => img.addEventListener("load", draw));
  if (document.fonts) document.fonts.ready.then(draw);
}

// Side note beside a node: optional bold label ("CLICK") over the note text.
const noteHtml = n => n.note
  ? `<p class="node-note">${n.noteLabel ? `<span class="node-note-label">${esc(n.noteLabel)}</span>` : ""}${esc(n.note)}</p>`
  : "";

function renderNode(n, looks) {
  const el = document.createElement("div");
  el.className = `node node-${n.type}`;
  el.dataset.id = n.id;
  const look = looks[n.lookId];

  switch (n.type) {
    case "app":
      el.innerHTML = `
        <div class="app-label">${esc(n.label)}</div>
        <div class="win">
          <div class="win-bar">App</div>
          <div class="app-canvas"><span class="upload-btn">${esc(n.action)}</span></div>
        </div>`;
      break;
    case "terminal":
      el.innerHTML = `
        <div class="win">
          <div class="win-bar sans">${esc(n.label)}</div>
          <div class="term-body">
            <div class="term-welcome"><span>✻</span> Welcome to Claude Code</div>
            <ul class="term-steps">${n.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
            <div class="term-prompt">› <span class="cursor"></span></div>
          </div>
        </div>`;
      break;
    case "look":
      el.tabIndex = 0;
      el.style.setProperty("--look", look.headerColor);
      el.innerHTML = `
        <div class="look-title" style="background:${look.headerColor};color:${look.headerInk}">${esc(look.name)}</div>
        <img class="look-collage" src="${ROOT + look.collage}" alt="${esc(look.name)} sample collage" loading="lazy">`;
      break;
    case "prompt":
      el.tabIndex = 0;
      el.style.setProperty("--look", look.headerColor);
      el.innerHTML = `
        <table class="tbl">
          <thead style="background:${look.headerColor};color:${look.headerInk}">
            <tr><th>Prompt</th><th>${esc(look.name)}</th></tr>
          </thead>
          <tbody><tr><td colspan="2">Style prompt</td></tr></tbody>
        </table>`;
      break;
    case "rules":
      el.innerHTML = `
        <table class="tbl tbl-rules">
          <thead><tr><th>${esc(n.label)}</th></tr></thead>
          <tbody>${n.rules.length
            ? n.rules.map(r => `<tr><td>${esc(r)}</td></tr>`).join("")
            : `<tr><td class="muted">Add global rules applied to every style prompt.</td></tr>`}
          </tbody>
        </table>
        ${noteHtml(n)}`;
      break;
    case "publish":
      if (n.logo) {
        el.innerHTML = `
          <div class="node-head">${esc(n.label)}</div>
          <div class="publish-logo-wrap">
            <img class="publish-logo" src="${ROOT + n.logo}" alt="${esc(n.logoAlt || "")}">
            ${n.logoHover ? `<img class="publish-logo publish-logo--hover" src="${ROOT + n.logoHover}" alt="" aria-hidden="true">` : ""}
          </div>
          ${noteHtml(n)}`;
        break;
      }
      el.innerHTML = `
        <div class="node-head">${esc(n.label)}</div>
        <label class="dropzone">
          <input type="file" accept="image/*" hidden>
          <img class="drop-preview" alt="" hidden>
          <span class="drop-hint">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <b>Drop logo</b>
            <span>or <u>browse files</u></span>
          </span>
        </label>`;
      wireDropzone(el);
      break;
    case "post":
      el.innerHTML = `
        <table class="tbl">
          <thead><tr><th>${esc(n.label)}</th></tr></thead>
          <tbody><tr><td>${esc(n.description)}</td></tr></tbody>
        </table>
        ${n.branch ? `
          <span class="branch-line" aria-hidden="true"></span>
          <div class="branch">
            <div class="branch-label">${esc(n.branch.label)}</div>
            <p class="branch-box">${esc(n.branch.text)}</p>
          </div>` : ""}
        ${noteHtml(n)}`;
      break;
    case "outputs": {
      // One column per look (colour-coded), one row per source photo; same square crop in every look.
      const order = Object.values(looks);
      el.style.setProperty("--cols", order.length);
      el.innerHTML = `
        <div class="node-head">${esc(n.label)}</div>
        <div class="out-grid">
          ${order.map(l => `<div class="out-col-head" style="background:${l.headerColor};color:${l.headerInk}">${esc(l.name)}</div>`).join("")}
          ${n.photos.map(ph => order.map(l => `
            <button class="out-cell" style="--look:${l.headerColor}" data-look="${l.id}"
                    data-full="${ROOT + (n.full || n.image).replace("{look}", l.id).replace("{photo}", ph)}"
                    aria-label="Expand ${esc(l.name)} output">
              <img class="out-img" loading="lazy"
                   src="${ROOT + n.image.replace("{look}", l.id).replace("{photo}", ph)}"
                   alt="${esc(l.name)} output">
              <span class="out-expand" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg></span>
            </button>`).join("")).join("")}
        </div>`;
      // Expand mode: click any output to see the full, uncropped frame; arrows step through.
      setTimeout(() => {
        const cells = [...el.querySelectorAll(".out-cell")];
        cells.forEach((c, i) => c.addEventListener("click", e => { e.stopPropagation(); openOutput(cells, i, looks); }));
      });
      break;
    }
    default:
      el.innerHTML = `<div class="node-title">${esc(n.label || n.id)}</div>`;
  }
  return el;
}

// Published-graph logo: drop or browse an image; kept in this browser only (localStorage).
function wireDropzone(el) {
  const KEY = "style-shift-info:published-logo";
  const zone = el.querySelector(".dropzone"), input = zone.querySelector("input");
  const preview = zone.querySelector(".drop-preview"), hint = zone.querySelector(".drop-hint");
  const show = src => { preview.src = src; preview.hidden = false; hint.hidden = true; zone.classList.add("filled"); };
  const read = file => {
    if (!file || !file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => { show(r.result); try { localStorage.setItem(KEY, r.result); } catch {} };
    r.readAsDataURL(file);
  };
  const saved = localStorage.getItem(KEY);
  if (saved) show(saved);
  input.addEventListener("change", () => read(input.files[0]));
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", e => { e.preventDefault(); zone.classList.remove("over"); read(e.dataTransfer.files[0]); });
}

// Embedded: shrink the whole graph (and its intro) so it fits the panel's width.
function fitToPanel() {
  const wf = $id("wf");
  if (!wf) return;
  const canvas = $id("flow");
  wf.style.zoom = "";
  const cs = getComputedStyle(canvas.parentElement);
  const fit = wf.clientWidth / (canvas.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight));
  if (fit < 1) wf.style.zoom = fit.toFixed(4);
}

function drawEdges(edges, looks, byId) {
  const canvas = $id("flow");
  const svg = $id("edges");
  const box = canvas.getBoundingClientRect();
  // Under an ancestor's CSS zoom, rects come back zoomed but the SVG is drawn in the
  // canvas's own px: divide them back out (1 when nothing is zoomed).
  const k = box.width / canvas.offsetWidth || 1;
  svg.setAttribute("width", canvas.scrollWidth);
  svg.setAttribute("height", canvas.scrollHeight);
  const pos = id => {
    const r = canvas.querySelector(`[data-id="${id}"]`).getBoundingClientRect();
    return { x: (r.left - box.left + r.width / 2) / k, t: (r.top - box.top) / k, b: (r.bottom - box.top) / k };
  };
  svg.innerHTML = edges.map(e => {
    const a = pos(e.from), b = pos(e.to);
    // Elbow connector: down to the midpoint, across, down; rounded corners.
    const y1 = a.b, y2 = b.t, ym = (y1 + y2) / 2, dx = b.x - a.x;
    const s = Math.sign(dx), r = Math.min(14, Math.abs(dx) / 2, (y2 - y1) / 2);
    const d = Math.abs(dx) < 1
      ? `M${a.x},${y1} V${y2}`
      : `M${a.x},${y1} V${ym - r} Q${a.x},${ym} ${a.x + s * r},${ym} H${b.x - s * r} Q${b.x},${ym} ${b.x},${ym + r} V${y2}`;
    const tint = looks[byId[e.from].lookId] || looks[byId[e.to].lookId];
    return `<path class="edge" data-from="${e.from}" data-to="${e.to}"
      ${tint ? `style="--edge:${tint.headerColor}"` : ""}
      d="${d}"/>`;
  }).join("");
}

function openDrawer(look) {
  const modal = $id("modal");
  outState = null;
  graphRun++;
  $id("modal-body").classList.remove("modal--output", "modal--graph", "modal--detail");
  $id("modal-body").innerHTML = `
    <header class="modal-head" style="background:${look.headerColor};color:${look.headerInk}">
      <h2>${esc(look.name)}</h2>
      <button class="modal-close" id="modal-close" aria-label="Close" style="color:${look.headerInk}">×</button>
    </header>
    <div class="modal-grid">
      <img class="modal-img" src="${ROOT + look.collage}" alt="${esc(look.name)} sample collage">
      <table class="modal-table">
        <thead><tr><th>Element</th><th>${esc(look.name)}</th></tr></thead>
        <tbody>
          ${Object.entries(look.elements).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${hexes(esc(v))}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${(look.note || LOOK_NOTE) ? `<p class="modal-note">${esc(look.note || LOOK_NOTE)}</p>` : ""}`;
  $id("modal-close").addEventListener("click", closeDrawer);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

// Expanded output: the full frame in a look-coloured viewer; ←/→ (or the buttons) step through.
let outState = null;
function openOutput(cells, i, looks) {
  outState = { cells, i, looks };
  const c = cells[i], look = looks[c.dataset.look];
  const n = cells.length;
  $id("modal-body").innerHTML = `
    <header class="modal-head" style="background:${look.headerColor};color:${look.headerInk}">
      <h2>${esc(look.name)} <span class="out-count">${i + 1} / ${n}</span></h2>
      <button class="modal-close" id="modal-close" aria-label="Close" style="color:${look.headerInk}">×</button>
    </header>
    <div class="out-view">
      <button class="out-nav out-nav--prev" aria-label="Previous output">‹</button>
      <img class="out-full" src="${c.dataset.full}" alt="${esc(look.name)} output, full frame">
      <button class="out-nav out-nav--next" aria-label="Next output">›</button>
    </div>`;
  const body = $id("modal-body");
  graphRun++;
  body.classList.remove("modal--graph", "modal--detail");
  body.classList.add("modal--output");
  $id("modal-close").addEventListener("click", closeDrawer);
  body.querySelector(".out-nav--prev").addEventListener("click", () => stepOutput(-1));
  body.querySelector(".out-nav--next").addEventListener("click", () => stepOutput(1));
  const modal = $id("modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function stepOutput(d) {
  if (!outState) return;
  const { cells, i, looks } = outState;
  openOutput(cells, (i + d + cells.length) % cells.length, looks);
}

// Highlight every hex value in the treatment text.
const hexes = html => html.replace(/#[0-9a-fA-F]{6}\b/g, h => `<span class="hex">${h}</span>`);

// ── Published graph: the Firefly Graph rebuilt as live nodes (no video). The prompt types
// itself into the text node while the photo fades up in the image node, then the connectors draw
// and carry pulses into "generate", which runs and hands off to Output assets and the result.
// Everything is HTML + SVG; the connector paths are measured from the port dots, so the
// layout can change in CSS without touching this code.
let graphRun = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chev = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>`;

function openGraph(g) {
  const run = ++graphRun;
  outState = null;
  const body = $id("modal-body");
  body.classList.remove("modal--output", "modal--detail");
  body.classList.add("modal--graph");
  body.innerHTML = `
    <header class="modal-head gx-head">
      <div class="gx-actions">
        <button class="gx-replay" id="gx-replay" aria-label="Replay the animation">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          Replay
        </button>
        <button class="modal-close" id="modal-close" aria-label="Close">×</button>
      </div>
    </header>
    <div class="gx-fit">
      <div class="gx-stage" id="gx-stage">
        <svg class="gx-wires" id="gx-wires" aria-hidden="true"></svg>

        <section class="gx-node gx-prompt" data-n="prompt">
          <div class="gx-title"><span class="gx-ico">T</span>prompt<span class="gx-chev">${chev}</span></div>
          <div class="gx-port-row gx-right">Text<i class="gx-port gx-green" data-port="prompt-out"></i></div>
          <div class="gx-field-label">Content</div>
          <div class="gx-textarea"><div class="gx-typed" id="gx-typed"></div><span class="gx-caret"></span></div>
        </section>

        <div class="gx-copy">
          <h2 class="gx-heading" id="gx-heading"${g.accent ? ` style="color:${esc(g.accent)}"` : ""}>${esc(g.title || "Published graph")}</h2>
          ${(g.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join("")}
        </div>

        <section class="gx-node gx-photo" data-n="photo">
          <div class="gx-title"><span class="gx-ico"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="M14 11l-3.5-3.5L4 13.5"/></svg></span>photo</div>
          <div class="gx-port-row gx-right">Image<i class="gx-port gx-blue" data-port="photo-out"></i></div>
          <div class="gx-select-row"><span>Import from</span><span class="gx-select">Your device ${chev}</span></div>
          <div class="gx-drop">
            <div class="gx-drop-hint">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="15" height="13" rx="2"/><path d="M3 15l4-4 4 4M14 13l1.5-1.5L18 14"/><circle cx="19" cy="17" r="3.2" fill="#fff"/><path d="M19 15.6v2.8M17.6 17h2.8"/></svg>
              <b>Drag and drop files or folders</b>
              <span>Or, select a folder from your computer</span>
            </div>
            <img class="gx-input" src="${ROOT + g.input}" alt="Reference photo">
          </div>
        </section>

        <section class="gx-node gx-gen" data-n="gen">
          <div class="gx-title"><span class="gx-ico"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="10" height="10" rx="1.5"/><path d="M10 2l.6 1.4L12 4l-1.4.6L10 6l-.6-1.4L8 4l1.4-.6zM13.5 7l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z"/></svg></span>generate<span class="gx-status" id="gx-status"></span><span class="gx-chev">${chev}</span></div>
          <div class="gx-port-row gx-right">Output<i class="gx-port gx-blue" data-port="gen-out"></i></div>
          <div class="gx-sep"></div>
          <div class="gx-port-row gx-left"><i class="gx-port gx-green" data-port="gen-prompt"></i>Prompt *</div>
          <div class="gx-port-row gx-left"><i class="gx-port gx-blue" data-port="gen-ref"></i>Reference images (14)</div>
          <div class="gx-sep"></div>
          <div class="gx-select-row"><span>Aspect ratio</span><span class="gx-select">${esc(g.aspect || "16:9")} ${chev}</span></div>
          <div class="gx-select-row"><span>Model version</span><span class="gx-select">${esc(g.model || "")} ${chev}</span></div>
          <div class="gx-adv">› Advanced</div>
          <div class="gx-progress"><i id="gx-bar"></i></div>
        </section>

        <section class="gx-node gx-assets" data-n="assets">
          <div class="gx-title"><span class="gx-ico"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4.5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.8.8 2.6 2.6 0 0 1-.4 5.2"/><path d="M8 8v6M6 10l2-2 2 2"/></svg></span>Output assets<span class="gx-chev">${chev}</span></div>
          <div class="gx-port-row gx-left"><i class="gx-port gx-blue" data-port="assets-in"></i>Assets *<i class="gx-anchor" data-port="assets-out"></i></div>
          <div class="gx-sep"></div>
          <div class="gx-select-row"><span>Location</span><span class="gx-select">Your files ${chev}</span></div>
        </section>

        <figure class="gx-result" data-n="result">
          <i class="gx-anchor gx-anchor-left" data-port="result-in"></i>
          <img src="${ROOT + g.output}" alt="Restyled output in the selected look">
        </figure>
      </div>
    </div>`;

  $id("modal-close").addEventListener("click", closeDrawer);
  $id("gx-replay").addEventListener("click", () => openGraph(g));
  const modal = $id("modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const stage = $id("gx-stage");
  fitGraph(stage);
  const wires = drawGraphWires(stage);
  const relayout = () => { if (run !== graphRun) return window.removeEventListener("resize", relayout); fitGraph(stage); drawGraphWires(stage, true); };
  window.addEventListener("resize", relayout);
  stage.querySelectorAll("img").forEach(img => img.addEventListener("load", () => drawGraphWires(stage, true)));

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  playGraph(g, stage, wires, run, still);
}

// ── Text panel (Global rules): the Published graph's dark mono style without the graph —
// title, intro copy, then numbered rule cards and an exceptions row, all from the node's
// `detail` in workflow.json.
function openDetail(d) {
  graphRun++;
  outState = null;
  const body = $id("modal-body");
  body.classList.remove("modal--output", "modal--graph");
  body.classList.add("modal--graph", "modal--detail");
  const cards = (items, numbered) => items.map((r, i) => `
    <li class="dx-card">
      ${numbered ? `<span class="dx-num">${String(i + 1).padStart(2, "0")}</span>` : ""}
      <h3>${esc(r.name)}</h3>
      <p>${esc(r.text)}</p>
    </li>`).join("");
  body.innerHTML = `
    <header class="modal-head gx-head">
      <div class="gx-actions"><button class="modal-close" id="modal-close" aria-label="Close">×</button></div>
    </header>
    <div class="dx-body${d.panelClass ? " " + esc(d.panelClass) : ""}">
      <h2 class="gx-heading"${d.accent ? ` style="color:${esc(d.accent)}"` : ""}>${esc(d.title)}</h2>
      <div class="dx-copy">${(d.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join("")}</div>
      <ol class="dx-grid${(d.rules || []).length === 2 ? " dx-grid--2" : ""}">${cards(d.rules || [], true)}</ol>
      ${(d.exceptions || []).length ? `
        <h3 class="dx-sub">${esc(d.exceptionsTitle || "Exceptions")}</h3>
        <ul class="dx-grid dx-grid--2">${cards(d.exceptions, false)}</ul>` : ""}
      ${(d.photos || []).length ? `
        <ul class="dx-photos">${d.photos.map(ph => `
          <li class="dx-photo">
            <h3>${esc(ph.label)}</h3>
            <img src="${ROOT + ph.src}" alt="${esc(ph.label)}" loading="lazy">
          </li>`).join("")}
        </ul>` : ""}
    </div>`;
  $id("modal-close").addEventListener("click", closeDrawer);
  const modal = $id("modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

// Scale the fixed-size stage down to the modal's width (never up).
function fitGraph(stage) {
  stage.style.zoom = "";
  const wrap = stage.parentElement, cs = getComputedStyle(wrap);
  const avail = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);  // content box only
  const fit = avail / stage.offsetWidth;
  if (fit < 1) stage.style.zoom = fit.toFixed(4);
}

// Connectors between port dots, drawn like the main workflow's edges: solid thin lines with
// right-angle elbows and rounded corners (out horizontally, a vertical run, in horizontally).
// Each wire is a faint track, an ink stroke that draws in, and a pulse that keeps travelling
// along it once it's live. `mid` places the vertical run (0 = at the source, 1 = at the
// target); prompt and photo use different values so their runs sit side by side.
const GX_WIRES = [
  { id: "w-prompt", from: "prompt-out", to: "gen-prompt", c: "green", mid: 0.48 },
  { id: "w-photo",  from: "photo-out",  to: "gen-ref",    c: "blue",  mid: 0.26 },
  { id: "w-out",    from: "gen-out",    to: "assets-in",  c: "blue" },
  { id: "w-result", from: "assets-out", to: "result-in",  c: "grey", level: true },
];
function drawGraphWires(stage, keepState) {
  const svg = stage.querySelector("#gx-wires");
  const box = stage.getBoundingClientRect();
  const k = box.width / stage.offsetWidth || 1;
  const pt = name => {
    const r = stage.querySelector(`[data-port="${name}"]`).getBoundingClientRect();
    return { x: (r.left + r.width / 2 - box.left) / k, y: (r.top + r.height / 2 - box.top) / k };
  };
  const state = keepState ? Object.fromEntries([...svg.querySelectorAll(".gx-wire")].map(w => [w.id, w.getAttribute("class")])) : {};
  svg.setAttribute("viewBox", `0 0 ${stage.offsetWidth} ${stage.offsetHeight}`);
  svg.innerHTML = GX_WIRES.map(w => {
    const a = pt(w.from), b = pt(w.to);
    // A near-level pair is drawn dead level (the hand-off into the result image enters
    // its left edge at the Assets row's height; the image is tall enough).
    if (w.level || Math.abs(b.y - a.y) < 6) b.y = a.y;
    const dy = b.y - a.y, s = Math.sign(dy);
    const xm = a.x + (b.x - a.x) * (w.mid ?? 0.5);
    const r = Math.min(14, Math.abs(dy) / 2, (xm - a.x), (b.x - xm));
    const d = dy === 0
      ? `M${a.x},${a.y} H${b.x}`
      : `M${a.x},${a.y} H${xm - r} Q${xm},${a.y} ${xm},${a.y + s * r} V${b.y - s * r} Q${xm},${b.y} ${xm + r},${b.y} H${b.x}`;
    // Pulse: travels the wire every 3.6 s once live, fading in at the source and out at the
    // target. Opacity is SMIL too, so it stays in step with the motion and is 0 until begun.
    return `<g class="${state[w.id] || "gx-wire gx-" + w.c}" id="${w.id}">
      <path class="gx-track" d="${d}"/>
      <path class="gx-ink" d="${d}" pathLength="1"/>
      <circle class="gx-pulse" r="2.25" opacity="0">
        <animateMotion dur="3.6s" begin="indefinite" repeatCount="indefinite" path="${d}" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.25 1"/>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" dur="3.6s" begin="indefinite" repeatCount="indefinite"/>
      </circle>
    </g>`;
  }).join("");
  // After a relayout, restart the pulses on wires that were already live.
  if (keepState) svg.querySelectorAll(".gx-wire.flowing").forEach(startPulse);
  return Object.fromEntries(GX_WIRES.map(w => [w.id, () => svg.querySelector("#" + w.id)]));
}

function startPulse(g) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  g.querySelectorAll("animateMotion, animate").forEach(a => a.beginElement());
}

// Light a wire: draw the stroke in, then keep a pulse travelling along it.
function liveWire(get) {
  const g = get();
  if (!g) return;
  g.classList.add("drawn", "flowing");
  startPulse(g);
}

async function playGraph(g, stage, wires, run, still) {
  const alive = () => run === graphRun;
  const typed = stage.querySelector("#gx-typed");
  const status = stage.querySelector("#gx-status");
  const node = n => stage.querySelector(`[data-n="${n}"]`);
  const text = g.prompt || "";

  if (still) {  // reduced motion: show the finished graph, no movement
    typed.textContent = text;
    stage.classList.add("gx-done", "gx-still");
    ["prompt", "photo", "gen", "assets", "result"].forEach(n => node(n).classList.add("on"));
    Object.values(wires).forEach(get => get()?.classList.add("drawn"));
    status.textContent = "Complete";
    return;
  }

  // 1. The app writes the prompt into the text node.
  await sleep(450); if (!alive()) return;
  node("prompt").classList.add("typing");
  node("photo").classList.add("on");  // the reference photo fades up slowly as the prompt types
  const ta = typed.parentElement;
  const dur = 2600, t0 = performance.now();
  const typing = new Promise(done => {
    const tick = now => {
      if (!alive()) return done();
      const n = Math.min(text.length, Math.ceil(text.length * Math.max(0, now - t0) / dur));
      typed.textContent = text.slice(0, n);
      ta.scrollTop = ta.scrollHeight;
      n < text.length ? requestAnimationFrame(tick) : done();
    };
    requestAnimationFrame(tick);
  });

  // 2. Both inputs start travelling into generate while the prompt is still typing.
  await sleep(500); if (!alive()) return;
  liveWire(wires["w-prompt"]);
  await sleep(300); if (!alive()) return;
  liveWire(wires["w-photo"]);
  await typing; if (!alive()) return;
  node("prompt").classList.remove("typing");
  node("prompt").classList.add("on");
  await sleep(500); if (!alive()) return;  // let the (slower) lines finish drawing in

  // 3. generate runs.
  node("gen").classList.add("running");
  status.textContent = "Generating…";
  await sleep(2300); if (!alive()) return;
  node("gen").classList.remove("running");
  node("gen").classList.add("on");
  status.textContent = "Complete";

  // 4. The result goes to Output assets, then out of the graph to the app.
  liveWire(wires["w-out"]);
  await sleep(1500); if (!alive()) return;
  node("assets").classList.add("on");
  liveWire(wires["w-result"]);
  await sleep(1100); if (!alive()) return;
  node("result").classList.add("ghost");
  await sleep(700); if (!alive()) return;
  node("result").classList.add("on");
  stage.classList.add("gx-done");
}

function closeDrawer() {
  const modal = $id("modal");
  if (!modal.classList.contains("open")) return;
  modal.classList.remove("open");
  outState = null;
  graphRun++;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

window.StyleShiftWorkflow = { mount };
})();
