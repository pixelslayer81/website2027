// Page 09: About. Fills the client ticker and makes the top bar's 01-05 /
// Contact links scroll to their sections (in the stitched site the sections
// live in a shadow root, which a plain #hash link cannot reach); everything
// else is static markup and CSS.
// Exposes window.AboutSketch = { mount(container), unmount() } so the stitched
// site can host it as one section. Classic script (not a module) so the page
// works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

// the ticker's names, in the spec's order, " * " between them
const TICKER = ["Microsoft", "Apple", "AT&T", "Google", "Ford", "BMW", "Amazon", "Los York", "Brand New School", "Mirada", "Prologue", "Stardust"];

let root;
let listeners = [];

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}

// two identical halves, so sliding the track by half loops without a seam
function buildTicker() {
  const track = root.querySelector("#ticker-track");
  if (!track) return;
  const run = TICKER.map((n) => `${n} * `).join("");
  track.textContent = "";
  for (let i = 0; i < 2; i++) {
    const half = document.createElement("span");
    half.textContent = run;
    track.appendChild(half);
  }
}

function mountNav() {
  const doc = root.getRootNode();
  for (const a of root.querySelectorAll('.bar__nav a[href^="#"]')) {
    on(a, "click", (e) => {
      const target = doc.getElementById(a.getAttribute("href").slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" }); // the site's scroll-padding keeps it below the header
    });
  }
}

function mount(container) {
  root = container;
  buildTicker();
  mountNav();
}

function unmount() {
  for (const off of listeners) off();
  listeners = [];
  root = null;
}

window.AboutSketch = { mount, unmount, asset };
})();
