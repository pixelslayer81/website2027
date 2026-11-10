// Light / dark theme for the home (index.html) and the About page only (dark by
// default since 2026-11-10): the
// project pages never load this and stay light. The choice is kept in
// localStorage ("theme") and set as data-theme="dark" on <html>; shared/
// tokens.css (and pages/09-about/style.css) redefine the colour tokens under
// it. Loaded in <head> so the stored theme applies before the first paint; the
// header's #site-theme button toggles it. Fires a "themechange" event on window
// (detail.theme) for sketches that read the tokens once at mount (the flock).
// Classic script, like everything else here.
(function () {
"use strict";

const KEY = "theme";
const root = document.documentElement;
// dark by default (2026-11-10); light only when chosen
let theme = "dark";
try { theme = localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch (err) {}
// ?theme=dark / ?theme=light: a preview override (headless checks); it is kept
const forced = (new URLSearchParams(location.search).get("theme") || "").toLowerCase();
if (forced === "dark" || forced === "light") {
  theme = forced;
  try { localStorage.setItem(KEY, theme); } catch (err) {}
}

function apply(t) {
  theme = t;
  if (t === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  const btn = document.getElementById("site-theme");
  if (!btn) return;
  // the button names the current mode; pressing it switches to the other
  btn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
  btn.title = t === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const label = btn.querySelector(".site-theme__label");
  if (label) label.textContent = t === "dark" ? "Dark mode" : "Light mode";
}

function toggle() {
  const t = theme === "dark" ? "light" : "dark";
  try { localStorage.setItem(KEY, t); } catch (err) {}
  apply(t);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } }));
}

function wire() {
  apply(theme);
  const btn = document.getElementById("site-theme");
  if (btn) btn.addEventListener("click", toggle);
}

apply(theme); // before the body exists: the attribute alone, so the first paint is already themed
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
else wire();

window.SiteTheme = { get: () => theme, toggle };
})();
