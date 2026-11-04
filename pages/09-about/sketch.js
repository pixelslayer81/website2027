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
  track.textContent = "";
  for (let i = 0; i < 2; i++) {
    const half = document.createElement("span");
    for (const n of TICKER) {
      half.append(`${n} `); // non-breaking spaces around each asterisk
      const star = document.createElement("span");
      star.className = "ticker__star"; // red
      star.textContent = "*";
      half.append(star, " ");
    }
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

// Hero photo parallax: as the page scrolls, the picture moves within its frame
// at PARALLAX.rate of the scroll, so it reads slower than the page. The image is
// taller than the frame by PARALLAX.range above and below (style.css), so its
// edge never shows.
const PARALLAX = { rate: 0.25, range: 0.14 }; // range: a fraction of the frame height
let parallaxRaf = 0;

function updateParallax() {
  parallaxRaf = 0;
  const strip = root && root.querySelector(".strip");
  const img = strip && strip.querySelector("img");
  if (!img) return;
  const r = strip.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  if (r.bottom < 0 || r.top > vh) return; // off screen
  // how far the frame's centre is from the window's centre, in px; the picture
  // drifts against that, capped at the extra height it has
  const off = r.top + r.height / 2 - vh / 2;
  const max = r.height * PARALLAX.range;
  const y = Math.max(-max, Math.min(max, -off * PARALLAX.rate));
  img.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
}

function mountParallax() {
  const strip = root.querySelector(".strip");
  if (!strip) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  strip.style.setProperty("--parallax-range", String(PARALLAX.range));
  const queue = () => { if (!parallaxRaf) parallaxRaf = requestAnimationFrame(updateParallax); };
  on(window, "scroll", queue, { passive: true });
  on(window, "resize", queue);
  updateParallax();
}

function mount(container) {
  root = container;
  buildTicker();
  mountNav();
  mountParallax();
}

function unmount() {
  cancelAnimationFrame(parallaxRaf);
  parallaxRaf = 0;
  for (const off of listeners) off();
  listeners = [];
  root = null;
}

window.AboutSketch = { mount, unmount, asset };
})();
